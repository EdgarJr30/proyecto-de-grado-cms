const swUrl = new URL(self.location.href);
const SW_VERSION = swUrl.searchParams.get('v') || 'dev';
const STATIC_CACHE = `mlm-static-${SW_VERSION}`;
const RUNTIME_CACHE = `mlm-runtime-${SW_VERSION}`;
const CACHE_PREFIXES = ['mlm-static-', 'mlm-runtime-'];
const MAX_RUNTIME_ENTRIES = 120;
const NAVIGATION_TIMEOUT_MS = 8000;

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.webmanifest',
  '/apple-touch-icon.png',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/pwa-maskable-512x512.png',
];

function shouldBypass(request, url) {
  if (request.method !== 'GET') return true;
  if (url.origin !== self.location.origin) return true;
  return url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/');
}

function isStaticAssetRequest(request, url) {
  return (
    ['style', 'script', 'image', 'font'].includes(request.destination) ||
    /\.(?:css|js|mjs|png|jpg|jpeg|svg|gif|webp|ico|woff2?)$/i.test(url.pathname)
  );
}

function isCacheableResponse(response) {
  if (!response || !response.ok || response.type !== 'basic') return false;
  const cacheControl = (response.headers.get('cache-control') || '').toLowerCase();
  return !cacheControl.includes('no-store') && !cacheControl.includes('private');
}

async function trimRuntimeCache() {
  const cache = await caches.open(RUNTIME_CACHE);
  const keys = await cache.keys();
  if (keys.length <= MAX_RUNTIME_ENTRIES) return;
  const keysToDelete = keys.slice(0, keys.length - MAX_RUNTIME_ENTRIES);
  await Promise.all(keysToDelete.map((key) => cache.delete(key)));
}

function withTimeout(promise, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('network-timeout')), timeoutMs);
    promise
      .then((result) => {
        clearTimeout(timeout);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timeout);
        reject(error);
      });
  });
}

async function handleNavigation(request) {
  try {
    const networkResponse = await withTimeout(fetch(request), NAVIGATION_TIMEOUT_MS);
    if (isCacheableResponse(networkResponse)) {
      const cache = await caches.open(RUNTIME_CACHE);
      await cache.put(request, networkResponse.clone());
      await trimRuntimeCache();
    }
    return networkResponse;
  } catch (_error) {
    const cache = await caches.open(RUNTIME_CACHE);
    const cachedRoute = await cache.match(request);
    if (cachedRoute) return cachedRoute;
    const appShell = await caches.match('/index.html');
    if (appShell) return appShell;
    return caches.match('/offline.html');
  }
}

async function handleStaticAsset(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cachedResponse = await cache.match(request);

  const networkPromise = fetch(request)
    .then(async (networkResponse) => {
      if (isCacheableResponse(networkResponse)) {
        await cache.put(request, networkResponse.clone());
        await trimRuntimeCache();
      }
      return networkResponse;
    })
    .catch(() => cachedResponse);

  return cachedResponse || networkPromise;
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const cacheKeys = await caches.keys();
      const staleKeys = cacheKeys.filter((key) => {
        const managedByUs = CACHE_PREFIXES.some((prefix) => key.startsWith(prefix));
        const isCurrent = key === STATIC_CACHE || key === RUNTIME_CACHE;
        return managedByUs && !isCurrent;
      });
      await Promise.all(staleKeys.map((key) => caches.delete(key)));
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable();
      }
      await self.clients.claim();
    })()
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (shouldBypass(request, url)) return;

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
    return;
  }

  if (isStaticAssetRequest(request, url)) {
    event.respondWith(handleStaticAsset(request));
  }
});
