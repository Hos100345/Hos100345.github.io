// ============================================================
// מודעות עיצובישי ← Google Drive (Google Apps Script, רץ בחשבון של הושעיה)
// השרת שלנו (Edge Function ads-drive) מעביר לכאן בקשות מעורך הפרסומת: מנהל ושותפים עם קוד.
// אין כאן סודות: הטוקן נשמר ב-Script Properties (setup), לא בקוד.
// מי שואל — נקבע ב-ads-drive ולא כאן: { admin:true|false, by:'admin'|'p-<hash>', label:'<שם השותף>' }.
// by הוא hash של קוד השותף — הקוד עצמו לא מגיע לכאן ולא נשמר בדרייב.
//
// התקנה חד-פעמית (מוסבר גם ב-README.md שליד הקובץ):
//   1. script.google.com → פרויקט חדש → להדביק את כל הקובץ הזה במקום מה שיש.
//   2. לבחור למעלה את הפונקציה setup → ▶ הפעלה → לאשר הרשאות (דרייב + גישה לרשת לתמונות הקטנות).
//      ביומן (Execution log) מופיע הטוקן — להעתיק.
//   3. Deploy → New deployment → Web app · Execute as: Me · Who has access: Anyone → Deploy.
//      להעתיק את ה-Web app URL.
//   4. ב-Supabase → Edge Functions → Secrets: DRIVE_ADS_URL = הכתובת, DRIVE_ADS_TOKEN = הטוקן.
//
// פעולות (S-190 + S-193):
//   save {name, dataUrl, note, folderId?}        מודעה גמורה (PNG/JPEG). שותף — תמיד לתיקייה שלו.
//   list                                          תמונות בתיקייה הראשית (S-190, נשאר כמו שהיה)
//   browse {folderId?, pageToken?}                תיקיות + תמונות עם תמונה קטנה (base64 ≤60KB), 30 בעמוד
//   file_get {id}                                 קובץ אחד כ-base64
//   templates                                     תיקיות "תבנית – …" (בראשית ובתיקיות השותפים) עם preview
//   template_get {id}                             template.json + רשימת הקבצים בתיקייה
//   template_save {step:'begin'|'file'|'finish'}  שמירה בכמה קריאות (תבנית גדולה) — ראו README
//   template_delete {id} · file_delete {id}       לפח. מותר למנהל או למי שיצר (description "by:…")
// ============================================================
const FOLDER_ID = '1JydT_5VV_BSZYPqn9cRqofbnVdPc6Jmb'; // "מודעות עיצובישי" בדרייב של הושעיה
const PARTNERS = 'שותפים';          // שותף שומר תחת שותפים/<השם שלו>/
const TPL = 'תבנית – ';             // תיקיית תבנית
const TMP = '⏳ ';                  // תבנית שבאמצע שמירה (לא מוצגת; מתחלפת בסוף)
const THUMB_MAX = 60 * 1024;        // תמונה קטנה בדפדפן
const PREVIEW_MAX = 220 * 1024;     // preview.jpg של תבנית
const FILE_MAX = 25 * 1024 * 1024;  // file_get
const PAGE = 30;                    // תמונות בעמוד של browse

function setup() {
  const t = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  PropertiesService.getScriptProperties().setProperty('TOKEN', t);
  DriveApp.getFolderById(FOLDER_ID).getName(); // מבקש הרשאת דרייב עכשיו, לא בבקשה הראשונה
  try { UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/about?fields=user', { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true }); } catch (e) {} // הרשאת רשת (תמונות קטנות)
  Logger.log('הטוקן (להעתיק ל-DRIVE_ADS_TOKEN ב-Supabase): ' + t);
}

function out(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
function fail(error, extra) { const o = { ok: false, error: error }; if (extra) for (const k in extra) o[k] = extra[k]; return out(o); }

// ── בעלות: description של כל קובץ/תיקייה שנוצרו כאן מתחיל ב-"by:<מי>" ──
function byOf(item) { const m = /(?:^|\s)by:(\S+)/.exec(String(item.getDescription() || '')); return m ? m[1] : ''; }
function tag(item, by, note) { item.setDescription('by:' + by + (note ? '\n' + String(note).slice(0, 450) : '')); }
function mine(item, w) { return !!w.by && byOf(item) === w.by; }
function canDel(item, w) { return w.admin || mine(item, w); }
function who(b) {
  const admin = b.admin === true;
  const by = admin ? 'admin' : String(b.by || '');
  if (!admin && !/^p-[0-9a-f]{8,64}$/.test(by)) throw new Error('bad_who');
  return { admin: admin, by: by, label: safe(b.label || 'שותף', 60) };
}
function safe(s, n) { return String(s || '').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, n || 120) || 'ללא שם'; }

// בתוך "מודעות עיצובישי"? (הולך למעלה בעץ, עד 10 רמות)
function inRoot(item) {
  if (item.getId() === FOLDER_ID) return true;
  let level = [item];
  for (let d = 0; d < 10 && level.length; d++) {
    const next = [];
    for (const it of level) {
      const ps = it.getParents();
      while (ps.hasNext()) { const p = ps.next(); if (p.getId() === FOLDER_ID) return true; next.push(p); }
    }
    level = next;
  }
  return false;
}
function folderIn(id) {
  if (!id || id === FOLDER_ID) return DriveApp.getFolderById(FOLDER_ID);
  const f = DriveApp.getFolderById(String(id));
  if (f.isTrashed() || !inRoot(f)) throw new Error('not_found');
  return f;
}
function fileIn(id) {
  const f = DriveApp.getFileById(String(id));
  if (f.isTrashed() || !inRoot(f)) throw new Error('not_found');
  return f;
}
function first(it) { while (it.hasNext()) { const x = it.next(); if (!x.isTrashed()) return x; } return null; }

// שותפים/<השם> — לפי התג של השותף (לא לפי השם: שני שותפים יכולים להיקרא אותו דבר)
function partnerFolder(w) {
  const root = DriveApp.getFolderById(FOLDER_ID);
  let P = first(root.getFoldersByName(PARTNERS));
  if (!P) { P = root.createFolder(PARTNERS); tag(P, 'admin'); }
  const it = P.getFolders(); const names = {};
  while (it.hasNext()) { const f = it.next(); if (f.isTrashed()) continue; if (byOf(f) === w.by) return f; names[f.getName()] = 1; }
  let name = w.label, i = 2; while (names[name]) name = w.label + ' (' + (i++) + ')';
  const f = P.createFolder(name); tag(f, w.by, 'התיקייה של ' + w.label);
  return f;
}
// לאן שומרים: שותף — תמיד לתיקייה שלו; מנהל — לתיקייה שבחר (בתוך הראשית) או לראשית
function target(b, w) { return w.admin ? folderIn(b.folderId) : partnerFolder(w); }

function decode(dataUrl, allow) {
  const m = /^data:(image\/(png|jpeg|webp));base64,(.+)$/.exec(String(dataUrl || ''));
  if (!m || (allow && allow.indexOf(m[2]) < 0)) return null;
  return { mime: m[1], ext: m[2] === 'jpeg' ? 'jpg' : m[2], bytes: Utilities.base64Decode(m[3]) };
}
const b64 = (mime, bytes) => 'data:' + mime + ';base64,' + Utilities.base64Encode(bytes);

// תמונות קטנות: thumbnailLink של Drive API (בגודל 240) — נשלפות כאן בשרת, כך שהדפדפן לא צריך חשבון גוגל.
// אם אין — getThumbnail() של DriveApp, ואם גם זה לא — הקובץ עצמו כשהוא קטן מספיק. אחרת null (הדפדפן מראה אייקון).
function thumbs(files) {
  const res = files.map(() => null);
  try {
    const H = { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() };
    const meta = UrlFetchApp.fetchAll(files.map(f => ({ url: 'https://www.googleapis.com/drive/v3/files/' + f.getId() + '?fields=thumbnailLink', headers: H, muteHttpExceptions: true })));
    const want = [];
    meta.forEach((r, i) => {
      if (r.getResponseCode() !== 200) return;
      const l = (JSON.parse(r.getContentText() || '{}') || {}).thumbnailLink;
      if (l) want.push({ i: i, req: { url: String(l).replace(/=s\d+$/, '') + '=s240', headers: H, muteHttpExceptions: true } });
    });
    if (want.length) UrlFetchApp.fetchAll(want.map(x => x.req)).forEach((r, j) => {
      if (r.getResponseCode() !== 200) return;
      const bl = r.getBlob(), by = bl.getBytes();
      if (by.length && by.length <= THUMB_MAX) res[want[j].i] = b64(bl.getContentType() || 'image/jpeg', by);
    });
  } catch (e) { /* בלי רשת — ממשיכים לגיבוי */ }
  files.forEach((f, i) => {
    if (res[i]) return;
    try { const t = f.getThumbnail(); if (t) { const by = t.getBytes(); if (by.length && by.length <= THUMB_MAX) { res[i] = b64(t.getContentType() || 'image/png', by); return; } } } catch (e) {}
    try { if (f.getSize() <= THUMB_MAX) res[i] = b64(f.getMimeType(), f.getBlob().getBytes()); } catch (e) {}
  });
  return res;
}

function crumbs(folder) {
  const path = []; let f = folder;
  for (let d = 0; d < 12 && f; d++) {
    path.unshift({ id: f.getId(), name: f.getId() === FOLDER_ID ? 'מודעות עיצובישי' : f.getName() });
    if (f.getId() === FOLDER_ID) break;
    const ps = f.getParents(); f = ps.hasNext() ? ps.next() : null;
  }
  return path;
}
function itemInfo(x, w) { return { id: x.getId(), name: x.getName(), mine: mine(x, w), canDelete: canDel(x, w), updated: x.getLastUpdated().toISOString() }; }

function browse(b, w) {
  const folder = folderIn(b.folderId);
  const r = { ok: true, folder: { id: folder.getId(), url: folder.getUrl() }, path: crumbs(folder), folders: [], files: [], next: null, myFolder: null };
  if (!b.pageToken) { // התיקיות רק בעמוד הראשון
    const it = folder.getFolders();
    while (it.hasNext() && r.folders.length < 200) {
      const f = it.next(); if (f.isTrashed() || f.getName().indexOf(TMP) === 0) continue;
      const o = itemInfo(f, w); o.template = f.getName().indexOf(TPL) === 0; if (o.template) o.title = f.getName().slice(TPL.length);
      r.folders.push(o);
    }
    r.folders.sort((a, c) => (a.template - c.template) || a.name.localeCompare(c.name, 'he'));
  }
  const it = b.pageToken ? DriveApp.continueFileIterator(String(b.pageToken)) : folder.getFiles();
  const got = [];
  while (it.hasNext() && got.length < PAGE) { const f = it.next(); if (f.isTrashed() || !/^image\//.test(f.getMimeType())) continue; got.push(f); }
  if (it.hasNext()) r.next = it.getContinuationToken();
  const th = thumbs(got);
  got.forEach((f, i) => { const o = itemInfo(f, w); o.mime = f.getMimeType(); o.size = f.getSize(); o.thumb = th[i]; r.files.push(o); });
  if (!w.admin) { try { const p = partnerFolder(w); r.myFolder = { id: p.getId(), name: PARTNERS + '/' + p.getName() }; } catch (e) {} }
  return out(r);
}

function fileGet(b) {
  const f = fileIn(b.id);
  if (f.getSize() > FILE_MAX) return fail('too_big');
  return out({ ok: true, id: f.getId(), name: f.getName(), mime: f.getMimeType(), data: Utilities.base64Encode(f.getBlob().getBytes()) });
}

function previewOf(folder) {
  const p = first(folder.getFilesByName('preview.jpg'));
  if (!p || p.getSize() > PREVIEW_MAX) return null;
  return b64('image/jpeg', p.getBlob().getBytes());
}
function templates(w) {
  const root = DriveApp.getFolderById(FOLDER_ID), list = [];
  const scan = (folder, where) => {
    const it = folder.getFolders();
    while (it.hasNext() && list.length < 80) {
      const f = it.next(); if (f.isTrashed() || f.getName().indexOf(TPL) !== 0) continue;
      const o = itemInfo(f, w); o.title = f.getName().slice(TPL.length); o.where = where; o.preview = previewOf(f); list.push(o);
    }
  };
  scan(root, '');
  const P = first(root.getFoldersByName(PARTNERS));
  if (P) { const it = P.getFolders(); while (it.hasNext()) { const f = it.next(); if (!f.isTrashed()) scan(f, f.getName()); } }
  list.sort((a, c) => (a.updated < c.updated ? 1 : -1));
  return out({ ok: true, templates: list });
}

function templateFolder(id) {
  const f = folderIn(id);
  if (f.getId() === FOLDER_ID || f.getName().indexOf(TPL) !== 0) throw new Error('not_template');
  return f;
}
function templateGet(b, w) {
  const f = templateFolder(b.id);
  const j = first(f.getFilesByName('template.json'));
  if (!j) return fail('broken_template');
  const files = [], it = f.getFiles();
  while (it.hasNext()) { const x = it.next(); if (x.isTrashed()) continue; const n = x.getName(); if (n === 'template.json' || n === 'preview.jpg') continue; files.push({ id: x.getId(), name: n, mime: x.getMimeType(), size: x.getSize() }); }
  const o = itemInfo(f, w); o.title = f.getName().slice(TPL.length);
  return out({ ok: true, folder: o, template: JSON.parse(j.getBlob().getDataAsString('UTF-8')), files: files });
}

// שמירת תבנית בכמה קריאות: begin → file (לכל תמונה) → finish. עד finish התבנית בתיקייה "⏳ תבנית – …" שלא מוצגת,
// וב-finish היא מקבלת את השם הסופי (ואם יש ישנה באותו שם ומותר לדרוס — הישנה עוברת לפח). כך שמירה שנקטעה לא שוברת תבנית קיימת.
function tmpFolder(id, w) {
  const f = folderIn(id);
  if (f.getName().indexOf(TMP + TPL) !== 0 || byOf(f) !== w.by) throw new Error('bad_folder');
  return f;
}
function templateSave(b, w) {
  if (b.step === 'begin') {
    const parent = target(b, w), name = TPL + safe(b.title, 80);
    const old = first(parent.getFoldersByName(name));
    if (old && !b.overwrite) return fail('exists', { exists: true, canOverwrite: canDel(old, w), id: old.getId() });
    if (old && !canDel(old, w)) return fail('not_owner');
    // ניקוי: שמירות שנקטעו (של אותו אחד, לפני יותר משעה)
    const it = parent.getFolders(), hour = Date.now() - 3600000;
    while (it.hasNext()) { const f = it.next(); if (!f.isTrashed() && f.getName().indexOf(TMP) === 0 && byOf(f) === w.by && f.getLastUpdated().getTime() < hour) f.setTrashed(true); }
    const tmp = parent.createFolder(TMP + name); tag(tmp, w.by);
    return out({ ok: true, folderId: tmp.getId(), name: name });
  }
  if (b.step === 'file') {
    const f = tmpFolder(b.folderId, w), d = decode(b.dataUrl);
    if (!d) return fail('bad_image');
    const name = safe(b.name, 100);
    const old = first(f.getFilesByName(name)); if (old) old.setTrashed(true);
    const x = f.createFile(Utilities.newBlob(d.bytes, d.mime, name)); tag(x, w.by);
    return out({ ok: true, id: x.getId(), name: name });
  }
  if (b.step === 'finish') {
    const f = tmpFolder(b.folderId, w);
    let j = b.json; if (typeof j !== 'string') j = JSON.stringify(j || {});
    try { const t = JSON.parse(j); if (!t || !Array.isArray(t.layers)) return fail('bad_json'); } catch (e) { return fail('bad_json'); }
    const oj = first(f.getFilesByName('template.json')); if (oj) oj.setTrashed(true);
    tag(f.createFile(Utilities.newBlob(j, 'application/json', 'template.json')), w.by);
    const pv = decode(b.preview, ['jpeg', 'png']);
    if (pv) { const op = first(f.getFilesByName('preview.jpg')); if (op) op.setTrashed(true); tag(f.createFile(Utilities.newBlob(pv.bytes, 'image/jpeg', 'preview.jpg')), w.by); }
    const name = f.getName().slice(TMP.length), ps = f.getParents(), parent = ps.hasNext() ? ps.next() : null;
    const old = parent ? first(parent.getFoldersByName(name)) : null;
    if (old && old.getId() !== f.getId()) {
      if (!b.overwrite) return fail('exists', { exists: true, canOverwrite: canDel(old, w), id: old.getId() });
      if (!canDel(old, w)) return fail('not_owner');
      old.setTrashed(true);
    }
    f.setName(name); tag(f, w.by, 'תבנית מודעה · עורך הפרסומת');
    return out({ ok: true, id: f.getId(), name: name, url: f.getUrl() });
  }
  return fail('bad_step');
}

function save(b, w) {
  const d = decode(b.dataUrl, ['png', 'jpeg']);
  if (!d) return fail('bad_image');
  const name = safe(b.name || 'מודעה', 120) + '.' + d.ext;
  const folder = target(b, w);
  const f = folder.createFile(Utilities.newBlob(d.bytes, d.mime, name));
  tag(f, w.by, b.note);
  return out({ ok: true, id: f.getId(), url: f.getUrl(), name: name, folder: folder.getId() });
}

function doPost(e) {
  try {
    const b = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const tok = PropertiesService.getScriptProperties().getProperty('TOKEN');
    if (!tok || b.token !== tok) return fail('forbidden');
    // בלי admin/by (קריאה ישנה מ-S-190) = מנהל — רק ads-drive מחזיק את הטוקן
    const w = (b.admin === undefined && b.by === undefined) ? { admin: true, by: 'admin', label: '' } : who(b);
    const folder = DriveApp.getFolderById(FOLDER_ID);

    if (b.action === 'save') return save(b, w);
    if (b.action === 'list') {
      const it = folder.getFiles(), list = [];
      while (it.hasNext() && list.length < 200) {
        const f = it.next();
        if (f.isTrashed() || !/^image\//.test(f.getMimeType())) continue;
        list.push({ id: f.getId(), name: f.getName(), url: f.getUrl(), updated: f.getLastUpdated().toISOString() });
      }
      list.sort((a, c) => (a.updated < c.updated ? 1 : -1));
      return out({ ok: true, folder: folder.getUrl(), files: list });
    }
    if (b.action === 'browse') return browse(b, w);
    if (b.action === 'file_get') return fileGet(b);
    if (b.action === 'templates') return templates(w);
    if (b.action === 'template_get') return templateGet(b, w);
    if (b.action === 'template_save') return templateSave(b, w);
    if (b.action === 'template_delete') {
      const f = templateFolder(b.id);
      if (!canDel(f, w)) return fail('not_owner');
      f.setTrashed(true); return out({ ok: true });
    }
    if (b.action === 'file_delete') {
      const f = fileIn(b.id);
      if (!canDel(f, w)) return fail('not_owner');
      f.setTrashed(true); return out({ ok: true });
    }
    return fail('bad_action');
  } catch (err) {
    const m = String(err && err.message || err);
    // getFolderById/getFileById על מזהה שלא קיים / בלי גישה
    if (/not_found|No item with the given ID|Access denied|לא נמצא/i.test(m)) return fail('not_found');
    return fail(m);
  }
}
