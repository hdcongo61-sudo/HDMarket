import axios from 'axios';
import { Capacitor } from '@capacitor/core';
import storage from '../utils/storage.js';
import indexedDB, { STORES } from '../utils/indexedDB.js';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5001/api',
  withCredentials: true,
});

// Cache configuration
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes default
const CACHE_PREFIX = 'hdmarket:api-cache:';
const CACHE_STORAGE_KEY = 'hdmarket:cache-keys'; // Track all cache keys for cleanup

// Endpoints that should be cached with their TTL (in ms)
const CACHE_CONFIG = {
  '/products/public': 3 * 60 * 1000, // 3 minutes
  '/shops': 5 * 60 * 1000, // 5 minutes (includes /shops/verified page data)
  '/shops/verified': 5 * 60 * 1000, // 5 minutes – verified shops page
  '/settings': 10 * 60 * 1000, // 10 minutes
  '/search': 2 * 60 * 1000, // 2 minutes
  '/categories': 30 * 60 * 1000, // 30 minutes
  '/cities': 30 * 60 * 1000, // 30 minutes
  '/users/notifications': 1 * 60 * 1000, // 1 minute
  '/users/profile/stats': 2 * 60 * 1000, // 2 minutes
  '/admin/dashboard/stats': 1 * 60 * 1000, // 1 minute
};

const CACHE_ALLOW_PREFIXES = Object.keys(CACHE_CONFIG);
const CACHE_EXCLUDE_PREFIXES = ['/users/auth', '/users/login', '/users/register', '/cart', '/orders/create', '/admin', '/payments', '/support', '/chat', '/settings/networks'];

// Enable caching for all platforms (not just native)
const isCacheEnabled = () => typeof window !== 'undefined';

const normalizeUrl = (config) => {
  const raw = config.url || '';
  const base = config.baseURL || '';
  if (raw.startsWith('http')) {
    try {
      const urlObj = new URL(raw);
      return urlObj.pathname + urlObj.search;
    } catch {
      return raw.replace(base, '');
    }
  }
  return raw.replace(base, '');
};

const buildCacheKey = (config) => {
  const normalized = normalizeUrl(config);
  const params = config.params ? new URLSearchParams(config.params).toString() : '';
  const query = params ? (normalized.includes('?') ? `&${params}` : `?${params}`) : '';
  return `${CACHE_PREFIX}${normalized}${query}`;
};

// Get TTL for a specific endpoint
const getCacheTTL = (normalizedUrl) => {
  for (const [prefix, ttl] of Object.entries(CACHE_CONFIG)) {
    if (normalizedUrl.startsWith(prefix)) {
      return ttl;
    }
  }
  return CACHE_TTL_MS;
};

// Track cache keys for cleanup
const trackCacheKey = async (key) => {
  try {
    const keys = await storage.get(CACHE_STORAGE_KEY) || [];
    if (!keys.includes(key)) {
      keys.push(key);
      await storage.set(CACHE_STORAGE_KEY, keys);
    }
  } catch {
    // ignore errors
  }
};

// Determine if data should use IndexedDB (larger datasets)
const shouldUseIndexedDB = (normalizedUrl, dataSize) => {
  // Use IndexedDB for product listings, search results, and large datasets
  const indexedDBEndpoints = ['/products/public', '/search', '/shops'];
  const isLargeData = dataSize > 100 * 1024; // 100KB threshold
  
  return indexedDBEndpoints.some(prefix => normalizedUrl.startsWith(prefix)) || isLargeData;
};

// Clean up expired cache entries
const cleanupExpiredCache = async () => {
  try {
    const keys = await storage.get(CACHE_STORAGE_KEY) || [];
    const validKeys = [];
    
    for (const key of keys) {
      try {
        const cached = await storage.get(key);
        if (cached) {
          const ttl = getCacheTTL(key.replace(CACHE_PREFIX, ''));
          if (Date.now() - cached.timestamp < ttl) {
            validKeys.push(key);
          } else {
            await storage.remove(key);
          }
        }
      } catch {
        await storage.remove(key);
      }
    }
    
    await storage.set(CACHE_STORAGE_KEY, validKeys);
    
    // Also cleanup IndexedDB
    await indexedDB.cleanup(STORES.CACHE);
  } catch {
    // ignore errors
  }
};

// Run cleanup on load
if (typeof window !== 'undefined') {
  cleanupExpiredCache();
  // Run cleanup every 5 minutes
  setInterval(cleanupExpiredCache, 5 * 60 * 1000);
}

const readCache = async (key, normalizedUrl) => {
  if (!isCacheEnabled()) return null;
  
  try {
    // Check if should use IndexedDB
    if (shouldUseIndexedDB(normalizedUrl, 0)) {
      const cached = await indexedDB.get(STORES.CACHE, key);
      return cached;
    }
    
    // Use unified storage
    const cached = await storage.get(key);
    if (!cached || typeof cached !== 'object') return null;
    
    const ttl = getCacheTTL(normalizedUrl);
    if (Date.now() - cached.timestamp > ttl) {
      await storage.remove(key);
      return null;
    }
    
    return cached.data;
  } catch {
    return null;
  }
};

const writeCache = async (key, data, normalizedUrl) => {
  if (!isCacheEnabled()) return;
  
  try {
    const dataSize = new Blob([JSON.stringify(data)]).size;
    const ttl = getCacheTTL(normalizedUrl);
    
    // Use IndexedDB for large datasets
    if (shouldUseIndexedDB(normalizedUrl, dataSize)) {
      await indexedDB.set(STORES.CACHE, key, data, ttl);
    } else {
      // Use unified storage for smaller data
      await storage.set(key, { timestamp: Date.now(), data });
    }
    
    await trackCacheKey(key);
  } catch (e) {
    // If storage is full, try to clean up old entries
    if (e.name === 'QuotaExceededError' || e.message?.includes('quota')) {
      await cleanupExpiredCache();
      try {
        const dataSize = new Blob([JSON.stringify(data)]).size;
        const ttl = getCacheTTL(normalizedUrl);
        
        if (shouldUseIndexedDB(normalizedUrl, dataSize)) {
          await indexedDB.set(STORES.CACHE, key, data, ttl);
        } else {
          await storage.set(key, { timestamp: Date.now(), data });
        }
        await trackCacheKey(key);
      } catch {
        // ignore storage errors
      }
    }
  }
};

// Clear cache for specific endpoint pattern
export const clearCache = async (pattern) => {
  if (typeof window === 'undefined') return;
  try {
    const keys = await storage.get(CACHE_STORAGE_KEY) || [];
    const remainingKeys = [];
    
    for (const key of keys) {
      if (key.includes(pattern)) {
        await storage.remove(key);
        // Also remove from IndexedDB if exists
        try {
          await indexedDB.delete(STORES.CACHE, key);
        } catch {
          // ignore
        }
      } else {
        remainingKeys.push(key);
      }
    }
    
    await storage.set(CACHE_STORAGE_KEY, remainingKeys);
  } catch {
    // ignore errors
  }
};

// Clear all cache
export const clearAllCache = async () => {
  if (typeof window === 'undefined') return;
  try {
    const keys = await storage.get(CACHE_STORAGE_KEY) || [];
    
    for (const key of keys) {
      await storage.remove(key);
    }
    
    await storage.remove(CACHE_STORAGE_KEY);
    
    // Also clear IndexedDB cache
    await indexedDB.clear(STORES.CACHE);
  } catch {
    // ignore errors
  }
};

const shouldCacheRequest = (config) => {
  if (!isCacheEnabled()) return false;
  if ((config.method || 'get').toLowerCase() !== 'get') return false;
  if (config.skipCache || config.headers?.['x-skip-cache']) return false;
  const normalized = normalizeUrl(config);
  if (!normalized.startsWith('/')) return false;
  if (CACHE_EXCLUDE_PREFIXES.some((prefix) => normalized.startsWith(prefix))) return false;
  return CACHE_ALLOW_PREFIXES.some((prefix) => normalized.startsWith(prefix));
};

api.interceptors.request.use(async (config) => {
  config.headers = config.headers || {};
  const token = await storage.get('qm_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  if (shouldCacheRequest(config)) {
    const normalized = normalizeUrl(config);
    const key = buildCacheKey(config);
    const cached = await readCache(key, normalized);
    if (cached) {
      config.adapter = async () => ({
        data: cached,
        status: 200,
        statusText: 'OK',
        headers: { 'x-cache': 'HIT' },
        config,
        request: { fromCache: true }
      });
    } else {
      config.__cacheKey = key;
      config.__normalizedUrl = normalized;
    }
  }
  return config;
});

// Retry config for network errors (no response = connection/timeout/CORS)
const NETWORK_ERROR_MAX_RETRIES = 2;
const NETWORK_ERROR_DELAY_MS = 1200;
const NETWORK_ERROR_TOAST_THROTTLE_MS = 15000; // max one toast per 15s
let lastNetworkErrorToastAt = 0;

api.interceptors.response.use(
  async (response) => {
    if (shouldCacheRequest(response.config)) {
      const key = response.config.__cacheKey || buildCacheKey(response.config);
      const normalized = response.config.__normalizedUrl || normalizeUrl(response.config);
      if (key && response.status === 200) {
        await writeCache(key, response.data, normalized);
      }
    }
    return response;
  },
  async (error) => {
    const config = error.config || {};
    const retryCount = config.__retryCount ?? 0;
    const isNetworkError = !error.response;

    if (isNetworkError && retryCount < NETWORK_ERROR_MAX_RETRIES) {
      config.__retryCount = retryCount + 1;
      const delay = NETWORK_ERROR_DELAY_MS * (retryCount + 1);
      await new Promise((r) => setTimeout(r, delay));
      return api.request(config);
    }

    if (isNetworkError && typeof window !== 'undefined') {
      const now = Date.now();
      if (now - lastNetworkErrorToastAt >= NETWORK_ERROR_TOAST_THROTTLE_MS) {
        lastNetworkErrorToastAt = now;
        const message =
          'Impossible de joindre le serveur. Vérifiez votre connexion internet et réessayez.';
        window.dispatchEvent(
          new CustomEvent('hdmarket:network-error', {
            detail: { message },
            bubbles: true,
            cancelable: false
          })
        );
      }
    }
    return Promise.reject(error);
  }
);

export default api;
