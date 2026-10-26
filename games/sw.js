// Service worker של מחולל המשחקים. יושב בתיקייה /games/ ולכן שולט רק בה — לא בדאבל, לא בסטודיו ולא בשאר האתר
// (אותו דפוס כמו play/sw.js ו-studio/sw.js).
// הדף והמנוע: רשת קודם (כל עדכון מגיע מיד), ומהמטמון רק כשאין רשת. פונטים מ-CDN: מהמטמון מיד, ומתעדכנים ברקע.
// התמונות של הלקוחה לא עוברות כאן בכלל — הן ב-IndexedDB.
// שינוי בקובץ הזה = להעלות את V, כדי לנקות מטמון ישן.
const V = 'games-sw-9';
const SHELL = ['./', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', '../js/play-engine.js?v=8'];
const CDN = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k.startsWith('games-sw-') && k !== V).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.protocol === 'blob:' || u.protocol === 'data:') return;
  if (u.origin === location.origin) {
    e.respondWith(fetch(r).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(V).then(c => c.put(r, copy)); }
      return res;
    }).catch(() => caches.match(r, { ignoreSearch: r.mode === 'navigate' })
      .then(hit => hit || (r.mode === 'navigate' ? caches.match('./') : Response.error()))));
    return;
  }
  if (CDN.includes(u.hostname)) {
    e.respondWith(caches.open(V).then(c => c.match(r).then(hit => {
      const net = fetch(r).then(res => { if (res.ok || res.type === 'opaque') c.put(r, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    })));
  }
});
