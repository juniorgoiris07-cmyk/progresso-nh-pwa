/**
 * sw.js - Service worker de la PWA Progresso NH.
 * Cachea el app shell (HTML/CSS/JS son un solo index.html + manifest + iconos)
 * para que la app abra y sea instalable incluso offline. Las llamadas a
 * Supabase (oulrdijjdrfsmbeezolt.supabase.co) NUNCA se cachean: siempre van a
 * red, para no mostrar datos de stock/produccion desactualizados.
 */
var CACHE_NAME = 'progresso-pwa-v3';
var APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) { return cache.addAll(APP_SHELL); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys
        .filter(function (k) { return k !== CACHE_NAME; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  var url = req.url;

  // Llamadas a Supabase: siempre red, nunca cache.
  if (url.indexOf('supabase.co') !== -1) {
    event.respondWith(
      fetch(req).catch(function () {
        return new Response(
          JSON.stringify({ error: 'Sin conexion a internet. Intenta de nuevo.' }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      })
    );
    return;
  }

  // App shell: cache-first, con actualizacion en segundo plano.
  if (req.method === 'GET') {
    event.respondWith(
      caches.match(req).then(function (cached) {
        var network = fetch(req).then(function (res) {
          if (res && res.status === 200) {
            var clone = res.clone();
            caches.open(CACHE_NAME).then(function (cache) { cache.put(req, clone); });
          }
          return res;
        }).catch(function () {
          if (req.mode === 'navigate') return caches.match('./index.html');
        });
        return cached || network;
      })
    );
  }
});
