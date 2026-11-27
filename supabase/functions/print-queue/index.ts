// print-queue — שרשרת ההדפסה (S-209). הסוכן במחשב ההדפסה (tools/print-agent, Windows) שואל כל ~20 שנ׳ אם יש עבודה.
// ⚠ verify_jwt=false: הסוכן מזדהה בכותרת x-print-token (טוקן אקראי; בטבלה print_agents רק sha256 שלו). המנהל מנהל את התור ישירות מהסטודיו (RLS).
//   poll   {info:{printers,host,ver}} → {hold:'shabbat'} בשבת · אחרת עבודה אחת (print_claim) + קישור הורדה חתום לשעה + dry_run + printer
//   report {id, status:'printed'|'downloaded'|'failed', error?} → מעדכן את העבודה; הודפס = ההזמנה מסומנת הודפסה (status done, printed)
// 🕯️ שבת: מ-40 דק׳ לפני השקיעה ביום שישי עד 40 דק׳ אחרי השקיעה במוצ"ש (שקיעה מחושבת לבקעת הירדן). חגים — עדיין לא.
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-print-token", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const LAT = 31.87, LON = 35.45; // בקעת הירדן

async function sha(s: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("print-agent:" + s));
  return Array.from(new Uint8Array(d)).map((x) => x.toString(16).padStart(2, "0")).join("");
}
// שקיעה (NOAA, דיוק של כדקה) — מחזיר Date ב-UTC לתאריך הנתון (y,m,d)
export function sunset(y: number, m: number, d: number): Date {
  const rad = Math.PI / 180, N = Math.floor(275 * m / 9) - Math.floor((m + 9) / 12) * (1 + Math.floor((y - 4 * Math.floor(y / 4) + 2) / 3)) + d - 30;
  const lngH = LON / 15, t = N + ((18 - lngH) / 24), M = (0.9856 * t) - 3.289;
  let L = M + (1.916 * Math.sin(M * rad)) + (0.020 * Math.sin(2 * M * rad)) + 282.634; L = (L + 360) % 360;
  let RA = Math.atan(0.91764 * Math.tan(L * rad)) / rad; RA = (RA + 360) % 360;
  RA = (RA + (Math.floor(L / 90) * 90 - Math.floor(RA / 90) * 90)) / 15;
  const sinDec = 0.39782 * Math.sin(L * rad), cosDec = Math.cos(Math.asin(sinDec));
  const cosH = (Math.cos(90.833 * rad) - (sinDec * Math.sin(LAT * rad))) / (cosDec * Math.cos(LAT * rad));
  const H = Math.acos(cosH) / rad / 15, T = H + RA - (0.06571 * t) - 6.622, UT = ((T - lngH) % 24 + 24) % 24;
  return new Date(Date.UTC(y, m - 1, d) + UT * 3600e3);
}
export function shabbat(now = new Date()): { hold: boolean; until?: string } {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Jerusalem", weekday: "short", year: "numeric", month: "numeric", day: "numeric" }).formatToParts(now).map((x) => [x.type, x.value]));
  const y = +p.year, m = +p.month, d = +p.day;
  if (p.weekday === "Fri") { const s = sunset(y, m, d); if (now.getTime() >= s.getTime() - 40 * 60e3) { const e = new Date(Date.UTC(y, m - 1, d + 1)); const ss = sunset(e.getUTCFullYear(), e.getUTCMonth() + 1, e.getUTCDate()); return { hold: true, until: new Date(ss.getTime() + 40 * 60e3).toISOString() }; } }
  if (p.weekday === "Sat") { const s = sunset(y, m, d), end = s.getTime() + 40 * 60e3; if (now.getTime() < end) return { hold: true, until: new Date(end).toISOString() }; }
  return { hold: false };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  try {
    const tok = (req.headers.get("x-print-token") || "").trim();
    if (!/^[A-Za-z0-9_-]{24,100}$/.test(tok)) return json({ error: "no_token" }, 401);
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const { data: ag } = await db.from("print_agents").select("id,active,dry_run,printer,printers").eq("token_hash", await sha(tok)).maybeSingle();
    if (!ag || !ag.active) return json({ error: "bad_token" }, 403);
    let body: any = {};
    try { body = JSON.parse((await req.text()) || "{}"); } catch { return json({ error: "bad_json" }, 400); }
    const action = String(body.action || "");

    if (action === "poll") {
      const info = body.info && typeof body.info === "object" ? body.info : {};
      const printers = Array.isArray(info.printers) ? info.printers.map((x: unknown) => String(x).slice(0, 120)).slice(0, 40) : [];
      await db.from("print_agents").update({ last_seen: new Date().toISOString(), info: { printers, host: String(info.host || "").slice(0, 60), ver: String(info.ver || "").slice(0, 20) } }).eq("id", ag.id);
      const sh = shabbat();
      if (sh.hold) return json({ hold: "shabbat", until: sh.until });
      const { data: jobs, error } = await db.rpc("print_claim", { p_agent: ag.id });
      if (error) throw new Error(error.message);
      const job = (jobs || [])[0];
      if (!job) return json({ job: null, dry_run: ag.dry_run });
      // מדפסת לפי החומר של העבודה (פרופיל ומראה שונים בדרייבר), אחרת מדפסת ברירת המחדל של המחשב
      const printer = ((ag.printers || {}) as Record<string, string>)[job.material] || ag.printer || "";
      if (!ag.dry_run && !printer) { await db.from("print_jobs").update({ status: "failed", error: "לא נבחרה מדפסת לחומר: " + job.material }).eq("id", job.id); return json({ job: null, dry_run: ag.dry_run }); }
      const path = job.order_id ? `${job.order_id}/${job.file}` : job.file;
      const { data: s, error: se } = await db.storage.from("studio-orders").createSignedUrl(path, 3600);
      if (se || !s) { await db.from("print_jobs").update({ status: "failed", error: "הקובץ לא נמצא: " + path }).eq("id", job.id); return json({ job: null, dry_run: ag.dry_run }); }
      return json({ job: { id: job.id, code: job.code || "", file: job.file.split("/").pop(), copies: job.copies, material: job.material }, url: s.signedUrl, dry_run: ag.dry_run, printer });
    }

    if (action === "report") {
      const id = String(body.id || ""), st = String(body.status || "");
      if (!/^[0-9a-f-]{36}$/i.test(id) || !["printed", "downloaded", "failed"].includes(st)) return json({ error: "bad_report" }, 400);
      const { data: job } = await db.from("print_jobs").select("id,order_id,order_ids,agent_id").eq("id", id).maybeSingle();
      if (!job || job.agent_id !== ag.id) return json({ error: "not_yours" }, 403);
      await db.from("print_jobs").update({ status: st, error: st === "failed" ? String(body.error || "שגיאה").slice(0, 500) : null, done_at: new Date().toISOString() }).eq("id", id);
      const ids = [job.order_id, ...(job.order_ids || [])].filter(Boolean);
      if (st === "printed" && ids.length) await db.from("studio_orders").update({ status: "done", printed: true }).in("id", ids); // גליל = כמה הזמנות
      return json({ ok: true });
    }
    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    console.error("print-queue", String((e as Error)?.message || e));
    return json({ error: "server_error" }, 500);
  }
});
