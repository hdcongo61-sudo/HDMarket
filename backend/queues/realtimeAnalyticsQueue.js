import { safeAsync } from '../utils/safeAsync.js';

const QUEUE_NAME = 'realtime-analytics';

let QueueClass = null;
let QueueSchedulerClass = null;
let analyticsQueue = null;
let analyticsScheduler = null;

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

export const initRealtimeAnalyticsQueue = async () => {
  if (analyticsQueue) return analyticsQueue;

  const loaded = await loadBullMQ();
  if (!loaded) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn('[realtime-analytics] BullMQ unavailable; queue disabled.');
    }
    return null;
  }

  const connection = redisConnection();
  analyticsQueue = new QueueClass(QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      attempts: Math.max(1, Number(process.env.REALTIME_ANALYTICS_JOB_ATTEMPTS || 2)),
      removeOnComplete: 1000,
      removeOnFail: 2000,
      backoff: {
        type: 'exponential',
        delay: Math.max(1000, Number(process.env.REALTIME_ANALYTICS_JOB_BACKOFF_MS || 3000))
      }
    }
  });

  if (QueueSchedulerClass) {
    analyticsScheduler = new QueueSchedulerClass(QUEUE_NAME, { connection });
    await analyticsScheduler.waitUntilReady();
  }

  await analyticsQueue.waitUntilReady();
  return analyticsQueue;
};

export const enqueueRealtimeAnalyticsJob = async (name, data = {}, options = {}) => {
  const queue = await initRealtimeAnalyticsQueue();
  if (!queue) return null;
  const jobName = String(name || '').trim();
  if (!jobName) return null;

  return queue.add(jobName, data, {
    delay: Math.max(0, Number(options.delay || 0)),
    priority: Number(options.priority || 3),
    jobId: options.jobId || undefined
  });
};

export const ensureRealtimeAnalyticsSchedules = async () => {
  const queue = await initRealtimeAnalyticsQueue();
  if (!queue) return null;

  await queue.add(
    'presence-peak-snapshot',
    { source: 'schedule' },
    { jobId: 'schedule:presence-peak-snapshot', repeat: { every: 60 * 1000 } }
  );
  await queue.add(
    'daily-analytics-rollup',
    { source: 'schedule' },
    { jobId: 'schedule:daily-analytics-rollup', repeat: { every: 60 * 60 * 1000 } }
  );
  await queue.add(
    'founder-cache-warm',
    { source: 'schedule' },
    { jobId: 'schedule:founder-cache-warm', repeat: { every: 5 * 60 * 1000 } }
  );

  return true;
};

export const closeRealtimeAnalyticsQueue = async () => {
  if (analyticsScheduler) {
    await safeAsync(async () => analyticsScheduler.close(), { fallback: null });
    analyticsScheduler = null;
  }
  if (analyticsQueue) {
    await safeAsync(async () => analyticsQueue.close(), { fallback: null });
    analyticsQueue = null;
  }
};

export const realtimeAnalyticsQueueName = QUEUE_NAME;

