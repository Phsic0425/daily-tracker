const CACHE = 'daily-tracker-v2';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './manifest.json',
  './js/config.js',
  './js/utils.js',
  './js/storage.js',
  './js/expense.js',
  './js/todo.js',
  './js/templates.js',
  './js/effects.js',
  './js/report.js',
  './js/ui.js',
  './js/events.js',
  './js/app.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached =>
      cached || fetch(e.request).then(resp => {
        if (resp.ok) {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return resp;
      })
    )
  );
});
