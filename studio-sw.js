// הוחלף ב-/studio/sw.js (הסטודיו עבר לתיקייה /studio/, 28/09/2026).
// הקובץ נשאר רק כדי לנקות את עצמו אצל מי שכבר ביקר: מוחק את המטמון שלו ומבטל את הרישום.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k === 'studio-sw-1').map(k => caches.delete(k))))
    .then(() => self.registration.unregister()));
});
