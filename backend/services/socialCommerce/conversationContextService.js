import { initRedis, getRedisClient, isRedisReady } from '../../config/redisClient.js';

// Short-lived per-(channel, externalUserId) conversation memory — "the last
// product this customer asked about", so a follow-up like "vous livrez à
// Bacongo ?" can be tied back to the product without repeating the code.
// Deliberately NOT a permanent session: expires quickly, Redis-backed when
// available (preferred per spec §33), falls back to an in-process Map
// otherwise — never written to Mongo.
const CONTEXT_TTL_SECONDS = 15 * 60; // 15 minutes
const REDIS_KEY_PREFIX = 'social:ctx:';

const memoryStore = new Map();

const memoryKey = (channel, externalUserId) => `${channel}:${externalUserId}`;

const sweepExpiredMemoryEntries = () => {
  const now = Date.now();
  for (const [key, value] of memoryStore.entries()) {
    if (!value || value.expiresAt <= now) memoryStore.delete(key);
  }
};

const withRedis = async () => {
  if (isRedisReady()) return getRedisClient();
  try {
    return await initRedis();
  } catch {
    return null;
  }
};

export const setConversationContext = async (channel, externalUserId, { lastProductId, lastIntent }) => {
  const expiresAt = Date.now() + CONTEXT_TTL_SECONDS * 1000;
  const payload = { lastProductId: String(lastProductId || ''), lastIntent: lastIntent || '', expiresAt };

  const redis = await withRedis();
  if (redis) {
    try {
      await redis.set(`${REDIS_KEY_PREFIX}${channel}:${externalUserId}`, JSON.stringify(payload), { EX: CONTEXT_TTL_SECONDS });
      return;
    } catch {
      // Fall through to in-memory — a conversation-context miss is not
      // worth failing a webhook reply over.
    }
  }
  sweepExpiredMemoryEntries();
  memoryStore.set(memoryKey(channel, externalUserId), payload);
};

export const getConversationContext = async (channel, externalUserId) => {
  const redis = await withRedis();
  if (redis) {
    try {
      const raw = await redis.get(`${REDIS_KEY_PREFIX}${channel}:${externalUserId}`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      // Fall through to in-memory.
    }
  }
  sweepExpiredMemoryEntries();
  const entry = memoryStore.get(memoryKey(channel, externalUserId));
  if (!entry || entry.expiresAt <= Date.now()) return null;
  return entry;
};
