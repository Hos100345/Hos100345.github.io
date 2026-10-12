// ============================================================
// נגן המשחק (/play/) — Edge Function: play-load (D-70)
// ציבורית (verify_jwt: false), כמו studio-order. כניסה עם קוד מנוי + אימייל
// → מחזירה את העיצוב האחרון של הלקוחה מהענן (הגדרות + קישורים חתומים לתמונות, שעה).
//
// אבטחה — הקוד הוא מפתח לתמונות של ילדים:
//  • קוד + אימייל חייבים להתאים (created_for). רק קוד עם code_only=true — מספיק הקוד (הושעיה מסמן).
//  • מנוי ישן בלי אימייל (לא בטבלת הקודים): הקוד נבדק כסיסמה ל-{code}@sub.hoshaya.co.il + תוקף/סטטוס
//    ב-profiles — אותם כללים בדיוק כמו הכניסה במחולל (D-71).
//  • כל ניסיון נרשם ב-play_login_attempts. יותר מ-8 כשלונות מאותה כתובת, או 5 על אותו קוד,
//    ב-15 דקות → חסימה זמנית (429).
//  • תשובת כשל אחידה — לא מגלים אם הקוד או האימייל שגוי.
//  • לא נוגעים ב-current_usage (כניסה לנגן אינה "שימוש" בקוד) ולא ב-redeem_access_code.
// ============================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });
const WINDOW_MIN = 15, MAX_FAIL_IP = 8, MAX_FAIL_CODE = 5;
const SUB_DOMAIN = 'sub.hoshaya.co.il';   // מנויי legacy: {code}@sub.hoshaya.co.il (js/supabase-config.js)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);
  try {
    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    const code = String(body?.code ?? '').trim();
    const email = String(body?.email ?? '').trim().toLowerCase();
    if (!code || code.length > 40 || email.length > 200) return json({ ok: false, error: 'bad_login' }, 400);
    const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || null;
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

    // ── הגבלת ניחושים ──
    const since = new Date(Date.now() - WINDOW_MIN * 60000).toISOString();
    const [byIp, byCode] = await Promise.all([
      ip ? admin.from('play_login_attempts').select('id', { count: 'exact', head: true }).eq('ok', false).eq('ip', ip).gte('at', since) : Promise.resolve({ count: 0 }),
      admin.from('play_login_attempts').select('id', { count: 'exact', head: true }).eq('ok', false).eq('code', code).gte('at', since),
    ]);
    if ((byIp.count || 0) >= MAX_FAIL_IP || (byCode.count || 0) >= MAX_FAIL_CODE) {
      return json({ ok: false, error: 'too_many' }, 429);
    }
    const log = (ok: boolean) => admin.from('play_login_attempts').insert({ ip, code, ok });

    // ── בדיקת הקוד — אותם כללים כמו redeem_access_code (התאמה מדויקת, פעיל, לא פג) ──
    const { data: rec } = await admin.from('dobble_access_codes')
      .select('code,created_for,is_active,expires_at,max_order,code_only').eq('code', code).maybeSingle();
    let ids: string[] = [], maxOrder = 7;
    if (rec) {
      const owner = String(rec.created_for || '').trim().toLowerCase();
      const valid = rec.is_active !== false
        && (!rec.expires_at || new Date(rec.expires_at) > new Date())
        && (rec.code_only === true || (!!email && email === owner));
      if (!valid) { await log(false); return json({ ok: false, error: 'bad_login' }, 401); }
      // העיצוב האחרון: חשבון האימייל של הקוד, או חשבון legacy של הקוד עצמו
      const wanted = new Set([owner, `${code.toLowerCase()}@${SUB_DOMAIN}`].filter(Boolean));
      const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
      ids = (list?.users || []).filter((u) => wanted.has((u.email || '').toLowerCase())).map((u) => u.id);
      maxOrder = rec.max_order ?? 7;
    } else {
      // ── מנוי ישן (legacy, בלי אימייל): הקוד = סיסמה לחשבון {code}@sub.hoshaya.co.il ──
      // בדיוק כמו subscriberLogin במחולל: signInWithPassword, ואז subscriptionGate (סטטוס + תוקף).
      const anon = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { auth: { persistSession: false } });
      const { data: si, error: siErr } = await anon.auth.signInWithPassword({ email: `${code.toLowerCase()}@${SUB_DOMAIN}`, password: code });
      if (siErr || !si?.user) { await log(false); return json({ ok: false, error: 'bad_login' }, 401); }
      const { data: prof } = await admin.from('profiles').select('subscription_expires,subscriber_status,max_order').eq('id', si.user.id).maybeSingle();
      // הקוד נכון — מכאן מותר להגיד למה לא נכנסים (כמו חלון החידוש במחולל)
      if (prof?.subscriber_status && prof.subscriber_status !== 'active') { await log(true); return json({ ok: false, error: 'disabled' }, 403); }
      if (prof?.subscription_expires && String(prof.subscription_expires).slice(0, 10) < new Date().toISOString().slice(0, 10)) {
        await log(true); return json({ ok: false, error: 'expired' }, 403);
      }
      ids = [si.user.id];
      maxOrder = prof?.max_order ?? 57;
    }
    await log(true);

    let design: unknown = null;
    if (ids.length) {
      const { data: rows } = await admin.from('designs').select('id,name,game_data,updated_at')
        .in('user_id', ids).order('updated_at', { ascending: false }).limit(20);
      const dz = (rows || []).find((r: any) => Array.isArray(r.game_data?.images) && r.game_data.images.length);
      if (dz) {
        const gd: any = dz.game_data;
        const imgs: any[] = gd.images;
        const paths = imgs.map((im) => im.path).filter(Boolean);
        const { data: su } = await admin.storage.from('symbols').createSignedUrls(paths, 3600);
        const byPath = new Map((su || []).map((s: any) => [s.path, s.signedUrl || s.signedURL]));
        design = {
          name: dz.name, updated_at: dz.updated_at, settings: gd.settings || {},
          images: imgs.map((im) => ({
            id: im.id, name: im.name || '', type: im.type,
            srcAssetId: im.srcAssetId || null, isCropSource: !!im.isCropSource, selected: im.selected !== false,
            af: im.af || null, url: byPath.get(im.path) || null,
          })),
        };
      }
    }
    return json({ ok: true, max_order: maxOrder, design });
  } catch (e) {
    return json({ ok: false, error: String((e as Error)?.message || e) }, 500);
  }
});
