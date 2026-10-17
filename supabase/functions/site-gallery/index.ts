// ============================================================
// גלריית האתר — Edge Function: site-gallery (W-30)
// תמונות האתר ב-bucket ציבורי site-gallery + טבלה public.site_gallery (קריאה ציבורית, כתיבה רק מכאן).
// verify_jwt=false — ההרשאה נבדקת כאן:
//   • פעולות מנהל (sign/add/update/delete/list): JWT של משתמש ב-ADMIN_EMAILS (כמו manage-customers).
//   • import_drive (העברה חד-פעמית מגוגל דרייב): טוקן חד-פעמי מ-site_gallery_jobs (נוצר ידנית ב-SQL, תוקף שעתיים).
// כל תמונה נשמרת בשני גדלים: 600 (גלריה) ו-1600 (תצוגה מלאה).
// ============================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const BUCKET = 'site-gallery';
const ADMIN_EMAILS = (Deno.env.get('ADMIN_EMAILS') || 'hoshaya@gmail.com').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
const CATS = ['bar','bar-chars','event-chars','characters','centerpieces','arch','column','hoop','garlands','hats','numbers','frame','rooms','events','workshops','printing','satisfied'];
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });
const UUID_RE = /^[0-9a-f-]{36}$/;
const PATH_RE = /^(up|drive)\/[A-Za-z0-9_-]+-(600|1600)\.(webp|jpg|png)$/;

async function fetchTimeout(url: string, ms: number) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
  try { return await fetch(url, { signal: c.signal, redirect: 'follow' }); } finally { clearTimeout(t); }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  let body: Record<string, any>;
  try { body = await req.json(); } catch { return json({ error: 'invalid_body' }, 400); }
  const action = String(body.action || '');

  // ── העברה מגוגל דרייב (טוקן חד-פעמי) ──
  if (action === 'import_drive') {
    const token = String(body.token || '');
    if (token.length < 24) return json({ error: 'unauthorized' }, 401);
    const { data: job } = await admin.from('site_gallery_jobs').select('token,created_at,used_at').eq('token', token).maybeSingle();
    if (!job || job.used_at || Date.now() - new Date(job.created_at).getTime() > 2 * 3600e3) return json({ error: 'unauthorized' }, 401);
    let items: any[] = Array.isArray(body.items) ? body.items.slice(0, 20) : [];
    // מקור חלופי: רשימת הגלריה מ-js/site-data.js בגיט (offset/limit) — כך לא צריך לשלוח את הרשימה בגוף הבקשה
    if (!items.length && Number.isInteger(body.offset)) {
      const r = await fetchTimeout('https://raw.githubusercontent.com/Hos100345/Hos100345.github.io/main/js/site-data.js', 20000);
      const src = await r.text();
      const g = src.slice(src.indexOf('gallery: ['));
      const all = [...g.slice(0, g.indexOf('\n  ],')).matchAll(/src:\s*"https:\/\/lh3\.googleusercontent\.com\/d\/([A-Za-z0-9_-]+)",\s*cat:\s*"([a-z-]+)",\s*alt:\s*"([^"]*)"/g)]
        .map((m, i) => ({ drive_id: m[1], cat: m[2], alt: m[3], sort: i }));
      items = all.slice(body.offset, body.offset + Math.min(20, Number(body.limit) || 20));
      if (body.count === true) return json({ ok: true, total: all.length });
    }
    const results: unknown[] = [];
    for (const it of items) {
      const id = String(it.drive_id || '');
      if (!/^[A-Za-z0-9_-]{10,80}$/.test(id) || !CATS.includes(it.cat)) { results.push({ id, ok: false, error: 'bad_item' }); continue; }
      try {
        const paths: Record<string, string> = {};
        for (const w of [600, 1600]) {
          const r = await fetchTimeout(`https://lh3.googleusercontent.com/d/${id}=w${w}`, 25000);
          const ct = r.headers.get('content-type') || '';
          if (!r.ok || !ct.startsWith('image/')) throw new Error(`fetch ${w}: ${r.status} ${ct}`);
          const ext = ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : 'jpg';
          const path = `drive/${id}-${w}.${ext}`;
          const buf = new Uint8Array(await r.arrayBuffer());
          const { error } = await admin.storage.from(BUCKET).upload(path, buf, { contentType: ct.split(';')[0], upsert: true, cacheControl: '31536000' });
          if (error) throw new Error('upload ' + error.message);
          paths[w] = path;
        }
        const { error } = await admin.from('site_gallery').upsert({ drive_id: id, cat: it.cat, alt: String(it.alt || '').slice(0, 200), sort: Number(it.sort) || 0, thumb_path: paths[600], full_path: paths[1600] }, { onConflict: 'drive_id,cat' });
        if (error) throw new Error('db ' + error.message);
        results.push({ id, ok: true });
      } catch (e) { results.push({ id, ok: false, error: String((e as Error).message || e) }); }
    }
    if (body.finish === true) await admin.from('site_gallery_jobs').update({ used_at: new Date().toISOString() }).eq('token', token);
    return json({ ok: true, results });
  }

  // ── פעולות מנהל ──
  const jwt = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const { data: { user } } = await admin.auth.getUser(jwt);
  if (!user || !ADMIN_EMAILS.includes((user.email || '').toLowerCase())) return json({ error: 'not authorized' }, 403);

  if (action === 'list') {
    const { data, error } = await admin.from('site_gallery').select('*').order('cat').order('sort');
    return error ? json({ error: error.message }, 500) : json({ ok: true, rows: data });
  }
  if (action === 'sign') {
    const n = Math.min(40, Math.max(1, Number(body.n) || 1));
    const out = [];
    for (let i = 0; i < n; i++) {
      const key = crypto.randomUUID().replace(/-/g, '');
      const pair: Record<string, string> = {};
      for (const w of [600, 1600]) {
        const path = `up/${key}-${w}.webp`;
        const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(path);
        if (error || !data) return json({ error: 'sign' }, 500);
        pair[`url${w}`] = data.signedUrl; pair[`path${w}`] = path;
      }
      out.push(pair);
    }
    return json({ ok: true, uploads: out });
  }
  if (action === 'add') {
    const rows = (Array.isArray(body.rows) ? body.rows : []).slice(0, 40).filter((r: any) => CATS.includes(r.cat) && PATH_RE.test(r.thumb_path) && PATH_RE.test(r.full_path));
    if (!rows.length) return json({ error: 'no_rows' }, 400);
    const { data: last } = await admin.from('site_gallery').select('sort').order('sort', { ascending: false }).limit(1).maybeSingle();
    let s = (last?.sort || 0) + 1;
    const { data, error } = await admin.from('site_gallery').insert(rows.map((r: any) => ({ cat: r.cat, alt: String(r.alt || '').slice(0, 200), thumb_path: r.thumb_path, full_path: r.full_path, sort: r.top ? -s++ : s++ }))).select();
    return error ? json({ error: error.message }, 500) : json({ ok: true, rows: data });
  }
  if (action === 'update') {
    if (!UUID_RE.test(String(body.id))) return json({ error: 'bad_id' }, 400);
    const patch: Record<string, unknown> = {};
    if (typeof body.hidden === 'boolean') patch.hidden = body.hidden;
    if (CATS.includes(body.cat)) patch.cat = body.cat;
    if (typeof body.alt === 'string') patch.alt = body.alt.slice(0, 200);
    if (Number.isFinite(body.sort)) patch.sort = body.sort;
    const { error } = await admin.from('site_gallery').update(patch).eq('id', body.id);
    return error ? json({ error: error.message }, 500) : json({ ok: true });
  }
  if (action === 'delete') {
    if (!UUID_RE.test(String(body.id))) return json({ error: 'bad_id' }, 400);
    const { data: row } = await admin.from('site_gallery').select('thumb_path,full_path').eq('id', body.id).maybeSingle();
    if (row) await admin.storage.from(BUCKET).remove([row.thumb_path, row.full_path].filter(Boolean));
    const { error } = await admin.from('site_gallery').delete().eq('id', body.id);
    return error ? json({ error: error.message }, 500) : json({ ok: true });
  }
  return json({ error: 'invalid_action' }, 400);
});
