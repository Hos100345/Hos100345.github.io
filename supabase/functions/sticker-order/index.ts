// ============================================================
// מחולל מדבקות לעפרונות — Edge Function: sticker-order
// PR 1 מתוך 4 (spec-sticker-orders.md + נספח התשלום). מטרה יחידה:
// לקבל עיצוב מהדפדפן, לשמור קבצים ב-Storage וליצור שורת הזמנה.
// אין כאן UI, אין כאן webhook — אלה PR 2–4 נפרדים.
//
// ציבורית (verify_jwt: false) — pencil-stickers.html קורא לה ישירות
// בלי SDK ובלי מפתח, בדיוק כמו ש-Morning קוראת ל-morning-webhook.
// בדיוק בגלל זה שום דבר כאן לא סומך על קלט הדפדפן: ולידציה מלאה בצד
// שרת, ו-code/created_at/status/paid תמיד ברירת המחדל של ה-DB.
//
// טבלה sticker_orders ו-bucket sticker-orders כבר קיימים (נוצרו ידנית
// דרך MCP) — הפונקציה הזו לא יוצרת ולא משנה סכימה.
//
// פריסה: MCP בלבד (Claude Code לא מגיע ל-*.supabase.co).
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const BUCKET = 'sticker-orders';
const PRICE_ILS_PER_SHEET = 10;
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_SVG_BYTES = 500 * 1024;
const MAX_PREVIEW_BYTES = 2 * 1024 * 1024;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

function fail(error: string, status: number) {
  return json({ ok: false, error }, status);
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// ── ולידציה — הפונקציה ציבורית, אף אחד מהשדות האלה לא נבדק קודם בדפדפן ──

function validatePhone(raw: unknown): string | null {
  const digits = String(raw ?? '').replace(/\D/g, '');
  // 05XXXXXXXX (10 ספרות) או 5XXXXXXXX (9 ספרות, בלי ה-0 המוביל)
  if (!/^(05\d{8}|5\d{8})$/.test(digits)) return null;
  return digits;
}

function validateSheets(raw: unknown): number | null {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 20) return null;
  return n;
}

function validateDesign(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const design = raw as Record<string, unknown>;
  if (!Array.isArray(design.layers)) return null;
  return design;
}

function validateSvg(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith('<svg')) return null;
  if (new TextEncoder().encode(trimmed).length >= MAX_SVG_BYTES) return null;
  return trimmed;
}

const PREVIEW_PREFIX = 'data:image/jpeg;base64,';
function validatePreview(raw: unknown): Uint8Array | null {
  if (typeof raw !== 'string' || !raw.startsWith(PREVIEW_PREFIX)) return null;
  const b64 = raw.slice(PREVIEW_PREFIX.length);
  // אורך בתים משוער מראש (בלי לפענח) כדי לא לבזבז עבודה על קלט ענק בכוונה
  if (Math.floor(b64.length * 3 / 4) >= MAX_PREVIEW_BYTES) return null;
  try {
    const bytes = base64ToBytes(b64);
    if (bytes.length >= MAX_PREVIEW_BYTES) return null;
    return bytes;
  } catch {
    return null;
  }
}

function truncate(raw: unknown, max: number): string | null {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  return s.slice(0, max);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return fail('method_not_allowed', 405);

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return fail('invalid_body', 400);

    const phone = validatePhone((body as Record<string, unknown>).phone);
    if (!phone) return fail('invalid_phone', 400);

    const sheets = validateSheets((body as Record<string, unknown>).sheets);
    if (sheets === null) return fail('invalid_sheets', 400);

    const design = validateDesign((body as Record<string, unknown>).design);
    if (!design) return fail('invalid_design', 400);

    const svg = validateSvg((body as Record<string, unknown>).svg);
    if (!svg) return fail('invalid_svg', 400);

    const previewBytes = validatePreview((body as Record<string, unknown>).previewBase64);
    if (!previewBytes) return fail('invalid_preview', 400);

    const name = truncate((body as Record<string, unknown>).name, 80);
    const note = truncate((body as Record<string, unknown>).note, 300);

    const sizesRaw = (body as Record<string, unknown>).sizes;
    const sizes = (sizesRaw && typeof sizesRaw === 'object') ? sizesRaw as Record<string, unknown> : {};
    const lenMm = Number.isFinite(Number(sizes.lenMm)) ? Number(sizes.lenMm) : null;
    const widMm = Number.isFinite(Number(sizes.widMm)) ? Number(sizes.widMm) : null;
    const perSheet = Number.isInteger(Number(sizes.perSheet)) ? Number(sizes.perSheet) : null;

    const url = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

    // ── הגבלת קצב — לפני כל כתיבה, כדי שלא לבזבז אחסון על ניסיון חסום ──
    const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
    const { count, error: cntErr } = await admin.from('sticker_orders')
      .select('id', { count: 'exact', head: true })
      .eq('customer_phone', phone)
      .gte('created_at', since);
    if (cntErr) {
      console.error('RATE_LIMIT_QUERY_ERROR', JSON.stringify(cntErr));
      return fail('server_error', 500);
    }
    if ((count ?? 0) >= RATE_LIMIT_MAX) return fail('rate_limited', 429);

    // ── קבצים לפני שורה — הנתיב לפי uuid, לא לפי code (code עדיין לא קיים) ──
    const uuid = crypto.randomUUID();
    const svgPath = `${uuid}/cut.svg`;
    const previewPath = `${uuid}/preview.jpg`;
    const uploaded: string[] = [];

    const { error: svgErr } = await admin.storage.from(BUCKET)
      .upload(svgPath, new TextEncoder().encode(svg), { contentType: 'image/svg+xml', upsert: false });
    if (svgErr) {
      console.error('SVG_UPLOAD_ERROR', JSON.stringify(svgErr));
      return fail('server_error', 500);
    }
    uploaded.push(svgPath);

    const { error: previewErr } = await admin.storage.from(BUCKET)
      .upload(previewPath, previewBytes, { contentType: 'image/jpeg', upsert: false });
    if (previewErr) {
      console.error('PREVIEW_UPLOAD_ERROR', JSON.stringify(previewErr));
      await admin.storage.from(BUCKET).remove(uploaded);
      return fail('server_error', 500);
    }
    uploaded.push(previewPath);

    // ── שורה — code/created_at/status/paid הם ברירת המחדל של ה-DB, לא נשלחים כאן ──
    const { data: row, error: insErr } = await admin.from('sticker_orders').insert({
      customer_name: name,
      customer_phone: phone,
      customer_note: note,
      sheets,
      price_ils: sheets * PRICE_ILS_PER_SHEET,
      design,
      size_len_mm: lenMm,
      size_wid_mm: widMm,
      per_sheet: perSheet,
      svg_path: svgPath,
      preview_path: previewPath,
    }).select('code').single();

    if (insErr || !row) {
      console.error('INSERT_ERROR', JSON.stringify(insErr));
      // הזמנה בלי קבצים גרועה מהזמנה שנכשלה בגלוי — אם השורה לא נוצרה, לא משאירים קבצים יתומים.
      await admin.storage.from(BUCKET).remove(uploaded);
      return fail('server_error', 500);
    }

    console.log('STICKER_ORDER_CREATED', row.code, 'phone=', phone, 'sheets=', sheets);
    return json({ ok: true, code: row.code });
  } catch (e) {
    console.error('STICKER_ORDER_THROW', String((e as Error)?.message || e));
    return fail('server_error', 500);
  }
});
