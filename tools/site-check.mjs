#!/usr/bin/env node
// בדיקת האתר לפני פרסום (S-171). רץ ב-GitHub Actions על כל PR ועל כל push ל-main, ואפשר גם מקומית:
//   npm i --no-save playwright@1 axe-core@4 && npx playwright install chromium && node tools/site-check.mjs
// מה נבדק (הכללים המלאים ב-DESIGN.md):
//   1. תחביר — כל בלוק <script> בתוך כל דף HTML, וכל קובץ js/*.js
//   2. כללי HTML — lang="he" dir="rtl", <title>, viewport שלא חוסם הגדלה, alt לכל <img>, קישור להצהרת הנגישות בדפים ציבוריים
//   3. נגישות (axe-core, WCAG 2.1 AA — הבסיס של ת"י 5568) בטלפון 390×800 — כשל על בעיה בדרגת serious/critical
// קוד יציאה ≠ 0 = יש כשל, וה-PR מסומן באדום.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const require = createRequire(import.meta.url);
const errors = [], warns = [];
const err = (f, m) => errors.push(`✗ ${f}: ${m}`);
const warn = (f, m) => warns.push(`! ${f}: ${m}`);

// דפים פנימיים/הפניות — לא נבדקים לקישור הצהרת נגישות
const INTERNAL = /^(admin|manage|gallery-admin|stickers-admin|studio|games|play|dobble|dobble-info|one-match|404)\.html$/;
const SKIP_DIRS = new Set(['node_modules', '.git', 'vendor', 'supabase', 'tools', 'images', 'arie-tal', 'avisar', 'avishar']);

function htmlFiles(dir = ROOT, rel = '') {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const r = rel ? rel + '/' + e.name : e.name;
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) out.push(...htmlFiles(path.join(dir, e.name), r)); }
    else if (e.name.endsWith('.html')) out.push(r);
  }
  return out;
}

// ── 1+2: בדיקות סטטיות ──
const pages = htmlFiles();
for (const f of pages) {
  const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
  const redirect = /http-equiv=["']refresh/i.test(s) || s.length < 1500;
  const re = /<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi; let m, i = 0;
  while ((m = re.exec(s))) {
    i++; const attrs = m[1] || '';
    if (/\bsrc=/.test(attrs) || /type=["'](application\/(ld\+)?json|importmap|text\/template|x-shader)/i.test(attrs)) continue;
    const code = m[2]; if (!code.trim()) continue;
    if (/type=["']module/.test(attrs)) continue; // מודולים (import) — vm.Script לא מפרש אותם
    try { new vm.Script(code, { filename: `${f}#script${i}` }); } catch (e) { err(f, `שגיאת תחביר בסקריפט ${i}: ${e.message}`); }
  }
  if (redirect) continue;
  const lang = (s.match(/<html[^>]*\blang=["']([a-z-]+)["']/i) || [])[1];
  if (!lang) err(f, 'חסר lang בתגית <html>');
  else if (lang.startsWith('he') && !/<html[^>]*\bdir=["']rtl["']/i.test(s)) err(f, 'דף עברי בלי dir="rtl" בתגית <html>');
  if (!/<title>[^<]+<\/title>/i.test(s)) err(f, 'חסרה כותרת <title>');
  const vp = (s.match(/<meta[^>]+name=["']viewport["'][^>]*>/i) || [''])[0];
  if (!vp) err(f, 'חסר meta viewport');
  else if (/user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*1(\.0)?\b/i.test(vp)) err(f, 'ה-viewport חוסם הגדלה (WCAG 1.4.4)');
  const markup = s.replace(/<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>|<!--[\s\S]*?-->/gi, '');
  for (const img of markup.match(/<img\b[^>]*>/gi) || []) if (!/\balt=/.test(img)) err(f, 'תמונה בלי alt: ' + img.slice(0, 90));
  if (!INTERNAL.test(path.basename(f)) && !/accessibility\.html/.test(s)) err(f, 'אין קישור להצהרת הנגישות (חובה לפי החוק)');
}
for (const f of fs.readdirSync(path.join(ROOT, 'js')).filter(x => x.endsWith('.js'))) {
  const code = fs.readFileSync(path.join(ROOT, 'js', f), 'utf8');
  if (/^\s*(import|export)\s/m.test(code)) continue;
  try { new vm.Script(code, { filename: 'js/' + f }); } catch (e) { err('js/' + f, 'שגיאת תחביר: ' + e.message); }
}

// ── 3: axe בדפדפן ──
const STUDIO = ['stickers', 'keychains', 'cards', 'memory', 'quartets', 'bingo', 'domino', 'dice', 'puzzle', 'tangram', 'ludo', 'blessing', 'tshirt', 'mug', 'subl', 'snakes'];
const AXE_PAGES = [
  ...pages.filter(f => !/^(admin|manage|gallery-admin|stickers-admin)\.html$/.test(f) && !f.startsWith('studio/') && !/^(play|games)\//.test(f)),
  'play/', 'games/', ...STUDIO.map(p => 'studio/index.html?p=' + p),
];

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((q, r) => {
  let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  const fp = path.join(ROOT, p);
  if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(fp)] || 'application/octet-stream' }); fs.createReadStream(fp).pipe(r);
});
await new Promise(ok => server.listen(0, ok));
const BASE = `http://127.0.0.1:${server.address().port}/`;

let chromium, AXE;
try { ({ chromium } = require('playwright')); AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8'); }
catch (e) { err('setup', 'חסרים playwright / axe-core — npm i --no-save playwright@1 axe-core@4'); }

if (chromium) {
  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH, args: ['--no-sandbox'] } : {});
  // reducedMotion: אלמנטי .reveal נכנסים מ-opacity:0 ל-1 תוך 0.7s (ועד 0.3s השהיה).
  // axe מודד את הצבע *אחרי* המיזוג עם מה שמאחור, כך שכפתור שנתפס באמצע ההנפשה
  // מקבל ניגודיות שקרית — למשל .btn-hero-phone ב-one-match.html: 1.86:1 במקום 5.07:1
  // האמיתיים. ברץ עמוס ההנפשה מסתיימת אחרי ההמתנה למטה, ולכן אותו commit נכשל
  // פעם ועובר פעם. `prefers-reduced-motion` מקוצר ל-0.01ms ב-css/tokens.css, כך
  // שהדף מגיע מיד למצב הסופי — וזה גם המצב שהבדיקה אמורה לבדוק.
  const ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, locale: 'he-IL', reducedMotion: 'reduce' });
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, rt => rt.abort()); // בלי רשת חיצונית — הבדיקה יציבה ומהירה
  for (const u of AXE_PAGES) {
    const pg = await ctx.newPage(); const jsErr = [];
    pg.on('pageerror', e => jsErr.push(e.message));
    try {
      await pg.goto(BASE + u, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await pg.waitForTimeout(1200);
      // חגורה שנייה ל-reducedMotion: דף שלא טוען את css/tokens.css לא מקצר הנפשות,
      // ואז עדיין אפשר לתפוס .reveal באמצע הדהייה. מחכים שכל מה שנראה על המסך
      // יגיע ל-opacity סופי. מוגבל בזמן ולא מפיל את הבדיקה.
      await pg.waitForFunction(() => [...document.querySelectorAll('.reveal')].every(el => {
        const r = el.getBoundingClientRect();
        if (r.bottom <= 0 || r.top >= innerHeight || r.width === 0) return true;
        const o = getComputedStyle(el).opacity;
        return o === '1' || o === '0';
      }), null, { timeout: 4000 }).catch(() => {});
      await pg.addScriptTag({ content: AXE });
      const v = await pg.evaluate(async () => (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } }))
        .violations.map(x => ({ id: x.id, impact: x.impact, help: x.help, n: x.nodes.length, at: x.nodes.slice(0, 2).map(n => n.target.join(' ')) })));
      for (const x of v) (x.impact === 'serious' || x.impact === 'critical' ? err : warn)(u, `[axe ${x.id}] ${x.help} ×${x.n} — ${x.at.join(' | ')}`);
      for (const e of jsErr) if (!/supabase|fetch|network|Failed to load|net::/i.test(e)) err(u, 'שגיאת JS בטעינה: ' + e.slice(0, 160));
    } catch (e) { err(u, 'הדף לא נטען: ' + e.message.split('\n')[0]); }
    await pg.close();
  }
  await browser.close();
}
server.close();

console.log(`נבדקו ${pages.length} קבצי HTML, ${AXE_PAGES.length} דפים בדפדפן.`);
warns.forEach(w => console.log(w));
errors.forEach(e => console.log(e));
console.log(errors.length ? `\n${errors.length} כשלים — לתקן לפני פרסום.` : '\n✓ הכול עבר.');
process.exit(errors.length ? 1 : 0);
