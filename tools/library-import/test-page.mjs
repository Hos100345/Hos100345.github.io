#!/usr/bin/env node
// בדיקת דפדפן ל-library/index.html — הפונקציה design-library מוחלפת ב-page.route (בלי רשת אמיתית).
// הרצה: node tools/library-import/test-page.mjs [תיקייה-לצילומי-מסך]
//   צריך playwright (+ axe-core אם מותקן — אחרת מדלג על axe). מכשירים: Pixel 7 (מגע), 320px, 1366px.
// בודק: רשת + סינון + מיון, דירוג נשמר ומוצג (וגם אחרי רענון), העלאה עם/בלי חיתוך שולחת את הגוף הנכון,
//        קוד שגוי, מצב מנהל: אישור / דחייה / כפילות / קוד שותף, אפס שגיאות קונסול, אין גלילה אופקית.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch { pw = require('/opt/node22/lib/node_modules/playwright'); }
const { chromium, devices } = pw;
let AXE = null;
for (const p of ['axe-core/axe.min.js', process.env.AXE_PATH].filter(Boolean)) { try { AXE = fs.readFileSync(require.resolve(p), 'utf8'); break; } catch { /* */ } }
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const SHOTS = process.argv[2] || '';

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg' };
const server = http.createServer((q, r) => {
  let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  const fp = path.join(ROOT, p);
  if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(fp)] || 'application/octet-stream' }); fs.createReadStream(fp).pipe(r);
});
await new Promise((ok) => server.listen(0, ok));
const BASE = `http://127.0.0.1:${server.address().port}/`;

// ── שרת מזויף ──
const IMGS = ['images/games/hanukkah/1.webp', 'images/games/puzzle.webp', 'images/games/keychains-sq.webp', 'images/games/hanukkah/5.webp', 'images/games/war.webp', 'images/games/hanukkah/8.webp', 'images/brand/itzuvishi-logo-512.webp'];
const CATS = ['כוסות', 'מזוזות', 'תמונות', 'מחזיקי מפתחות', 'אחר'];
function makeState() {
  const items = Array.from({ length: 30 }, (_, i) => ({
    id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`, title: ['כוס לסבתא', 'מזוזה צבעונית', 'תמונה משפחתית', 'מחזיק לרכב', 'עיצוב חג'][i % 5] + ' ' + (i + 1),
    category: CATS[i % 5], contributor: i % 3 ? 'דנה' : '', created_at: new Date(Date.UTC(2026, 10, 25) - i * 86400e3).toISOString(),
    rating_avg: (i * 7) % 5 + (i % 2 ? .5 : 0), rating_count: i % 4 ? i : 0, width: 800, height: 800,
    url: BASE + IMGS[i % IMGS.length], thumb: BASE + IMGS[i % IMGS.length] + '?w=600',
  }));
  const pending = [
    { id: 'aaaaaaaa-0000-4000-8000-000000000001', title: 'כוס חדשה', category: 'כוסות', contributor: 'יוסי', status: 'pending', created_at: '2026-11-25T10:00:00Z', url: BASE + IMGS[0], thumb: BASE + IMGS[0], cut: BASE + IMGS[6], width: 1200, height: 900, rating_avg: 0, rating_count: 0, duplicate_of: null, dup: null, correction: '' },
    { id: 'aaaaaaaa-0000-4000-8000-000000000002', title: 'אותה כוס', category: 'כוסות', contributor: '', status: 'pending', created_at: '2026-11-25T11:00:00Z', url: BASE + IMGS[0], thumb: BASE + IMGS[0], cut: '', width: 1200, height: 900, rating_avg: 0, rating_count: 0, duplicate_of: items[0].id, dup: { id: items[0].id, title: items[0].title, status: 'approved', thumb: items[0].thumb, url: items[0].url }, correction: '' },
  ];
  return { items, pending, calls: [] };
}
async function stub(page, st) {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (rt) => {
    const u = rt.request().url();
    if (!u.includes('/functions/v1/design-library')) return rt.abort();
    const b = JSON.parse(rt.request().postData() || '{}');
    const auth = rt.request().headers().authorization || '';
    st.calls.push({ ...b, image: b.image ? b.image.slice(0, 30) + '…' + b.image.length : undefined, cut: b.cut ? b.cut.slice(0, 30) + '…' + b.cut.length : undefined, _auth: auth });
    const J = (o, s = 200) => rt.fulfill({ status: s, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(o) });
    if (b.action === 'list') {
      if (b.id) return J({ items: st.items.filter((x) => x.id === b.id), more: false });
      let L = st.items.filter((x) => !b.category || x.category === b.category);
      if (b.sort === 'top') L = [...L].sort((a, c) => c.rating_avg - a.rating_avg || c.rating_count - a.rating_count);
      const size = b.size || 24, p = b.page || 0;
      const cats = {}; st.items.forEach((x) => { cats[x.category] = (cats[x.category] || 0) + 1; });
      return J({ items: L.slice(p * size, p * size + size), more: L.length > (p + 1) * size, ...(p ? {} : { cats }) });
    }
    if (b.action === 'rate') { const it = st.items.find((x) => x.id === b.id); it.rating_count++; it.rating_avg = b.stars; return J({ ok: true, stars: b.stars, rating_avg: it.rating_avg, rating_count: it.rating_count }); }
    if (b.action === 'upload') {
      if (!b.code && auth !== 'Bearer tok.admin.x') return J({ error: 'חסר קוד שותף' }, 401);
      if (b.code && b.code !== 'ITZ-TEST') return J({ error: 'הקוד לא נכון. בדקו את הקוד שקיבלתם מהושעיה', reason: 'bad_code' }, 403);
      return J({ ok: true, id: 'new', duplicate: false });
    }
    if (b.action.startsWith('admin_')) {
      if (auth !== 'Bearer tok.admin.x') return J({ error: 'מנהל בלבד' }, 401);
      if (b.action === 'admin_list') return J({ items: b.status === 'pending' ? st.pending : [], more: false, counts: { pending: st.pending.length, approved: st.items.length, rejected: 0 }, code: { active: true, label: 'שותפים', created_at: '2026-11-20T00:00:00Z' } });
      if (b.action === 'admin_review') { if (b.status && b.status !== 'pending') st.pending = st.pending.filter((x) => x.id !== b.id); return J({ ok: true, item: {} }); }
      if (b.action === 'admin_set_code') return J({ ok: true, label: b.label || 'שותפים' });
      if (b.action === 'admin_delete') { st.pending = st.pending.filter((x) => x.id !== b.id); return J({ ok: true }); }
    }
    return J({ error: 'פעולה לא מוכרת' }, 400);
  });
}
const ADMIN_INIT = () => {
  localStorage.setItem('sb-test-auth-token', '{}');
  window.supabase = { createClient: () => ({ auth: {
    getSession: async () => ({ data: { session: { access_token: 'tok.admin.x' } } }),
    onAuthStateChange() {}, signOut: async () => ({}), signInWithOtp: async () => ({}), verifyOtp: async () => ({ data: {} }),
  } }) };
};

const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const failures = []; let passed = 0;
const t = async (name, fn) => { try { await fn(); passed++; console.log('✓', name); } catch (e) { failures.push(name); console.log('✗', name, '\n   ', e.message.split('\n').slice(0, 14).join('\n    ')); } };
async function open(ctxOpts, { admin = false, url = 'library/' } = {}) {
  const ctx = await browser.newContext({ locale: 'he-IL', ...ctxOpts });
  const page = await ctx.newPage(); const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', (e) => errs.push(e.message));
  const st = makeState(); await stub(page, st);
  if (admin) await page.addInitScript(ADMIN_INIT);
  await page.goto(BASE + url, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#grid .card', { timeout: 10000 });
  return { ctx, page, st, errs };
}
const noHScroll = async (page) => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'גלילה אופקית: ' + await page.evaluate(() => document.documentElement.scrollWidth + '>' + innerWidth));
const realErrs = (errs) => errs.filter((e) => !/ERR_FAILED|net::|Failed to load resource/.test(e));
const shot = async (page, n) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `lib-${n}.png`) }); };
// תמונה עם רקע לבן ועיגול צבעוני — לבדיקת החיתוך
const PNG_FILE = path.join(process.env.TMPDIR || '/tmp', 'dl-test-white.png');

const PIXEL = { ...devices['Pixel 7'], deviceScaleFactor: 2 };

await t('Pixel 7: רשת, סינון, מיון, טען עוד', async () => {
  const { ctx, page, st, errs } = await open(PIXEL);
  assert.equal(await page.locator('#grid .card').count(), 24);
  assert.equal(await page.locator('#moreBtn').isVisible(), true);
  await shot(page, 1);
  await page.click('#moreBtn'); await page.waitForFunction(() => document.querySelectorAll('#grid .card').length === 30);
  await page.click('#chips .chip:has-text("מזוזות")');
  await page.waitForFunction(() => document.querySelectorAll('#grid .card').length === 6);
  assert.equal(st.calls.at(-1).category, 'מזוזות');
  assert.equal(await page.locator('#chips .chip[aria-pressed="true"]').innerText().then((s) => s.includes('מזוזות')), true);
  await page.click('.seg button[data-sort="top"]');
  await page.waitForFunction(() => document.querySelector('.seg [data-sort="top"]').getAttribute('aria-pressed') === 'true');
  await page.waitForTimeout(200);
  assert.equal(st.calls.at(-1).sort, 'top');
  await noHScroll(page);
  if (AXE) {
    await page.addScriptTag({ content: AXE });
    const v = await page.evaluate(async () => (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } })).violations.filter((x) => x.impact === 'serious' || x.impact === 'critical').map((x) => x.id + ': ' + x.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')));
    assert.deepEqual(v, []);
  }
  assert.deepEqual(realErrs(errs), []);
  await ctx.close();
});

await t('Pixel 7: תצוגה + דירוג נשמר, נשלח עם מזהה מכשיר, ונזכר אחרי רענון', async () => {
  const { ctx, page, st, errs } = await open(PIXEL);
  await page.locator('#grid .card').nth(1).click();
  await page.waitForSelector('#dlgView:not([hidden])');
  await page.click('#stars .star:nth-child(4)');
  await page.waitForFunction(() => /נשמר/.test(document.getElementById('vAvg').textContent));
  const c = st.calls.find((x) => x.action === 'rate');
  assert.equal(c.stars, 4); assert.equal(c.id, st.items[1].id); assert.match(c.device, /^[A-Za-z0-9_-]{8,64}$/);
  assert.equal(await page.locator('#stars .star[aria-pressed="true"]').getAttribute('aria-label'), '4 כוכבים');
  assert.ok(page.url().includes('?d=' + st.items[1].id));
  await shot(page, 2);
  if (AXE) {
    await page.addScriptTag({ content: AXE });
    const v = await page.evaluate(async () => (await axe.run(document.getElementById('dlgView'), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } })).violations.filter((x) => x.impact === 'serious' || x.impact === 'critical').map((x) => x.id));
    assert.deepEqual(v, []);
  }
  await page.keyboard.press('Escape'); await page.waitForSelector('#dlgView[hidden]', { state: 'attached' });
  // קישור ישיר ?d= פותח את העיצוב, והדירוג שלי זכור
  await page.goto(BASE + 'library/?d=' + st.items[1].id); await page.waitForSelector('#dlgView:not([hidden])');
  assert.equal(await page.locator('#stars .star[aria-pressed="true"]').getAttribute('aria-label'), '4 כוכבים');
  assert.deepEqual(realErrs(errs), []);
  await ctx.close();
});

await t('Pixel 7: העלאה בלי חיתוך — ולידציה, קוד שגוי, שליחה תקינה', async () => {
  const { ctx, page, st, errs } = await open(PIXEL);
  // יוצרים PNG עם רקע לבן בדפדפן
  const b64 = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 400; c.height = 300; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 400, 300); x.fillStyle = '#0070C5'; x.beginPath(); x.arc(200, 150, 90, 0, 7); x.fill(); x.fillStyle = '#fff'; x.fillRect(180, 130, 40, 40); return c.toDataURL('image/png').split(',')[1]; });
  fs.writeFileSync(PNG_FILE, Buffer.from(b64, 'base64'));
  await page.click('#addBtn'); await page.waitForSelector('#dlgUp:not([hidden])');
  await page.click('#upSend'); assert.match(await page.textContent('#upMsg'), /בחרו קודם תמונה/);
  await page.setInputFiles('#upFile', PNG_FILE);
  await page.waitForSelector('#upPrev:not([hidden])');
  assert.equal(await page.inputValue('#upTitle'), 'dl test white');
  await page.fill('#upTitle', 'כוס עם עיגול');
  await page.click('#upSend'); assert.match(await page.textContent('#upMsg'), /על מה העיצוב/);
  await page.click('#upCats button:has-text("כוסות")');
  await page.click('#upSend'); assert.match(await page.textContent('#upMsg'), /קוד השותף/);
  await page.fill('#upCode', 'wrong'); await page.fill('#upName', 'רותי');
  await page.click('#upSend'); assert.match(await page.textContent('#upMsg'), /מאשרים/);
  await page.check('#upOk');
  await shot(page, 3);
  await page.click('#upSend'); await page.waitForFunction(() => /הקוד לא נכון/.test(document.getElementById('upMsg').textContent));
  assert.equal(await page.getAttribute('#upCode', 'aria-invalid'), 'true');
  await page.fill('#upCode', 'ITZ-TEST'); await page.click('#upSend');
  await page.waitForSelector('#upDone:not([hidden])');
  const c = st.calls.filter((x) => x.action === 'upload').at(-1);
  assert.equal(c.code, 'ITZ-TEST'); assert.equal(c.title, 'כוס עם עיגול'); assert.equal(c.category, 'כוסות'); assert.equal(c.contributor, 'רותי');
  assert.match(c.image, /^data:image\/png;base64,/); assert.equal(c.cut, undefined);
  assert.equal(await page.evaluate(() => localStorage.getItem('dl_code')), 'ITZ-TEST');
  // פעם הבאה: הקוד והשם זכורים
  await page.click('#upAgain');
  assert.equal(await page.inputValue('#upCode'), 'ITZ-TEST'); assert.equal(await page.inputValue('#upName'), 'רותי');
  await noHScroll(page);
  assert.deepEqual(realErrs(errs), []);
  await ctx.close();
});

await t('Pixel 7: העלאה עם חיתוך + הסרת רקע לבן → cut PNG שקוף ומקוצץ', async () => {
  const { ctx, page, st, errs } = await open(PIXEL);
  await page.click('#addBtn'); await page.setInputFiles('#upFile', PNG_FILE); await page.waitForSelector('#upPrev:not([hidden])');
  await page.click('#cutBtn'); await page.waitForSelector('#cutBox:not([hidden])');
  // סליידר נעול במגע עד נגיעה בשורה שלו
  await page.check('#cutWhite');
  assert.equal(await page.$eval('#cutTol', (e) => e.style.pointerEvents), 'none');
  await page.tap('#tolRow label'); await page.waitForTimeout(450);
  assert.equal(await page.$eval('#cutTol', (e) => e.style.pointerEvents), 'auto');
  await page.$eval('#cutTol', (e) => { e.value = 40; e.dispatchEvent(new Event('input', { bubbles: true })); });
  // גרירה על התמונה (סימון אזור) ואז "כל התמונה"
  const bb = await page.locator('#cutCv').boundingBox();
  await page.mouse.move(bb.x + 5, bb.y + 5); await page.mouse.down(); await page.mouse.move(bb.x + bb.width * .6, bb.y + bb.height * .6, { steps: 4 }); await page.mouse.up();
  const sel = await page.evaluate(() => window.__lib.UP.sel); assert.ok(sel.w > .4 && sel.w < .7, JSON.stringify(sel));
  await page.click('#cutAll');
  await page.waitForTimeout(250);
  await page.click('#cutSave');
  assert.match(await page.textContent('#cutState'), /החיתוך יישלח/);
  const info = await page.evaluate(() => new Promise((ok) => { const i = new Image(); i.onload = () => { const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const x = c.getContext('2d'); x.drawImage(i, 0, 0); ok({ w: i.width, h: i.height, corner: x.getImageData(1, 1, 1, 1).data[3], mid: x.getImageData(i.width / 2 | 0, 8, 1, 1).data[3], hole: x.getImageData(i.width / 2 | 0, i.height / 2 | 0, 1, 1).data[3] }); }; i.src = window.__lib.UP.cut; }));
  assert.ok(info.w <= 184 && info.w >= 176, 'קוצץ לעיגול: ' + JSON.stringify(info)); // העיגול 180px
  assert.equal(info.corner, 0); assert.equal(info.mid, 255);
  assert.equal(info.hole, 255, 'לבן בתוך העיצוב נשאר (מילוי מהשוליים בלבד)');
  await page.click('#upCats button:has-text("אחר")'); await page.fill('#upCode', 'ITZ-TEST'); await page.check('#upOk');
  await page.click('#upSend'); await page.waitForSelector('#upDone:not([hidden])');
  const c = st.calls.filter((x) => x.action === 'upload').at(-1);
  assert.match(c.cut, /^data:image\/png;base64,/); assert.equal(c.category, 'אחר');
  assert.deepEqual(realErrs(errs), []);
  await ctx.close();
});

await t('מנהל (Pixel 7): תור, אישור, דחייה ככפילות, קוד שותף', async () => {
  const { ctx, page, st, errs } = await open(PIXEL, { admin: true });
  await page.waitForSelector('#adminBar:not([hidden])');
  assert.equal(await page.textContent('#qN'), '2');
  await page.click('.tab[data-tab="queue"]'); await page.waitForSelector('#queue .qi');
  assert.equal(await page.locator('#queue .qi').count(), 2);
  assert.equal(await page.locator('#queue .dupbox').count(), 1);
  await shot(page, 4);
  await noHScroll(page);
  // אישור עם עריכת שם
  const first = page.locator('#queue .qi').first();
  await first.locator('input').first().fill('כוס חדשה ומתוקנת');
  await first.locator('button:has-text("אישור")').click();
  await page.waitForFunction(() => document.querySelectorAll('#queue .qi').length === 1);
  let c = st.calls.filter((x) => x.action === 'admin_review').at(-1);
  assert.equal(c.status, 'approved'); assert.equal(c.title, 'כוס חדשה ומתוקנת'); assert.equal(c.category, 'כוסות'); assert.equal(c._auth, 'Bearer tok.admin.x');
  // כפילות
  await page.locator('#queue .qi button:has-text("זו כפילות")').click();
  await page.waitForFunction(() => document.querySelectorAll('#queue .qi').length === 0);
  c = st.calls.filter((x) => x.action === 'admin_review').at(-1);
  assert.equal(c.status, 'rejected'); assert.equal(c.duplicate_of, st.items[0].id); assert.equal(c.correction, 'כפילות');
  // סימון כפילות ידני מתוך בורר — בתור חדש
  st.pending = [{ ...st.pending[0] || {}, id: 'aaaaaaaa-0000-4000-8000-000000000003', title: 'בלי חשד', category: 'מזוזות', status: 'pending', created_at: '2026-11-25T12:00:00Z', url: BASE + IMGS[1], thumb: BASE + IMGS[1], cut: '', dup: null, duplicate_of: null, correction: '' }];
  await page.click('#qReload'); await page.waitForSelector('#queue .qi');
  await page.click('#queue .qi button:has-text("סמן ככפילות")');
  await page.waitForSelector('#queue .picker button');
  await page.locator('#queue .picker button').nth(2).click();
  await page.waitForFunction(() => document.querySelectorAll('#queue .qi').length === 0);
  c = st.calls.filter((x) => x.action === 'admin_review').at(-1);
  assert.equal(c.status, 'rejected'); assert.equal(c.duplicate_of, st.items[2].id);
  // קוד שותף
  await page.click('.tab[data-tab="code"]'); await page.waitForSelector('#tab-code:not([hidden])');
  assert.match(await page.textContent('#codeNow'), /יש קוד פעיל/);
  await page.fill('#newCode', 'ab'); await page.click('#saveCode'); assert.match(await page.textContent('#codeMsg'), /4–40/);
  await page.click('#genCode'); const code = await page.inputValue('#newCode'); assert.match(code, /^ITZ-[A-Z0-9]{6}$/);
  await page.fill('#codeLabel', 'חברים'); await page.click('#saveCode');
  await page.waitForSelector('#codeShare:not([hidden])');
  c = st.calls.filter((x) => x.action === 'admin_set_code').at(-1);
  assert.equal(c.code, code); assert.equal(c.label, 'חברים');
  assert.ok((await page.inputValue('#shareTxt')).includes(code));
  await noHScroll(page);
  assert.deepEqual(realErrs(errs), []);
  await ctx.close();
});

await t('לא מנהל: אין מצב ניהול, ופעולות admin_ לא נקראות', async () => {
  const { ctx, page, st } = await open(PIXEL);
  await page.waitForTimeout(300);
  assert.equal(await page.isVisible('#adminBar'), false);
  assert.equal(st.calls.filter((x) => x.action.startsWith('admin_')).length, 0);
  await ctx.close();
});

await t('320px ו-1366px: אין גלילה אופקית (גם בחלון ההעלאה ובחיתוך)', async () => {
  for (const vp of [{ width: 320, height: 640 }, { width: 1366, height: 860 }]) {
    const { ctx, page, errs } = await open({ viewport: vp });
    await noHScroll(page);
    await page.locator('#grid .card').first().click(); await noHScroll(page); await page.click('#viewClose');
    await page.click('#addBtn'); await page.setInputFiles('#upFile', PNG_FILE); await page.waitForSelector('#upPrev:not([hidden])');
    await page.click('#cutBtn'); await page.check('#cutWhite'); await page.waitForTimeout(200);
    await noHScroll(page);
    assert.ok(await page.$eval('#dlgUp .modal-card', (e) => e.scrollWidth <= e.clientWidth + 1), 'גלילה אופקית בחלון ' + vp.width);
    assert.deepEqual(realErrs(errs), []);
    await ctx.close();
  }
});

await t('שגיאת שרת / בלי רשת: הודעה ברורה + נסו שוב', async () => {
  const ctx = await browser.newContext({ ...PIXEL, locale: 'he-IL' });
  const page = await ctx.newPage(); let fail = true;
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (rt) => (fail ? rt.abort('internetdisconnected') : rt.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [], more: false, cats: {} }) })));
  await page.goto(BASE + 'library/');
  await page.waitForFunction(() => /לא הצלחנו/.test(document.getElementById('libMsg').textContent));
  fail = false; await page.click('#libMsg button');
  await page.waitForSelector('#grid .empty');
  assert.match(await page.textContent('#grid .empty'), /הספרייה עוד ריקה/);
  await ctx.close();
});

await browser.close(); server.close();
console.log(`\n${passed} עברו, ${failures.length} נכשלו${AXE ? '' : ' (axe לא מותקן — דילגתי)'}.`);
process.exit(failures.length ? 1 : 0);
