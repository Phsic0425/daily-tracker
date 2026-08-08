const CACHE = 'daily-tracker-v7';

self.addEventListener('install', e => {
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

// 网络优先：始终请求最新文件，网络不通时才用缓存
self.addEventListener('fetch', e => {
  // 跳过非 GET 请求
  if (e.request.method !== 'GET') return;
  // 跳过 chrome-extension 等非 http(s) 请求
  if (!e.request.url.startsWith('http')) return;

  e.respondWith(
    fetch(e.request).then(resp => {
      // 网络请求成功，更新缓存
      if (resp.ok && resp.type !== 'opaque') {
        const clone = resp.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
      }
      return resp;
    }).catch(() => {
      // 网络不通，尝试缓存
      return caches.match(e.request);
    })
  );
});
