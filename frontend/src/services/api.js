import axios from 'axios';
import storage from '../utils/storage.js';
import indexedDB, { STORES } from '../utils/indexedDB.js';

const API_TIMEOUT_MS = Math.max(4000, Number(import.meta.env.VITE_API_TIMEOUT_MS || 12000));

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || `http://localhost:5001/api`,
  withCredentials: true,
  timeout: API_TIMEOUT_MS,
  transitional: { clarifyTimeoutError: true }
});

// Cache configuration
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes default
const CACHE_PREFIX = 'hdmarket:api-cache:';
const CACHE_STORAGE_KEY = 'hdmarket:cache-keys'; // Track all cache keys for cleanup

// Endpoints that should be cached with their TTL (in ms)
const CACHE_CONFIG = {
  '/products/public': 3 * 60 * 1000, // 3 minutes
  '/products/public/installments': 3 * 60 * 1000, // 3 minutes
  '/marketplace-promo-codes/public/home': 3 * 60 * 1000, // 3 minutes
  '/shops': 5 * 60 * 1000, // 5 minutes (includes /shops/verified page data)
  '/shops/verified': 5 * 60 * 1000, // 5 minutes – verified shops page
  '/settings': 10 * 60 * 1000, // 10 minutes
  '/search': 2 * 60 * 1000, // 2 minutes
  '/categories': 30 * 60 * 1000, // 30 minutes
  '/cities': 30 * 60 * 1000, // 30 minutes
  '/users/notifications': 1 * 60 * 1000, // 1 minute
  '/admin/dashboard/stats': 1 * 60 * 1000, // 1 minute
};

const CACHE_ALLOW_PREFIXES = Object.keys(CACHE_CONFIG);
const CACHE_EXCLUDE_PREFIXES = [
  '/users/auth',
  '/users/login',
  '/users/register',
  '/users/profile/stats',
  '/users/profile/seller-analytics',
  '/settings/app-logo',
  '/cart',
  '/orders/create',
  '/admin',
  '/payments',
  '/support',
  '/chat',
  '/settings/networks'
];
const USER_SCOPED_CACHE_PREFIXES = [
  '/users/profile',
  '/users/notifications',
  '/users/favorites',
  '/users/search-history',
  '/orders',
  '/cart'
];

// Enable caching for all platforms (not just native)
const isCacheEnabled = () => typeof window !== 'undefined';

const resolveRequestId = (error) =>
  String(
    error?.requestId ||
      error?.response?.data?.requestId ||
      error?.response?.headers?.['x-request-id'] ||
      error?.response?.headers?.['X-Request-Id'] ||
      ''
  ).trim();

const resolveApiErrorMessage = (error, fallback = 'Une erreur est survenue.') =>
  error?.response?.data?.message || error?.userMessage || error?.message || fallback;

const clearAbortTimer = (config = {}) => {
  if (!config.__abortTimer) return;
  clearTimeout(config.__abortTimer);
  config.__abortTimer = null;
};

const dispatchGlobalApiError = (error, config = {}) => {
  if (typeof window === 'undefined' || config?.silentGlobalError || error?.name === 'CanceledError') {
    return;
  }
  const message = resolveApiErrorMessage(error, 'Une erreur est survenue. Veuillez réessayer.');
  const requestId = resolveRequestId(error);
  const status = Number(error?.response?.status || 0);
  const code = String(error?.response?.data?.code || error?.code || 'API_ERROR');
  window.dispatchEvent(
    new CustomEvent('hdmarket:api-error', {
      detail: {
        message,
        requestId,
        status,
        code
      }
    })
  );
};

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

const decodeJwtUserId = (token) => {
  try {
    const payload = String(token || '').split('.')[1];
    if (!payload) return '';
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const parsed = JSON.parse(atob(normalized));
    return String(parsed?.id || parsed?._id || parsed?.sub || '').trim();
  } catch {
    return '';
  }
};

const getUserScopeSuffix = (config, normalizedUrl) => {
  if (!USER_SCOPED_CACHE_PREFIXES.some((prefix) => normalizedUrl.startsWith(prefix))) {
    return '';
  }

  const authHeader = config?.headers?.Authorization || config?.headers?.authorization || '';
  const token = String(authHeader).startsWith('Bearer ')
    ? String(authHeader).slice(7)
    : '';
  const userId = decodeJwtUserId(token);
  return userId ? `::user:${userId}` : '::user:anon';
};

const buildCacheKey = (config) => {
  const normalized = normalizeUrl(config);
  const params = config.params ? new URLSearchParams(config.params).toString() : '';
  const query = params ? (normalized.includes('?') ? `&${params}` : `?${params}`) : '';
  const userScope = getUserScopeSuffix(config, normalized);
  return `${CACHE_PREFIX}${normalized}${query}${userScope}`;
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
  config.__requestStartAt = Date.now();
  const contentType = String(config.headers['Content-Type'] || config.headers['content-type'] || '').toLowerCase();
  if (contentType.includes('multipart/form-data') && Number(config.timeout || 0) < 60_000) {
    config.timeout = 60_000;
  }
  if (!config.signal && typeof AbortController !== 'undefined') {
    const controller = new AbortController();
    config.signal = controller.signal;
    config.__abortController = controller;
    const timeoutMs = Math.max(1000, Number(config.timeout || API_TIMEOUT_MS));
    config.__abortTimer = setTimeout(() => controller.abort('REQUEST_ABORT_TIMEOUT'), timeoutMs + 200);
  }
  const token = await storage.get('qm_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  const method = String(config.method || 'get').toLowerCase();
  if (
    ['post', 'put', 'patch', 'delete'].includes(method) &&
    !config.headers['Idempotency-Key'] &&
    !config.headers['x-idempotency-key']
  ) {
    config.headers['Idempotency-Key'] = `hdm-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 10)}`;
  }
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
const NETWORK_ERROR_MAX_RETRIES = 1;
const NETWORK_ERROR_DELAY_MS = 700;
const RETRYABLE_METHODS = new Set(['get', 'head', 'options']);

api.interceptors.response.use(
  async (response) => {
    clearAbortTimer(response.config || {});
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
    clearAbortTimer(config);
    const retryCount = config.__retryCount ?? 0;
    const method = String(config.method || 'get').toLowerCase();
    const isNetworkError = !error.response;
    const isTimeoutError =
      error.code === 'ECONNABORTED' ||
      error.name === 'AbortError' ||
      (error.code === 'ERR_CANCELED' && Boolean(config.__abortController)) ||
      /timeout/i.test(String(error.message || ''));
    const isRetryableStatus = [502, 503, 504].includes(Number(error?.response?.status || 0));
    error.requestDurationMs = Math.max(0, Date.now() - Number(config.__requestStartAt || Date.now()));

    if (isTimeoutError) {
      error.isTimeout = true;
      error.userMessage = 'Le serveur met trop de temps à répondre. Réessayez.';
      if (!error.response) {
        error.message = error.userMessage;
      }
    } else if (isNetworkError) {
      error.userMessage = 'Connexion indisponible. Vérifiez internet puis réessayez.';
      error.message = error.userMessage;
    }
    if (!error.response && error.userMessage) {
      error.response = {
        status: 0,
        statusText: 'NETWORK_ERROR',
        data: { message: error.userMessage },
        headers: {},
        config
      };
    }
    const requestId = resolveRequestId(error);
    if (requestId) {
      error.requestId = requestId;
    }

    const canRetry = RETRYABLE_METHODS.has(method);
    if ((isNetworkError || isRetryableStatus) && canRetry && retryCount < NETWORK_ERROR_MAX_RETRIES) {
      config.__retryCount = retryCount + 1;
      const delay = NETWORK_ERROR_DELAY_MS * (retryCount + 1);
      await new Promise((r) => setTimeout(r, delay));
      return api.request(config);
    }

    dispatchGlobalApiError(error, config);
    return Promise.reject(error);
  }
);

export const isApiTimeoutError = (error) =>
  Boolean(
    error?.isTimeout ||
      error?.code === 'ECONNABORTED' ||
      error?.name === 'AbortError' ||
      /timeout/i.test(String(error?.message || ''))
  );

export const getApiErrorMessage = (error, fallback = 'Une erreur est survenue.') =>
  resolveApiErrorMessage(error, fallback);

const normalizeTransactionCode = (value) => String(value || '').replace(/\D/g, '').trim();

export const verifyTransactionCodeAvailability = async (transactionCode) => {
  const normalizedCode = normalizeTransactionCode(transactionCode);
  if (normalizedCode.length !== 10) {
    return {
      valid: false,
      used: false,
      available: false,
      code: normalizedCode,
      message: 'Le code de transaction doit contenir exactement 10 chiffres.'
    };
  }

  try {
    const { data } = await api.post(
      '/payments/transaction-code/verify',
      { transactionCode: normalizedCode },
      { skipCache: true, headers: { 'x-skip-cache': '1' } }
    );
    return {
      valid: Boolean(data?.valid),
      used: Boolean(data?.used),
      available: Boolean(data?.valid && !data?.used),
      code: normalizedCode,
      message: data?.message || 'Code de transaction disponible.'
    };
  } catch (error) {
    if (error?.response?.status === 409 || error?.response?.status === 400) {
      const payload = error.response?.data || {};
      return {
        valid: Boolean(payload?.valid),
        used: Boolean(payload?.used || error.response?.status === 409),
        available: false,
        code: normalizedCode,
        message: payload?.message || 'Code de transaction invalide ou déjà utilisé.'
      };
    }
    throw error;
  }
};

export default api;
