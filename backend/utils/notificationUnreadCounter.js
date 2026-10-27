import Notification from '../models/notificationModel.js';
import { initRedis, getRedisClient, isRedisReady } from '../config/redisClient.js';
import { buildUnreadNotificationFilter } from './notificationVisibility.js';

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
  const unread = await Notification.countDocuments(buildUnreadNotificationFilter(userId));
  const client = await withRedis().catch(() => null);
  if (client) {
    await client.set(buildKey(userId), String(unread), { EX: UNREAD_TTL_SECONDS }).catch(() => {});
  }
  return Number(unread || 0);
};

// Read the indexed database count: snooze/expiry can change visibility without
// a mutation, and queue retries must never apply the same delta twice.
export const getUnreadCount = syncUnreadCount;

export const buildUnreadCounterKey = buildKey;
