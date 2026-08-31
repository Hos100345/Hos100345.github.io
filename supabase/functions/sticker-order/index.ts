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
const MAX_SVG_BYTES = 500 * 1024;
const MAX_PREVIEW_BYTES = 2 * 1024 * 1024;
const MAX_DESIGN_BYTES = 256 * 1024;
const MAX_PRINT_BYTES = 6 * 1024 * 1024;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_IMAGES = 3;

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

// מנרמלת כל פורמט סביר לצורה אחידה 05XXXXXXXX (10 ספרות) — לא רק ולידציה.
// morning-webhook (PR 4) יתאים תשלום לפי 9 הספרות האחרונות; פורמטים מעורבים
// בטבלה (972 בינלאומי מול 05 מקומי, עם/בלי ה-0 המוביל) ישברו את ההתאמה.
function validatePhone(raw: unknown): string | null {
  let d = String(raw ?? '').replace(/\D/g, '');
  if (d.startsWith('972')) d = '0' + d.slice(3);        // +972-50-1234567 → 0501234567
  if (d.length === 9 && d.startsWith('5')) d = '0' + d; // 501234567 → 0501234567
  if (!/^05\d{8}$/.test(d)) return null;
  return d;
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

// ── PR 2: קובץ הדפסה (אופציונלי, לעולם לא מפיל הזמנה) ותמונות לקוח ──

const PRINT_PREFIX = 'data:image/jpeg;base64,';
function validatePrintImage(raw: unknown): Uint8Array | null {
  if (typeof raw !== 'string' || !raw.startsWith(PRINT_PREFIX)) return null;
  const b64 = raw.slice(PRINT_PREFIX.length);
  if (Math.floor(b64.length * 3 / 4) >= MAX_PRINT_BYTES) return null;
  try {
    const bytes = base64ToBytes(b64);
    if (bytes.length >= MAX_PRINT_BYTES) return null;
    return bytes;
  } catch {
    return null;
  }
}

function validatePrintDpi(raw: unknown): number | null {
  const n = Number(raw);
  return (n === 300 || n === 200) ? n : null;
}

const IMAGE_PREFIX = 'data:image/png;base64,';
const IMAGE_ID_RE = /^[a-zA-Z0-9_-]{1,40}$/;
// תמונות שהלקוח מעלה (לוגו/צילום) — לא נוסעות בתוך design (זה מה ששומר אותו
// מתחת ל-256KB), אלא כמערך נפרד. כל אחת מאומתת בנפרד ומועלית לנתיב משלה.
function validateImages(raw: unknown): { id: string; bytes: Uint8Array }[] | null {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw) || raw.length > MAX_IMAGES) return null;
  const out: { id: string; bytes: Uint8Array }[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') return null;
    const id = (item as Record<string, unknown>).id;
    const dataUrl = (item as Record<string, unknown>).dataUrl;
    if (typeof id !== 'string' || !IMAGE_ID_RE.test(id)) return null;
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith(IMAGE_PREFIX)) return null;
    const b64 = dataUrl.slice(IMAGE_PREFIX.length);
    if (Math.floor(b64.length * 3 / 4) >= MAX_IMAGE_BYTES) return null;
    try {
      const bytes = base64ToBytes(b64);
      if (bytes.length >= MAX_IMAGE_BYTES) return null;
      out.push({ id, bytes });
    } catch {
      return null;
    }
  }
  return out;
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
    // תמונות שהלקוח מעלה לא נוסעות כאן (ראה הערה ב-מרשם.md לקראת PR 2) — כל
    // עוד זה נכון, 256KB מספיקים בשפע לטקסט/אייקונים/הגדרות בלבד.
    if (new TextEncoder().encode(JSON.stringify(design)).length >= MAX_DESIGN_BYTES) {
      return fail('design_too_large', 400);
    }

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

    // תמונות לקוח — חלק מהעיצוב (מוזכרות מ-design.layers[].imageId), אז כשל
    // ולידציה כאן כן פוסל את ההזמנה, בניגוד לקובץ ההדפסה למטה.
    const images = validateImages((body as Record<string, unknown>).images);
    if (!images) return fail('invalid_images', 400);

    // קובץ ההדפסה אופציונלי לגמרי — נחמד שיהיה, לא תנאי. printDpi פסול/חסר
    // פשוט הופך לתיעוד null, לא לשגיאה.
    const printBytes = validatePrintImage((body as Record<string, unknown>).printBase64);
    const printDpi = printBytes ? validatePrintDpi((body as Record<string, unknown>).printDpi) : null;

    const url = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

    // ── קבצים לפני שורה — הנתיב לפי uuid, לא לפי code (code עדיין לא קיים).
    // ההגבלת-קצב זזה לאחרי ההעלאה (לתוך ה-RPC האטומי למטה) — לכן כל כשל
    // מכאן והלאה, כולל rate_limited, חייב לנקות את מה שכבר הועלה.
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

    // תמונות הלקוח — חלק מהעיצוב, אז כשל העלאה כאן כן מפיל את ההזמנה (בדיוק
    // כמו svg/preview למעלה), בניגוד לקובץ ההדפסה האופציונלי שמגיע אחריהן.
    for (const img of images) {
      const imgPath = `${uuid}/img-${img.id}.png`;
      const { error: imgErr } = await admin.storage.from(BUCKET)
        .upload(imgPath, img.bytes, { contentType: 'image/png', upsert: false });
      if (imgErr) {
        console.error('IMAGE_UPLOAD_ERROR', img.id, JSON.stringify(imgErr));
        await admin.storage.from(BUCKET).remove(uploaded);
        return fail('server_error', 500);
      }
      uploaded.push(imgPath);
    }

    // קובץ ההדפסה — אופציונלי לגמרי. כישלון בהעלאה שלו בלבד לא מפיל את ההזמנה,
    // רק מדלג עליו (print_path/print_dpi נשארים null ברשומה שנוצרת).
    let printPath: string | null = null;
    if (printBytes) {
      const candidatePath = `${uuid}/print.jpg`;
      const { error: printErr } = await admin.storage.from(BUCKET)
        .upload(candidatePath, printBytes, { contentType: 'image/jpeg', upsert: false });
      if (printErr) {
        console.warn('PRINT_UPLOAD_SKIPPED', JSON.stringify(printErr));
      } else {
        printPath = candidatePath;
        uploaded.push(candidatePath);
      }
    }

    // ── ספירת הקצב + insert בטרנזקציה אחת עם נעילה, בתוך create_sticker_order
    // (SQL, מנוהל ב-MCP) — לא שתי פעולות נפרדות. זה מה שהופך את ההגבלה
    // לאטומית מול בקשות מקבילות מאותו טלפון. code/created_at/status/paid
    // הם תמיד ברירת המחדל של ה-DB, לא נשלחים כאן.
    const { data: code, error: rpcErr } = await admin.rpc('create_sticker_order', {
      p: {
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
        print_path: printPath,
        print_dpi: printPath ? printDpi : null,
      },
    });

    if (rpcErr || !code) {
      // כל ניסיון חסום (קצב או כישלון אחר) לא ישאיר קבצים יתומים ב-Storage.
      await admin.storage.from(BUCKET).remove(uploaded);
      if (String(rpcErr?.message || '').includes('rate_limited')) return fail('rate_limited', 429);
      console.error('RPC_ERROR', JSON.stringify(rpcErr));
      return fail('server_error', 500);
    }

    console.log('STICKER_ORDER_CREATED', code, 'phone=', phone, 'sheets=', sheets);
    return json({ ok: true, code });
  } catch (e) {
    console.error('STICKER_ORDER_THROW', String((e as Error)?.message || e));
    return fail('server_error', 500);
  }
});
