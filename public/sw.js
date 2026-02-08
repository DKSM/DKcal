const CACHE_NAME = 'dkcal-v1';
const STATIC_ASSETS = [
  '/',
  '/css/reset.css',
  '/css/variables.css',
  '/css/layout.css',
  '/css/modal.css',
  '/css/components.css',
  '/css/charts.css',
  '/js/app.js',
  '/js/api.js',
  '/js/auth.js',
  '/js/dashboard.js',
  '/js/consumption.js',
  '/js/items.js',
  '/js/stats.js',
  '/js/modal.js',
  '/js/utils.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API calls: network only (don't cache dynamic data)
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Static assets: cache first, then network
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetched = fetch(event.request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached);

      return cached || fetched;
    })
  );
});
