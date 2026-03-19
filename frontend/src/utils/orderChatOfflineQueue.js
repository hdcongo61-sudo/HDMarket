import storage from './storage';

const PREFIX = 'hdmarket:order-chat-offline-queue:v1';
const OFFLINE_QUEUE_EVENT = 'hdmarket:offline-queue-changed';

const buildKey = (userId, orderId) =>
  `${PREFIX}:${String(userId || 'guest').trim()}:${String(orderId || 'unknown').trim()}`;

const normalizeQueue = (value) => {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item && typeof item === 'object');
};

const emitQueueChanged = (detail = {}) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(OFFLINE_QUEUE_EVENT, {
      detail: {
        source: 'order-chat',
        ...detail
      }
    })
  );
};

export const loadOrderChatOfflineQueue = async (userId, orderId) => {
  const key = buildKey(userId, orderId);
  const data = await storage.get(key);
  return normalizeQueue(data);
};

export const saveOrderChatOfflineQueue = async (userId, orderId, queue) => {
  const key = buildKey(userId, orderId);
  const nextQueue = normalizeQueue(queue);
  const saved = await storage.set(key, nextQueue);
  if (saved) {
    emitQueueChanged({
      userId,
      orderId,
      count: nextQueue.length
    });
  }
  return saved;
};

export const enqueueOrderChatOfflineAction = async (userId, orderId, action) => {
  const queue = await loadOrderChatOfflineQueue(userId, orderId);
  queue.push({
    ...action,
    queuedAt: action?.queuedAt || new Date().toISOString()
  });
  await saveOrderChatOfflineQueue(userId, orderId, queue);
  return queue;
};

export const removeOrderChatOfflineAction = async (userId, orderId, queueId) => {
  const queue = await loadOrderChatOfflineQueue(userId, orderId);
  const nextQueue = queue.filter((item) => String(item?.queueId || '') !== String(queueId || ''));
  await saveOrderChatOfflineQueue(userId, orderId, nextQueue);
  return nextQueue;
};

export const clearOrderChatOfflineQueue = async (userId, orderId) => {
  return saveOrderChatOfflineQueue(userId, orderId, []);
};

export const countAllOrderChatOfflineActions = async () => {
  const keys = await storage.keys();
  const targetKeys = (Array.isArray(keys) ? keys : []).filter((key) =>
    String(key || '').startsWith(PREFIX)
  );
  let total = 0;
  for (const key of targetKeys) {
    const queue = normalizeQueue(await storage.get(key));
    total += queue.length;
  }
  return total;
};
