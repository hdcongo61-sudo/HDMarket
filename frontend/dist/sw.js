/**
 * HDMarket PWA Service Worker
 * - Static assets: cache-first
 * - Dynamic API data: network-first + background revalidation
 * - Auth API responses are never cached to avoid cross-user data leaks
 */

const SW_VERSION = 'v4-2026-02-23';
const CACHE_NAME = `hdmarket-${SW_VERSION}`;
const STATIC_CACHE_NAME = `hdmarket-static-${SW_VERSION}`;
const API_CACHE_NAME = `hdmarket-api-${SW_VERSION}`;
const SEARCH_HISTORY_CACHE = `hdmarket-search-history-${SW_VERSION}`;

const FIREBASE_SDK_VERSION = '9.23.0';
const DEFAULT_FIREBASE_SDK_BASES = [
  `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}`,
  '/firebase'
];

const STATIC_ASSETS = ['/', '/index.html', '/favicon.svg'];
const DEFAULT_NOTIFICATION_ICON = '/icons/icon-192.svg';
const DEFAULT_NOTIFICATION_BADGE = '/icons/icon-192.svg';

const DEV_HOSTS = new Set(['localhost', '127.0.0.1']);
const DEV_BYPASS_PATHS = [
  /^\/@vite\//,
  /^\/@react-refresh/,
  /^\/src\//,
  /^\/node_modules\//,
  /^\/@id\//,
  /^\/@fs\//,
  /^\/__vite_ping/
];

const PUBLIC_CACHEABLE_API_PREFIXES = [
  '/api/products/public',
  '/api/shops',
  '/api/settings',
  '/api/categories',
  '/api/cities',
  '/api/search',
  '/api/search/popular'
];

const NETWORK_FIRST_API_PREFIXES = [
  '/api/settings/cities',
  '/api/settings/communes',
  '/api/admin/cities',
  '/api/admin/communes',
  '/api/users/notifications',
  '/api/users/profile',
  '/api/orders'
];

const NON_CACHEABLE_API_PATTERNS = [
  /^\/api\/products\/public\/[^/]+\/comments(?:\/|$)/,
  /^\/api\/products\/public\/[^/]+\/ratings(?:\/|$)/,
  /^\/api\/shops\/[^/]+\/reviews(?:\/|$)/,
  /^\/api\/shops\/[^/]+$/
];

let firebaseConfig = null;
let firebaseMessaging = null;
let firebaseInitialized = false;
let firebaseScriptsLoaded = false;
let firebaseSdkBaseUrl = null;

const isDevHost = () => DEV_HOSTS.has(self.location.hostname);

const isAuthRequest = (request) => {
  try {
    const authHeader = request?.headers?.get('authorization');
    return Boolean(authHeader && String(authHeader).trim());
  } catch {
    return false;
  }
};

const clearAllCaches = async () => {
  const names = await caches.keys();
  await Promise.all(names.map((name) => caches.delete(name)));
};

const stampCacheResponse = (response) => {
  const clone = response.clone();
  const headers = new Headers(clone.headers);
  headers.set('sw-cache-date', Date.now().toString());
  return new Response(clone.body, {
    status: clone.status,
    statusText: clone.statusText,
    headers
  });
};

const offlineJson = (status = 503, message = 'Connexion indisponible.') =>
  new Response(JSON.stringify({ offline: true, message }), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });

const isPublicCacheableApiRequest = (request, path) => {
  if (!request || request.method !== 'GET') return false;
  if (isAuthRequest(request)) return false;
  if (NON_CACHEABLE_API_PATTERNS.some((pattern) => pattern.test(path))) return false;
  return PUBLIC_CACHEABLE_API_PREFIXES.some((prefix) => path.startsWith(prefix));
};

const isNetworkFirstApiRequest = (request, path) => {
  if (!request || request.method !== 'GET') return false;
  return NETWORK_FIRST_API_PREFIXES.some((prefix) => path.startsWith(prefix));
};

const loadFirebaseScripts = (sdkBaseUrl) => {
  if (firebaseScriptsLoaded) return true;
  const bases = [];
  if (sdkBaseUrl && typeof sdkBaseUrl === 'string') {
    bases.push(sdkBaseUrl.replace(/\/+$/, ''));
  }
  DEFAULT_FIREBASE_SDK_BASES.forEach((base) => bases.push(base.replace(/\/+$/, '')));

  let lastError = null;
  for (const base of bases) {
    try {
      importScripts(`${base}/firebase-app-compat.js`, `${base}/firebase-messaging-compat.js`);
      firebaseScriptsLoaded = true;
      return true;
    } catch (err) {
      lastError = err;
    }
  }

  if (lastError) {
    console.warn('[HDMarket] Firebase SW importScripts failed', lastError);
  }
  return false;
};

const initFirebaseMessaging = (config, sdkBaseUrl) => {
  if (!config || !config.apiKey || !config.messagingSenderId) return;
  try {
    if (!loadFirebaseScripts(sdkBaseUrl)) return;
    if (!self.firebase) return;
    if (!self.firebase.apps?.length) {
      self.firebase.initializeApp(config);
    }
    firebaseMessaging = self.firebase.messaging();
    if (!firebaseInitialized && firebaseMessaging?.onBackgroundMessage) {
      firebaseMessaging.onBackgroundMessage((payload) => {
        const notification = payload?.notification || {};
        const data = payload?.data || {};
        const title = notification.title || data.title || 'HDMarket';
        const body = notification.body || data.body || '';
        const icon = notification.icon || data.icon || DEFAULT_NOTIFICATION_ICON;
        const image = notification.image || data.image;
        const url = data.url || data.link || data.deeplink || data.path || '/';

        const options = {
          body,
          icon,
          badge: DEFAULT_NOTIFICATION_BADGE,
          data: { url }
        };
        if (image) options.image = image;
        self.registration.showNotification(title, options);
      });
      firebaseInitialized = true;
    }
  } catch (err) {
    console.warn('[HDMarket] Firebase SW init failed', err);
  }
};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter(
            (name) =>
              ![CACHE_NAME, STATIC_CACHE_NAME, API_CACHE_NAME, SEARCH_HISTORY_CACHE].includes(name)
          )
          .map((name) => caches.delete(name))
      )
    )
  );

  if (isDevHost()) {
    event.waitUntil(clearAllCaches());
    event.waitUntil(self.registration.unregister());
  }

  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
  const { type, payload } = event.data || {};

  if (type === 'SET_FIREBASE_CONFIG') {
    firebaseConfig = payload?.config || payload || null;
    firebaseSdkBaseUrl = payload?.sdkBaseUrl || null;
    initFirebaseMessaging(firebaseConfig, firebaseSdkBaseUrl);
    return;
  }

  if (type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  if (type === 'CLEAR_CACHE') {
    event.waitUntil(clearAllCaches());
    return;
  }

  if (type === 'CLEAR_API_CACHE') {
    event.waitUntil(caches.delete(API_CACHE_NAME));
    return;
  }

  if (type === 'CLEAR_SEARCH_CACHE') {
    event.waitUntil(caches.delete(SEARCH_HISTORY_CACHE));
  }
});

const handleNetworkFirstDynamicApi = async (request) => {
  // Privacy safety: never persist authenticated API payloads in SW cache.
  if (isAuthRequest(request)) {
    try {
      return await fetch(request, { cache: 'no-store' });
    } catch {
      return offlineJson(503, 'Connexion indisponible. Cette ressource nécessite une connexion active.');
    }
  }

  const cache = await caches.open(API_CACHE_NAME);
  const cached = await cache.match(request);

  try {
    const networkResponse = await fetch(request, { cache: 'no-store' });
    if (networkResponse.ok) {
      await cache.put(request, stampCacheResponse(networkResponse));
    }
    return networkResponse;
  } catch {
    if (cached) return cached;
    return offlineJson(503, 'Connexion indisponible. Données dynamiques non disponibles hors ligne.');
  }
};

const revalidatePublicApiInBackground = async (request, cache) => {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      await cache.put(request, stampCacheResponse(networkResponse));
    }
  } catch {
    // Ignore background refresh errors.
  }
};

const handlePublicApiRequest = async (request, event) => {
  const cache = await caches.open(API_CACHE_NAME);
  const cached = await cache.match(request);

  if (cached) {
    event.waitUntil(revalidatePublicApiInBackground(request, cache));
    return cached;
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      await cache.put(request, stampCacheResponse(networkResponse));
    }
    return networkResponse;
  } catch {
    return offlineJson(503, 'Connexion indisponible.');
  }
};

const handleSearchHistoryRequest = async (request) => {
  const cache = await caches.open(SEARCH_HISTORY_CACHE);

  if (request.method === 'GET') {
    const cached = await cache.match(request);
    if (cached) return cached;
    try {
      const networkResponse = await fetch(request);
      if (networkResponse.ok) {
        await cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    } catch {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  return fetch(request);
};

const handleApiRequest = async (request, event, url) => {
  if (isNetworkFirstApiRequest(request, url.pathname)) {
    return handleNetworkFirstDynamicApi(request);
  }

  if (isPublicCacheableApiRequest(request, url.pathname)) {
    return handlePublicApiRequest(request, event);
  }

  try {
    return await fetch(request);
  } catch {
    return offlineJson(503, 'Connexion indisponible. Cette ressource nécessite une connexion active.');
  }
};

const handleStaticRequest = async (request) => {
  const isNavigation = request.mode === 'navigate';
  const staticCache = await caches.open(STATIC_CACHE_NAME);

  if (isNavigation) {
    try {
      const networkResponse = await fetch(request);
      if (networkResponse.ok) return networkResponse;
      const fallbackIndex = await staticCache.match('/index.html');
      return fallbackIndex || networkResponse;
    } catch {
      const fallbackIndex = await staticCache.match('/index.html');
      return fallbackIndex || new Response('Offline', { status: 503 });
    }
  }

  const cached = await staticCache.match(request);
  if (cached) return cached;

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      await staticCache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    const fallbackIndex = await staticCache.match('/index.html');
    return fallbackIndex || new Response('Offline', { status: 503 });
  }
};

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;
  if (isDevHost()) return;
  if (DEV_BYPASS_PATHS.some((pattern) => pattern.test(url.pathname))) return;

  if (url.origin !== self.location.origin && !url.pathname.startsWith('/api')) {
    return;
  }

  if (url.pathname.startsWith('/api')) {
    if (url.pathname.includes('/search-history') && !isAuthRequest(request)) {
      event.respondWith(handleSearchHistoryRequest(request));
      return;
    }
    event.respondWith(handleApiRequest(request, event, url));
    return;
  }

  event.respondWith(handleStaticRequest(request));
});

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    return;
  }
  const notification = payload.notification || {};
  const data = payload.data || payload.notification?.data || {};
  const title = notification.title || data.title || 'HDMarket';
  const body = notification.body || data.body || '';
  const url = data.url || data.link || data.deeplink || data.path || '/';

  const options = {
    body: body || undefined,
    icon: DEFAULT_NOTIFICATION_ICON,
    badge: DEFAULT_NOTIFICATION_BADGE,
    data: {
      url: url.startsWith('http')
        ? url
        : `${self.location.origin}${url.startsWith('/') ? url : `/${url}`}`
    },
    tag: 'hdmarket-push',
    renotify: true
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification?.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clientList.length > 0) {
        const client = clientList[0];
        if ('navigate' in client) {
          return client.navigate(url).then(() => client.focus());
        }
        return client.focus();
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
      return null;
    })
  );
});
