import { initRedis, getRedisClient, isRedisReady } from '../../config/redisClient.js';

// Per-external-user automated-reply throttle + duplicate-message
// suppression (spec §32). Same Redis-preferred/in-memory-fallback shape as
// conversationContextService.js — this is an anti-abuse guard, not a
// business record, so it never touches Mongo.
const MAX_REPLIES_PER_MINUTE = Math.max(1, Number(process.env.SOCIAL_MAX_REPLIES_PER_MINUTE || 6));
const WINDOW_SECONDS = 60;
const REDIS_KEY_PREFIX = 'social:rl:';

const memoryWindows = new Map();

const withRedis = async () => {
  if (isRedisReady()) return getRedisClient();
  try {
    return await initRedis();
  } catch {
    return null;
  }
};

const memoryCount = (key) => {
  const now = Date.now();
  const entry = memoryWindows.get(key);
  if (!entry || entry.resetAt <= now) {
    memoryWindows.set(key, { count: 1, resetAt: now + WINDOW_SECONDS * 1000 });
    return 1;
  }
  entry.count += 1;
  return entry.count;
};

/**
 * @returns {Promise<boolean>} true if this external user is currently over
 *   the automated-reply rate limit and should NOT receive another reply.
 */
export const isRateLimited = async (channel, externalUserId) => {
  const key = `${REDIS_KEY_PREFIX}${channel}:${externalUserId}`;
  const redis = await withRedis();
  if (redis) {
    try {
      const count = await redis.incr(key);
      if (count === 1) await redis.expire(key, WINDOW_SECONDS);
      return count > MAX_REPLIES_PER_MINUTE;
    } catch {
      // Fall through to in-memory.
    }
  }
  return memoryCount(key) > MAX_REPLIES_PER_MINUTE;
};
