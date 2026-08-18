// ============================================================
// מחולל הדאבל — Edge Function: manage-customers
// כלי ניהול לקוחות, תשלומים וקודים — מנהל בלבד.
//
// עובד מול המנגנון החי: dobble_access_codes + dobble_transactions.
// נפרד בכוונה מ-manage-subscriber, שמטפל במנגנון המנויים הישן
// (profiles + מיילים סינתטיים @sub) — שני מנגנונים, שתי פונקציות.
//
// שער: ADMIN_EMAILS (Secret). service_role מוזרק אוטומטית.
// פריסה: MCP בלבד (Claude Code חסום מול Supabase). verify_jwt=true.
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ADMIN_EMAILS = (Deno.env.get('ADMIN_EMAILS') || 'hoshaya@gmail.com')
  .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

// חמש הרמות החוקיות היחידות — תואם ל-ORDERS.total בפרונט (מבנה GF(4), לא כל מספר).
const VALID_MAX_ORDERS = [7, 13, 21, 31, 57];

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

const digits = (s: unknown) => String(s || '').replace(/\D/g, '');
const lc = (s: unknown) => String(s || '').trim().toLowerCase();

// תקינות קוד — זהה לכללים של ה-RPC claim_access_code, כדי שקוד שנוצר ידנית
// יתנהג בדיוק כמו קוד שנוצר אחרי תשלום.
function badCode(code: string): string | null {
  if (code.length < 4 || code.length > 20) return 'הקוד חייב להיות באורך 4–20 תווים';
  if (/\s/.test(code)) return 'הקוד לא יכול להכיל רווחים';
  return null;
}

function addMonths(from: Date, months: number): Date {
  const d = new Date(from);
  d.setMonth(d.getMonth() + months);
  return d;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

    // ── שער מנהל בצד שרת — לא לסמוך על isAdminUser() בפרונט ──
    const token = (req.headers.get('Authorization') || '').replace('Bearer ', '');
    const { data: { user }, error: uErr } = await admin.auth.getUser(token);
    if (uErr || !user || !ADMIN_EMAILS.includes((user.email || '').toLowerCase())) {
      return json({ error: 'not authorized' }, 403);
    }
    const adminEmail = (user.email || '').toLowerCase();

    // audit — מי, מה, על מי, מתי. כשל ברישום לא מפיל את הפעולה עצמה.
    async function logAudit(event: string, code: string | null, detail: Record<string, unknown>) {
      try {
        const { error } = await admin.from('events').insert({
          event, code: code || null, label: null, actor: adminEmail, detail: JSON.stringify(detail),
        });
        if (error) console.error('audit insert failed:', error.message);
      } catch (e) {
        console.error('audit insert threw:', String(e));
      }
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action;

    // ── חיפוש לקוח: מייל / טלפון / שם המשלם / קוד ──
    if (action === 'customer-lookup') {
      const q = String(body.q || '').trim();
      const qd = digits(q);
      const qLike = '%' + q.replace(/[%_]/g, '') + '%';

      const TX_COLS = 'id,customer_email,customer_phone,amount,tier,status,created_at,claimed_at,claimed_code,raw_payload';
      const CD_COLS = 'id,code,type,max_order,expires_at,usage_limit,current_usage,created_for,is_active,created_at';
      const txBase = () => admin.from('dobble_transactions').select(TX_COLS)
        .order('created_at', { ascending: false }).limit(50);

      let txQ = txBase();
      let cdQ = admin.from('dobble_access_codes').select(CD_COLS)
        .order('created_at', { ascending: false }).limit(50);
      // חיפוש לפי שם המשלם רץ בשאילתה נפרדת ולא בתוך or(): השם יושב בתוך JSON
      // (raw_payload->payer->>name), וסינון JSON בתוך or() של PostgREST שביר.
      let nameQ: any = null;

      if (q) {
        const txOr = [`customer_email.ilike.${qLike}`];
        if (qd) txOr.push(`customer_phone.ilike.%${qd}%`);
        txQ = txQ.or(txOr.join(','));
        nameQ = txBase().filter('raw_payload->payer->>name', 'ilike', qLike);
        cdQ = cdQ.or([`code.ilike.${qLike}`, `created_for.ilike.${qLike}`].join(','));
      } else {
        // חיפוש ריק = בדיוק מה שדורש טיפול: תשלומים ששולמו וטרם נוצלו
        txQ = txQ.eq('status', 'paid').is('claimed_at', null);
        cdQ = cdQ.limit(1);
      }

      const [{ data: txs, error: tErr }, { data: codes, error: cErr }] = await Promise.all([txQ, cdQ]);
      if (tErr) return json({ error: 'חיפוש תשלומים נכשל: ' + tErr.message }, 500);
      if (cErr) return json({ error: 'חיפוש קודים נכשל: ' + cErr.message }, 500);

      // מיזוג תוצאות השם, בלי כפילויות. כשל בשאילתת השם לא מפיל את החיפוש כולו.
      const merged: any[] = [...(txs || [])];
      if (nameQ) {
        const { data: byName } = await nameQ;
        const seen = new Set(merged.map((t: any) => t.id));
        for (const t of (byName || [])) if (!seen.has(t.id)) { seen.add(t.id); merged.push(t); }
      }

      const transactions = merged.map((t: any) => ({
        id: t.id,
        email: t.customer_email,
        phone: t.customer_phone || digits(t.raw_payload?.payer?.phone) || null,
        name: t.raw_payload?.payer?.name || null,
        amount: t.amount, tier: t.tier, status: t.status,
        created_at: t.created_at, claimed_at: t.claimed_at, claimed_code: t.claimed_code,
      }));

      await logAudit('admin_customer_lookup', null, { q, txCount: transactions.length });
      return json({ transactions, codes: q ? (codes || []) : [] });
    }

    // ── הנפקת קוד ידנית / הארכה ──
    // משכפל את ההיגיון של claim_access_code: קוד תפוס ע"י לקוח אחר → שגיאה;
    // קוד של אותו לקוח → הארכה ולא כפילות; המדרגה רק עולה, לעולם לא יורדת.
    if (action === 'code-issue') {
      const code = String(body.code || '').trim();
      const email = lc(body.email);
      const months = Math.max(1, Math.min(24, Number(body.months) || 1));
      const maxOrder = Number(body.maxOrder);
      const bad = badCode(code);
      if (bad) return json({ error: bad }, 400);
      if (!email) return json({ error: 'חסר מייל לקוח' }, 400);
      if (!VALID_MAX_ORDERS.includes(maxOrder)) {
        return json({ error: 'maxOrder לא תקין — ערכים חוקיים: ' + VALID_MAX_ORDERS.join('/') }, 400);
      }

      const { data: existing } = await admin.from('dobble_access_codes')
        .select('*').eq('code', code).maybeSingle();

      const now = new Date();
      if (existing) {
        if (lc(existing.created_for) !== email) {
          return json({ error: 'הקוד הזה כבר תפוס על ידי לקוח אחר (' + (existing.created_for || 'לא ידוע') + ')' }, 409);
        }
        const from = existing.expires_at && new Date(existing.expires_at) > now ? new Date(existing.expires_at) : now;
        const exp = addMonths(from, months);
        const { error } = await admin.from('dobble_access_codes').update({
          expires_at: exp.toISOString(), is_active: true,
          max_order: Math.max(Number(existing.max_order) || 7, maxOrder),
        }).eq('id', existing.id);
        if (error) return json({ error: 'הארכת הקוד נכשלה: ' + error.message }, 500);
        await logAudit('admin_code_issue_renew', code, { email, months, maxOrder });
        return json({ ok: true, code, renewed: true, expires_at: exp.toISOString() });
      }

      const exp = addMonths(now, months);
      const { error } = await admin.from('dobble_access_codes').insert({
        code, type: 'pass', max_order: maxOrder,
        expires_at: exp.toISOString(), created_for: email, is_active: true,
      });
      if (error) return json({ error: 'יצירת הקוד נכשלה: ' + error.message }, 500);
      await logAudit('admin_code_issue', code, { email, months, maxOrder });
      return json({ ok: true, code, renewed: false, expires_at: exp.toISOString() });
    }

    if (action === 'code-extend') {
      const code = String(body.code || '').trim();
      const months = Math.max(1, Math.min(24, Number(body.months) || 1));
      const { data: row } = await admin.from('dobble_access_codes').select('*').eq('code', code).maybeSingle();
      if (!row) return json({ error: 'הקוד לא נמצא' }, 404);
      const now = new Date();
      const from = row.expires_at && new Date(row.expires_at) > now ? new Date(row.expires_at) : now;
      const exp = addMonths(from, months);
      const { error } = await admin.from('dobble_access_codes')
        .update({ expires_at: exp.toISOString(), is_active: true }).eq('id', row.id);
      if (error) return json({ error: error.message }, 500);
      await logAudit('admin_code_extend', code, { months, newExpiry: exp.toISOString() });
      return json({ ok: true, expires_at: exp.toISOString() });
    }

    if (action === 'code-set-tier') {
      const code = String(body.code || '').trim();
      const maxOrder = Number(body.maxOrder);
      if (!VALID_MAX_ORDERS.includes(maxOrder)) {
        return json({ error: 'maxOrder לא תקין — ערכים חוקיים: ' + VALID_MAX_ORDERS.join('/') }, 400);
      }
      const { data: row } = await admin.from('dobble_access_codes').select('id').eq('code', code).maybeSingle();
      if (!row) return json({ error: 'הקוד לא נמצא' }, 404);
      const { error } = await admin.from('dobble_access_codes').update({ max_order: maxOrder }).eq('id', row.id);
      if (error) return json({ error: error.message }, 500);
      await logAudit('admin_code_set_tier', code, { maxOrder });
      return json({ ok: true, maxOrder });
    }

    if (action === 'code-toggle') {
      const code = String(body.code || '').trim();
      const active = !!body.active;
      const { data: row } = await admin.from('dobble_access_codes').select('id').eq('code', code).maybeSingle();
      if (!row) return json({ error: 'הקוד לא נמצא' }, 404);
      const { error } = await admin.from('dobble_access_codes').update({ is_active: active }).eq('id', row.id);
      if (error) return json({ error: error.message }, 500);
      await logAudit('admin_code_toggle', code, { active });
      return json({ ok: true, active });
    }

    // ── הפלסטר המרכזי ──
    // לקוח ששילם ב-Morning עם מייל אחר מזה שהזין אצלנו: claim_access_code מתאים
    // לפי customer_email בלבד, ולכן בלי התיקון הזה התשלום שלו לא נמצא והוא תקוע.
    if (action === 'tx-set-email') {
      const txId = String(body.txId || '').trim();
      const email = lc(body.email);
      if (!txId) return json({ error: 'חסר מזהה עסקה' }, 400);
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'כתובת מייל לא תקינה' }, 400);
      const { data: row } = await admin.from('dobble_transactions')
        .select('id,customer_email,claimed_at').eq('id', txId).maybeSingle();
      if (!row) return json({ error: 'העסקה לא נמצאה' }, 404);
      if (row.claimed_at) return json({ error: 'העסקה כבר נוצלה — שינוי מייל לא ישנה כלום' }, 409);
      const { error } = await admin.from('dobble_transactions')
        .update({ customer_email: email, updated_at: new Date().toISOString() }).eq('id', txId);
      if (error) return json({ error: error.message }, 500);
      await logAudit('admin_tx_set_email', null, { txId, from: row.customer_email, to: email });
      return json({ ok: true, email });
    }

    // סימון ידני כ"שולם" — לתשלום שנתקע ב-pending (productId לא מוכר, סכום שלא תאם).
    if (action === 'tx-mark-paid') {
      const txId = String(body.txId || '').trim();
      const tier = Number(body.tier);
      if (!txId) return json({ error: 'חסר מזהה עסקה' }, 400);
      if (!VALID_MAX_ORDERS.includes(tier)) {
        return json({ error: 'tier לא תקין — ערכים חוקיים: ' + VALID_MAX_ORDERS.join('/') }, 400);
      }
      const { data: row } = await admin.from('dobble_transactions').select('id,status').eq('id', txId).maybeSingle();
      if (!row) return json({ error: 'העסקה לא נמצאה' }, 404);
      const { error } = await admin.from('dobble_transactions')
        .update({ status: 'paid', tier, updated_at: new Date().toISOString() }).eq('id', txId);
      if (error) return json({ error: error.message }, 500);
      await logAudit('admin_tx_mark_paid', null, { txId, from: row.status, tier });
      return json({ ok: true, tier });
    }

    return json({ error: 'unknown action' }, 400);
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
