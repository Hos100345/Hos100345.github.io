#!/usr/bin/env node
// בדיקות יחידה ל-supabase/functions/design-library/index.ts עם לקוח Supabase מזויף (בזיכרון).
// הרצה: node tools/library-import/test-function.mjs   (node 22.18+ — מריץ TypeScript ישירות)
// בודק: אימות קוד (hash), קוד שגוי + הגבלת ניסיונות, הגבלת קצב (שעה לקוד / יום לכולם / דירוגים), magic bytes,
//        גודל, כפילות מסומנת ולא חסומה, דירוג + ממוצע, list רק מאושרים, הרשאת מנהל, אישור מעביר קובץ, מחיקה, החלפת קוד.
import { register } from 'node:module';
import assert from 'node:assert/strict';
import path from 'node:path';

// "jsr:@supabase/supabase-js@2" → בדל ריק (הלקוח האמיתי לא נוצר ב-node; handle מקבל את המזויף)
register('data:text/javascript,' + encodeURIComponent(`
export async function resolve(s, c, next) {
  if (s.startsWith('jsr:') || s.startsWith('npm:')) return { url: 'data:text/javascript,export const createClient=()=>null;', shortCircuit: true };
  return next(s, c);
}`));
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const F = await import(path.join(ROOT, 'supabase/functions/design-library/index.ts'));

// ── Supabase מזויף ──
function fakeDb({ admins = { 'tok.admin.x': 'hoshaya@gmail.com', 'tok.user.x': 'someone@x.com' }, missing = [] } = {}) {
  const tables = { design_library: [], design_library_codes: [], design_ratings: [], design_library_log: [] };
  const files = new Map();
  let logId = 0;
  const recalc = (id) => {
    const rs = tables.design_ratings.filter((r) => r.design_id === id);
    const row = tables.design_library.find((r) => r.id === id);
    if (row) { row.rating_count = rs.length; row.rating_avg = rs.length ? Math.round(rs.reduce((a, r) => a + r.stars, 0) / rs.length * 100) / 100 : 0; }
  };
  function q(t) {
    const st = { filters: [], order: [], op: 'select', head: false, count: false, single: false, range: null, limit: null };
    const b = {
      select(cols, o = {}) { if (st.op === 'select') st.op = 'select'; st.ret = true; st.head = !!o.head; st.count = !!o.count; return b; },
      eq(k, v) { st.filters.push((r) => r[k] === v); return b; },
      neq(k, v) { st.filters.push((r) => r[k] !== v); return b; },
      gte(k, v) { st.filters.push((r) => r[k] >= v); return b; },
      in(k, vs) { st.filters.push((r) => vs.includes(r[k])); return b; },
      order(k, o = {}) { st.order.push([k, o.ascending !== false]); return b; },
      range(a, z) { st.range = [a, z]; return b; },
      limit(n) { st.limit = n; return b; },
      maybeSingle() { st.single = true; return b; },
      insert(row) { st.op = 'insert'; st.row = row; return b; },
      upsert(row, o = {}) { st.op = 'upsert'; st.row = row; st.conf = (o.onConflict || 'id').split(','); return b; },
      update(p) { st.op = 'update'; st.patch = p; return b; },
      delete() { st.op = 'delete'; return b; },
      then(ok, no) { return Promise.resolve().then(run).then(ok, no); },
    };
    function run() {
      if (missing.includes(t)) return { data: null, error: { message: `relation "${t}" does not exist` }, count: null };
      const T = tables[t];
      const match = (r) => st.filters.every((f) => f(r));
      if (st.op === 'insert') {
        const r = { created_at: new Date().toISOString(), ...st.row };
        if (t === 'design_library_log') r.id = ++logId;
        T.push(r); return { data: null, error: null };
      }
      if (st.op === 'upsert') {
        const ex = T.find((r) => st.conf.every((k) => r[k] === st.row[k]));
        if (ex) Object.assign(ex, st.row); else T.push({ created_at: new Date().toISOString(), ...st.row });
        if (t === 'design_ratings') recalc(st.row.design_id);
        return { data: null, error: null };
      }
      if (st.op === 'update') {
        const rs = T.filter(match); rs.forEach((r) => Object.assign(r, st.patch));
        return { data: st.single ? rs[0] || null : rs, error: null };
      }
      if (st.op === 'delete') {
        const keep = T.filter((r) => !match(r)); const gone = T.filter(match);
        T.length = 0; T.push(...keep);
        if (t === 'design_library') for (const g of gone) tables.design_ratings = tables.design_ratings.filter((r) => r.design_id !== g.id);
        return { data: null, error: null };
      }
      let rs = T.filter(match);
      for (const [k, asc] of [...st.order].reverse()) rs = [...rs].sort((a, b) => (a[k] > b[k] ? 1 : a[k] < b[k] ? -1 : 0) * (asc ? 1 : -1));
      if (st.head) return { data: null, count: rs.length, error: null };
      if (st.range) rs = rs.slice(st.range[0], st.range[1] + 1);
      if (st.limit) rs = rs.slice(0, st.limit);
      return { data: st.single ? rs[0] || null : rs.map((r) => ({ ...r })), error: null, count: rs.length };
    }
    return b;
  }
  const storage = {
    from() {
      return {
        async upload(p, bytes) { if (files.has(p)) return { error: { message: 'exists' } }; files.set(p, bytes); return { data: { path: p }, error: null }; },
        async createSignedUrl(p, ttl, o) { return { data: { signedUrl: `https://signed/${p}${o?.transform ? '?w=' + o.transform.width : ''}` }, error: null }; },
        async createSignedUrls(ps) { return { data: ps.map((p) => ({ path: p, signedUrl: `https://signed/${p}` })), error: null }; },
        async move(a, z) { if (!files.has(a)) return { error: { message: 'not found' } }; files.set(z, files.get(a)); files.delete(a); return { error: null }; },
        async remove(ps) { ps.forEach((p) => files.delete(p)); return { error: null }; },
      };
    },
  };
  const auth = { async getUser(jwt) { return { data: { user: admins[jwt] ? { email: admins[jwt] } : null } }; } };
  return { from: q, storage, auth, tables, files };
}

const env = (k) => ({ ADMIN_EMAILS: 'hoshaya@gmail.com' })[k];
const call = async (db, body, { ip = '1.2.3.4', jwt } = {}) => {
  const h = { 'content-type': 'application/json', 'x-forwarded-for': ip };
  if (jwt) h.authorization = 'Bearer ' + jwt;
  const r = await F.handle(new Request('http://x/', { method: 'POST', headers: h, body: JSON.stringify(body) }), db, env);
  return { status: r.status, j: await r.json() };
};
// תמונות קטנות אמיתיות
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAMAAAACCAYAAACddGYaAAAAEElEQVR4nGP4z8DwH4YZYAAA9AT/AbHgTXQAAAAASUVORK5CYII=';
const PNG2 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const JPG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAACAAUBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
const FAKE = 'data:image/png;base64,' + Buffer.from('hello, not an image at all').toString('base64');

let n = 0; const t = async (name, fn) => { await fn(); n++; console.log('✓', name); };
const CODE = 'shutafim 2026';
const seedCode = async (db, code = CODE) => db.tables.design_library_codes.push({ code_hash: await F.codeHash(code), active: true, label: 'שותפים' });

await t('hash של הקוד: sha256("dl:"+UPPER בלי רווחים)', async () => {
  const crypto = await import('node:crypto');
  assert.equal(await F.codeHash(' shutafim 2026 '), crypto.createHash('sha256').update('dl:SHUTAFIM2026').digest('hex'));
  assert.equal(F.norm(' ab c '), 'ABC');
});
await t('magic bytes + מידות', async () => {
  const b = (d) => Uint8Array.from(Buffer.from(d.split(',')[1], 'base64'));
  assert.equal(F.sniff(b(PNG)), 'png'); assert.deepEqual(F.dims(b(PNG), 'png'), { w: 3, h: 2 });
  assert.equal(F.sniff(b(JPG)), 'jpeg'); assert.deepEqual(F.dims(b(JPG), 'jpeg'), { w: 5, h: 2 });
  assert.equal(F.sniff(b(FAKE)), null);
  assert.ok('error' in F.parseImage(FAKE, ['png']));
  assert.ok('error' in F.parseImage(JPG.replace('image/jpeg', 'image/png'), ['png', 'jpeg'])); // סוג מוצהר ≠ תוכן
  assert.ok('error' in F.parseImage('data:image/gif;base64,R0lGOD', ['png']));
  const big = 'data:image/png;base64,' + 'A'.repeat(Math.ceil((F.MAX_IMAGE + 10) * 4 / 3));
  assert.match(F.parseImage(big, ['png']).error, /10MB/);
});
await t('upload בלי קוד → 401, קוד שגוי → 403 ונרשם', async () => {
  const db = fakeDb(); await seedCode(db);
  assert.equal((await call(db, { action: 'upload', image: PNG })).status, 401);
  const r = await call(db, { action: 'upload', code: 'nope', image: PNG });
  assert.equal(r.status, 403); assert.equal(r.j.reason, 'bad_code');
  assert.equal(db.tables.design_library_log.filter((l) => l.action === 'bad_code').length, 1);
  assert.equal(db.tables.design_library.length, 0);
});
await t('קוד מושבת → 403', async () => {
  const db = fakeDb(); await seedCode(db); db.tables.design_library_codes[0].active = false;
  assert.equal((await call(db, { action: 'upload', code: CODE, image: PNG })).status, 403);
});
await t('יותר מ-20 קודים שגויים ברבע שעה מאותה כתובת → 429', async () => {
  const db = fakeDb(); await seedCode(db);
  for (let i = 0; i < 21; i++) await call(db, { action: 'upload', code: 'x' + i, image: PNG });
  assert.equal((await call(db, { action: 'upload', code: CODE, image: PNG })).status, 429);
  assert.equal((await call(db, { action: 'upload', code: CODE, image: PNG }, { ip: '9.9.9.9' })).status, 200);
});
await t('upload תקין → pending, קובץ ב-pending/, מידות, sha, בלי חשיפת הקוד', async () => {
  const db = fakeDb(); await seedCode(db);
  const r = await call(db, { action: 'upload', code: 'SHUTAFIM2026', title: ' כוס  לסבתא ', category: 'כוסות', contributor: 'דנה', image: PNG, cut: PNG2 });
  assert.equal(r.status, 200); assert.equal(r.j.ok, true); assert.equal(r.j.duplicate, false);
  const row = db.tables.design_library[0];
  assert.equal(row.status, 'pending'); assert.equal(row.title, 'כוס לסבתא'); assert.equal(row.category, 'כוסות'); assert.equal(row.contributor, 'דנה');
  assert.equal(row.asset_path, `pending/${r.j.id}.png`); assert.equal(row.asset_cut_path, `pending/${r.j.id}-cut.png`);
  assert.equal(row.width, 3); assert.equal(row.height, 2); assert.equal(row.file_sha256.length, 64);
  assert.ok(db.files.has(row.asset_path) && db.files.has(row.asset_cut_path));
  assert.ok(!JSON.stringify(db.tables).includes('SHUTAFIM'));
});
await t('קטגוריה לא מוכרת → "אחר", קובץ מזויף → 400, חיתוך JPG → 400', async () => {
  const db = fakeDb(); await seedCode(db);
  await call(db, { action: 'upload', code: CODE, category: 'בלונים', image: JPG });
  assert.equal(db.tables.design_library[0].category, 'אחר');
  assert.equal((await call(db, { action: 'upload', code: CODE, image: FAKE })).status, 400);
  assert.equal((await call(db, { action: 'upload', code: CODE, image: PNG, cut: JPG })).status, 400);
});
await t('כפילות: אותו קובץ → נכנס ומסומן duplicate_of (לא נחסם); אחרי דחייה — לא מסומן', async () => {
  const db = fakeDb(); await seedCode(db);
  const a = await call(db, { action: 'upload', code: CODE, image: PNG });
  const b = await call(db, { action: 'upload', code: CODE, image: PNG });
  assert.equal(b.status, 200); assert.equal(b.j.duplicate, true);
  assert.equal(db.tables.design_library.find((r) => r.id === b.j.id).duplicate_of, a.j.id);
  db.tables.design_library.forEach((r) => { r.status = 'rejected'; });
  const c = await call(db, { action: 'upload', code: CODE, image: PNG });
  assert.equal(c.j.duplicate, false);
});
await t('הגבלה: 30 העלאות לשעה לקוד', async () => {
  const db = fakeDb(); await seedCode(db);
  const h = await F.codeHash(CODE);
  for (let i = 0; i < 30; i++) db.tables.design_library_log.push({ who_hash: h, action: 'upload', ok: true, created_at: new Date().toISOString() });
  assert.equal((await call(db, { action: 'upload', code: CODE, image: PNG })).status, 429);
  db.tables.design_library_log.forEach((l) => { l.created_at = new Date(Date.now() - 2 * 3600e3).toISOString(); });
  assert.equal((await call(db, { action: 'upload', code: CODE, image: PNG })).status, 200);
});
await t('הגבלה: 300 ביום לכולם', async () => {
  const db = fakeDb(); await seedCode(db);
  const old = new Date(Date.now() - 2 * 3600e3).toISOString();
  for (let i = 0; i < 300; i++) db.tables.design_library_log.push({ who_hash: 'other' + i, action: 'upload', ok: true, created_at: old });
  assert.equal((await call(db, { action: 'upload', code: CODE, image: PNG })).status, 429);
});
await t('fail-open: בלי טבלת היומן ההעלאה עוברת', async () => {
  const db = fakeDb({ missing: ['design_library_log'] }); await seedCode(db);
  assert.equal((await call(db, { action: 'upload', code: CODE, image: PNG })).status, 200);
});
await t('בלי טבלת הקודים → 503 (לא fail-open — אי אפשר לאמת)', async () => {
  const db = fakeDb({ missing: ['design_library_codes'] });
  assert.equal((await call(db, { action: 'upload', code: CODE, image: PNG })).status, 503);
});
await t('מנהל מעלה בלי קוד ובלי הגבלה; משתמש רגיל עם JWT — 401', async () => {
  const db = fakeDb();
  assert.equal((await call(db, { action: 'upload', image: PNG }, { jwt: 'tok.admin.x' })).status, 200);
  assert.equal((await call(db, { action: 'upload', image: PNG }, { jwt: 'tok.user.x' })).status, 401);
});
await t('list: רק מאושרים, קטגוריה, מיון, דפדוף, קישורים חתומים + 600px', async () => {
  const db = fakeDb();
  const mk = (i, status, cat, avg) => ({ id: `00000000-0000-4000-8000-00000000000${i}`, created_at: `2026-11-2${i}T00:00:00Z`, title: 't' + i, category: cat, status, asset_path: `approved/${i}.png`, rating_avg: avg, rating_count: 1 });
  db.tables.design_library.push(mk(1, 'approved', 'כוסות', 5), mk(2, 'approved', 'מזוזות', 3), mk(3, 'pending', 'כוסות', 0), mk(4, 'rejected', 'כוסות', 0), mk(5, 'approved', 'כוסות', 4));
  let r = await call(db, { action: 'list' });
  assert.deepEqual(r.j.items.map((x) => x.title), ['t5', 't2', 't1']);
  assert.deepEqual(r.j.cats, { 'כוסות': 2, 'מזוזות': 1 });
  assert.match(r.j.items[0].thumb, /\?w=600$/); assert.doesNotMatch(r.j.items[0].url, /\?w=/);
  assert.ok(!('asset_path' in r.j.items[0]) && !('status' in r.j.items[0]));
  r = await call(db, { action: 'list', sort: 'top' }); assert.deepEqual(r.j.items.map((x) => x.title), ['t1', 't5', 't2']);
  r = await call(db, { action: 'list', category: 'כוסות' }); assert.deepEqual(r.j.items.map((x) => x.title), ['t5', 't1']);
  r = await call(db, { action: 'list', size: 2 }); assert.equal(r.j.more, true);
  r = await call(db, { action: 'list', size: 2, page: 1 }); assert.deepEqual(r.j.items.map((x) => x.title), ['t1']); assert.equal(r.j.more, false);
  r = await call(db, { action: 'list', id: mk(3).id }); assert.equal(r.j.items.length, 0); // ממתין — לא נחשף
  r = await call(db, { action: 'list', id: mk(2).id }); assert.equal(r.j.items[0].title, 't2');
});
await t('rate: עדכון ממוצע, הצבעה חוזרת מחליפה, מכשיר אחר נוסף, רק מאושר, 60 לשעה', async () => {
  const db = fakeDb();
  const id = '00000000-0000-4000-8000-000000000001';
  db.tables.design_library.push({ id, status: 'approved', asset_path: 'approved/1.png', rating_avg: 0, rating_count: 0 },
    { id: '00000000-0000-4000-8000-000000000002', status: 'pending', asset_path: 'pending/2.png' });
  let r = await call(db, { action: 'rate', id, stars: 5, device: 'dev-aaaaaaaa' });
  assert.equal(r.j.rating_avg, 5); assert.equal(r.j.rating_count, 1);
  r = await call(db, { action: 'rate', id, stars: 3, device: 'dev-aaaaaaaa' });
  assert.equal(r.j.rating_avg, 3); assert.equal(r.j.rating_count, 1);
  r = await call(db, { action: 'rate', id, stars: 4, device: 'dev-bbbbbbbb' });
  assert.equal(r.j.rating_avg, 3.5); assert.equal(r.j.rating_count, 2);
  assert.equal((await call(db, { action: 'rate', id, stars: 6, device: 'dev-aaaaaaaa' })).status, 400);
  assert.equal((await call(db, { action: 'rate', id, stars: 5, device: 'x' })).status, 400);
  assert.equal((await call(db, { action: 'rate', id: '00000000-0000-4000-8000-000000000002', stars: 5, device: 'dev-aaaaaaaa' })).status, 404);
  for (let i = 0; i < 60; i++) await call(db, { action: 'rate', id, stars: 1 + (i % 5), device: 'dev-cccccccc' });
  assert.equal((await call(db, { action: 'rate', id, stars: 5, device: 'dev-cccccccc' })).status, 429);
});
await t('admin_*: בלי JWT / משתמש רגיל → 401', async () => {
  const db = fakeDb();
  for (const a of ['admin_list', 'admin_review', 'admin_delete', 'admin_set_code']) {
    assert.equal((await call(db, { action: a })).status, 401);
    assert.equal((await call(db, { action: a }, { jwt: 'tok.user.x' })).status, 401);
  }
});
await t('admin_list + review: אישור מעביר קבצים ל-approved/, עריכה, כפילות, דחייה', async () => {
  const db = fakeDb(); await seedCode(db);
  const a = await call(db, { action: 'upload', code: CODE, image: PNG, cut: PNG2, title: 'א' });
  const b = await call(db, { action: 'upload', code: CODE, image: PNG, title: 'ב' });
  let L = await call(db, { action: 'admin_list', status: 'pending' }, { jwt: 'tok.admin.x' });
  assert.equal(L.status, 200); assert.equal(L.j.counts.pending, 2); assert.equal(L.j.items.length, 2);
  assert.equal(L.j.items[1].dup.id, a.j.id); assert.ok(L.j.items[0].cut); assert.equal(L.j.code.active, true);
  let r = await call(db, { action: 'admin_review', id: a.j.id, status: 'approved', title: 'כוס חדשה', category: 'כוסות' }, { jwt: 'tok.admin.x' });
  assert.equal(r.status, 200);
  const row = db.tables.design_library.find((x) => x.id === a.j.id);
  assert.equal(row.status, 'approved'); assert.equal(row.title, 'כוס חדשה'); assert.ok(row.reviewed_at);
  assert.equal(row.asset_path, `approved/${a.j.id}.png`); assert.equal(row.asset_cut_path, `approved/${a.j.id}-cut.png`);
  assert.ok(db.files.has(row.asset_path) && !db.files.has(`pending/${a.j.id}.png`));
  r = await call(db, { action: 'admin_review', id: b.j.id, status: 'rejected', duplicate_of: a.j.id, correction: 'כפילות' }, { jwt: 'tok.admin.x' });
  assert.equal(db.tables.design_library.find((x) => x.id === b.j.id).status, 'rejected');
  assert.equal((await call(db, { action: 'admin_review', id: b.j.id, duplicate_of: b.j.id }, { jwt: 'tok.admin.x' })).status, 400);
  assert.equal((await call(db, { action: 'admin_review', id: b.j.id, category: 'בלונים' }, { jwt: 'tok.admin.x' })).status, 400);
  r = await call(db, { action: 'admin_review', id: b.j.id, duplicate_of: null }, { jwt: 'tok.admin.x' });
  assert.equal(db.tables.design_library.find((x) => x.id === b.j.id).duplicate_of, null);
  L = await call(db, { action: 'list' }); assert.equal(L.j.items.length, 1);
});
await t('admin_delete: מוחק שורה, קבצים ודירוגים', async () => {
  const db = fakeDb(); await seedCode(db);
  const a = await call(db, { action: 'upload', code: CODE, image: PNG, cut: PNG2 });
  await call(db, { action: 'admin_review', id: a.j.id, status: 'approved' }, { jwt: 'tok.admin.x' });
  await call(db, { action: 'rate', id: a.j.id, stars: 4, device: 'dev-aaaaaaaa' });
  const r = await call(db, { action: 'admin_delete', id: a.j.id }, { jwt: 'tok.admin.x' });
  assert.equal(r.status, 200); assert.equal(db.tables.design_library.length, 0); assert.equal(db.files.size, 0); assert.equal(db.tables.design_ratings.length, 0);
});
await t('admin_set_code: קוד חדש פעיל, הישן מושבת, נשמר רק hash', async () => {
  const db = fakeDb(); await seedCode(db, 'OLD-CODE');
  assert.equal((await call(db, { action: 'admin_set_code', code: 'ab' }, { jwt: 'tok.admin.x' })).status, 400);
  const r = await call(db, { action: 'admin_set_code', code: 'new code 1', label: 'חברים' }, { jwt: 'tok.admin.x' });
  assert.equal(r.status, 200);
  assert.equal(db.tables.design_library_codes.filter((c) => c.active).length, 1);
  assert.ok(!JSON.stringify(db.tables).includes('NEWCODE1'));
  assert.equal((await call(db, { action: 'upload', code: 'OLD-CODE', image: PNG })).status, 403);
  assert.equal((await call(db, { action: 'upload', code: 'newcode1', image: PNG })).status, 200);
});
await t('CORS + שיטות + גוף לא תקין', async () => {
  const db = fakeDb();
  const o = await F.handle(new Request('http://x/', { method: 'OPTIONS' }), db, env);
  assert.equal(o.headers.get('access-control-allow-origin'), '*');
  assert.equal((await F.handle(new Request('http://x/'), db, env)).status, 405);
  assert.equal((await F.handle(new Request('http://x/', { method: 'POST', body: '{bad' }), db, env)).status, 400);
  assert.equal((await call(db, { action: 'nope' })).status, 400);
});
console.log(`\n${n} בדיקות עברו.`);
