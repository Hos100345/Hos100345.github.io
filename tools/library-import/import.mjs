#!/usr/bin/env node
// ייבוא תיקיית עיצובים לספריית העיצובים (W-75) — כל קובץ נכנס כ-pending (ממתין לאישור), דרך הפעולה upload של design-library.
// ⛔ הקוד / הטוקן עוברים רק במשתני סביבה — לעולם לא בקובץ ולא בגיט.
//
//   DL_CODE=<קוד השותף> node tools/library-import/import.mjs <תיקיית-תמונות> <רשימה.csv> [--dry-run]
//   או בלי הגבלת קצב (מנהל): DL_ADMIN_JWT=<access_token של hoshaya@gmail.com> node tools/library-import/import.mjs …
//
// CSV (UTF-8, שורת כותרת): file,title,category[,contributor][,cut]
//   file — שם הקובץ בתוך התיקייה (jpg/png/webp, עד 10MB) · category — כוסות | מזוזות | תמונות | מחזיקי מפתחות | אחר
//   cut — רשות: קובץ PNG שקוף של האלמנט החתוך
// ממשיך מאיפה שעצר: מה שכבר עלה נרשם ב-<רשימה.csv>.done.json. על 429 (מגבלת 30 לשעה לקוד) — מחכה 10 דקות ומנסה שוב.
// משתנים נוספים: DL_ENDPOINT (ברירת מחדל: הפונקציה ב-Supabase של האתר), DL_CONTRIBUTOR (שם ברירת מחדל).
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const CATS = ['כוסות', 'מזוזות', 'תמונות', 'מחזיקי מפתחות', 'אחר'];
const MAX = 10 * 1024 * 1024;
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const DRY = process.argv.includes('--dry-run');
if (args.length < 2) { console.error('שימוש: DL_CODE=… node tools/library-import/import.mjs <תיקייה> <רשימה.csv> [--dry-run]'); process.exit(2); }
const [DIR, CSV] = args;
const CODE = (process.env.DL_CODE || '').trim(), JWT = (process.env.DL_ADMIN_JWT || '').trim();
if (!DRY && !CODE && !JWT) { console.error('חסר DL_CODE (קוד השותף) או DL_ADMIN_JWT במשתני הסביבה'); process.exit(2); }

// כתובת הפונקציה ומפתח ה-anon (ציבורי) — מתוך js/supabase-config.js, כדי לא לשכפל
const cfg = fs.readFileSync(path.join(ROOT, 'js/supabase-config.js'), 'utf8');
const SB_URL = (cfg.match(/url:\s*"([^"]+)"/) || [])[1];
const ANON = (cfg.match(/anonKey:\s*"([^"]+)"/) || [])[1];
const ENDPOINT = process.env.DL_ENDPOINT || SB_URL + '/functions/v1/design-library';

export function parseCsv(text) {
  const rows = []; let row = [], cell = '', q = false;
  text = text.replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; continue; }
    if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); cell = ''; if (row.some((c) => c.trim())) rows.push(row); row = []; }
    else cell += ch;
  }
  row.push(cell); if (row.some((c) => c.trim())) rows.push(row);
  const head = (rows.shift() || []).map((h) => h.trim().toLowerCase());
  return rows.map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] || '').trim()])));
}
export function sniff(b) {
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
  if (b.slice(0, 4).toString() === 'RIFF' && b.slice(8, 12).toString() === 'WEBP') return 'webp';
  return null;
}
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));
function asDataUrl(file, allowed) {
  const b = fs.readFileSync(file);
  const k = sniff(b);
  if (!k || !allowed.includes(k)) throw new Error('סוג קובץ לא נתמך (רק ' + allowed.join('/') + ')');
  if (b.length > MAX) throw new Error(`גדול מ-10MB (${(b.length / 1048576).toFixed(1)}MB) — להקטין ולהריץ שוב`);
  return `data:image/${k};base64,${b.toString('base64')}`;
}
async function send(body) {
  const h = { 'Content-Type': 'application/json', apikey: ANON };
  if (!CODE && JWT) h.Authorization = 'Bearer ' + JWT;
  for (let attempt = 1; ; attempt++) {
    let r, j;
    try {
      r = await fetch(ENDPOINT, { method: 'POST', headers: h, body: JSON.stringify(body), signal: AbortSignal.timeout(120000) });
      j = await r.json().catch(() => ({}));
    } catch (e) {
      if (attempt >= 4) throw new Error('אין חיבור לשרת: ' + e.message);
      await sleep(5000 * attempt); continue;
    }
    if (r.status === 429 && attempt < 30) { console.log(`   ⏸ ${j.error || 'מגבלת קצב'} — מחכה 10 דקות…`); await sleep(+process.env.DL_WAIT_MS || 600000); continue; }
    if ((r.status >= 500) && attempt < 4) { await sleep(5000 * attempt); continue; }
    if (!r.ok || j.error) { const e = new Error(j.error || 'HTTP ' + r.status); e.fatal = r.status === 401 || r.status === 403; throw e; }
    return j;
  }
}

const rows = parseCsv(fs.readFileSync(CSV, 'utf8'));
const DONE_FILE = CSV + '.done.json';
const done = fs.existsSync(DONE_FILE) ? JSON.parse(fs.readFileSync(DONE_FILE, 'utf8')) : {};
let ok = 0, dup = 0, skip = 0, fail = 0, already = 0;
console.log(`${rows.length} שורות · ${DRY ? 'בדיקה בלבד (dry-run)' : 'שולח ל-' + ENDPOINT}`);
for (const [i, r] of rows.entries()) {
  const tag = `[${i + 1}/${rows.length}] ${r.file}`;
  if (!r.file) { console.log(tag, '⚠ חסר שם קובץ'); skip++; continue; }
  if (done[r.file]) { already++; continue; }
  let category = r.category;
  if (!CATS.includes(category)) { if (category) console.log(tag, `⚠ קטגוריה "${category}" לא מוכרת → אחר`); category = 'אחר'; }
  let image, cut;
  try {
    image = asDataUrl(path.join(DIR, r.file), ['png', 'jpeg', 'webp']);
    if (r.cut) cut = asDataUrl(path.join(DIR, r.cut), ['png', 'webp']);
  } catch (e) { console.log(tag, '⚠ דילגתי:', e.message); skip++; continue; }
  if (DRY) { console.log(tag, '✓ תקין', category, r.title || ''); ok++; continue; }
  try {
    const j = await send({ action: 'upload', code: CODE || undefined, title: r.title || path.parse(r.file).name, category, contributor: r.contributor || process.env.DL_CONTRIBUTOR || undefined, image, cut });
    done[r.file] = j.id; fs.writeFileSync(DONE_FILE, JSON.stringify(done, null, 1));
    ok++; if (j.duplicate) dup++;
    console.log(tag, '✓', j.duplicate ? '(חשד לכפילות — מסומן לבדיקה)' : '');
  } catch (e) {
    console.log(tag, '✗', e.message); fail++;
    if (e.fatal) { console.error('עוצר — הקוד/הטוקן לא תקין.'); break; }
  }
}
console.log(`\nסיכום: ${ok} ${DRY ? 'תקינים' : 'עלו'} (${dup} חשד לכפילות) · ${already} כבר עלו קודם · ${skip} דולגו · ${fail} נכשלו`);
if (!DRY && ok) console.log('הכול ממתין לאישור בדף library/ → מצב מנהל → ⏳ ממתינים.');
process.exit(fail ? 1 : 0);
