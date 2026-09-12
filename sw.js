// 改版本号强制刷新所有缓存（每次发布改动都要 +1，浏览器才能检测到新 SW）
const CACHE = 'daily-tracker-v14';

self.addEventListener('install', e => {
  // 立即跳过等待，新版本装完就激活，页面收到 controllerchange 后自动刷新
  self.skipWaiting();
});

// 收到页面消息后跳过等待（手动「检查更新」兜底）
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

// 网络优先策略：仅 HTML 导航强制 no-cache（确保页面最新），
// 静态资源(js/css/图片)走默认缓存，避免每次刷新都重新下载大文件
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (!e.request.url.startsWith('http')) return;

  var opt = e.request.mode === 'navigate' ? { cache: 'no-cache' } : {};

  e.respondWith(
    fetch(e.request, opt).then(resp => {
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
