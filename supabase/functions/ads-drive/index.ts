// ads-drive — עורך הפרסומת (studio ?p=ad) ← תיקיית "מודעות עיצובישי" בדרייב.
// מעביר ל-Google Apps Script שרץ בחשבון של הושעיה (tools/drive-ads/Code.gs). סודות: DRIVE_ADS_URL (כתובת ה-Web app), DRIVE_ADS_TOKEN.
// S-190: מנהל בלבד (ADMIN_EMAILS). S-193: גם שותפים — `code` בגוף הבקשה, נבדק מול studio_ai_codes בדיוק כמו ai-image (פעיל ולא פג תוקף).
//   מנהל: הכול. שותף: status · browse · file_get · templates · template_get · list · save · template_save · template_delete/file_delete (רק של עצמו).
//   מי השותף בדרייב = by:'p-<sha256 של הקוד, 24 תווים>' — הקוד עצמו לא נשלח ל-Apps Script ולא נשמר בדרייב. Code.gs אוכף בעלות ומחיקה.
//   שמירות של שותף נכנסות תמיד לשותפים/<label>/ (Code.gs), וה-folderId שלו מתעלמים ממנו בשמירה.
// הגבלה לשותף: עד 30 שמירות (save / template_save begin) ועד 1200 קבצי תבנית בשעה, לפי studio_drive_log
//   (supabase/sql/2026-11-24_ads_drive.sql). אם הטבלה עוד לא קיימת — לא חוסמים (fail-open) ונרשמת אזהרה בלוג.
// ⚠ פריסה עם verify_jwt=false (כמו ai-image): לשותף אין JWT. מנהל מזוהה כאן ב-getUser.
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const MAX_BODY = 31 * 1024 * 1024; // ~30MB: dataUrl של מודעה A4 או של תמונה גדולה בתבנית
const TIMEOUT = 90000;
const SAVES_HOUR = 30, FILES_HOUR = 1200;
const norm = (c: unknown) => String(c || "").trim().toUpperCase().replace(/\s+/g, "");
const PARTNER = new Set(["status", "list", "browse", "file_get", "templates", "template_get", "save", "template_save", "template_delete", "file_delete"]);
const ERR: Record<string, string> = {
  forbidden: "הטוקן לא תואם (DRIVE_ADS_TOKEN)",
  not_found: "הקובץ או התיקייה לא נמצאו (אולי נמחקו)",
  not_owner: "אפשר למחוק או לדרוס רק מה שיצרתם",
  exists: "יש כבר תבנית בשם הזה",
  bad_image: "תמונה לא תקינה",
  bad_json: "קובץ התבנית לא תקין",
  too_big: "הקובץ גדול מדי",
  not_template: "זו לא תיקיית תבנית",
  broken_template: "חסר template.json בתיקיית התבנית",
  bad_folder: "השמירה נקטעה — נסו לשמור שוב",
};

async function sha(s: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("ads-drive:" + s));
  return Array.from(new Uint8Array(d)).map((x) => x.toString(16).padStart(2, "0")).join("").slice(0, 24);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  try {
    const raw = await req.text();
    if (raw.length > MAX_BODY) return json({ error: "הקובץ גדול מדי (עד 30MB)" }, 413);
    let body: any = {};
    try { body = JSON.parse(raw || "{}"); } catch { return json({ error: "בקשה לא תקינה" }, 400); }
    const action = String(body.action || "");
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const code = norm(body.code);

    // ── מי שואל ──
    let admin = false, by = "admin", label = "";
    if (!code) {
      const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
      const { data: { user } } = await db.auth.getUser(jwt).catch(() => ({ data: { user: null } })) as any;
      const admins = (Deno.env.get("ADMIN_EMAILS") || "hoshaya@gmail.com").toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);
      if (!user?.email || !admins.includes(user.email.toLowerCase())) return json({ error: "צריך קוד גישה או כניסת מנהל" }, 401);
      admin = true;
    } else {
      // כמו ai-image: ניסיונות קוד שגוי נספרים ב-studio_ai_log (error='bad_code'); יותר מ-20 ברבע שעה → 429
      const since = new Date(Date.now() - 15 * 60000).toISOString();
      const { count } = await db.from("studio_ai_log").select("id", { count: "exact", head: true }).eq("error", "bad_code").gte("created_at", since);
      if ((count || 0) > 20) return json({ error: "יותר מדי ניסיונות — נסו שוב בעוד רבע שעה" }, 429);
      const { data: c } = await db.from("studio_ai_codes").select("code,label,active,expires_at").eq("code", code).maybeSingle();
      if (!c) { await db.from("studio_ai_log").insert({ who: code.slice(0, 40), ok: false, error: "bad_code" }); return json({ error: "הקוד לא נמצא" }, 403); }
      if (!c.active) return json({ error: "הקוד הושבת" }, 403);
      if (c.expires_at && new Date(c.expires_at) < new Date()) return json({ error: "תוקף הקוד הסתיים" }, 403);
      if (!PARTNER.has(action)) return json({ error: "מנהל בלבד" }, 403);
      by = "p-" + await sha(code);
      label = String(c.label || "").trim() || "שותף " + code.slice(0, 3);
    }

    const url = Deno.env.get("DRIVE_ADS_URL")?.trim(), token = Deno.env.get("DRIVE_ADS_TOKEN")?.trim();
    if (action === "status") return json({ configured: !!(url && token), admin, label: admin ? "" : label });
    if (!url || !token) return json({ error: "החיבור לדרייב עוד לא הוגדר", configured: false }, 503);

    // ── בדיקות קלט ──
    const isImg = (s: unknown, types = "png|jpeg|webp") => typeof s === "string" && new RegExp(`^data:image\\/(${types});base64,`).test(s);
    const id = (v: unknown) => (typeof v === "string" && /^[\w-]{10,100}$/.test(v) ? v : undefined);
    let payload: Record<string, unknown>;
    const base = { token, action, admin, by, label };
    if (action === "save") {
      if (!isImg(body.dataUrl, "png|jpeg")) return json({ error: "תמונה לא תקינה" }, 400);
      payload = { ...base, dataUrl: body.dataUrl, name: String(body.name ?? "מודעה").slice(0, 120), note: String(body.note ?? "").slice(0, 400), folderId: admin ? id(body.folderId) : undefined };
    } else if (action === "list" || action === "templates") {
      payload = base;
    } else if (action === "browse") {
      payload = { ...base, folderId: id(body.folderId), pageToken: typeof body.pageToken === "string" ? body.pageToken.slice(0, 4000) : undefined };
    } else if (action === "file_get" || action === "template_get" || action === "template_delete" || action === "file_delete") {
      if (!id(body.id)) return json({ error: "חסר מזהה" }, 400);
      payload = { ...base, id: body.id };
    } else if (action === "template_save") {
      const step = String(body.step || "");
      if (step === "begin") payload = { ...base, step, title: String(body.title || "תבנית").slice(0, 80), overwrite: body.overwrite === true, folderId: admin ? id(body.folderId) : undefined };
      else if (step === "file") {
        if (!isImg(body.dataUrl) || !id(body.folderId)) return json({ error: "תמונה לא תקינה" }, 400);
        payload = { ...base, step, folderId: body.folderId, name: String(body.name || "img").slice(0, 100), dataUrl: body.dataUrl };
      } else if (step === "finish") {
        if (!id(body.folderId) || body.json == null) return json({ error: "חסר קובץ התבנית" }, 400);
        const j = typeof body.json === "string" ? body.json : JSON.stringify(body.json);
        if (j.length > 2_000_000) return json({ error: "קובץ התבנית גדול מדי" }, 400);
        payload = { ...base, step, folderId: body.folderId, json: j, preview: isImg(body.preview, "png|jpeg") ? body.preview : undefined, overwrite: body.overwrite === true };
      } else return json({ error: "שלב לא מוכר" }, 400);
    } else return json({ error: "פעולה לא מוכרת" }, 400);

    // ── הגבלת קצב לשותף (שמירות) ──
    const kind = action === "save" || (action === "template_save" && body.step === "begin") ? "save" : (action === "template_save" ? "file" : "");
    if (!admin && kind) {
      const since = new Date(Date.now() - 3600000).toISOString();
      const { count, error } = await db.from("studio_drive_log").select("id", { count: "exact", head: true }).eq("who", by).eq("kind", kind).gte("created_at", since);
      if (error) console.warn("studio_drive_log", error.message); // הטבלה עוד לא קיימת — לא חוסמים
      else if ((count || 0) >= (kind === "save" ? SAVES_HOUR : FILES_HOUR)) return json({ error: "הגעתם למגבלת השמירות לשעה — נסו שוב מאוחר יותר" }, 429);
    }

    // Apps Script עונה ב-302 לכתובת googleusercontent; fetch עוקב לבד (GET) ומחזיר את התשובה.
    const r = await fetch(url, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload), redirect: "follow", signal: AbortSignal.timeout(TIMEOUT),
    });
    const d = await r.json().catch(() => null);
    if (!d) return json({ error: `הדרייב לא ענה כמו שצריך (${r.status})` }, 502);
    if (!admin && kind) {
      const { error } = await db.from("studio_drive_log").insert({ who: by, kind, action, ok: !!d.ok, bytes: raw.length });
      if (error) console.warn("studio_drive_log insert", error.message);
    }
    if (!d.ok) {
      const st = d.error === "not_owner" ? 403 : d.error === "not_found" ? 404 : d.error === "exists" ? 409 : 502;
      return json({ ...d, error: ERR[d.error] || d.error || "שגיאה בדרייב", reason: d.error }, st);
    }
    return json(d);
  } catch (e) {
    const m = String((e as Error)?.message || e);
    if ((e as Error)?.name === "TimeoutError" || /timed? ?out|aborted/i.test(m)) return json({ error: "הדרייב לא ענה בזמן — נסו שוב" }, 504);
    return json({ error: m }, 500);
  }
});
