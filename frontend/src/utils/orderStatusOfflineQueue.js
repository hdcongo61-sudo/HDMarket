import storage from './storage';

const PREFIX = 'hdmarket:order-status-offline-queue:v1';
const OFFLINE_QUEUE_EVENT = 'hdmarket:offline-queue-changed';

const buildKey = (userId, scope = 'seller') =>
  `${PREFIX}:${String(userId || 'guest').trim()}:${String(scope || 'seller').trim()}`;

const normalizeQueue = (value) => {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item && typeof item === 'object' && item.orderId && item.nextStatus);
};

const emitQueueChanged = (detail = {}) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(OFFLINE_QUEUE_EVENT, {
      detail: {
        source: 'order-status',
        ...detail
      }
    })
  );
};

export const loadOrderStatusOfflineQueue = async (userId, scope = 'seller') => {
  const key = buildKey(userId, scope);
  const data = await storage.get(key);
  return normalizeQueue(data);
};

export const saveOrderStatusOfflineQueue = async (userId, scope = 'seller', queue) => {
  const key = buildKey(userId, scope);
  const nextQueue = normalizeQueue(queue);
  const saved = await storage.set(key, nextQueue);
  if (saved) {
    emitQueueChanged({
      userId,
      scope,
      count: nextQueue.length
    });
  }
  return saved;
};

export const enqueueOrderStatusOfflineAction = async (userId, scope = 'seller', action) => {
  const queue = await loadOrderStatusOfflineQueue(userId, scope);
  queue.push({
    ...action,
    queuedAt: action?.queuedAt || new Date().toISOString()
  });
  await saveOrderStatusOfflineQueue(userId, scope, queue);
  return queue;
};

export const removeOrderStatusOfflineAction = async (userId, scope = 'seller', queueId) => {
  const queue = await loadOrderStatusOfflineQueue(userId, scope);
  const nextQueue = queue.filter((item) => String(item?.queueId || '') !== String(queueId || ''));
  await saveOrderStatusOfflineQueue(userId, scope, nextQueue);
  return nextQueue;
};

export const clearOrderStatusOfflineQueue = async (userId, scope = 'seller') => {
  return saveOrderStatusOfflineQueue(userId, scope, []);
};

export const countOrderStatusOfflineActions = async (userId, scope = 'seller') => {
  const queue = await loadOrderStatusOfflineQueue(userId, scope);
  return queue.length;
};

export const countAllOrderStatusOfflineActions = async () => {
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
