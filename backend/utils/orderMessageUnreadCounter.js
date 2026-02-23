import mongoose from 'mongoose';
import OrderMessage from '../models/orderMessageModel.js';
import { initRedis, getRedisClient, isRedisReady } from '../config/redisClient.js';

const ENV = String(process.env.CACHE_ENV || process.env.NODE_ENV || 'dev')
  .toLowerCase()
  .startsWith('prod')
  ? 'prod'
  : 'dev';

const UNREAD_TTL_SECONDS = Math.max(60, Number(process.env.ORDER_CHAT_UNREAD_TTL_SECONDS || 300));
const KEY_PREFIX = `${ENV}:chat:user:`;

const buildTotalKey = (userId) => `${KEY_PREFIX}${String(userId)}:unread`;
const buildConversationKey = (userId) => `${KEY_PREFIX}${String(userId)}:conversations`;

const withRedis = async () => {
  if (isRedisReady()) return getRedisClient();
  return initRedis();
};

const asObjectId = (value) => {
  try {
    return new mongoose.Types.ObjectId(String(value));
  } catch {
    return null;
  }
};

export const syncOrderUnreadState = async (userId) => {
  if (!userId) return { totalUnread: 0, byConversation: {} };
  const recipient = asObjectId(userId);
  if (!recipient) return { totalUnread: 0, byConversation: {} };

  const rows = await OrderMessage.aggregate([
    {
      $match: {
        recipient,
        readAt: null
      }
    },
    {
      $group: {
        _id: '$order',
        count: { $sum: 1 }
      }
    }
  ]);

  const byConversation = {};
  let totalUnread = 0;
  rows.forEach((row) => {
    const conversationId = String(row?._id || '');
    const count = Number(row?.count || 0);
    if (!conversationId || !Number.isFinite(count) || count <= 0) return;
    byConversation[conversationId] = count;
    totalUnread += count;
  });

  const client = await withRedis();
  if (client) {
    const totalKey = buildTotalKey(userId);
    const conversationKey = buildConversationKey(userId);

    const multi = client.multi();
    multi.set(totalKey, String(totalUnread), { EX: UNREAD_TTL_SECONDS });
    multi.del(conversationKey);
    if (Object.keys(byConversation).length) {
      multi.hSet(conversationKey, byConversation);
      multi.expire(conversationKey, UNREAD_TTL_SECONDS);
    }
    await multi.exec();
  }

  return { totalUnread, byConversation };
};

export const getOrderUnreadTotal = async (userId) => {
  if (!userId) return 0;
  const client = await withRedis();
  if (!client) {
    const recipient = asObjectId(userId);
    if (!recipient) return 0;
    return OrderMessage.countDocuments({ recipient, readAt: null });
  }

  const key = buildTotalKey(userId);
  const cached = await client.get(key);
  if (cached !== null) {
    const parsed = Number(cached);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }

  const snapshot = await syncOrderUnreadState(userId);
  return snapshot.totalUnread;
};

export const incrementOrderConversationUnread = async (userId, conversationId, delta = 1) => {
  if (!userId || !conversationId) return { totalUnread: 0, conversationUnread: 0 };
  const amount = Math.max(1, Number(delta || 1));
  const client = await withRedis();

  if (!client) {
    const snapshot = await syncOrderUnreadState(userId);
    return {
      totalUnread: snapshot.totalUnread,
      conversationUnread: Number(snapshot.byConversation[String(conversationId)] || 0)
    };
  }

  const totalKey = buildTotalKey(userId);
  const conversationKey = buildConversationKey(userId);
  const conversationField = String(conversationId);

  const multi = client.multi();
  multi.hIncrBy(conversationKey, conversationField, amount);
  multi.incrBy(totalKey, amount);
  multi.expire(conversationKey, UNREAD_TTL_SECONDS);
  multi.expire(totalKey, UNREAD_TTL_SECONDS);
  const result = await multi.exec();

  const conversationUnread = Number(result?.[0] || 0);
  const totalUnread = Number(result?.[1] || 0);
  return {
    totalUnread: Math.max(0, totalUnread),
    conversationUnread: Math.max(0, conversationUnread)
  };
};

export const resetOrderConversationUnread = async (userId, conversationId) => {
  if (!userId || !conversationId) return { totalUnread: 0, conversationUnread: 0 };
  const client = await withRedis();
  const conversationField = String(conversationId);

  if (!client) {
    const snapshot = await syncOrderUnreadState(userId);
    return {
      totalUnread: snapshot.totalUnread,
      conversationUnread: Number(snapshot.byConversation[conversationField] || 0)
    };
  }

  const totalKey = buildTotalKey(userId);
  const conversationKey = buildConversationKey(userId);

  const currentConversationUnread = Number((await client.hGet(conversationKey, conversationField)) || 0);
  const currentTotal = Number((await client.get(totalKey)) || 0);

  const nextTotal = Math.max(0, currentTotal - Math.max(0, currentConversationUnread));
  const multi = client.multi();
  multi.hDel(conversationKey, conversationField);
  multi.set(totalKey, String(nextTotal), { EX: UNREAD_TTL_SECONDS });
  multi.expire(conversationKey, UNREAD_TTL_SECONDS);
  await multi.exec();

  return {
    totalUnread: nextTotal,
    conversationUnread: 0
  };
};

export const setOrderUnreadTotal = async (userId, totalUnread = 0) => {
  if (!userId) return 0;
  const sanitized = Math.max(0, Number(totalUnread || 0));
  const client = await withRedis();
  if (!client) return sanitized;
  await client.set(buildTotalKey(userId), String(sanitized), { EX: UNREAD_TTL_SECONDS });
  return sanitized;
};

export const decrementOrderConversationUnread = async (userId, conversationId, delta = 1) => {
  if (!userId || !conversationId) return { totalUnread: 0, conversationUnread: 0 };
  const amount = Math.max(1, Number(delta || 1));
  const client = await withRedis();
  const conversationField = String(conversationId);

  if (!client) {
    const snapshot = await syncOrderUnreadState(userId);
    return {
      totalUnread: snapshot.totalUnread,
      conversationUnread: Number(snapshot.byConversation[conversationField] || 0)
    };
  }

  const totalKey = buildTotalKey(userId);
  const conversationKey = buildConversationKey(userId);

  const currentConversationUnread = Number((await client.hGet(conversationKey, conversationField)) || 0);
  const currentTotal = Number((await client.get(totalKey)) || 0);
  const decremented = Math.min(amount, Math.max(0, currentConversationUnread));
  const nextConversationUnread = Math.max(0, currentConversationUnread - decremented);
  const nextTotal = Math.max(0, currentTotal - decremented);

  const multi = client.multi();
  if (nextConversationUnread <= 0) {
    multi.hDel(conversationKey, conversationField);
  } else {
    multi.hSet(conversationKey, conversationField, String(nextConversationUnread));
  }
  multi.set(totalKey, String(nextTotal), { EX: UNREAD_TTL_SECONDS });
  multi.expire(conversationKey, UNREAD_TTL_SECONDS);
  await multi.exec();

  return {
    totalUnread: nextTotal,
    conversationUnread: nextConversationUnread
  };
};

export const buildOrderUnreadKeys = {
  total: buildTotalKey,
  conversations: buildConversationKey
};
