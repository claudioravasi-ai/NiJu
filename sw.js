/* NiJu — Service Worker
   Red primero para todo; la caché es solo para cuando no hay internet.
   Antes el armazón iba cache-first con un nombre de caché fijo: el
   teléfono seguía mostrando la versión vieja aunque se subiera una
   nueva a GitHub. Cambiar CACHE en cada versión fuerza la limpieza. */
const CACHE = 'niju-v0.6.0';
const BASE = [
  './', './index.html', './manifest.json',
  './css/core.css', './css/views.css', './css/compras.css', './css/portada.css', './css/vitrina.css', './css/cuenta.css', './css/info.css', './css/desglose.css', './css/calculadora-niju.css', './css/negocio.css', './css/ficha.css',
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
    fetch(e.request).then(res => {
      if (res.ok){
        const copia = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copia));
      }
      return res;
    }).catch(() => caches.match(e.request).then(hit => hit || caches.match('./index.html')))
  );
});
