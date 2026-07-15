// ============================================================
// מחולל הדאבל — Edge Function: ניהול מנויים
// יוצר/מוחק/מציג חשבונות מנוי, מאובטח כך שרק המנהל (המחובר עם
// המייל שלו) יכול להפעיל אותו. משתמש ב-service_role שמוזרק
// אוטומטית ל-Edge Functions — לא צריך להעתיק אותו לשום מקום.
//
// פריסה (מהדשבורד, בלי CLI):
//   Supabase → Edge Functions → Create a function → שם: manage-subscriber
//   → הדביקו את כל הקובץ הזה → Deploy.
//   (אופציונלי) Edge Functions → Secrets → ADMIN_EMAILS = hoshaya@gmail.com
//   ברירת מחדל אם לא הוגדר: hoshaya@gmail.com
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ADMIN_EMAILS = (Deno.env.get('ADMIN_EMAILS') || 'hoshaya@gmail.com')
  .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
const SUB_DOMAIN = Deno.env.get('SUB_EMAIL_DOMAIN') || 'sub.hoshaya.co.il';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

    // ── אימות שהקורא הוא מנהל ──
    const token = (req.headers.get('Authorization') || '').replace('Bearer ', '');
    const { data: { user }, error: uErr } = await admin.auth.getUser(token);
    if (uErr || !user || !ADMIN_EMAILS.includes((user.email || '').toLowerCase())) {
      return json({ error: 'not authorized' }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action;
    const codeToEmail = (c: string) => String(c).trim().toLowerCase() + '@' + SUB_DOMAIN;

    if (action === 'create') {
      const code = String(body.code || '').trim();
      if (code.length < 6) return json({ error: 'הקוד חייב להיות 6 תווים לפחות' }, 400);
      const email = codeToEmail(code);
      let userId: string | null = null;
      const { data, error } = await admin.auth.admin.createUser({
        email, password: code, email_confirm: true,
      });
      if (error) {
        // כנראה כבר קיים — מאתרים ומעדכנים (חידוש/הארכת תוקף)
        const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
        const existing = (list?.users || []).find((x) => (x.email || '').toLowerCase() === email);
        if (!existing) return json({ error: error.message }, 400);
        userId = existing.id;
      } else {
        userId = data.user?.id || null;
      }
      if (userId) {
        const { error: pErr } = await admin.from('profiles').upsert({
          id: userId,
          label: body.label || null,
          subscription_expires: body.expiry || null,
          subscriber_status: 'active',
        });
        // חשוב: לא לשתוק על כשל שמירה — אחרת התוקף "נעלם"
        if (pErr) return json({ error: 'המנוי נוצר אך שמירת התוקף נכשלה: ' + pErr.message }, 500);
      }
      return json({ ok: true, code });
    }

    if (action === 'delete') {
      const email = codeToEmail(body.code || '');
      const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
      const u = (list?.users || []).find((x) => (x.email || '').toLowerCase() === email);
      if (!u) return json({ error: 'המנוי לא נמצא' }, 404);
      const { error } = await admin.auth.admin.deleteUser(u.id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (action === 'list') {
      const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
      const users = (list?.users || []).filter((u) => (u.email || '').endsWith('@' + SUB_DOMAIN));
      // מצרפים תוקף/סטטוס/תיאור מטבלת profiles
      const ids = users.map((u) => u.id);
      const { data: profs } = ids.length
        ? await admin.from('profiles').select('id,subscription_expires,subscriber_status,label').in('id', ids)
        : { data: [] };
      const pmap = new Map((profs || []).map((p: any) => [p.id, p]));
      const subs = users.map((u) => {
        const p: any = pmap.get(u.id) || {};
        return {
          code: (u.email || '').split('@')[0],
          created: u.created_at,
          lastSignIn: u.last_sign_in_at,
          expiry: p.subscription_expires || null,
          status: p.subscriber_status || 'active',
          label: p.label || null,
        };
      });
      return json({ subscribers: subs });
    }

    return json({ error: 'unknown action' }, 400);
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
