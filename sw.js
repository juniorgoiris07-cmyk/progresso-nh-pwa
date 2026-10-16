/**
 * sw.js - Service worker de la PWA Progresso NH.
 * Cachea el app shell (HTML/CSS/JS son un solo index.html + manifest + iconos)
 * para que la app abra y sea instalable incluso offline. Las llamadas a
 * Supabase (oulrdijjdrfsmbeezolt.supabase.co) NO pasan por este SW (ni se
 * cachean ni se interceptan): si fallan, la app recibe un error real.
 */
var CACHE_NAME = 'progresso-pwa-v6';
var APP_SHELL = [
  './',
  './index.html',
  './supabase-2.117.2.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) {
        // cache:'reload' salta la cache HTTP del navegador (GitHub Pages ~10 min)
        return Promise.all(APP_SHELL.map(function (u) {
          return cache.add(new Request(u, { cache: 'reload' }));
        }));
      })
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

  // Llamadas a Supabase: el SW no se mete. Van directo a la red y, si falla,
  // el navegador devuelve error real (asi la app nunca muestra "guardado" en falso).
  if (url.indexOf('supabase.co') !== -1) return;

  // App shell: red primero (siempre la version nueva si hay internet), con
  // respaldo en cache si no hay red o tarda mas de 2.5 s (campo / señal mala).
  if (req.method === 'GET') {
    event.respondWith(
      caches.match(req).then(function (cached) {
        var sameOrigin = url.indexOf(self.location.origin) === 0;
        var network = (sameOrigin ? fetch(url, { cache: 'no-cache' }) : fetch(req)).then(function (res) {
          if (res && res.status === 200) {
            var clone = res.clone();
            caches.open(CACHE_NAME).then(function (cache) { cache.put(req, clone); });
          }
          return res;
        });
        if (!cached) {
          return network.catch(function () {
            if (req.mode === 'navigate') return caches.match('./index.html');
            return Response.error();
          });
        }
        if (!sameOrigin) return cached;
        return new Promise(function (resolve) {
          var done = false;
          var t = setTimeout(function () { if (!done) { done = true; resolve(cached); } }, 2500);
          network.then(function (res) {
            if (done) return;
            done = true; clearTimeout(t);
            resolve(res && res.status === 200 ? res : cached);
          }).catch(function () {
            if (done) return;
            done = true; clearTimeout(t);
            resolve(cached);
          });
        });
      })
    );
  }
});
