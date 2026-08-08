// 改版本号强制刷新所有缓存
const CACHE = 'daily-tracker-v8';

self.addEventListener('install', e => {
  // 不立即 skipWaiting，等用户主动更新
  // self.skipWaiting();
});

// 收到页面消息后跳过等待
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('activate', e => {
  // 删除所有旧版本缓存
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  // 立即接管所有页面
  self.clients.claim();
});

// 网络优先策略
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (!e.request.url.startsWith('http')) return;

  e.respondWith(
    fetch(e.request).then(resp => {
      if (resp.ok && resp.type !== 'opaque') {
        const clone = resp.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
      }
      return resp;
    }).catch(() => {
      return caches.match(e.request);
    })
  );
});
