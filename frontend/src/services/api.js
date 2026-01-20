import axios from 'axios';
import { Capacitor } from '@capacitor/core';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'https://hdmarket-backend.onrender.com/api',
  withCredentials: true,
});

const CACHE_TTL_MS = 2 * 60 * 1000;
const CACHE_PREFIX = 'hdmarket:api-cache:';
const CACHE_ALLOW_PREFIXES = [
  '/products/public',
  '/shops',
  '/settings',
  '/search',
  '/categories',
  '/cities',
  '/users/notifications'
];
const CACHE_EXCLUDE_PREFIXES = ['/users', '/cart', '/orders', '/admin', '/payments', '/support', '/chat'];

const isNativeCacheEnabled = () => Capacitor.isNativePlatform();

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

const readCache = (key) => {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (Date.now() - parsed.timestamp > CACHE_TTL_MS) {
      window.localStorage.removeItem(key);
      return null;
    }
    return parsed.data;
  } catch {
    window.localStorage.removeItem(key);
    return null;
  }
};

const writeCache = (key, data) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      key,
      JSON.stringify({ timestamp: Date.now(), data })
    );
  } catch {
    // ignore storage errors
  }
};

const shouldCacheRequest = (config) => {
  if (!isNativeCacheEnabled()) return false;
  if ((config.method || 'get').toLowerCase() !== 'get') return false;
  if (config.skipCache || config.headers?.['x-skip-cache']) return false;
  const normalized = normalizeUrl(config);
  if (!normalized.startsWith('/')) return false;
  if (CACHE_EXCLUDE_PREFIXES.some((prefix) => normalized.startsWith(prefix))) return false;
  return CACHE_ALLOW_PREFIXES.some((prefix) => normalized.startsWith(prefix));
};

api.interceptors.request.use((config) => {
  config.headers = config.headers || {};
  const token = localStorage.getItem('qm_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  if (shouldCacheRequest(config)) {
    const key = buildCacheKey(config);
    const cached = readCache(key);
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
      config.headers['x-cache-key'] = key;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    if (shouldCacheRequest(response.config)) {
      const key = response.config.headers?.['x-cache-key'] || buildCacheKey(response.config);
      if (key && response.status === 200) {
        writeCache(key, response.data);
      }
    }
    return response;
  },
  (error) => {
    if (!error.response) {
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
    return Promise.reject(error);
  }
);

export default api;
