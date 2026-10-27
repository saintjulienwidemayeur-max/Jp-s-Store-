// Offline app shell. Bump VERSION to invalidate caches.
const VERSION = 'v1';
const CACHE = `jps-shell-${VERSION}`;
const SHELL = [
  './', 'index.html', 'shop.html', 'product.html', 'wishlist.html', 'info.html', '404.html',
  'cart.html', 'checkout.html', 'order.html', 'account.html',
  'css/styles.css', 'css/commerce.css',
  'js/i18n.js', 'js/i18n.commerce.js', 'js/layout.js', 'js/cart.js', 'js/api.js', 'js/pricing.js', 'js/seed.js', 'js/config.js',
  'js/pages/home.js', 'js/pages/shop.js', 'js/pages/product.js', 'js/pages/wishlist.js', 'js/pages/info.js', 'js/pages/notfound.js',
  'assets/brand/logo.png', 'assets/brand/icon-192.png', 'assets/brand/icon-512.png',
  'assets/img/face-tattoo.jpg', 'assets/img/headband.jpg', 'assets/img/scarf.jpg', 'assets/img/thunder-stick.jpg',
  'manifest.json'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('jps-shell-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Network-first for same-origin GETs (always fresh when online), cache fallback when offline.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // Supabase, fonts: let the browser handle
  e.respondWith(
    fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || (req.mode === 'navigate' ? caches.match('index.html') : Response.error())))
  );
});
