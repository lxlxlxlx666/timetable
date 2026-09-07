// sw.js — 离线缓存
// v1.1.0: html/css/js 改为网络优先(便于部署后热更新), 图片等缓存优先
const VERSION = 'v1.1.0';
const CACHE = 'lixi-timetable-' + VERSION;
const CORE = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './timetable-core.js',
  './data.json',
  './manifest.webmanifest',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // data.json / html / css / js / manifest：网络优先（部署后热更新），失败回退缓存
  const netFirst = url.pathname.endsWith('/data.json')
    || /\.(html|css|js|webmanifest)$/.test(url.pathname) || url.pathname.endsWith('/');
  if (netFirst) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((m) => m || (req.mode === 'navigate' ? caches.match('./index.html') : undefined)))
    );
    return;
  }

  // 其它（图片等）：缓存优先
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
      return res;
    }))
  );
});
