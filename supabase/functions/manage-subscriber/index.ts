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

// מסלולי מנוי למנגנון ה"מנויים" הישן (profiles) — נפרד מהמדרגות של הרכישה החדשה, אבל אותם ערכי max_order.
// חמש הרמות החוקיות היחידות (תואם ל-ORDERS.total בפרונט — מבנה GF(4) של Dobble, לא כל מספר).
const VALID_MAX_ORDERS = [7, 13, 21, 31, 57];
// שלושה כינויים נוחים, מאושרים — freemium/paid/full. 13/21 נשלחים כמספר ישירות (body.maxOrder), לא דרך tier.
const ADMIN_TIERS: Record<string, number> = { freemium: 7, paid: 31, full: 57 };

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
    const adminEmail = (user.email || '').toLowerCase();

    // רישום audit — "מי, מה, על מי, מתי". לא חוסם את הפעולה הראשית אם הכתיבה נכשלת (רק נרשם ל-log של הפונקציה).
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
    const codeToEmail = (c: string) => String(c).trim().toLowerCase() + '@' + SUB_DOMAIN;

    async function findUserByCode(code: string) {
      const email = codeToEmail(code);
      const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
      return (list?.users || []).find((x) => (x.email || '').toLowerCase() === email) || null;
    }

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
        const existing = await findUserByCode(code);
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
      await logAudit('admin_create_subscriber', code, {});
      return json({ ok: true, code });
    }

    if (action === 'delete') {
      const code = String(body.code || '').trim();
      const u = await findUserByCode(code);
      if (!u) return json({ error: 'המנוי לא נמצא' }, 404);
      const { error } = await admin.auth.admin.deleteUser(u.id);
      if (error) return json({ error: error.message }, 400);
      await logAudit('admin_delete_subscriber', code, {});
      return json({ ok: true });
    }

    if (action === 'list') {
      const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
      const users = (list?.users || []).filter((u) => (u.email || '').endsWith('@' + SUB_DOMAIN));
      const codes = users.map((u) => (u.email || '').split('@')[0]);
      const ids = users.map((u) => u.id);

      // תוקף/סטטוס/תיאור/מסלול מטבלת profiles
      const { data: profs } = ids.length
        ? await admin.from('profiles').select('id,subscription_expires,subscriber_status,label,max_order,print_limit,print_count').in('id', ids)
        : { data: [] };
      const pmap = new Map((profs || []).map((p: any) => [p.id, p]));

      // שימוש בזמן אמת: אגרגציה של events לפי code — נעשית כאן בשרת (Deno), לא בדפדפן.
      // הדאטהסט קטן (מאות שורות) כך שסינון+ספירה בזיכרון עדיף על RPC ייעודי כרגע.
      const { data: evRows } = codes.length
        ? await admin.from('events').select('event,code').in('code', codes)
        : { data: [] };
      const usageMap = new Map<string, { logins: number; games: number; prints: number }>();
      for (const e of (evRows || [])) {
        const key = (e as any).code;
        if (!key) continue;
        const u = usageMap.get(key) || { logins: 0, games: 0, prints: 0 };
        if ((e as any).event === 'unlock') u.logins++;
        else if ((e as any).event === 'game') u.games++;
        else if ((e as any).event === 'print-order') u.prints++;
        usageMap.set(key, u);
      }

      // תיקיית עיצובים: כמות עיצובים + כמות סמלים שמורים — נגזר מ-designs.game_data, לא מקריאת Storage
      // (אותו מידע, בלי לשלם על list() רקורסיבי לכל תיקיית משתמש).
      const { data: designRows } = ids.length
        ? await admin.from('designs').select('user_id,game_data').in('user_id', ids)
        : { data: [] };
      const designAgg = new Map<string, { designsCount: number; symbolsCount: number }>();
      for (const d of (designRows || [])) {
        const uid = (d as any).user_id;
        const imgs = ((d as any).game_data && (d as any).game_data.images) || [];
        const agg = designAgg.get(uid) || { designsCount: 0, symbolsCount: 0 };
        agg.designsCount++;
        agg.symbolsCount += Array.isArray(imgs) ? imgs.length : 0;
        designAgg.set(uid, agg);
      }

      const subs = users.map((u) => {
        const p: any = pmap.get(u.id) || {};
        const code = (u.email || '').split('@')[0];
        const usage = usageMap.get(code) || { logins: 0, games: 0, prints: 0 };
        const dz = designAgg.get(u.id) || { designsCount: 0, symbolsCount: 0 };
        return {
          code,
          created: u.created_at,
          lastSignIn: u.last_sign_in_at,
          expiry: p.subscription_expires || null,
          status: p.subscriber_status || 'active',
          label: p.label || null,
          maxOrder: p.max_order != null ? p.max_order : null,
          printLimit: p.print_limit != null ? p.print_limit : null,
          printCount: p.print_count || 0,
          usage,
          designsCount: dz.designsCount,
          symbolsCount: dz.symbolsCount,
        };
      });
      return json({ subscribers: subs });
    }

    // שדרוג/שינוי מסלול — כל אחת מחמש הרמות החוקיות (7/13/21/31/57), לא רק שלושת הכינויים.
    // body.tier (freemium/paid/full) נשאר לתאימות/נוחות; body.maxOrder מקבל כל אחת מהחמש ישירות (כולל 13/21).
    if (action === 'set_tier') {
      const code = String(body.code || '').trim();
      let maxOrder: number;
      if (body.maxOrder != null) {
        maxOrder = Number(body.maxOrder);
        if (!VALID_MAX_ORDERS.includes(maxOrder)) {
          return json({ error: 'maxOrder לא תקין — ערכים חוקיים: ' + VALID_MAX_ORDERS.join('/') }, 400);
        }
      } else {
        const tier = String(body.tier || '');
        if (!(tier in ADMIN_TIERS)) return json({ error: 'יש לשלוח tier (freemium/paid/full) או maxOrder (7/13/21/31/57)' }, 400);
        maxOrder = ADMIN_TIERS[tier];
      }
      const u = await findUserByCode(code);
      if (!u) return json({ error: 'המנוי לא נמצא' }, 404);
      const { error } = await admin.from('profiles').upsert({ id: u.id, max_order: maxOrder });
      if (error) return json({ error: error.message }, 500);
      await logAudit('admin_set_tier', code, { maxOrder });
      return json({ ok: true, maxOrder });
    }

    // הארכת תוקף — days (מספר ימים מהיום/מהתוקף הקיים, המאוחר מביניהם) או unlimited:true (ללא הגבלה)
    if (action === 'extend') {
      const code = String(body.code || '').trim();
      const u = await findUserByCode(code);
      if (!u) return json({ error: 'המנוי לא נמצא' }, 404);
      let newExpiry: string | null = null;
      if (body.unlimited) {
        newExpiry = null;
      } else {
        const days = Number(body.days);
        if (!Number.isFinite(days) || days <= 0) return json({ error: 'days לא תקין' }, 400);
        const { data: prof } = await admin.from('profiles').select('subscription_expires').eq('id', u.id).maybeSingle();
        const current = prof?.subscription_expires ? new Date(prof.subscription_expires).getTime() : 0;
        const base = Math.max(current, Date.now());
        newExpiry = new Date(base + days * 86400000).toISOString();
      }
      const { error } = await admin.from('profiles').upsert({ id: u.id, subscription_expires: newExpiry });
      if (error) return json({ error: error.message }, 500);
      await logAudit('admin_extend', code, { unlimited: !!body.unlimited, days: body.days || null, newExpiry });
      return json({ ok: true, expiry: newExpiry });
    }

    // קביעת תאריך תפוגה מדויק (לא הארכה יחסית) — למקרה שהמנהל רוצה תאריך ספציפי
    // למנוי קיים, לא רק +days מהתוקף הנוכחי. expiry ריק/חסר = ללא הגבלה.
    if (action === 'set_expiry') {
      const code = String(body.code || '').trim();
      const u = await findUserByCode(code);
      if (!u) return json({ error: 'המנוי לא נמצא' }, 404);
      let newExpiry: string | null = null;
      if (body.expiry) {
        const d = new Date(body.expiry);
        if (isNaN(d.getTime())) return json({ error: 'תאריך לא תקין' }, 400);
        newExpiry = d.toISOString();
      }
      const { error } = await admin.from('profiles').upsert({ id: u.id, subscription_expires: newExpiry });
      if (error) return json({ error: error.message }, 500);
      await logAudit('admin_set_expiry', code, { newExpiry });
      return json({ ok: true, expiry: newExpiry });
    }

    // הגבלת ייצוא/הדפסה עצמאית בבית — הגנה מפני שימוש לרעה. printLimit ריק/null = ללא הגבלה (ברירת מחדל).
    // האכיפה בפועל היא ב-RPC נפרד (consume_print_quota, נקרא מהלקוח בכל ניסיון ייצוא) — זו רק קביעת המכסה.
    if (action === 'set_print_limit') {
      const code = String(body.code || '').trim();
      const u = await findUserByCode(code);
      if (!u) return json({ error: 'המנוי לא נמצא' }, 404);
      let printLimit: number | null = null;
      if (body.printLimit != null && body.printLimit !== '') {
        printLimit = Number(body.printLimit);
        if (!Number.isFinite(printLimit) || printLimit < 0) return json({ error: 'מספר לא תקין' }, 400);
      }
      const { error } = await admin.from('profiles').upsert({ id: u.id, print_limit: printLimit });
      if (error) return json({ error: error.message }, 500);
      await logAudit('admin_set_print_limit', code, { printLimit });
      return json({ ok: true, printLimit });
    }

    // איפוס מונה ההדפסות שנוצלו — לשימוש כשהמנהל רוצה "לפתוח מכסה חדשה" למנוי בלי לשנות את הגבלת ה-max שלו.
    if (action === 'reset_print_count') {
      const code = String(body.code || '').trim();
      const u = await findUserByCode(code);
      if (!u) return json({ error: 'המנוי לא נמצא' }, 404);
      const { error } = await admin.from('profiles').upsert({ id: u.id, print_count: 0 });
      if (error) return json({ error: error.message }, 500);
      await logAudit('admin_reset_print_count', code, {});
      return json({ ok: true });
    }

    // חסימה/שחרור — המנהל עצמו לעולם לא בטבלת המנויים (דומיין @sub.* בלבד) כך שאינו יכול לחסום את עצמו דרך הפעולה הזו.
    if (action === 'block' || action === 'unblock') {
      const code = String(body.code || '').trim();
      const u = await findUserByCode(code);
      if (!u) return json({ error: 'המנוי לא נמצא' }, 404);
      const status = action === 'block' ? 'disabled' : 'active';
      const { error } = await admin.from('profiles').upsert({ id: u.id, subscriber_status: status });
      if (error) return json({ error: error.message }, 500);
      await logAudit('admin_' + action, code, {});
      return json({ ok: true, status });
    }

    // העיצובים של מנוי — מחזיר למנהל את העיצובים השמורים בענן עם קישורי-תמונה חתומים (לתמיכה/צפייה בלבד)
    if (action === 'subscriber-designs') {
      const code = String(body.code || '').trim();
      const u = await findUserByCode(code);
      if (!u) return json({ error: 'המנוי לא נמצא' }, 404);
      const { data: designs, error } = await admin.from('designs')
        .select('id,name,game_data,created_at').eq('user_id', u.id).order('created_at', { ascending: false });
      if (error) return json({ error: error.message }, 400);
      const out = [];
      for (const dz of (designs || [])) {
        const gd: any = dz.game_data || {};
        const imgs: any[] = gd.images || [];
        const paths = imgs.map((im) => im.path).filter(Boolean);
        let byPath = new Map<string, string>();
        if (paths.length) {
          const { data: su } = await admin.storage.from('symbols').createSignedUrls(paths, 3600);
          byPath = new Map((su || []).map((s: any) => [s.path, s.signedUrl || s.signedURL]));
        }
        out.push({
          id: dz.id, name: dz.name, created_at: dz.created_at, settings: gd.settings || {},
          images: imgs.map((im) => ({
            id: im.id, name: im.name, type: im.type,
            srcAssetId: im.srcAssetId || null, isCropSource: im.isCropSource || false,
            url: byPath.get(im.path) || null,
          })),
        });
      }
      // Audit: כל פתיחת עיצוב של לקוח לצורך תמיכה נרשמת (מי, על מי, מתי)
      await logAudit('admin_view_designs', code, { designCount: out.length });
      return json({ designs: out });
    }

    return json({ error: 'unknown action' }, 400);
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
