import Notification from '../models/notificationModel.js';
import { initRedis, getRedisClient, isRedisReady } from '../config/redisClient.js';

const ENV = String(process.env.CACHE_ENV || process.env.NODE_ENV || 'dev')
  .toLowerCase()
  .startsWith('prod')
  ? 'prod'
  : 'dev';
const UNREAD_TTL_SECONDS = Math.max(60, Number(process.env.NOTIFICATION_UNREAD_TTL_SECONDS || 60));
const KEY_PREFIX = `${ENV}:notifications:user:`;

const buildKey = (userId) => `${KEY_PREFIX}${String(userId)}:count`;

const withRedis = async () => {
  if (isRedisReady()) return getRedisClient();
  return initRedis();
};

export const syncUnreadCount = async (userId) => {
  if (!userId) return 0;
  const unread = await Notification.countDocuments({ user: userId, readAt: null });
  const client = await withRedis();
  if (client) {
    await client.set(buildKey(userId), String(unread), { EX: UNREAD_TTL_SECONDS });
  }
  return Number(unread || 0);
};

export const getUnreadCount = async (userId) => {
  if (!userId) return 0;
  const client = await withRedis();
  if (!client) {
    return Notification.countDocuments({ user: userId, readAt: null });
  }

  const key = buildKey(userId);
  const cached = await client.get(key);
  if (cached !== null) {
    const parsed = Number(cached);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  return syncUnreadCount(userId);
};

export const incrementUnreadCount = async (userId, delta = 1) => {
  if (!userId) return 0;
  const amount = Math.max(1, Number(delta || 1));
  const client = await withRedis();
  if (!client) {
    return getUnreadCount(userId);
  }
  const key = buildKey(userId);
  const next = await client.incrBy(key, amount);
  await client.expire(key, UNREAD_TTL_SECONDS);
  return Number(next || 0);
};

export const decrementUnreadCount = async (userId, delta = 1) => {
  if (!userId) return 0;
  const amount = Math.max(1, Number(delta || 1));
  const client = await withRedis();
  if (!client) {
    return getUnreadCount(userId);
  }
  const key = buildKey(userId);
  const next = await client.decrBy(key, amount);
  const sanitized = Math.max(0, Number(next || 0));
  await client.set(key, String(sanitized), { EX: UNREAD_TTL_SECONDS });
  return sanitized;
};

export const resetUnreadCount = async (userId) => {
  if (!userId) return 0;
  const client = await withRedis();
  if (!client) return 0;
  await client.set(buildKey(userId), '0', { EX: UNREAD_TTL_SECONDS });
  return 0;
};

export const buildUnreadCounterKey = buildKey;
