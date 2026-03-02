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

function parsePushPayload(event) {
  if (!event.data) return {};
  try {
    return event.data.json();
  } catch (_error) {
    return {};
  }
}

async function broadcastPushReceived(payload) {
  const clients = await self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true,
  });
  for (const client of clients) {
    client.postMessage({
      type: 'notification:push_received',
      receivedAt: Date.now(),
      url: typeof payload.url === 'string' ? payload.url : '/notificaciones',
    });
  }
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

self.addEventListener('push', (event) => {
  const payload = parsePushPayload(event);
  const title =
    typeof payload.title === 'string' && payload.title.trim()
      ? payload.title
      : 'Nueva notificación';
  const body =
    typeof payload.body === 'string' && payload.body.trim()
      ? payload.body
      : 'Tienes una actualización en el sistema.';

  const options = {
    body,
    icon:
      typeof payload.icon === 'string' && payload.icon.trim()
        ? payload.icon
        : '/pwa-192x192.png',
    badge:
      typeof payload.badge === 'string' && payload.badge.trim()
        ? payload.badge
        : '/pwa-192x192.png',
    data: {
      url:
        typeof payload.url === 'string' && payload.url.trim()
          ? payload.url
          : '/notificaciones',
    },
    tag:
      typeof payload.tag === 'string' && payload.tag.trim()
        ? payload.tag
        : undefined,
    renotify: Boolean(payload.renotify),
  };

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options),
      broadcastPushReceived(payload),
    ])
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const rawUrl =
    event.notification &&
    event.notification.data &&
    typeof event.notification.data.url === 'string'
      ? event.notification.data.url
      : '/notificaciones';
  const targetUrl = new URL(rawUrl, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return undefined;
    })
  );
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
