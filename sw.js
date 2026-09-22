const CACHE = 'qalam-v3';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './manifest.json',
  './icon.svg',
  './js/engine.js',
  './js/app.js',
  './js/vendor/lucide.min.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  e.respondWith(
    caches.match(req).then((res) => res || fetch(req).then((net) => {
      const copy = net.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
      return net;
    }).catch(() => {
      // offline navigation -> app shell
      if (req.mode === 'navigate') return caches.match('./index.html');
      return undefined;
    }))
  );
});