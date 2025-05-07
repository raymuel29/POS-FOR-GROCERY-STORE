const CACHE_NAME = 'pos-cache-v1';
const urlsToCache = [
  '/',
  '/static/styles.css',
  '/static/scripts.js',
  '/static/logo.png',
  '/static/profile.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToCache);
    })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
