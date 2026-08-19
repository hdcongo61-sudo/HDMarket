import { safeAsync } from '../utils/safeAsync.js';
import { notificationCampaignQueueName, enqueueCampaignDelivery } from '../queues/notificationCampaignQueue.js';
import NotificationCampaign from '../models/notificationCampaignModel.js';
import { deliverCampaign } from '../services/notificationCampaignService.js';
import { deliverDueSteps } from '../services/onboardingService.js';

let WorkerClass = null;
let notificationCampaignWorker = null;

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

const loadWorkerClass = async () => {
  if (WorkerClass) return true;
  try {
    const bullmq = await import('bullmq');
    WorkerClass = bullmq.Worker || null;
    return Boolean(WorkerClass);
  } catch {
    return false;
  }
};

const REDIS_ENABLED = Boolean(process.env.REDIS_URL || (process.env.REDIS_HOST && process.env.REDIS_PORT));

/** Finds campaigns whose scheduled start has arrived and flips them into delivery — never scans the User collection, only the (small) NotificationCampaign collection. */
const activateScheduledCampaigns = async () => {
  const due = await NotificationCampaign.find({
    status: 'scheduled',
    'schedule.startAt': { $lte: new Date() }
  })
    .select('_id')
    .lean();
  for (const campaign of due) {
    const job = await enqueueCampaignDelivery(campaign._id).catch((error) => {
      console.error(`[notification-campaign] failed to enqueue delivery for ${campaign._id}`, error);
      return null;
    });
    if (!job) {
      // Redis/queue unavailable (or enqueue failed) — fall back to inline
      // delivery so scheduled sends still happen without BullMQ configured.
      await deliverCampaign(campaign._id).catch((deliverError) =>
        console.error(`[notification-campaign] inline fallback delivery failed for ${campaign._id}`, deliverError)
      );
    }
  }
  return { activated: due.length };
};

export const initNotificationCampaignWorker = async () => {
  if (!REDIS_ENABLED) return null;
  if (notificationCampaignWorker) return notificationCampaignWorker;

  const loaded = await loadWorkerClass();
  if (!loaded) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn('[notification-campaign] Worker unavailable; campaign worker disabled.');
    }
    return null;
  }

  notificationCampaignWorker = new WorkerClass(
    notificationCampaignQueueName,
    async (job) => {
      const name = String(job?.name || '').trim();
      const data = job?.data || {};

      if (name === 'activate-scheduled-campaigns') {
        return activateScheduledCampaigns();
      }
      if (name === 'deliver-campaign') {
        return deliverCampaign(data.campaignId);
      }
      if (name === 'process-onboarding-steps') {
        return deliverDueSteps({ limit: Number(data?.limit || 200) });
      }
      return null;
    },
    { connection: redisConnection(), concurrency: 2 }
  );

  notificationCampaignWorker.on('failed', (job, error) => {
    console.error(`[notification-campaign] job failed name=${job?.name} id=${job?.id}`, error?.message || error);
  });

  return notificationCampaignWorker;
};

export const closeNotificationCampaignWorker = async () => {
  if (notificationCampaignWorker) {
    await safeAsync(async () => notificationCampaignWorker.close(), { fallback: null });
    notificationCampaignWorker = null;
  }
};

// Exported for the server.js setInterval fallback used when Redis/BullMQ
// isn't configured — mirrors the existing review-reminder fallback pattern.
export const runNotificationCampaignFallbackSweep = async () => {
  const activation = await activateScheduledCampaigns();
  const onboarding = await deliverDueSteps({ limit: 200 });
  return { activation, onboarding };
};
