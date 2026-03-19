import storage from './storage';

const PREFIX = 'hdmarket:admin-delivery-offline-queue:v1';
const OFFLINE_QUEUE_EVENT = 'hdmarket:offline-queue-changed';

const buildKey = (userId) => `${PREFIX}:${String(userId || 'guest').trim()}`;

const normalizeQueue = (value) => {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item) => item && typeof item === 'object' && item.requestId && item.actionType
  );
};

const emitQueueChanged = (detail = {}) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(OFFLINE_QUEUE_EVENT, {
      detail: {
        source: 'admin-delivery',
        ...detail
      }
    })
  );
};

export const loadAdminDeliveryOfflineQueue = async (userId) => {
  const key = buildKey(userId);
  const data = await storage.get(key);
  return normalizeQueue(data);
};

export const saveAdminDeliveryOfflineQueue = async (userId, queue) => {
  const key = buildKey(userId);
  const nextQueue = normalizeQueue(queue);
  const saved = await storage.set(key, nextQueue);
  if (saved) {
    emitQueueChanged({
      userId,
      count: nextQueue.length
    });
  }
  return saved;
};

export const enqueueAdminDeliveryOfflineAction = async (userId, action) => {
  const queue = await loadAdminDeliveryOfflineQueue(userId);
  queue.push({
    ...action,
    queuedAt: action?.queuedAt || new Date().toISOString()
  });
  await saveAdminDeliveryOfflineQueue(userId, queue);
  return queue;
};

export const removeAdminDeliveryOfflineAction = async (userId, queueId) => {
  const queue = await loadAdminDeliveryOfflineQueue(userId);
  const nextQueue = queue.filter((item) => String(item?.queueId || '') !== String(queueId || ''));
  await saveAdminDeliveryOfflineQueue(userId, nextQueue);
  return nextQueue;
};

export const countAllAdminDeliveryOfflineActions = async () => {
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
