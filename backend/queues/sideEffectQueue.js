import { safeAsync } from '../utils/safeAsync.js';

const QUEUE_NAME = 'side-effects';
const DEFAULT_ATTEMPTS = Math.max(1, Number(process.env.SIDE_EFFECT_QUEUE_ATTEMPTS || 3));
const DEFAULT_BACKOFF_MS = Math.max(1000, Number(process.env.SIDE_EFFECT_QUEUE_BACKOFF_MS || 3000));

let QueueClass = null;
let QueueSchedulerClass = null;
let sideEffectQueue = null;
let sideEffectScheduler = null;

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

const REDIS_ENABLED = Boolean(
  process.env.REDIS_URL ||
    (process.env.REDIS_HOST && process.env.REDIS_PORT)
);

export const initSideEffectQueue = async () => {
  if (!REDIS_ENABLED) return null;
  if (sideEffectQueue) return sideEffectQueue;

  const loaded = await loadBullMQ();
  if (!loaded) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn('[side-effects] BullMQ unavailable; queue disabled.');
    }
    return null;
  }

  const connection = redisConnection();
  sideEffectQueue = new QueueClass(QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      attempts: DEFAULT_ATTEMPTS,
      removeOnComplete: 2000,
      removeOnFail: 3000,
      backoff: {
        type: 'exponential',
        delay: DEFAULT_BACKOFF_MS
      }
    }
  });

  if (QueueSchedulerClass) {
    sideEffectScheduler = new QueueSchedulerClass(QUEUE_NAME, { connection });
    await sideEffectScheduler.waitUntilReady();
  }

  await sideEffectQueue.waitUntilReady();
  return sideEffectQueue;
};

export const enqueueSideEffectJob = async (name, data = {}, options = {}) => {
  const queue = await initSideEffectQueue();
  if (!queue) return null;

  const jobName = String(name || '').trim();
  if (!jobName) return null;

  return queue.add(jobName, data, {
    delay: Math.max(0, Number(options.delay || 0)),
    priority: Number(options.priority || 3),
    jobId: options.jobId || undefined
  });
};

export const getSideEffectQueue = () => sideEffectQueue;

export const closeSideEffectQueue = async () => {
  if (sideEffectScheduler) {
    await safeAsync(async () => sideEffectScheduler.close(), { fallback: null });
    sideEffectScheduler = null;
  }
  if (sideEffectQueue) {
    await safeAsync(async () => sideEffectQueue.close(), { fallback: null });
    sideEffectQueue = null;
  }
};

export const sideEffectQueueName = QUEUE_NAME;
