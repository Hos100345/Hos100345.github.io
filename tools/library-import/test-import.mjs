#!/usr/bin/env node
// בדיקה לכלי הייבוא: שרת מקומי מזויף במקום design-library, תיקייה זמנית עם תמונות ו-CSV.
// בודק: גוף הבקשה (קוד, כותרת, קטגוריה, חיתוך), דילוג על קובץ לא-תמונה, קטגוריה לא מוכרת → אחר, המשך אחרי 429, ו-resume.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dl-import-'));
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
fs.writeFileSync(path.join(tmp, 'a.png'), PNG);
fs.writeFileSync(path.join(tmp, 'b.png'), PNG);
fs.writeFileSync(path.join(tmp, 'b-cut.png'), PNG);
fs.writeFileSync(path.join(tmp, 'c.txt'), 'not an image');
fs.writeFileSync(path.join(tmp, 'list.csv'), '﻿file,title,category,contributor,cut\na.png,"כוס, לסבתא",כוסות,,\nb.png,מזוזה,בלונים,דנה,b-cut.png\nc.txt,טקסט,אחר,,\n');

const got = []; let first429 = true;
const srv = http.createServer((q, r) => {
  let s = ''; q.on('data', (d) => { s += d; }); q.on('end', () => {
    const b = JSON.parse(s); got.push(b);
    if (b.title === 'מזוזה' && first429) { first429 = false; r.writeHead(429, { 'content-type': 'application/json' }); return r.end(JSON.stringify({ error: 'מגבלה' })); }
    r.writeHead(200, { 'content-type': 'application/json' }); r.end(JSON.stringify({ ok: true, id: 'id-' + got.length, duplicate: b.title === 'מזוזה' }));
  });
});
await new Promise((ok) => srv.listen(0, ok));
const run = () => new Promise((ok) => execFile(process.execPath, [path.join(HERE, 'import.mjs'), tmp, path.join(tmp, 'list.csv')],
  { env: { ...process.env, DL_CODE: 'TEST-CODE', DL_ENDPOINT: `http://127.0.0.1:${srv.address().port}/`, DL_WAIT_MS: '50' } }, (e, out) => ok({ code: e ? e.code : 0, out })));

let r = await run();
assert.equal(r.code, 0, r.out);
const ups = got.filter((b) => b.action === 'upload');
assert.equal(ups.length, 3); // a, b (429), b שוב
assert.equal(ups[0].code, 'TEST-CODE'); assert.equal(ups[0].title, 'כוס, לסבתא'); assert.equal(ups[0].category, 'כוסות');
assert.match(ups[0].image, /^data:image\/png;base64,/); assert.equal(ups[0].cut, undefined);
assert.equal(ups[2].category, 'אחר'); assert.equal(ups[2].contributor, 'דנה'); assert.match(ups[2].cut, /^data:image\/png;base64,/);
assert.match(r.out, /c\.txt ⚠ דילגתי/); assert.match(r.out, /2 עלו \(1 חשד לכפילות\)/);
// הרצה שנייה — הכול כבר עלה
got.length = 0; r = await run();
assert.equal(got.length, 0); assert.match(r.out, /2 כבר עלו קודם/);
srv.close(); fs.rmSync(tmp, { recursive: true });
console.log('✓ כלי הייבוא: גוף הבקשה, דילוג, קטגוריה, 429 והמשך, resume');
