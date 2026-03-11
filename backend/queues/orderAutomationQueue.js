import { safeAsync } from '../utils/safeAsync.js';

const QUEUE_NAME = 'order-automation';

let QueueClass = null;
let QueueSchedulerClass = null;
let orderAutomationQueue = null;
let orderAutomationScheduler = null;

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

export const initOrderAutomationQueue = async () => {
  if (orderAutomationQueue) return orderAutomationQueue;

  const loaded = await loadBullMQ();
  if (!loaded) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn('[order-automation] BullMQ unavailable; queue disabled.');
    }
    return null;
  }

  const connection = redisConnection();

  orderAutomationQueue = new QueueClass(QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      attempts: Math.max(1, Number(process.env.ORDER_AUTOMATION_JOB_ATTEMPTS || 3)),
      removeOnComplete: 1000,
      removeOnFail: 2000,
      backoff: {
        type: 'exponential',
        delay: Math.max(1000, Number(process.env.ORDER_AUTOMATION_JOB_BACKOFF_MS || 3000))
      }
    }
  });

  if (QueueSchedulerClass) {
    orderAutomationScheduler = new QueueSchedulerClass(QUEUE_NAME, { connection });
    await orderAutomationScheduler.waitUntilReady();
  }

  await orderAutomationQueue.waitUntilReady();
  return orderAutomationQueue;
};

export const enqueueOrderAutomationJob = async (name, data = {}, options = {}) => {
  const queue = await initOrderAutomationQueue();
  if (!queue) return null;
  const jobName = String(name || '').trim();
  if (!jobName) return null;

  return queue.add(jobName, data, {
    delay: Math.max(0, Number(options.delay || 0)),
    priority: Number(options.priority || 3),
    jobId: options.jobId || undefined
  });
};

export const ensureOrderAutomationSchedules = async () => {
  const queue = await initOrderAutomationQueue();
  if (!queue) return null;

  const every15m = 15 * 60 * 1000;
  const every60m = 60 * 60 * 1000;
  const every6h = 6 * 60 * 60 * 1000;
  const every12h = 12 * 60 * 60 * 1000;

  await queue.add(
    'detect-delays',
    { source: 'schedule' },
    { jobId: 'schedule:detect-delays', repeat: { every: every15m } }
  );
  await queue.add(
    'seller-reminders',
    { source: 'schedule', reminderType: 'seller' },
    { jobId: 'schedule:seller-reminders', repeat: { every: every60m } }
  );
  await queue.add(
    'buyer-confirmation-reminders',
    { source: 'schedule', reminderType: 'buyer_confirmation' },
    { jobId: 'schedule:buyer-confirmation-reminders', repeat: { every: every60m } }
  );
  await queue.add(
    'review-reminders',
    { source: 'schedule', reminderType: 'review' },
    { jobId: 'schedule:review-reminders', repeat: { every: every6h } }
  );
  await queue.add(
    'experience-reminders',
    { source: 'schedule', reminderType: 'experience' },
    { jobId: 'schedule:experience-reminders', repeat: { every: every12h } }
  );
  await queue.add(
    'escalation-reminders',
    { source: 'schedule', reminderType: 'escalation' },
    { jobId: 'schedule:escalation-reminders', repeat: { every: every60m } }
  );
  await queue.add(
    'installment-reminders',
    { source: 'schedule' },
    { jobId: 'schedule:installment-reminders', repeat: { every: every60m } }
  );
  await queue.add(
    'installment-proof-sla',
    { source: 'schedule' },
    { jobId: 'schedule:installment-proof-sla', repeat: { every: every60m } }
  );

  return true;
};

export const closeOrderAutomationQueue = async () => {
  if (orderAutomationScheduler) {
    await safeAsync(async () => orderAutomationScheduler.close(), { fallback: null });
    orderAutomationScheduler = null;
  }
  if (orderAutomationQueue) {
    await safeAsync(async () => orderAutomationQueue.close(), { fallback: null });
    orderAutomationQueue = null;
  }
};

export const orderAutomationQueueName = QUEUE_NAME;
