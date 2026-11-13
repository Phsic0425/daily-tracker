// 改版本号强制刷新所有缓存（每次发布改动都要 +1，浏览器才能检测到新 SW）
const CACHE = 'daily-tracker-v20';

self.addEventListener('install', e => {
  // 装好就立刻接管，不再等用户手动点「更新」
  // 页面侧的 controllerchange 监听会自动刷新一次（见 app.js）
  e.waitUntil(self.skipWaiting());
});

// 兼容旧入口：页面仍可主动发消息让 waiting 中的 SW 立刻接管
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('activate', e => {
  e.waitUntil(
    // 1) 删掉所有旧版本缓存  2) 立刻接管未受控的页面
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// 网络优先策略（cache:'no-cache' 绕过 HTTP 缓存，确保每次拿到最新文件）
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (!e.request.url.startsWith('http')) return;

  e.respondWith(
    fetch(e.request, { cache: 'no-cache' }).then(resp => {
      if (resp.ok && resp.type !== 'opaque') {
        const clone = resp.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
      }
      return resp;
    }).catch(() => {
      // 离线兜底：cache.match 可能返回 undefined，
      // 直接 respondWith(undefined) 会抛 "Failed to convert value to Response"，
      // 所以这里必须给一个真正的 Response
      return caches.match(e.request).then(cached => cached || new Response('', {
        status: 504,
        statusText: 'Offline'
      }));
    })
  );
});
