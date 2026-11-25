// design-library — ספריית העיצובים של עיצובישי (library/index.html, W-75). SQL: supabase/sql/2026-11-25_design_library.sql
// ⚠ פריסה עם verify_jwt=false: חברים בלי חשבון צופים, מדרגים ומעלים. ההרשאה נבדקת כאן:
//   • list / rate — ציבורי, בלי קוד. רק עיצובים מאושרים.
//   • upload — קוד שותף משותף (נשמר בטבלה רק כ-sha256 של 'dl:'+UPPER(code)), או JWT של מנהל (ייבוא בלי הגבלת קצב).
//   • admin_* — JWT של משתמש ב-ADMIN_EMAILS (ברירת מחדל hoshaya@gmail.com), כמו ads-drive / site-gallery.
// כל העלאה נכנסת כ-pending ומופיעה רק אחרי אישור. כפילות (אותו sha256 של הקובץ) מסומנת ב-duplicate_of — לא נחסמת.
// הגבלות: 30 העלאות לשעה לכל קוד · 300 ביום לכולם · 60 דירוגים לשעה למצביע · 20 קודים שגויים לרבע שעה לכתובת IP.
//   אם design_library_log עוד לא קיימת — לא חוסמים (fail-open) ונרשמת אזהרה בלוג.
// הלוגיקה מיוצאת (handle + עזרים) כדי שאפשר לבדוק אותה ב-node עם לקוח Supabase מזויף: tools/library-import/test-function.mjs
import { createClient } from "jsr:@supabase/supabase-js@2";

export const BUCKET = "design-library";
export const CATS = ["כוסות", "מזוזות", "תמונות", "מחזיקי מפתחות", "אחר"];
export const LIMITS = { uploadsPerCodeHour: 30, uploadsPerDay: 300, ratesPerHour: 60, badCodes15m: 20 };
export const MAX_IMAGE = 10 * 1024 * 1024;
const MAX_BODY = 29 * 1024 * 1024; // שתי תמונות של 10MB ב-base64 (+33%)
const SIGN_TTL = 3600;
const T = "design_library", LOG = "design_library_log", CODES = "design_library_codes", RATINGS = "design_ratings";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PUBLIC_COLS = "id,created_at,title,category,contributor,rating_avg,rating_count,width,height,asset_path";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// ── עזרים (מיוצאים לבדיקות) ──
export const norm = (c: unknown) => String(c ?? "").trim().toUpperCase().replace(/\s+/g, "");
export async function sha256hex(data: string | Uint8Array): Promise<string> {
  const buf = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const d = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(d)).map((x) => x.toString(16).padStart(2, "0")).join("");
}
export const codeHash = (code: unknown) => sha256hex("dl:" + norm(code));
export function cleanText(s: unknown, max: number): string {
  // eslint-disable-next-line no-control-regex
  return String(s ?? "").replace(/[\u0000-\u001f\u007f‎‏‪-‮]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}
export function sniff(b: Uint8Array): "png" | "jpeg" | "webp" | null {
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return "png";
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b.length > 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "webp";
  return null;
}
// מידות מהכותרת של הקובץ (בלי לפענח את התמונה). null אם לא הצלחנו — לא חוסם.
export function dims(b: Uint8Array, kind: string): { w: number; h: number } | null {
  try {
    const u32 = (i: number) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
    if (kind === "png") return { w: u32(16), h: u32(20) };
    if (kind === "jpeg") {
      let i = 2;
      while (i + 9 < b.length) {
        if (b[i] !== 0xff) { i++; continue; }
        const m = b[i + 1];
        if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7) || m === 0xff) { i += m === 0xff ? 1 : 2; continue; }
        const len = (b[i + 2] << 8) | b[i + 3];
        if ((m >= 0xc0 && m <= 0xcf) && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { h: (b[i + 5] << 8) | b[i + 6], w: (b[i + 7] << 8) | b[i + 8] };
        i += 2 + len;
      }
      return null;
    }
    if (kind === "webp") {
      const tag = String.fromCharCode(b[12], b[13], b[14], b[15]);
      if (tag === "VP8X") return { w: 1 + (b[24] | (b[25] << 8) | (b[26] << 16)), h: 1 + (b[27] | (b[28] << 8) | (b[29] << 16)) };
      if (tag === "VP8L") { const v = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24); return { w: 1 + (v & 0x3fff), h: 1 + ((v >>> 14) & 0x3fff) }; }
      if (tag === "VP8 ") return { w: (b[26] | (b[27] << 8)) & 0x3fff, h: (b[28] | (b[29] << 8)) & 0x3fff };
    }
  } catch { /* לא חוסם */ }
  return null;
}
// dataUrl → בייטים, אחרי בדיקת סוג (מוצהר + magic bytes) וגודל
export function parseImage(s: unknown, allowed: string[]): { kind: string; bytes: Uint8Array } | { error: string } {
  const m = typeof s === "string" ? /^data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=\s]+)$/.exec(s) : null;
  if (!m) return { error: "אפשר לשלוח רק תמונה מסוג JPG, PNG או WEBP" };
  const declared = m[1] === "jpg" ? "jpeg" : m[1];
  const b64 = m[2].replace(/\s+/g, "");
  if (Math.floor(b64.length * 3 / 4) > MAX_IMAGE + 2) return { error: "התמונה גדולה מדי (עד 10MB). נסו צילום מסך שלה" };
  let bin: string;
  try { bin = atob(b64); } catch { return { error: "התמונה לא נפתחה. נסו תמונה אחרת" }; }
  if (bin.length > MAX_IMAGE) return { error: "התמונה גדולה מדי (עד 10MB). נסו צילום מסך שלה" };
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const kind = sniff(bytes);
  if (!kind || kind !== declared || !allowed.includes(kind)) return { error: "הקובץ הזה לא נראה כמו תמונה תקינה. נסו תמונה אחרת" };
  return { kind, bytes };
}
export function clientIp(req: Request): string {
  const h = req.headers;
  return (h.get("cf-connecting-ip") || h.get("x-real-ip") || (h.get("x-forwarded-for") || "").split(",")[0] || "").trim() || "0";
}
const EXT: Record<string, string> = { png: "png", jpeg: "jpg", webp: "webp" };
const MIME: Record<string, string> = { png: "image/png", jpeg: "image/jpeg", webp: "image/webp" };

function withTimeout<X>(p: Promise<X>, ms: number): Promise<X> {
  let t: ReturnType<typeof setTimeout>;
  return Promise.race([
    Promise.resolve(p).finally(() => clearTimeout(t)),
    new Promise<X>((_, no) => { t = setTimeout(() => { const e = new Error("timeout"); e.name = "TimeoutError"; no(e); }, ms); }),
  ]);
}

// ── יומן והגבלת קצב (fail-open כשהטבלה חסרה) ──
async function countLog(db: any, action: string, who: string | null, sinceMs: number): Promise<number | null> {
  let q = db.from(LOG).select("id", { count: "exact", head: true }).eq("action", action).gte("created_at", new Date(Date.now() - sinceMs).toISOString());
  if (who) q = q.eq("who_hash", who);
  const { count, error } = await q;
  if (error) { console.warn(LOG, error.message); return null; }
  return count || 0;
}
async function writeLog(db: any, who: string, action: string, ok = true) {
  const { error } = await db.from(LOG).insert({ who_hash: who, action, ok });
  if (error) console.warn(LOG + " insert", error.message);
}

// ── קישורים חתומים: תמונה קטנה (600px, שינוי גודל של Supabase) + מלאה. אם השינוי לא זמין — הקטנה = המלאה ──
async function sign(db: any, rows: any[], withCut = false) {
  const st = db.storage.from(BUCKET);
  const paths = rows.map((r) => r.asset_path).filter(Boolean);
  const full: Record<string, string> = {};
  if (paths.length) {
    const { data } = await withTimeout(st.createSignedUrls(paths, SIGN_TTL), 15000) as any;
    for (const x of data || []) if (x?.signedUrl && x.path) full[x.path] = x.signedUrl;
  }
  return Promise.all(rows.map(async (r) => {
    let thumb = "", cut = "";
    try {
      const { data } = await withTimeout(st.createSignedUrl(r.asset_path, SIGN_TTL, { transform: { width: 600, resize: "contain", quality: 75 } }), 10000) as any;
      thumb = data?.signedUrl || "";
    } catch { /* לא זמין — הקטנה = המלאה */ }
    if (withCut && r.asset_cut_path) {
      try { const { data } = await withTimeout(st.createSignedUrl(r.asset_cut_path, SIGN_TTL), 10000) as any; cut = data?.signedUrl || ""; } catch { /* */ }
    }
    const url = full[r.asset_path] || thumb;
    return { ...r, url, thumb: thumb || url, cut };
  }));
}
const pub = (r: any) => ({
  id: r.id, created_at: r.created_at, title: r.title || "", category: r.category, contributor: r.contributor || "",
  rating_avg: Number(r.rating_avg) || 0, rating_count: r.rating_count || 0, width: r.width || null, height: r.height || null,
  url: r.url, thumb: r.thumb,
});

async function isAdmin(db: any, req: Request, env: (k: string) => string | undefined): Promise<boolean> {
  const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!jwt || jwt.split(".").length !== 3) return false;
  const res = await db.auth.getUser(jwt).catch(() => null);
  const email = res?.data?.user?.email;
  const admins = (env("ADMIN_EMAILS") || "hoshaya@gmail.com").toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);
  return !!email && admins.includes(String(email).toLowerCase());
}

// ════════════════════════════════════════════════════════════════════
export async function handle(req: Request, db: any, env: (k: string) => string | undefined): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  try {
    const raw = await req.text();
    if (raw.length > MAX_BODY) return json({ error: "הקבצים גדולים מדי (עד 10MB לתמונה)" }, 413);
    let body: any = {};
    try { body = JSON.parse(raw || "{}"); } catch { return json({ error: "בקשה לא תקינה" }, 400); }
    const action = String(body.action || "");
    const ip = clientIp(req);

    // ── list: עיצובים מאושרים ──
    if (action === "list") {
      const size = Math.min(48, Math.max(1, parseInt(body.size) || 24));
      const page = Math.max(0, parseInt(body.page) || 0);
      if (body.id != null) {
        if (!UUID_RE.test(String(body.id))) return json({ error: "חסר מזהה" }, 400);
        const { data, error } = await db.from(T).select(PUBLIC_COLS).eq("id", body.id).eq("status", "approved").maybeSingle();
        if (error) throw new Error(error.message);
        if (!data) return json({ items: [], more: false });
        return json({ items: (await sign(db, [data])).map(pub), more: false });
      }
      let q = db.from(T).select(PUBLIC_COLS).eq("status", "approved");
      if (body.category && CATS.includes(body.category)) q = q.eq("category", body.category);
      q = body.sort === "top"
        ? q.order("rating_avg", { ascending: false }).order("rating_count", { ascending: false }).order("created_at", { ascending: false })
        : q.order("created_at", { ascending: false });
      const { data, error } = await q.range(page * size, page * size + size); // size+1 שורות — כדי לדעת אם יש עוד
      if (error) throw new Error(error.message);
      const rows = (data || []) as any[];
      const out: any = { items: (await sign(db, rows.slice(0, size))).map(pub), more: rows.length > size };
      if (page === 0) {
        const { data: cs } = await db.from(T).select("category").eq("status", "approved").limit(5000);
        const cats: Record<string, number> = {};
        for (const c of cs || []) cats[c.category] = (cats[c.category] || 0) + 1;
        out.cats = cats;
      }
      return json(out);
    }

    // ── rate: כוכבים (ציבורי) ──
    if (action === "rate") {
      const id = String(body.id || ""), stars = Number(body.stars), device = String(body.device || "");
      if (!UUID_RE.test(id)) return json({ error: "חסר מזהה" }, 400);
      if (!Number.isInteger(stars) || stars < 1 || stars > 5) return json({ error: "בחרו בין כוכב אחד לחמישה" }, 400);
      if (!/^[A-Za-z0-9_-]{8,64}$/.test(device)) return json({ error: "בקשה לא תקינה" }, 400);
      const voter = await sha256hex("dlv:" + ip + "|" + device);
      const n = await countLog(db, "rate", voter, 3600e3);
      if (n !== null && n >= LIMITS.ratesPerHour) return json({ error: "דירגתם הרבה בשעה האחרונה — נסו שוב מאוחר יותר" }, 429);
      const { data: row } = await db.from(T).select("id,status").eq("id", id).maybeSingle();
      if (!row || row.status !== "approved") return json({ error: "העיצוב לא נמצא" }, 404);
      const now = new Date().toISOString();
      const { error } = await db.from(RATINGS).upsert({ design_id: id, voter_hash: voter, stars, updated_at: now }, { onConflict: "design_id,voter_hash" });
      if (error) throw new Error(error.message);
      await writeLog(db, voter, "rate");
      const { data: r2 } = await db.from(T).select("rating_avg,rating_count").eq("id", id).maybeSingle();
      return json({ ok: true, stars, rating_avg: Number(r2?.rating_avg) || 0, rating_count: r2?.rating_count || 0 });
    }

    // ── upload: קוד שותף (או מנהל) → pending ──
    if (action === "upload") {
      let who = "admin", contributorHash = "admin";
      const code = norm(body.code);
      if (!code) {
        if (!(await isAdmin(db, req, env))) return json({ error: "חסר קוד שותף", reason: "no_code" }, 401);
      } else {
        const ipHash = await sha256hex("dli:" + ip);
        const bad = await countLog(db, "bad_code", ipHash, 15 * 60e3);
        if (bad !== null && bad > LIMITS.badCodes15m) return json({ error: "יותר מדי ניסיונות — נסו שוב בעוד רבע שעה" }, 429);
        const h = await codeHash(code);
        const { data: c, error: ce } = await db.from(CODES).select("code_hash,active").eq("code_hash", h).maybeSingle();
        if (ce) { console.error(CODES, ce.message); return json({ error: "הספרייה עוד לא מוכנה לקבל עיצובים — נסו מחר" }, 503); }
        if (!c || !c.active) { await writeLog(db, ipHash, "bad_code", false); return json({ error: "הקוד לא נכון. בדקו את הקוד שקיבלתם מהושעיה", reason: "bad_code" }, 403); }
        who = h; contributorHash = h.slice(0, 16);
        const n = await countLog(db, "upload", who, 3600e3);
        if (n !== null && n >= LIMITS.uploadsPerCodeHour) return json({ error: "הגעתם למגבלת ההעלאות לשעה — נסו שוב מאוחר יותר" }, 429);
        const g = await countLog(db, "upload", null, 24 * 3600e3);
        if (g !== null && g >= LIMITS.uploadsPerDay) return json({ error: "הספרייה קיבלה היום הרבה עיצובים — נסו שוב מחר" }, 429);
      }
      const title = cleanText(body.title, 80) || "עיצוב חדש";
      const category = CATS.includes(body.category) ? body.category : "אחר";
      const contributor = cleanText(body.contributor, 40) || null;
      const img = parseImage(body.image, ["png", "jpeg", "webp"]);
      if ("error" in img) return json({ error: img.error }, 400);
      let cut: { kind: string; bytes: Uint8Array } | null = null;
      if (body.cut) {
        const c = parseImage(body.cut, ["png", "webp"]);
        if ("error" in c) return json({ error: "החיתוך: " + c.error }, 400);
        cut = c;
      }
      const fileSha = await sha256hex(img.bytes);
      const { data: dup } = await db.from(T).select("id").eq("file_sha256", fileSha).neq("status", "rejected").order("created_at", { ascending: true }).limit(1).maybeSingle();
      const id = crypto.randomUUID();
      const path = `pending/${id}.${EXT[img.kind]}`, cutPath = cut ? `pending/${id}-cut.${EXT[cut.kind]}` : null;
      const st = db.storage.from(BUCKET);
      const up = await withTimeout(st.upload(path, img.bytes, { contentType: MIME[img.kind], upsert: false }), 30000) as any;
      if (up?.error) throw new Error("upload: " + up.error.message);
      if (cut && cutPath) {
        const u2 = await withTimeout(st.upload(cutPath, cut.bytes, { contentType: MIME[cut.kind], upsert: false }), 30000) as any;
        if (u2?.error) { await st.remove([path]); throw new Error("upload cut: " + u2.error.message); }
      }
      const d = dims(img.bytes, img.kind);
      const { error: ie } = await db.from(T).insert({
        id, title, category, contributor, contributor_hash: contributorHash, status: "pending", asset_path: path, asset_cut_path: cutPath,
        file_sha256: fileSha, duplicate_of: dup?.id || null, width: d?.w || null, height: d?.h || null,
      });
      if (ie) { await st.remove([path, cutPath].filter(Boolean)); throw new Error(ie.message); }
      if (who !== "admin") await writeLog(db, who, "upload");
      return json({ ok: true, id, duplicate: !!dup });
    }

    // ── פעולות מנהל ──
    if (!action.startsWith("admin_")) return json({ error: "פעולה לא מוכרת" }, 400);
    if (!(await isAdmin(db, req, env))) return json({ error: "מנהל בלבד — היכנסו עם המייל של הושעיה" }, 401);

    if (action === "admin_list") {
      const status = ["pending", "approved", "rejected"].includes(body.status) ? body.status : "pending";
      const size = Math.min(60, Math.max(1, parseInt(body.size) || 30)), page = Math.max(0, parseInt(body.page) || 0);
      const { data, error } = await db.from(T).select("*").eq("status", status).order("created_at", { ascending: status === "pending" }).range(page * size, page * size + size);
      if (error) throw new Error(error.message);
      const rows = (data || []) as any[];
      const items = await sign(db, rows.slice(0, size), true);
      const dupIds = [...new Set(items.map((r) => r.duplicate_of).filter(Boolean))];
      const dups: Record<string, any> = {};
      if (dupIds.length) {
        const { data: dr } = await db.from(T).select("id,title,status,asset_path,created_at").in("id", dupIds);
        for (const r of await sign(db, dr || [])) dups[r.id] = { id: r.id, title: r.title, status: r.status, thumb: r.thumb, url: r.url, created_at: r.created_at };
      }
      const counts: Record<string, number> = {};
      for (const s of ["pending", "approved", "rejected"]) {
        const { count } = await db.from(T).select("id", { count: "exact", head: true }).eq("status", s);
        counts[s] = count || 0;
      }
      const { data: cd } = await db.from(CODES).select("label,created_at").eq("active", true).order("created_at", { ascending: false }).limit(1).maybeSingle();
      return json({
        items: items.map((r) => ({
          ...pub(r), status: r.status, cut: r.cut, correction: r.correction || "", reviewed_at: r.reviewed_at,
          duplicate_of: r.duplicate_of || null, dup: r.duplicate_of ? dups[r.duplicate_of] || null : null, file_sha256: r.file_sha256 || "",
        })),
        more: rows.length > size, counts, code: cd ? { active: true, label: cd.label || "", created_at: cd.created_at } : { active: false },
      });
    }

    if (action === "admin_review") {
      const id = String(body.id || "");
      if (!UUID_RE.test(id)) return json({ error: "חסר מזהה" }, 400);
      const { data: row } = await db.from(T).select("*").eq("id", id).maybeSingle();
      if (!row) return json({ error: "העיצוב לא נמצא (אולי נמחק)" }, 404);
      const patch: Record<string, unknown> = {};
      if (body.status !== undefined) {
        if (!["pending", "approved", "rejected"].includes(body.status)) return json({ error: "סטטוס לא מוכר" }, 400);
        patch.status = body.status; patch.reviewed_at = new Date().toISOString();
      }
      if (body.title !== undefined) patch.title = cleanText(body.title, 80) || row.title;
      if (body.category !== undefined) { if (!CATS.includes(body.category)) return json({ error: "קטגוריה לא מוכרת" }, 400); patch.category = body.category; }
      if (body.correction !== undefined) patch.correction = cleanText(body.correction, 300) || null;
      if (body.contributor !== undefined) patch.contributor = cleanText(body.contributor, 40) || null;
      if (body.duplicate_of !== undefined) {
        if (body.duplicate_of === null || body.duplicate_of === "") patch.duplicate_of = null;
        else {
          const did = String(body.duplicate_of);
          if (!UUID_RE.test(did) || did === id) return json({ error: "כפילות לא תקינה" }, 400);
          const { data: other } = await db.from(T).select("id").eq("id", did).maybeSingle();
          if (!other) return json({ error: "העיצוב המקורי לא נמצא" }, 404);
          patch.duplicate_of = did;
        }
      }
      if (!Object.keys(patch).length) return json({ error: "אין מה לשמור" }, 400);
      // אישור: הקבצים עוברים מ-pending/ ל-approved/
      const moved: [string, string][] = [];
      if (patch.status === "approved") {
        const st = db.storage.from(BUCKET);
        for (const k of ["asset_path", "asset_cut_path"]) {
          const p = row[k];
          if (typeof p === "string" && p.startsWith("pending/")) {
            const to = "approved/" + p.slice(8);
            const { error } = await withTimeout(st.move(p, to), 20000) as any;
            if (error) { for (const [a, b] of moved) await st.move(b, a); return json({ error: "העברת הקובץ נכשלה — נסו שוב" }, 502); }
            moved.push([p, to]); patch[k] = to;
          }
        }
      }
      const { data: upd, error } = await db.from(T).update(patch).eq("id", id).select("*").maybeSingle();
      if (error) {
        const st = db.storage.from(BUCKET);
        for (const [a, b] of moved) await st.move(b, a);
        throw new Error(error.message);
      }
      const [s] = await sign(db, [upd || { ...row, ...patch }], true);
      return json({ ok: true, item: { ...pub(s), status: s.status, cut: s.cut, correction: s.correction || "", duplicate_of: s.duplicate_of || null } });
    }

    if (action === "admin_delete") {
      const id = String(body.id || "");
      if (!UUID_RE.test(id)) return json({ error: "חסר מזהה" }, 400);
      const { data: row } = await db.from(T).select("id,asset_path,asset_cut_path").eq("id", id).maybeSingle();
      if (!row) return json({ ok: true, gone: true });
      const files = [row.asset_path, row.asset_cut_path].filter(Boolean);
      if (files.length) await withTimeout(db.storage.from(BUCKET).remove(files), 20000);
      const { error } = await db.from(T).delete().eq("id", id);
      if (error) throw new Error(error.message);
      return json({ ok: true });
    }

    if (action === "admin_set_code") {
      const code = norm(body.code);
      if (!/^[A-Z0-9א-ת_-]{4,40}$/u.test(code)) return json({ error: "קוד של 4–40 תווים: אותיות, ספרות, מקף" }, 400);
      const h = await codeHash(code), label = cleanText(body.label, 40) || "שותפים";
      const { error: e1 } = await db.from(CODES).update({ active: false }).eq("active", true).neq("code_hash", h);
      if (e1) throw new Error(e1.message);
      const { error: e2 } = await db.from(CODES).upsert({ code_hash: h, label, active: true, created_at: new Date().toISOString() }, { onConflict: "code_hash" });
      if (e2) throw new Error(e2.message);
      return json({ ok: true, label });
    }

    return json({ error: "פעולה לא מוכרת" }, 400);
  } catch (e) {
    const m = String((e as Error)?.message || e);
    if ((e as Error)?.name === "TimeoutError" || /timed? ?out|aborted/i.test(m)) return json({ error: "השרת לא ענה בזמן — נסו שוב" }, 504);
    console.error("design-library", m);
    return json({ error: "משהו השתבש בשרת — נסו שוב בעוד רגע" }, 500);
  }
}

// ── הרצה ב-Supabase (ב-node, בבדיקות, אין Deno — רק handle מיוצא) ──
const D = (globalThis as any).Deno;
if (D?.serve) {
  const env = (k: string) => D.env.get(k);
  const db = createClient(env("SUPABASE_URL")!, env("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  D.serve((req: Request) => handle(req, db, env));
}
