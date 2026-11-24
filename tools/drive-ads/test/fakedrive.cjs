// In-memory fake of the Apps Script globals Code.gs uses (DriveApp, Utilities, PropertiesService, ContentService, UrlFetchApp, ScriptApp, Logger).
// load(codeText) → { doPost(body)->obj, drive helpers }
const vm = require('vm');
const ROOT = '1JydT_5VV_BSZYPqn9cRqofbnVdPc6Jmb';

function make(codeText, opts = {}) {
  let seq = 0, clock = Date.parse('2026-11-24T10:00:00Z');
  const items = new Map();
  const newId = () => 'id' + String(++seq).padStart(6, '0') + 'xxxxxxxx';
  const tick = () => new Date(clock += 1000);
  function add(o) { const it = Object.assign({ desc: '', trashed: false, parents: [], updated: tick() }, o); items.set(it.id, it); return it; }
  add({ id: ROOT, name: 'מודעות עיצובישי', folder: true });
  const live = it => it && !it.trashed;
  const children = id => [...items.values()].filter(x => x.parents.includes(id));
  const iter = (arr, kind) => { let i = 0; const self = { hasNext: () => i < arr.length, next: () => wrap(arr[i++]), getContinuationToken: () => kind + ':' + arr.slice(i).map(x => x.id).join(',') }; return self; };
  function blob(bytes, mime, name) {
    bytes = Buffer.from(bytes);
    return { getBytes: () => bytes, getContentType: () => mime, getName: () => name, getDataAsString: () => bytes.toString('utf8'), _b: bytes, _n: name, _m: mime };
  }
  function wrap(it) {
    if (!it) return null;
    const common = {
      getId: () => it.id, getName: () => it.name, setName: n => { it.name = n; it.updated = tick(); return w; },
      getDescription: () => it.desc, setDescription: d => { it.desc = d; return w; },
      isTrashed: () => it.trashed, setTrashed: t => { it.trashed = !!t; return w; },
      getParents: () => iter(it.parents.map(p => items.get(p)).filter(Boolean)),
      getUrl: () => 'https://drive.google.com/' + (it.folder ? 'drive/folders/' : 'file/d/') + it.id,
      getLastUpdated: () => it.updated,
    };
    const w = it.folder ? Object.assign(common, {
      getFolders: () => iter(children(it.id).filter(x => x.folder)),
      getFiles: () => iter(children(it.id).filter(x => !x.folder), 'F'),
      getFoldersByName: n => iter(children(it.id).filter(x => x.folder && x.name === n)),
      getFilesByName: n => iter(children(it.id).filter(x => !x.folder && x.name === n)),
      createFolder: n => wrap(add({ id: newId(), name: n, folder: true, parents: [it.id] })),
      createFile: b => wrap(add({ id: newId(), name: b._n, mime: b._m, bytes: b._b, parents: [it.id] })),
    }) : Object.assign(common, {
      getMimeType: () => it.mime, getSize: () => it.bytes.length,
      getBlob: () => blob(it.bytes, it.mime, it.name),
      getThumbnail: () => it.thumb ? blob(it.thumb, 'image/png', 'thumb') : null,
    });
    return w;
  }
  const notFound = () => { throw new Error('No item with the given ID could be found. Possibly because you have not edited this item or you do not have permission to access it.'); };
  const stats = { thumbFetch: 0 };
  const G = {
    DriveApp: {
      getFolderById: id => { const it = items.get(id); if (!it || !it.folder) notFound(); return wrap(it); },
      getFileById: id => { const it = items.get(id); if (!it || it.folder) notFound(); return wrap(it); },
      continueFileIterator: t => { const ids = String(t).replace(/^F:/, '').split(',').filter(Boolean); return iter(ids.map(i => items.get(i)).filter(Boolean), 'F'); },
    },
    Utilities: {
      getUuid: () => require('crypto').randomUUID(),
      base64Encode: b => Buffer.from(b).toString('base64'),
      base64Decode: s => Buffer.from(s, 'base64'),
      newBlob: (d, m, n) => blob(typeof d === 'string' ? Buffer.from(d, 'utf8') : d, m, n),
    },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k === 'TOKEN' ? 'TOK' : null), setProperty() {} }) },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: s => ({ setMimeType() { return this; }, getContent: () => s }) },
    ScriptApp: { getOAuthToken: () => 'oauth' },
    UrlFetchApp: {
      fetchAll: reqs => reqs.map(r => {
        const m = /files\/([^?]+)\?fields=thumbnailLink/.exec(r.url);
        if (m) { const it = items.get(m[1]); const ok = it && it.thumbOnline; return { getResponseCode: () => (ok ? 200 : 404), getContentText: () => JSON.stringify(ok ? { thumbnailLink: 'https://lh3.fake/' + it.id + '=s220' } : {}) }; }
        const t = /lh3\.fake\/([^=]+)=s240/.exec(r.url); stats.thumbFetch++;
        const it = t && items.get(t[1]);
        return { getResponseCode: () => (it ? 200 : 404), getBlob: () => blob(it.thumbOnline, 'image/jpeg', 't') };
      }),
      fetch: () => ({}),
    },
    Logger: { log() {} },
    console,
  };
  if (opts.noNet) G.UrlFetchApp.fetchAll = () => { throw new Error('no net'); };
  const ctx = vm.createContext(G);
  vm.runInContext(codeText, ctx, { filename: 'Code.gs' });
  return {
    items, stats, ROOT, add: o => add(Object.assign({ id: newId() }, o)),
    call: body => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(Object.assign({ token: 'TOK' }, body)) } }).getContent()),
  };
}
module.exports = { make, ROOT };
