import { getRedisClient, initRedis, isRedisReady } from '../../../config/redisClient.js';

const CACHE_KEY = 'hdmarket:delivery:pricing-context:v1';
const CACHE_TTL_SECONDS = Math.max(30, Number(process.env.DELIVERY_PRICING_CACHE_TTL_SECONDS || 300));

let memoryEntry = null;

const stats = {
  memoryHits: 0,
  redisHits: 0,
  misses: 0,
  writes: 0,
  invalidations: 0,
  errors: 0
};

const ensureRedis = async () => {
  if (isRedisReady()) return getRedisClient();
  return initRedis();
};

export const getCachedPricingContext = async () => {
  if (memoryEntry && memoryEntry.expiresAt > Date.now()) {
    stats.memoryHits += 1;
    return { value: memoryEntry.value, source: 'memory' };
  }
  memoryEntry = null;

  try {
    const redis = await ensureRedis();
    if (redis) {
      const raw = await redis.get(CACHE_KEY);
      if (raw) {
        const value = JSON.parse(raw);
        memoryEntry = {
          value,
          expiresAt: Date.now() + CACHE_TTL_SECONDS * 1000
        };
        stats.redisHits += 1;
        return { value, source: 'redis' };
      }
    }
  } catch {
    stats.errors += 1;
  }

  stats.misses += 1;
  return null;
};

export const setCachedPricingContext = async (value) => {
  memoryEntry = {
    value,
    expiresAt: Date.now() + CACHE_TTL_SECONDS * 1000
  };
  stats.writes += 1;

  try {
    const redis = await ensureRedis();
    if (redis) {
      await redis.set(CACHE_KEY, JSON.stringify(value), { EX: CACHE_TTL_SECONDS });
    }
  } catch {
    stats.errors += 1;
  }

  return value;
};

export const invalidatePricingContext = async () => {
  memoryEntry = null;
  stats.invalidations += 1;
  try {
    const redis = await ensureRedis();
    if (redis) await redis.del(CACHE_KEY);
  } catch {
    stats.errors += 1;
  }
};

export const getPricingCacheStats = () => ({
  ...stats,
  ttlSeconds: CACHE_TTL_SECONDS,
  memoryReady: Boolean(memoryEntry && memoryEntry.expiresAt > Date.now()),
  memoryExpiresAt: memoryEntry?.expiresAt ? new Date(memoryEntry.expiresAt).toISOString() : null,
  redisReady: isRedisReady()
});

export default {
  get: getCachedPricingContext,
  set: setCachedPricingContext,
  invalidate: invalidatePricingContext,
  stats: getPricingCacheStats
};
