// Service worker של הסטודיו בלבד. נרשם עם scope "./studio" — שולט רק ב-studio.html,
// לא בדאבל ולא בשאר האתר.
// הדף עצמו: רשת קודם (כל עדכון מגיע מיד), ומהמטמון רק כשאין רשת — כדי שלא ייתקע אצל אף אחד גרסה ישנה.
// ספריות מ-CDN ופונטים: מהמטמון מיד, ומתעדכנים ברקע.
// Supabase (הזמנות, כניסה) לא עובר כאן בכלל.
const V = 'studio-sw-1';
const SHELL = ['./studio.html', './studio.webmanifest', './images/studio/icon-192.png', './images/studio/icon-512.png'];
const CDN = ['cdnjs.cloudflare.com', 'cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k.startsWith('studio-sw-') && k !== V).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.hostname.endsWith('supabase.co')) return;
  if (u.origin === location.origin) {
    e.respondWith(fetch(r).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(V).then(c => c.put(r, copy)); }
      return res;
    }).catch(() => caches.match(r, { ignoreSearch: r.mode === 'navigate' })
      .then(hit => hit || (r.mode === 'navigate' ? caches.match('./studio.html') : Response.error()))));
    return;
  }
  if (CDN.includes(u.hostname)) {
    e.respondWith(caches.open(V).then(c => c.match(r).then(hit => {
      const net = fetch(r).then(res => { if (res.ok || res.type === 'opaque') c.put(r, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    })));
  }
});
