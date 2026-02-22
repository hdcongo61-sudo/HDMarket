import { initRedis, getRedisClient, isRedisReady } from '../config/redisClient.js';
import { resolveCacheTTL } from '../config/cacheTTL.js';
import {
  buildRequestCacheKey,
  getCacheContextFromRequest,
  wildcardToRegExp,
  buildCachePattern,
  normalizeCacheEnv
} from './cacheKeyBuilder.js';
import { safeAsync } from './safeAsync.js';

const HOT_CACHE_MAX_SIZE = Math.max(200, Number(process.env.CACHE_HOT_MAX_SIZE || 1000));
const HOT_CACHE_DEFAULT_TTL = Math.max(1000, Number(process.env.CACHE_HOT_TTL_MS || 30_000));
const CACHE_LOGGING = String(process.env.CACHE_LOGGING || '').toLowerCase() === 'true';

class HotCache {
  constructor() {
    this.store = new Map();
  }

  get(key) {
    const item = this.store.get(key);
    if (!item) return null;
    if (Date.now() > item.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return item.value;
  }

  set(key, value, ttlMs = HOT_CACHE_DEFAULT_TTL) {
    if (!key) return;
    if (this.store.size >= HOT_CACHE_MAX_SIZE && !this.store.has(key)) {
      const firstKey = this.store.keys().next().value;
      if (firstKey) this.store.delete(firstKey);
    }
    this.store.set(key, {
      value,
      expiresAt: Date.now() + Math.max(500, Number(ttlMs || HOT_CACHE_DEFAULT_TTL))
    });
  }

  delete(key) {
    return this.store.delete(key);
  }

  clear() {
    const size = this.store.size;
    this.store.clear();
    return size;
  }

  keys() {
    const now = Date.now();
    const keys = [];
    for (const [key, value] of this.store.entries()) {
      if (now > value.expiresAt) {
        this.store.delete(key);
      } else {
        keys.push(key);
      }
    }
    return keys;
  }
}

const hotCache = new HotCache();

const stats = {
  localHits: 0,
  redisHits: 0,
  misses: 0,
  sets: 0,
  invalidations: 0,
  errors: 0
};

const CACHE_SNAPSHOT_LIMIT = Math.max(20, Number(process.env.CACHE_SNAPSHOT_LIMIT || 120));
const CACHE_SNAPSHOT_INTERVAL_MS = Math.max(
  10_000,
  Number(process.env.CACHE_SNAPSHOT_INTERVAL_MS || 30_000)
);
let snapshotTimer = null;
const snapshotHistory = [];

const logCache = (message, context = {}) => {
  if (!CACHE_LOGGING) return;
  // eslint-disable-next-line no-console
  console.log(`[cache] ${message}`, context);
};

const serialize = (value) => {
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
};

const deserialize = (value) => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const readRedisInfoMetric = (info = '', key = '') => {
  if (!info || !key) return '';
  const lines = String(info)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const prefix = `${key}:`;
  const matched = lines.find((line) => line.startsWith(prefix));
  return matched ? matched.slice(prefix.length).trim() : '';
};

const pushSnapshot = (snapshot) => {
  if (!snapshot || typeof snapshot !== 'object') return;
  snapshotHistory.push(snapshot);
  if (snapshotHistory.length > CACHE_SNAPSHOT_LIMIT) {
    snapshotHistory.splice(0, snapshotHistory.length - CACHE_SNAPSHOT_LIMIT);
  }
};

const buildSnapshot = (cacheStats) => {
  const localHits = Number(cacheStats?.localHits || 0);
  const redisHits = Number(cacheStats?.redisHits || 0);
  const misses = Number(cacheStats?.misses || 0);
  const hits = localHits + redisHits;
  const totalReads = hits + misses;
  const hitRatio = totalReads > 0 ? Number(((hits / totalReads) * 100).toFixed(2)) : 0;
  const redisInfoRaw = cacheStats?.redis?.memory || '';
  const memoryUsedBytes = Number(readRedisInfoMetric(redisInfoRaw, 'used_memory') || 0);

  return {
    timestamp: new Date().toISOString(),
    hitRatio,
    hits,
    misses,
    localHits,
    redisHits,
    redisReady: Boolean(cacheStats?.redis?.ready),
    redisKeyCount: Number(cacheStats?.redis?.keyCount || 0),
    memoryUsedBytes: Number.isFinite(memoryUsedBytes) ? memoryUsedBytes : 0
  };
};

const ensureRedis = async () => {
  if (isRedisReady()) return getRedisClient();
  return initRedis();
};

const setRedisValue = async (key, value, ttlMs) => {
  const client = await ensureRedis();
  if (!client) return false;

  const payload = serialize(value);
  if (!payload) return false;

  const ttlSeconds = Math.max(1, Math.ceil(Number(ttlMs || HOT_CACHE_DEFAULT_TTL) / 1000));
  const result = await client.set(key, payload, { EX: ttlSeconds });
  return result === 'OK';
};

const getRedisValue = async (key) => {
  const client = await ensureRedis();
  if (!client) return null;
  const raw = await client.get(key);
  if (!raw) return null;
  return deserialize(raw);
};

const deleteRedisKeys = async (keys = []) => {
  const cleanKeys = Array.from(new Set((Array.isArray(keys) ? keys : []).filter(Boolean)));
  if (!cleanKeys.length) return 0;

  const client = await ensureRedis();
  if (!client) return 0;
  return Number(await client.del(cleanKeys));
};

const scanAndDeleteRedis = async (pattern) => {
  const client = await ensureRedis();
  if (!client || !pattern) return 0;

  let cursor = '0';
  let deleted = 0;

  do {
    // redis v4 scan reply shape
    const reply = await client.scan(cursor, {
      MATCH: pattern,
      COUNT: 200
    });

    cursor = reply?.cursor ?? reply?.[0] ?? '0';
    const keys = reply?.keys ?? reply?.[1] ?? [];
    if (Array.isArray(keys) && keys.length) {
      deleted += Number(await client.del(keys));
    }
  } while (cursor !== '0');

  return deleted;
};

const invalidateHotByPattern = (pattern) => {
  if (!pattern) return 0;
  const regex = wildcardToRegExp(pattern);
  let removed = 0;

  hotCache.keys().forEach((key) => {
    if (regex.test(key)) {
      hotCache.delete(key);
      removed += 1;
    }
  });

  return removed;
};

export const generateCacheKey = (req, options = {}) => buildRequestCacheKey(req, options);

export const getCacheTTL = (path, options = {}) => {
  const reqLike = { baseUrl: path || '', query: {} };
  const context = getCacheContextFromRequest(reqLike, options);
  return resolveCacheTTL({
    domain: context.domain,
    scope: context.scope,
    overrideTtl: options.ttl
  });
};

export const cacheMiddleware = (options = {}) => {
  const {
    ttl = null,
    keyGenerator,
    condition = () => true,
    skipCache = () => false,
    includeQuery = true
  } = options;

  return async (req, res, next) => {
    if (req.method?.toLowerCase() !== 'get') return next();
    if (skipCache(req)) return next();
    if (!condition(req)) return next();

    const context = getCacheContextFromRequest(req, options);
    const cacheTTL = resolveCacheTTL({
      domain: context.domain,
      scope: context.scope,
      overrideTtl: ttl
    });

    const cacheKey =
      typeof keyGenerator === 'function'
        ? keyGenerator(req)
        : buildRequestCacheKey(req, { ...options, includeQuery });

    const hotHit = hotCache.get(cacheKey);
    if (hotHit !== null) {
      stats.localHits += 1;
      res.setHeader('X-Cache', 'HIT:LOCAL');
      res.setHeader('X-Cache-Key', cacheKey);
      res.setHeader('Cache-Control', context.scope === 'public' ? 'public, max-age=30' : 'private, max-age=15');
      return res.json(hotHit);
    }

    const redisHit = await safeAsync(
      async () => getRedisValue(cacheKey),
      {
        fallback: null,
        label: 'cache.redis.get',
        onError: () => {
          stats.errors += 1;
        }
      }
    );

    if (redisHit !== null) {
      stats.redisHits += 1;
      hotCache.set(cacheKey, redisHit, Math.min(cacheTTL, HOT_CACHE_DEFAULT_TTL));
      res.setHeader('X-Cache', 'HIT:REDIS');
      res.setHeader('X-Cache-Key', cacheKey);
      res.setHeader('Cache-Control', context.scope === 'public' ? 'public, max-age=30' : 'private, max-age=15');
      return res.json(redisHit);
    }

    stats.misses += 1;
    logCache('MISS', { key: cacheKey, domain: context.domain, scope: context.scope });

    const originalJson = res.json.bind(res);
    res.json = (data) => {
      if (res.statusCode >= 200 && res.statusCode < 300 && data !== undefined) {
        hotCache.set(cacheKey, data, Math.min(cacheTTL, HOT_CACHE_DEFAULT_TTL));

        void safeAsync(
          async () => setRedisValue(cacheKey, data, cacheTTL),
          {
            fallback: false,
            label: 'cache.redis.set',
            onError: () => {
              stats.errors += 1;
            }
          }
        );

        stats.sets += 1;
        res.setHeader('X-Cache', 'MISS');
        res.setHeader('X-Cache-Key', cacheKey);
        res.setHeader('Cache-Control', context.scope === 'public' ? 'public, max-age=30' : 'private, max-age=15');
      }
      return originalJson(data);
    };

    return next();
  };
};

export const invalidatePattern = async (pattern) => {
  const redisDeleted = await safeAsync(
    async () => scanAndDeleteRedis(pattern),
    {
      fallback: 0,
      label: 'cache.invalidate.redis',
      onError: () => {
        stats.errors += 1;
      }
    }
  );

  const localDeleted = invalidateHotByPattern(pattern);
  const total = Number(redisDeleted || 0) + Number(localDeleted || 0);
  stats.invalidations += total;
  if (total > 0) {
    logCache('INVALIDATE', { pattern, total });
  }
  return total;
};

export const invalidateCache = async (pattern) => {
  if (!pattern) return 0;
  const normalized = String(pattern).includes('*') ? String(pattern) : `*${pattern}*`;
  return invalidatePattern(normalized);
};

export const clearAllCache = async () => {
  const localCleared = hotCache.clear();
  const redisCleared = await safeAsync(
    async () => {
      const client = await ensureRedis();
      if (!client) return 0;
      const env = normalizeCacheEnv();
      return scanAndDeleteRedis(`${env}:*`);
    },
    {
      fallback: 0,
      label: 'cache.clearAll',
      onError: () => {
        stats.errors += 1;
      }
    }
  );
  return Number(localCleared || 0) + Number(redisCleared || 0);
};

export const invalidateUserCache = async (userId, domains = []) => {
  if (!userId) return 0;
  const list = Array.isArray(domains) && domains.length ? domains : ['orders', 'cart', 'notifications', 'dashboard', 'analytics', 'users'];
  const patterns = list.map((domain) => buildCachePattern({ domain, scope: 'user', id: userId, params: '*' }));

  let count = 0;
  for (const pattern of patterns) {
    // eslint-disable-next-line no-await-in-loop
    count += await invalidatePattern(pattern);
  }
  return count;
};

export const invalidateSellerCache = async (sellerId, domains = []) => {
  if (!sellerId) return 0;
  const list = Array.isArray(domains) && domains.length ? domains : ['orders', 'dashboard', 'analytics', 'products'];
  const patterns = list.map((domain) => buildCachePattern({ domain, scope: 'seller', id: sellerId, params: '*' }));

  let count = 0;
  for (const pattern of patterns) {
    // eslint-disable-next-line no-await-in-loop
    count += await invalidatePattern(pattern);
  }
  return count;
};

export const invalidateAdminCache = async (domains = []) => {
  const list = Array.isArray(domains) && domains.length ? domains : ['admin', 'dashboard', 'analytics'];
  let count = 0;
  for (const domain of list) {
    // eslint-disable-next-line no-await-in-loop
    count += await invalidatePattern(buildCachePattern({ domain, scope: 'role', id: '*', params: '*' }));
  }
  return count;
};

export const invalidateProductCache = async () => {
  let count = 0;
  count += await invalidatePattern(buildCachePattern({ domain: 'products', scope: 'public', id: '*', params: '*' }));
  count += await invalidatePattern(buildCachePattern({ domain: 'products', scope: 'seller', id: '*', params: '*' }));
  count += await invalidatePattern(buildCachePattern({ domain: 'products', scope: 'user', id: '*', params: '*' }));
  count += await invalidatePattern(buildCachePattern({ domain: 'dashboard', scope: 'seller', id: '*', params: '*' }));
  count += await invalidatePattern(buildCachePattern({ domain: 'analytics', scope: 'seller', id: '*', params: '*' }));
  count += await invalidatePattern(buildCachePattern({ domain: 'admin', scope: 'role', id: '*', params: '*' }));
  return count;
};

export const invalidateShopCache = async (shopId = null) => {
  if (shopId) {
    return invalidatePattern(buildCachePattern({ domain: 'shops', scope: 'seller', id: shopId, params: '*' }));
  }
  return invalidatePattern(buildCachePattern({ domain: 'shops', scope: 'public', id: '*', params: '*' }));
};

export const invalidateCategoryCache = async () => {
  return invalidatePattern(buildCachePattern({ domain: 'categories', scope: 'public', id: '*', params: '*' }));
};

export const invalidateSettingsCache = async () => {
  let count = 0;
  const domains = ['settings', 'currencies', 'cities', 'communes'];
  for (const domain of domains) {
    // eslint-disable-next-line no-await-in-loop
    count += await invalidatePattern(buildCachePattern({ domain, scope: 'public', id: '*', params: '*' }));
  }
  return count;
};

export const getCacheStats = async () => {
  const redisInfo = await safeAsync(
    async () => {
      const client = await ensureRedis();
      if (!client) return null;
      const [usedMemory, keyCount] = await Promise.all([
        client.info('memory'),
        client.dbSize()
      ]);
      return {
        ready: true,
        keyCount: Number(keyCount || 0),
        memory: usedMemory
      };
    },
    { fallback: { ready: false }, label: 'cache.stats.redis' }
  );

  return {
    ...stats,
    hotCacheSize: hotCache.keys().length,
    redis: redisInfo
  };
};

export const getCacheSnapshotHistory = (limit = 30) => {
  const count = Math.max(1, Math.min(Number(limit || 30), CACHE_SNAPSHOT_LIMIT));
  return snapshotHistory.slice(-count);
};

export const collectCacheSnapshot = async () => {
  const current = await getCacheStats();
  const snapshot = buildSnapshot(current);
  pushSnapshot(snapshot);
  return snapshot;
};

export const startCacheSnapshotScheduler = () => {
  if (snapshotTimer) return;

  snapshotTimer = setInterval(() => {
    void safeAsync(
      async () => collectCacheSnapshot(),
      {
        fallback: null,
        label: 'cache.snapshot.collect',
        onError: () => {
          stats.errors += 1;
        }
      }
    );
  }, CACHE_SNAPSHOT_INTERVAL_MS);

  if (typeof snapshotTimer.unref === 'function') {
    snapshotTimer.unref();
  }

  void safeAsync(
    async () => collectCacheSnapshot(),
    {
      fallback: null,
      label: 'cache.snapshot.bootstrap',
      onError: () => {
        stats.errors += 1;
      }
    }
  );
};

export const stopCacheSnapshotScheduler = () => {
  if (!snapshotTimer) return;
  clearInterval(snapshotTimer);
  snapshotTimer = null;
};

const cacheFacade = {
  get: (key) => hotCache.get(key),
  set: (key, value, ttl) => hotCache.set(key, value, ttl),
  delete: (key) => hotCache.delete(key),
  keys: () => hotCache.keys(),
  clear: () => hotCache.clear()
};

export default cacheFacade;
