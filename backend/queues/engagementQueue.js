import { safeAsync } from '../utils/safeAsync.js';

const QUEUE_NAME = 'engagement';

let QueueClass = null;
let QueueSchedulerClass = null;
let engagementQueue = null;
let engagementScheduler = null;

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

export const initEngagementQueue = async () => {
  if (!REDIS_ENABLED) return null;
  if (engagementQueue) return engagementQueue;

  const loaded = await loadBullMQ();
  if (!loaded) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn('[engagement] BullMQ unavailable; queue disabled.');
    }
    return null;
  }

  const connection = redisConnection();

  engagementQueue = new QueueClass(QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      attempts: Math.max(1, Number(process.env.ENGAGEMENT_JOB_ATTEMPTS || 2)),
      removeOnComplete: 500,
      removeOnFail: 1000,
      backoff: {
        type: 'exponential',
        delay: Math.max(1000, Number(process.env.ENGAGEMENT_JOB_BACKOFF_MS || 5000))
      }
    }
  });

  if (QueueSchedulerClass) {
    engagementScheduler = new QueueSchedulerClass(QUEUE_NAME, { connection });
    await engagementScheduler.waitUntilReady();
  }

  await engagementQueue.waitUntilReady();
  return engagementQueue;
};

export const ensureEngagementSchedules = async () => {
  const queue = await initEngagementQueue();
  if (!queue) return null;

  const everyHour = 60 * 60 * 1000;
  const every3h = 3 * 60 * 60 * 1000;
  const every6h = 6 * 60 * 60 * 1000;

  // Price drop check — every hour
  await queue.add(
    'check-price-drops',
    { source: 'schedule' },
    { jobId: 'schedule:check-price-drops', repeat: { every: everyHour } }
  );

  // Back in stock check — every hour
  await queue.add(
    'check-back-in-stock',
    { source: 'schedule' },
    { jobId: 'schedule:check-back-in-stock', repeat: { every: everyHour } }
  );

  // Abandoned cart check — every 6 hours
  await queue.add(
    'check-abandoned-carts',
    { source: 'schedule' },
    { jobId: 'schedule:check-abandoned-carts', repeat: { every: every6h } }
  );

  // Seller new product check — every 3 hours
  await queue.add(
    'check-seller-new-products',
    { source: 'schedule' },
    { jobId: 'schedule:check-seller-new-products', repeat: { every: every3h } }
  );

  // Weekly digest — every Sunday at 10:00 AM
  // BullMQ repeat with cron for weekly schedule
  await queue.add(
    'send-weekly-digest',
    { source: 'schedule' },
    { jobId: 'schedule:send-weekly-digest', repeat: { pattern: '0 10 * * 0' } }
  );

  // Review reminders — every 12 hours (supplements existing review_reminder)
  await queue.add(
    'check-review-reminders',
    { source: 'schedule' },
    { jobId: 'schedule:check-review-reminders', repeat: { every: 12 * 60 * 60 * 1000 } }
  );

  // Flash sale sweep — start scheduled / end expired — every 5 minutes
  const every5m = 5 * 60 * 1000;
  await queue.add(
    'sweep-flash-sales',
    { source: 'schedule' },
    { jobId: 'schedule:sweep-flash-sales', repeat: { every: every5m } }
  );

  // Seller level recalculation — every 6 hours
  await queue.add(
    'recalculate-seller-levels',
    { source: 'schedule' },
    { jobId: 'schedule:recalculate-seller-levels', repeat: { every: every6h } }
  );

  // Referral rewards — grant once a referred buyer's first order clears the
  // 72h dispute window undisputed — every hour
  await queue.add(
    'sweep-referral-rewards',
    { source: 'schedule' },
    { jobId: 'schedule:sweep-referral-rewards', repeat: { every: everyHour } }
  );

  // Group buy expiry — start/fill/expire sweep — every 5 minutes
  await queue.add(
    'sweep-group-buys',
    { source: 'schedule' },
    { jobId: 'schedule:sweep-group-buys', repeat: { every: every5m } }
  );

  // HDPoints purchase awards — every 15 minutes
  const every15m = 15 * 60 * 1000;
  await queue.add(
    'sweep-purchase-points',
    { source: 'schedule' },
    { jobId: 'schedule:sweep-purchase-points', repeat: { every: every15m } }
  );

  return true;
};

export const getEngagementQueue = () => engagementQueue;

export const closeEngagementQueue = async () => {
  if (engagementScheduler) {
    await safeAsync(async () => engagementScheduler.close(), { fallback: null });
    engagementScheduler = null;
  }
  if (engagementQueue) {
    await safeAsync(async () => engagementQueue.close(), { fallback: null });
    engagementQueue = null;
  }
};

export const engagementQueueName = QUEUE_NAME;
