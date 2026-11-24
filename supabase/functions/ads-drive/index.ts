// ads-drive — עורך הפרסומת (studio ?p=ad) ← תיקיית "מודעות עיצובישי" בדרייב.
// מנהל בלבד (ADMIN_EMAILS, כמו site-gallery). מעביר ל-Google Apps Script שרץ בחשבון של הושעיה
// (tools/drive-ads/Code.gs). סודות: DRIVE_ADS_URL (כתובת ה-Web app), DRIVE_ADS_TOKEN.
// פעולות: status · save {name, dataUrl, note} · list
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const MAX_BYTES = 20 * 1024 * 1024; // dataUrl של מודעה גדולה (PNG) — עד ~15MB בפועל

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  try {
    const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const { data: { user } } = await admin.auth.getUser(jwt).catch(() => ({ data: { user: null } }));
    const admins = (Deno.env.get("ADMIN_EMAILS") || "hoshaya@gmail.com").toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);
    if (!user?.email || !admins.includes(user.email.toLowerCase())) return json({ error: "רק למנהל" }, 403);

    const url = Deno.env.get("DRIVE_ADS_URL")?.trim(), token = Deno.env.get("DRIVE_ADS_TOKEN")?.trim();
    const body = await req.json().catch(() => ({}));
    if (body.action === "status") return json({ configured: !!(url && token) });
    if (!url || !token) return json({ error: "החיבור לדרייב עוד לא הוגדר (DRIVE_ADS_URL / DRIVE_ADS_TOKEN)" }, 503);

    let payload: Record<string, unknown>;
    if (body.action === "save") {
      const dataUrl = String(body.dataUrl ?? "");
      if (!/^data:image\/(png|jpeg);base64,/.test(dataUrl)) return json({ error: "תמונה לא תקינה" }, 400);
      if (dataUrl.length > MAX_BYTES) return json({ error: "התמונה גדולה מדי" }, 400);
      payload = { action: "save", token, dataUrl, name: String(body.name ?? "מודעה").slice(0, 120), note: String(body.note ?? "").slice(0, 500) };
    } else if (body.action === "list") {
      payload = { action: "list", token };
    } else return json({ error: "פעולה לא מוכרת" }, 400);

    // Apps Script עונה ב-302 לכתובת googleusercontent; fetch עוקב לבד (GET) ומחזיר את התשובה.
    const r = await fetch(url, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload), redirect: "follow", signal: AbortSignal.timeout(60000),
    });
    const d = await r.json().catch(() => null);
    if (!d) return json({ error: `הדרייב לא ענה כמו שצריך (${r.status})` }, 502);
    if (!d.ok) return json({ error: d.error === "forbidden" ? "הטוקן לא תואם (DRIVE_ADS_TOKEN)" : (d.error || "שגיאה בדרייב") }, 502);
    return json(d);
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
