/* Planner Pro — service worker
   Precache the whole shell so the app opens instantly and works with no network.
   Strategy: cache-first for the shell, network-first (with cache fallback) for
   navigations, stale-while-revalidate for everything else same-origin. */

const VERSION = 'v14.5.0';
const CACHE = 'planner-pro-' + VERSION;

const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/css/app.css',
  './assets/js/date.js',
  './assets/js/store.js',
  './assets/js/ui.js',
  './assets/js/crypto.js',
  './assets/js/views/parts.js',
  './assets/js/views/today.js',
  './assets/js/views/day.js',
  './assets/js/views/week.js',
  './assets/js/views/year.js',
  './assets/js/views/archive.js',
  './assets/js/views/insights.js',
  './assets/js/views/search.js',
  './assets/js/views/settings.js',
  './assets/js/views/about.js',
  './assets/js/app.js',
  './assets/img/favicon.svg',
  './assets/img/icon-192.png',
  './assets/img/icon-512.png',
  './assets/img/icon-maskable-512.png',
  './assets/img/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./index.html', copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('./index.html').then((r) => r || caches.match('./')))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});
