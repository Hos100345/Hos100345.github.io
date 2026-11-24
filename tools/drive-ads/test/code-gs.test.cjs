// הרצה: node tools/drive-ads/test/code-gs.test.cjs — בדיקת Code.gs מול דרייב מדומה (בלי גוגל)
// node unit tests for tools/drive-ads/Code.gs against fakedrive
const fs = require('fs'), assert = require('assert');
const { make } = require('./fakedrive.cjs');
const code = fs.readFileSync(require('path').join(__dirname,'..','Code.gs'), 'utf8');
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const D = make(code);
const A = { admin: true, by: 'admin' }, P1 = { admin: false, by: 'p-aaaaaaaaaaaaaaaa', label: 'דנה' }, P2 = { admin: false, by: 'p-bbbbbbbbbbbbbbbb', label: 'דנה' };
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
const call = (w, b) => D.call(Object.assign({}, w, b));

// seed: 4 ads, a QR, subfolder with assets
const big = Buffer.alloc(90 * 1024, 7);
for (let i = 1; i <= 4; i++) D.add({ name: 'מודעה ' + i + '.jpg', mime: 'image/jpeg', bytes: big, parents: [D.ROOT], thumbOnline: Buffer.from(PNG, 'base64') });
D.add({ name: 'qr.png', mime: 'image/png', bytes: Buffer.from(PNG, 'base64'), parents: [D.ROOT] });
D.add({ name: 'notes.txt', mime: 'text/plain', bytes: Buffer.from('x'), parents: [D.ROOT] });
const sub = D.add({ name: 'נכסים – שבת ארגון 1', folder: true, parents: [D.ROOT] });
for (let i = 0; i < 35; i++) D.add({ name: 'a' + i + '.png', mime: 'image/png', bytes: i === 0 ? big : Buffer.from(PNG, 'base64'), parents: [sub.id], thumb: i === 0 ? Buffer.from(PNG, 'base64') : null });
const outside = D.add({ name: 'secret', folder: true, parents: [] });
const outFile = D.add({ name: 's.png', mime: 'image/png', bytes: Buffer.from(PNG, 'base64'), parents: [outside.id] });

// token / legacy
ok(D.call({ token: 'bad', action: 'list' }).error === 'forbidden', 'token');
let r = D.call({ action: 'list' }); ok(r.ok && r.files.length === 5, 'legacy list (no who) = admin, images only');
ok(call({ admin: false, by: 'nope' }, { action: 'list' }).ok === false, 'bad who rejected');

// browse root
r = call(P1, { action: 'browse' });
ok(r.ok && r.folders.length === 1 && r.files.length === 5, 'browse root');
ok(r.path.length === 1 && r.path[0].id === D.ROOT, 'crumbs root');
ok(r.files.filter(f => f.thumb && f.thumb.startsWith('data:image/')).length === 5, 'thumbs (online for big ads, file itself for qr)');
ok(r.files.every(f => !f.canDelete && !f.mine), 'partner cannot delete untagged');
ok(!('by' in r.files[0]) && JSON.stringify(r).indexOf('p-aaaa') < 0, 'no raw by leaked');
ok(r.myFolder && /שותפים\/דנה/.test(r.myFolder.name), 'partner folder created');
// paginate sub
r = call(A, { action: 'browse', folderId: sub.id });
ok(r.files.length === 30 && r.next && r.path.length === 2, 'page 1 = 30');
ok(r.files[0].thumb && r.files[0].canDelete, 'getThumbnail fallback for big file; admin can delete');
const r2 = call(A, { action: 'browse', folderId: sub.id, pageToken: r.next });
ok(r2.files.length === 5 && !r2.next && r2.folders.length === 0, 'page 2 = 5');
ok(call(A, { action: 'browse', folderId: outside.id }).error === 'not_found', 'outside root blocked');
ok(call(A, { action: 'file_get', id: outFile.id }).error === 'not_found', 'file outside blocked');
// file_get
r = call(P1, { action: 'file_get', id: r2.files[0].id }); ok(r.ok && r.data === PNG && r.mime === 'image/png', 'file_get');

// save: partner forced into own folder, admin into chosen subfolder
r = call(P1, { action: 'save', name: 'מודעה/שלי', dataUrl: 'data:image/png;base64,' + PNG, note: 'n', folderId: sub.id });
const pf = D.items.get(D.items.get(r.id).parents[0]);
ok(r.ok && pf.name === 'דנה' && /by:p-aaaa/.test(D.items.get(r.id).desc) && r.name === 'מודעה-שלי.png', 'partner save → own folder, tagged, name sanitized');
const p2save = call(P2, { action: 'save', name: 'x', dataUrl: 'data:image/jpeg;base64,' + PNG });
ok(D.items.get(D.items.get(p2save.id).parents[0]).name === 'דנה (2)', 'same label, different partner → separate folder');
r = call(A, { action: 'save', name: 'adm', dataUrl: 'data:image/png;base64,' + PNG, folderId: sub.id });
ok(D.items.get(r.id).parents[0] === sub.id && /^by:admin/.test(D.items.get(r.id).desc), 'admin save → subfolder');
ok(call(A, { action: 'save', dataUrl: 'data:text/plain;base64,AA' }).error === 'bad_image', 'bad image');
// delete rules
const p1file = call(P1, { action: 'browse', folderId: pf.id }).files[0];
ok(p1file.mine && p1file.canDelete, 'partner sees own as deletable');
ok(call(P2, { action: 'file_delete', id: p1file.id }).error === 'not_owner', 'other partner cannot delete');
ok(call(P1, { action: 'file_delete', id: r.id }).error === 'not_owner', 'partner cannot delete admin');
ok(call(P1, { action: 'file_delete', id: p1file.id }).ok && D.items.get(p1file.id).trashed, 'partner deletes own');
ok(call(A, { action: 'file_delete', id: p2save.id }).ok, 'admin deletes partner file');

// templates: chunked save
function saveTpl(w, title, extra = {}) {
  let b = call(w, Object.assign({ action: 'template_save', step: 'begin', title }, extra));
  if (!b.ok) return b;
  const f = call(w, { action: 'template_save', step: 'file', folderId: b.folderId, name: '01-pic.png', dataUrl: 'data:image/png;base64,' + PNG });
  if (!f.ok) return f;
  ok(call(w, { action: 'templates' }).templates.filter(t => t.title === title).length <= 1, 'tmp folder hidden while saving');
  return call(w, Object.assign({ action: 'template_save', step: 'finish', folderId: b.folderId, json: { version: 1, title, fmt: 'a4', layers: [{ k: 'img', file: '01-pic.png' }], files: [{ file: '01-pic.png' }] }, preview: 'data:image/jpeg;base64,' + PNG }, extra));
}
r = saveTpl(A, 'מבצע חנוכה'); ok(r.ok && r.name === 'תבנית – מבצע חנוכה', 'admin template saved');
const tA = r.id;
r = saveTpl(P1, 'שלי'); ok(r.ok, 'partner template'); const tP = r.id;
ok(D.items.get(D.items.get(tP).parents[0]).name === 'דנה', 'partner template in own folder');
let L = call(P2, { action: 'templates' }).templates;
ok(L.length === 2 && L.every(t => t.preview && t.preview.startsWith('data:image/jpeg')), 'templates list with previews');
ok(L.find(t => t.id === tA).where === '' && L.find(t => t.id === tP).where === 'דנה', 'where');
ok(L.every(t => !t.canDelete), 'P2 cannot delete any');
r = call(P2, { action: 'template_get', id: tA });
ok(r.ok && r.template.title === 'מבצע חנוכה' && r.files.length === 1 && r.files[0].name === '01-pic.png', 'template_get');
ok(call(A, { action: 'template_get', id: sub.id }).error === 'not_template', 'non-template folder');
// exists / overwrite
r = call(A, { action: 'template_save', step: 'begin', title: 'מבצע חנוכה' });
ok(r.error === 'exists' && r.canOverwrite === true, 'exists for admin');
r = call(P1, { action: 'template_save', step: 'begin', title: 'שלי' });
ok(r.error === 'exists' && r.canOverwrite === true, 'exists for owner partner');
r = saveTpl(A, 'מבצע חנוכה', { overwrite: true }); ok(r.ok && D.items.get(tA).trashed && r.id !== tA, 'admin overwrite → old trashed');
const tA2 = r.id;
ok(call(A, { action: 'templates' }).templates.filter(t => t.title === 'מבצע חנוכה').length === 1, 'single after overwrite');
// tmp folder mismatched owner
const bb = call(P1, { action: 'template_save', step: 'begin', title: 'אחר' });
ok(call(P2, { action: 'template_save', step: 'file', folderId: bb.folderId, name: 'x.png', dataUrl: 'data:image/png;base64,' + PNG }).error === 'bad_folder', 'other cannot write into my tmp');
ok(call(P1, { action: 'template_save', step: 'finish', folderId: bb.folderId, json: '{bad' }).error === 'bad_json', 'bad json');
ok(call(P1, { action: 'template_save', step: 'nope' }).error === 'bad_step', 'bad step');
// delete templates
ok(call(P1, { action: 'template_delete', id: tA2 }).error === 'not_owner', 'partner cannot delete admin template');
ok(call(P2, { action: 'template_delete', id: tP }).error === 'not_owner', 'other partner cannot delete');
ok(call(P1, { action: 'template_delete', id: tP }).ok && D.items.get(tP).trashed, 'partner deletes own template');
ok(call(A, { action: 'template_delete', id: sub.id }).error === 'not_template', 'template_delete only templates');
ok(call(A, { action: 'template_delete', id: tA2 }).ok, 'admin deletes');
// browse shows template folders flagged
saveTpl(A, 'ב');
r = call(A, { action: 'browse' }); ok(r.folders.some(f => f.template && f.title === 'ב') && !r.folders.some(f => f.name.startsWith('⏳')), 'template folders flagged; tmp hidden');
ok(call(A, { action: 'bogus' }).error === 'bad_action', 'bad action');
// no network → thumbnails fall back without throwing
const D2 = make(code, { noNet: true }); D2.add({ name: 'q.png', mime: 'image/png', bytes: Buffer.from(PNG, 'base64'), parents: [D2.ROOT] });
r = D2.call({ action: 'browse', admin: true, by: 'admin' }); ok(r.ok && r.files[0].thumb, 'no UrlFetch → fallback thumb');
console.log('Code.gs unit: ' + n + ' checks passed');
