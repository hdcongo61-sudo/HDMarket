import { safeAsync } from '../utils/safeAsync.js';

const QUEUE_NAME = 'notifications';
const DEFAULT_ATTEMPTS = Math.max(1, Number(process.env.NOTIFICATION_QUEUE_ATTEMPTS || 4));
const DEFAULT_BACKOFF_MS = Math.max(1000, Number(process.env.NOTIFICATION_QUEUE_BACKOFF_MS || 5000));

let QueueClass = null;
let QueueSchedulerClass = null;
let notificationQueue = null;
let notificationQueueScheduler = null;

const redisConnection = () => {
  if (process.env.REDIS_URL) {
    return { url: process.env.REDIS_URL };
  }
  return {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT || 6379),
    password: process.env.REDIS_PASSWORD || undefined,
    db: Number(process.env.REDIS_DB || 0)
  };
};

const loadBullMQ = async () => {
  if (QueueClass) return true;
  try {
    const bullmq = await import('bullmq');
    QueueClass = bullmq.Queue || null;
    QueueSchedulerClass = bullmq.QueueScheduler || null;
    return Boolean(QueueClass);
  } catch {
    return false;
  }
};

const toBullPriority = (priority = 'NORMAL') => {
  switch (String(priority || '').toUpperCase()) {
    case 'CRITICAL':
      return 1;
    case 'HIGH':
      return 2;
    case 'LOW':
      return 4;
    default:
      return 3;
  }
};

export const initNotificationQueue = async () => {
  if (notificationQueue) return notificationQueue;

  const loaded = await loadBullMQ();
  if (!loaded) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn('[notifications] BullMQ not installed. Queue disabled, fallback mode active.');
    }
    return null;
  }

  const connection = redisConnection();
  notificationQueue = new QueueClass(QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      attempts: DEFAULT_ATTEMPTS,
      removeOnComplete: 2000,
      removeOnFail: 2000,
      backoff: {
        type: 'exponential',
        delay: DEFAULT_BACKOFF_MS
      }
    }
  });

  if (QueueSchedulerClass) {
    notificationQueueScheduler = new QueueSchedulerClass(QUEUE_NAME, { connection });
    await notificationQueueScheduler.waitUntilReady();
  }

  await notificationQueue.waitUntilReady();
  return notificationQueue;
};

export const enqueueNotificationJob = async (payload = {}) => {
  const queue = await initNotificationQueue();
  if (!queue) return null;

  const notificationId = String(payload.notificationId || '');
  if (!notificationId) return null;

  const job = await queue.add(
    'deliver',
    payload,
    {
      priority: toBullPriority(payload.priority),
      jobId: `${notificationId}:${Date.now()}`,
      delay: Math.max(0, Number(payload.delayMs || 0))
    }
  );
  return job;
};

export const getNotificationQueue = () => notificationQueue;

export const closeNotificationQueue = async () => {
  if (notificationQueueScheduler) {
    await safeAsync(async () => notificationQueueScheduler.close(), { fallback: null });
    notificationQueueScheduler = null;
  }
  if (notificationQueue) {
    await safeAsync(async () => notificationQueue.close(), { fallback: null });
    notificationQueue = null;
  }
};

export const notificationQueueName = QUEUE_NAME;
