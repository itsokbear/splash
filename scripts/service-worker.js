// Placeholders are replaced after Vite has written the complete production build.
const VERSION = __VERSION__;
const FILES = __PRECACHE__;
const SCOPE = self.registration.scope;
const PREFIX = `plukh-pwa:${new URL(SCOPE).pathname}:`;
const CACHE = PREFIX + VERSION;
const INDEX = new URL('index.html', SCOPE).href;
const URLS = new Set(FILES.map(file => new URL(file, SCOPE).href));

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    try {
      // Revalidate named assets while reusing their bytes after a 304 response.
      await cache.addAll([...URLS].map(url => new Request(url, { cache: 'no-cache' })));
    } catch (error) {
      await caches.delete(CACHE);
      throw error;
    }
    // Wait for existing tabs to close. Never replace a running game mid-session.
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith(PREFIX) && name !== CACHE)
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  const home = event.request.mode === 'navigate'
    && url.origin === new URL(SCOPE).origin
    && [new URL(SCOPE).pathname, new URL(INDEX).pathname].includes(url.pathname);
  const key = home ? INDEX : url.href;
  if (!URLS.has(key)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    return await cache.match(key) || fetch(event.request);
  })());
});
