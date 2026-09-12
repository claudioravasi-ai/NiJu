/* NiJu — Service Worker
   Cache-first para el armazón, red-primero para los datos. */
const CACHE = 'niju-v0.1.0';
const BASE = [
  './', './index.html', './manifest.json',
  './css/core.css', './css/views.css',
  './js/app.js', './js/config.js', './js/util.js', './js/state.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(BASE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  // Cotizaciones y APIs: siempre red, con caída a cache
  if (url.origin !== location.origin){
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
    return;
  }
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      const copia = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copia));
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});
