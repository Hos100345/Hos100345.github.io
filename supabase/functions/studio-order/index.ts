// ============================================================
// סטודיו הדפסה וחיתוך — Edge Function: studio-order
// ציבורית (verify_jwt: false), בנויה לפי sticker-order. שום דבר כאן לא סומך
// על הדפדפן: מחיר נקבע ב-DB (studio_price), קוד/סטטוס/תשלום הם ברירות מחדל.
//
// שני שלבים, כי PDF של כמה דפים גדול מדי לגוף בקשה אחד:
//   action=create   → ולידציה + שורת הזמנה (status=uploading) + קישורי העלאה חתומים
//   action=finalize → בדיקה שהקבצים באמת עלו → status=new
// הזמנה שלא הושלמה נשארת 'uploading' ומופיעה למנהל ככזו.
// ============================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const BUCKET = 'studio-orders';
const PRODUCTS = ['stickers', 'cards', 'memory', 'domino', 'dice', 'puzzle'];
const MAX_DESIGN_BYTES = 256 * 1024;
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });
const fail = (e: string, s: number) => json({ ok: false, error: e }, s);

function validatePhone(raw: unknown): string | null {
  let d = String(raw ?? '').replace(/\D/g, '');
  if (d.startsWith('972')) d = '0' + d.slice(3);
  if (d.length === 9 && d.startsWith('5')) d = '0' + d;
  return /^05\d{8}$/.test(d) ? d : null;
}
const truncate = (raw: unknown, max: number) => { const s = String(raw ?? '').trim(); return s ? s.slice(0, max) : null; };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return fail('method_not_allowed', 405);
  try {
    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    if (!body || typeof body !== 'object') return fail('invalid_body', 400);
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

    if (body.action === 'create') {
      const phone = validatePhone(body.phone);
      if (!phone) return fail('invalid_phone', 400);
      const product = String(body.product ?? '');
      if (!PRODUCTS.includes(product)) return fail('invalid_product', 400);
      const sheets = Number(body.sheets);
      if (!Number.isInteger(sheets) || sheets < 1 || sheets > 40) return fail('invalid_sheets', 400);
      const design = body.design;
      if (!design || typeof design !== 'object' || Array.isArray(design)) return fail('invalid_design', 400);
      if (new TextEncoder().encode(JSON.stringify(design)).length >= MAX_DESIGN_BYTES) return fail('design_too_large', 400);
      const cutExt = body.cutExt === 'zip' ? 'zip' : 'svg';

      const { data, error } = await admin.rpc('create_studio_order', { p: {
        product, customer_phone: phone, sheets, design,
        customer_name: truncate(body.name, 80), customer_note: truncate(body.note, 300), summary: truncate(body.summary, 200),
      } });
      if (error || !data) {
        if (String(error?.message || '').includes('rate_limited')) return fail('rate_limited', 429);
        console.error('RPC_ERROR', JSON.stringify(error));
        return fail('server_error', 500);
      }
      const { id, code, price } = data as { id: string; code: string; price: number };
      // design.zip = העיצוב המלא (הגדרות + תמונות) — המנהל פותח אותו בסטודיו ומחליט: גיליון לבית דפוס או דפי A4.
      // לא חובה ב-finalize: לקוח עם גרסה ישנה של הדף לא מעלה אותו.
      const names = ['print.pdf', 'preview.jpg', `cut.${cutExt}`, 'design.zip'];
      const uploads: Record<string, string> = {};
      for (const n of names) {
        const { data: s, error: e } = await admin.storage.from(BUCKET).createSignedUploadUrl(`${id}/${n}`);
        if (e || !s) { console.error('SIGN_ERROR', n, JSON.stringify(e)); await admin.from('studio_orders').delete().eq('id', id); return fail('server_error', 500); }
        uploads[n] = s.signedUrl;
      }
      console.log('STUDIO_ORDER_CREATED', code, product, 'sheets=', sheets, 'price=', price);
      return json({ ok: true, id, code, price, uploads });
    }

    if (body.action === 'finalize') {
      const id = String(body.id ?? ''), code = String(body.code ?? '');
      if (!UUID_RE.test(id) || !/^ST-\d{4,}$/.test(code)) return fail('invalid_order', 400);
      const { data: row } = await admin.from('studio_orders').select('id,status,created_at').eq('id', id).eq('code', code).maybeSingle();
      if (!row) return fail('not_found', 404);
      if (row.status !== 'uploading') return json({ ok: true, code, already: true });
      const { data: objs, error } = await admin.storage.from(BUCKET).list(id);
      if (error) return fail('server_error', 500);
      const files = (objs ?? []).map((o) => o.name);
      if (!files.includes('print.pdf') || !files.includes('preview.jpg')) return fail('files_missing', 400);
      await admin.from('studio_orders').update({ status: 'new', files }).eq('id', id);
      console.log('STUDIO_ORDER_FINALIZED', code, files.join(','));
      return json({ ok: true, code });
    }
    return fail('invalid_action', 400);
  } catch (e) {
    console.error('STUDIO_ORDER_THROW', String((e as Error)?.message || e));
    return fail('server_error', 500);
  }
});
