const CACHE = 'cashier-v4';
const FILES = ['./', 'index.html', 'style.css', 'app.js', 'config.js', 'sha256.js', 'manifest.json', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())
  );
});

// الشبكة الأول: لو فيه نت بيجيب أحدث نسخة من كل الملفات (فمفيش خلط بين نسخ قديمة وجديدة)
// ولو مفيش نت بيفتح من الكاش، فالبرنامج يشتغل بدون إنترنت
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' }).then(res => {
      if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
