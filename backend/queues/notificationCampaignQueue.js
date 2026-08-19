import { safeAsync } from '../utils/safeAsync.js';

const QUEUE_NAME = 'notification-campaign';

let QueueClass = null;
let QueueSchedulerClass = null;
let notificationCampaignQueue = null;
let notificationCampaignScheduler = null;

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

const REDIS_ENABLED = Boolean(process.env.REDIS_URL || (process.env.REDIS_HOST && process.env.REDIS_PORT));

export const isNotificationCampaignQueueRedisEnabled = () => REDIS_ENABLED;

export const initNotificationCampaignQueue = async () => {
  if (!REDIS_ENABLED) return null;
  if (notificationCampaignQueue) return notificationCampaignQueue;

  const loaded = await loadBullMQ();
  if (!loaded) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn('[notification-campaign] BullMQ unavailable; queue disabled.');
    }
    return null;
  }

  const connection = redisConnection();

  notificationCampaignQueue = new QueueClass(QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      attempts: Math.max(1, Number(process.env.NOTIFICATION_CAMPAIGN_JOB_ATTEMPTS || 3)),
      removeOnComplete: 500,
      removeOnFail: 1000,
      backoff: {
        type: 'exponential',
        delay: Math.max(1000, Number(process.env.NOTIFICATION_CAMPAIGN_JOB_BACKOFF_MS || 3000))
      }
    }
  });

  if (QueueSchedulerClass) {
    notificationCampaignScheduler = new QueueSchedulerClass(QUEUE_NAME, { connection });
    await notificationCampaignScheduler.waitUntilReady();
  }

  await notificationCampaignQueue.waitUntilReady();
  return notificationCampaignQueue;
};

/** Enqueues an immediate, one-off batch-delivery job for a single campaign (not a recurring schedule). */
export const enqueueCampaignDelivery = async (campaignId) => {
  const queue = await initNotificationCampaignQueue();
  if (!queue) return null;
  return queue.add(
    'deliver-campaign',
    { campaignId: String(campaignId) },
    { jobId: `deliver-campaign:${campaignId}` }
  );
};

export const ensureNotificationCampaignSchedules = async () => {
  const queue = await initNotificationCampaignQueue();
  if (!queue) return null;

  const every1m = 60 * 1000;
  const every5m = 5 * 60 * 1000;

  await queue.add(
    'activate-scheduled-campaigns',
    { source: 'schedule' },
    { jobId: 'schedule:activate-scheduled-campaigns', repeat: { every: every1m } }
  );
  await queue.add(
    'process-onboarding-steps',
    { source: 'schedule' },
    { jobId: 'schedule:process-onboarding-steps', repeat: { every: every5m } }
  );

  return true;
};

export const closeNotificationCampaignQueue = async () => {
  if (notificationCampaignScheduler) {
    await safeAsync(async () => notificationCampaignScheduler.close(), { fallback: null });
    notificationCampaignScheduler = null;
  }
  if (notificationCampaignQueue) {
    await safeAsync(async () => notificationCampaignQueue.close(), { fallback: null });
    notificationCampaignQueue = null;
  }
};

export const notificationCampaignQueueName = QUEUE_NAME;
