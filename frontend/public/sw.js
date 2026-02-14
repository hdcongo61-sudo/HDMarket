/**
 * Service Worker for PWA offline caching + Firebase web push
 * Caches API responses and static assets for offline access
 */

const CACHE_NAME = 'hdmarket-v2';
const API_CACHE_NAME = 'hdmarket-api-v2';
const STATIC_CACHE_NAME = 'hdmarket-static-v2';
const FIREBASE_SDK_VERSION = '9.23.0';

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/favicon.svg'
];

// API endpoints to cache (read-only GET requests)
const CACHEABLE_ENDPOINTS = [
  '/api/products/public',
  '/api/shops',
  '/api/settings',
  '/api/categories',
  '/api/cities',
  '/api/search',
  '/api/search/popular',
  '/api/users/search-history'
];

// Search history cache name
const SEARCH_HISTORY_CACHE = 'hdmarket-search-history-v1';
const DEFAULT_NOTIFICATION_ICON = '/icons/icon-192.svg';
const DEFAULT_NOTIFICATION_BADGE = '/icons/icon-192.svg';

let firebaseConfig = null;
let firebaseMessaging = null;
let firebaseInitialized = false;
let firebaseScriptsLoaded = false;

const loadFirebaseScripts = () => {
  if (firebaseScriptsLoaded) return;
  importScripts(
    `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-app-compat.js`,
    `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-messaging-compat.js`
  );
  firebaseScriptsLoaded = true;
};

const initFirebaseMessaging = (config) => {
  if (!config || !config.apiKey || !config.messagingSenderId) return;
  try {
    loadFirebaseScripts();
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
          data: { url },
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

const clearAllCaches = async () => {
  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.map((name) => caches.delete(name)));
};

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => {
            return (
              name !== CACHE_NAME &&
              name !== API_CACHE_NAME &&
              name !== STATIC_CACHE_NAME
            );
          })
          .map((name) => caches.delete(name))
      );
    })
  );
  return self.clients.claim();
});

// Listen for messages (e.g. Firebase config, cache management)
self.addEventListener('message', (event) => {
  const { type, payload } = event.data || {};
  if (type === 'SET_FIREBASE_CONFIG') {
    firebaseConfig = payload || null;
    initFirebaseMessaging(firebaseConfig);
  }
  if (type === 'CLEAR_CACHE') {
    event.waitUntil(clearAllCaches());
  }
});

// Notification click handler (open deep link)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification?.data?.url;
  if (!url) return;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
      return null;
    })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip cross-origin requests (except API)
  if (url.origin !== self.location.origin && !url.pathname.startsWith('/api')) {
    return;
  }

  // Handle API requests
  if (url.pathname.startsWith('/api')) {
    // Special handling for search history (offline support)
    if (url.pathname.includes('/search-history')) {
      event.respondWith(handleSearchHistoryRequest(request));
      return;
    }
    event.respondWith(handleApiRequest(request));
    return;
  }

  // Handle static assets
  event.respondWith(handleStaticRequest(request));
});

/**
 * Handle API requests with cache-first strategy
 */
async function handleApiRequest(request) {
  const cache = await caches.open(API_CACHE_NAME);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    // Check if cache is still valid (within TTL)
    const cacheDate = cachedResponse.headers.get('sw-cache-date');
    if (cacheDate) {
      const age = Date.now() - parseInt(cacheDate, 10);
      const maxAge = 5 * 60 * 1000; // 5 minutes default
      
      if (age < maxAge) {
        return cachedResponse;
      }
    } else {
      // If no date header, assume it's valid
      return cachedResponse;
    }
  }

  try {
    // Try network first
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Clone response and add cache date
      const responseToCache = networkResponse.clone();
      const headers = new Headers(responseToCache.headers);
      headers.set('sw-cache-date', Date.now().toString());
      
      const modifiedResponse = new Response(responseToCache.body, {
        status: responseToCache.status,
        statusText: responseToCache.statusText,
        headers: headers
      });
      
      // Cache successful responses
      cache.put(request, modifiedResponse);
    }
    
    return networkResponse;
  } catch (error) {
    // Network failed, return cached response if available
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline response
    return new Response(
      JSON.stringify({ 
        message: 'Vous êtes hors ligne. Données mises en cache affichées.',
        offline: true 
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

/**
 * Handle static asset requests.
 * Navigation/document requests (SPA routes): network-first so reload on /path always
 * gets index.html from the server. Prevents serving a cached 404 from before the
 * rewrite was configured.
 * Other static assets: cache-first for performance.
 */
async function handleStaticRequest(request) {
  const isNavigation = request.mode === 'navigate';

  if (isNavigation) {
    const staticCache = await caches.open(STATIC_CACHE_NAME);
    try {
      const networkResponse = await fetch(request);
      if (networkResponse.ok) {
        return networkResponse;
      }
      // 404/5xx: fall back to index.html so SPA can load (e.g. old cached 404)
      const indexResponse = await staticCache.match('/index.html');
      if (indexResponse) return indexResponse;
      return networkResponse;
    } catch (error) {
      const offlinePage = await staticCache.match('/index.html');
      if (offlinePage) return offlinePage;
      return new Response('Offline', { status: 503 });
    }
  }

  const cache = await caches.open(STATIC_CACHE_NAME);
  const cachedResponse = await cache.match(request);
  if (cachedResponse) return cachedResponse;

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const offlinePage = await cache.match('/index.html');
    if (offlinePage) return offlinePage;
    return new Response('Offline', { status: 503 });
  }
}

/**
 * Handle search history requests with offline support
 */
async function handleSearchHistoryRequest(request) {
  const cache = await caches.open(SEARCH_HISTORY_CACHE);
  
  // For GET requests, try cache first, then network
  if (request.method === 'GET') {
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    try {
      const networkResponse = await fetch(request);
      if (networkResponse.ok) {
        // Cache the response
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    } catch (error) {
      // Offline: return cached response or empty array
      if (cachedResponse) {
        return cachedResponse;
      }
      return new Response(
        JSON.stringify([]),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
  }
  
  // For POST requests (adding search history), cache after network
  if (request.method === 'POST') {
    try {
      const networkResponse = await fetch(request);
      if (networkResponse.ok) {
        // Cache the new entry
        const data = await networkResponse.clone().json();
        // Store in IndexedDB via message to main thread
        // For now, just cache the response
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    } catch (error) {
      // Offline: store in cache for later sync
      const clonedRequest = request.clone();
      const body = await clonedRequest.json();
      
      // Store offline entry
      const offlineEntry = {
        ...body,
        offline: true,
        timestamp: Date.now()
      };
      
      return new Response(
        JSON.stringify(offlineEntry),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
  }
  
  return fetch(request);
}

// Message event - handle cache invalidation
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((name) => caches.delete(name))
        );
      })
    );
  }
  
  if (event.data && event.data.type === 'CLEAR_API_CACHE') {
    event.waitUntil(caches.delete(API_CACHE_NAME));
  }
  
  if (event.data && event.data.type === 'CLEAR_SEARCH_CACHE') {
    event.waitUntil(caches.delete(SEARCH_HISTORY_CACHE));
  }
  
  // Sync offline search history
  if (event.data && event.data.type === 'SYNC_SEARCH_HISTORY') {
    event.waitUntil(syncOfflineSearchHistory());
  }
});

/**
 * Sync offline search history entries when back online
 */
async function syncOfflineSearchHistory() {
  // This would sync offline entries to the server
  // Implementation depends on your backend API
  console.log('Syncing offline search history...');
}

// Push event: show notification when PWA receives FCM (e.g. in background)
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
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    data: { url: url.startsWith('http') ? url : self.location.origin + (url.startsWith('/') ? url : '/' + url) },
    tag: 'hdmarket-push',
    renotify: true
  };
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Notification click: open app at the link
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification?.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      if (clientList.length) {
        const client = clientList[0];
        client.navigate(url);
        client.focus();
      } else if (self.clients.openWindow) {
        self.clients.openWindow(url);
      }
    })
  );
});
