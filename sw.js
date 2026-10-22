const CACHE_NAME = 'androheld-pwa-v10';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './css/tokens.css',
  './css/components.css',
  './css/app.css',
  './js/config.js',
  './js/lib/html5-qrcode.min.js',
  './js/lib/tesseract.min.js',
  './js/services/storageService.js',
  './js/services/supabaseService.js',
  './js/services/gasService.js',
  './js/services/sheetsService.js',
  './js/services/scannerService.js',
  './js/services/ocrService.js',
  './js/modules/pinModule.js',
  './js/modules/homeModule.js',
  './js/modules/mainToolsModule.js',
  './js/modules/inventoryModule.js',
  './js/modules/wipModule.js',
  './js/modules/qcHoseModule.js',
  './js/modules/stockModule.js',
  './assets/logo.png',
  './assets/background.jpg',
  './assets/icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Network-First with Cache Fallback for dynamic requests, Cache-First for local static assets
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // If Supabase or Google API, try network first, then cache if offline
  if (requestUrl.hostname.includes('supabase.co') || requestUrl.hostname.includes('google.com')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Local assets: Stale-While-Revalidate
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse.clone()));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
