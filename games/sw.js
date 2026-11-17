// הכתובת /games/ הועברה ל-/store/ (G-53). ה-SW הישן שהותקן כאן מנקה את עצמו ואת המטמון שלו, ומפנה לכתובת החדשה.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('games-sw-')).map(k => caches.delete(k))))
    .then(() => self.registration.unregister()));
});
