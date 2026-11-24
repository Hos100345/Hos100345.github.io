// ============================================================
// סטודיו הדפסה וחיתוך — Edge Function: studio-order
// ציבורית (verify_jwt: false), בנויה לפי sticker-order. שום דבר כאן לא סומך
// על הדפדפן: מחיר נקבע ב-DB (studio_price), קוד/סטטוס/תשלום הם ברירות מחדל.
//
// שני שלבים, כי PDF של כמה דפים גדול מדי לגוף בקשה אחד:
//   action=create   → ולידציה + שורת הזמנה (status=uploading) + קישורי העלאה חתומים
//   action=finalize → בדיקה שהקבצים באמת עלו → status=new
//   action=cart     → S-188: סל — עד 10 מוצרים בבת אחת (RPC create_studio_cart: הזמנה לכל מוצר עם cart_code משותף,
//                     סל = יחידה אחת במגבלת 5 ביום). מחזיר קישורי העלאה לכל מוצר; finalize לכל מוצר בנפרד כמו תמיד.
// הזמנה שלא הושלמה נשארת 'uploading' ומופיעה למנהל ככזו.
// ============================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const BUCKET = 'studio-orders';
const PRODUCTS = ['stickers', 'cards', 'memory', 'quartets', 'domino', 'dice', 'puzzle', 'bingo', 'tangram', 'ludo', 'tshirt', 'mug', 'subl', 'snakes', 'keychains']; // keychains = S-154 (v12, מחזיקי מפתחות — מחיר מ-studio_keychain_price) · snakes = S-100 (v10, סולמות וחבלים — הצעת מחיר, או studio_blank_prices snakes-8805) · subl = S-98 (v9, מתנות מזיקית — הצעת מחיר, או מחיר מ-studio_blank_prices subl-<מק"ט>) · mug = S-91 (v8) · tshirt = S-85 (v7, מחיר לפי כמות החולצות) · quartets = S-31 (v3) · bingo = S-55 (v4) · tangram/ludo = S-65 (v5, הצעת מחיר — מחיר 0 עד שנקבע)
const MAX_DESIGN_BYTES = 256 * 1024;
const MAX_CART_ITEMS = 10, MAX_CART_BYTES = 1536 * 1024; // S-188
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
        coupon: truncate(body.coupon, 30), // S-84: קוד הנחה — נבדק ונחשב ב-DB
      } });
      if (error || !data) {
        if (String(error?.message || '').includes('rate_limited')) return fail('rate_limited', 429);
        if (String(error?.message || '').includes('invalid_qty')) return fail('invalid_qty', 400);
        console.error('RPC_ERROR', JSON.stringify(error));
        return fail('server_error', 500);
      }
      const { id, code, price, price_before, coupon } = data as { id: string; code: string; price: number; price_before: number | null; coupon: string | null };
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
      return json({ ok: true, id, code, price, price_before, coupon, uploads });
    }

    // הזמנה ידנית מלשונית המנהל. רק למנהל (בודקים את ה-JWT כאן, כי verify_jwt=false).
    // לא עוברת דרך create_studio_order — בלי הגבלת 5 ביום לטלפון, בלי קבצים, בלי קופון.
    // שורה ב-status='new' עם מחיר וסימון שולם שהמנהל קובע.
    if (body.action === 'manual') {
      const tok = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
      const { data: u, error: ue } = await admin.auth.getUser(tok);
      if (ue || !u?.user || String(u.user.email ?? '').toLowerCase() !== 'hoshaya@gmail.com') return fail('forbidden', 403);
      const phone = validatePhone(body.phone);
      if (!phone) return fail('invalid_phone', 400);
      const product = String(body.product ?? '');
      if (!PRODUCTS.includes(product)) return fail('invalid_product', 400);
      const sheets = Number(body.sheets);
      if (!Number.isInteger(sheets) || sheets < 1 || sheets > 40) return fail('invalid_sheets', 400);
      const price = Number(body.price_ils);
      if (!Number.isInteger(price) || price < 0 || price > 100000) return fail('invalid_price', 400);
      const { data: row, error } = await admin.from('studio_orders').insert({
        product, customer_name: truncate(body.name, 80), customer_phone: phone,
        customer_note: truncate(body.note, 300), sheets, price_ils: price, design: {},
        summary: truncate(body.summary, 200), status: 'new', files: [], paid: body.paid === true,
      }).select('id,code').single();
      if (error || !row) {
        console.error('MANUAL_INSERT_ERROR', JSON.stringify(error));
        return fail('server_error', 500);
      }
      console.log('STUDIO_ORDER_MANUAL', row.code, product, 'sheets=', sheets, 'price=', price);
      return json({ ok: true, id: row.id, code: row.code });
    }

    // S-188: סל קניות. כל מוצר נבדק כמו create; שורות ההזמנה נוצרות בטרנזקציה אחת (מוצר אחד לא תקין = כלום לא נוצר).
    if (body.action === 'cart') {
      const phone = validatePhone(body.phone);
      if (!phone) return fail('invalid_phone', 400);
      const raw = body.items;
      if (!Array.isArray(raw) || raw.length < 1 || raw.length > MAX_CART_ITEMS) return fail('invalid_items', 400);
      const enc = new TextEncoder();
      let bytes = 0;
      const items: { product: string; sheets: number; design: Record<string, unknown>; summary: string | null; cutExt: string }[] = [];
      for (const it of raw as Record<string, unknown>[]) {
        if (!it || typeof it !== 'object') return fail('invalid_items', 400);
        const product = String(it.product ?? '');
        if (!PRODUCTS.includes(product)) return fail('invalid_product', 400);
        const sheets = Number(it.sheets);
        if (!Number.isInteger(sheets) || sheets < 1 || sheets > 40) return fail('invalid_sheets', 400);
        const design = it.design;
        if (!design || typeof design !== 'object' || Array.isArray(design)) return fail('invalid_design', 400);
        const n = enc.encode(JSON.stringify(design)).length;
        if (n >= MAX_DESIGN_BYTES) return fail('design_too_large', 400);
        bytes += n;
        items.push({ product, sheets, design: design as Record<string, unknown>, summary: truncate(it.summary, 200), cutExt: it.cutExt === 'zip' ? 'zip' : 'svg' });
      }
      if (bytes >= MAX_CART_BYTES) return fail('design_too_large', 400);

      const { data, error } = await admin.rpc('create_studio_cart', { p: {
        customer_phone: phone, customer_name: truncate(body.name, 80), customer_note: truncate(body.note, 300), coupon: truncate(body.coupon, 30),
        items: items.map(({ product, sheets, design, summary }) => ({ product, sheets, design, summary })),
      } });
      if (error || !data) {
        const m = String(error?.message || '');
        if (m.includes('rate_limited')) return fail('rate_limited', 429);
        if (m.includes('invalid_qty')) return fail('invalid_qty', 400);
        if (m.includes('invalid_items')) return fail('invalid_items', 400);
        console.error('CART_RPC_ERROR', JSON.stringify(error));
        return fail('server_error', 500);
      }
      const res = data as { cart_code: string; total: number; items: { id: string; code: string; price: number; price_before: number | null; coupon: string | null }[] };
      if (!Array.isArray(res.items) || res.items.length !== items.length) { console.error('CART_RPC_SHAPE', JSON.stringify(data)); return fail('server_error', 500); }
      const ids = res.items.map((o) => o.id);
      try {
        const out = await Promise.all(res.items.map(async (o, i) => {
          const uploads: Record<string, string> = {};
          for (const n of ['print.pdf', 'preview.jpg', `cut.${items[i].cutExt}`, 'design.zip']) {
            const { data: s, error: e } = await admin.storage.from(BUCKET).createSignedUploadUrl(`${o.id}/${n}`);
            if (e || !s) throw new Error('SIGN_ERROR ' + n + ' ' + JSON.stringify(e));
            uploads[n] = s.signedUrl;
          }
          return { id: o.id, code: o.code, price: o.price, price_before: o.price_before, coupon: o.coupon, uploads };
        }));
        console.log('STUDIO_CART_CREATED', res.cart_code, 'items=', out.length, 'total=', res.total, out.map((o) => o.code).join(','));
        return json({ ok: true, cart_code: res.cart_code, total: res.total, items: out });
      } catch (e) {
        console.error('CART_SIGN_ERROR', String((e as Error)?.message || e));
        await admin.from('studio_orders').delete().in('id', ids);
        return fail('server_error', 500);
      }
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
