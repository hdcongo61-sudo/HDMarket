import { safeAsync } from '../utils/safeAsync.js';
import { engagementQueueName } from '../queues/engagementQueue.js';
import {
  sweepPriceDrops,
  sweepBackInStock,
  sweepAbandonedCarts,
  sweepSellerNewProducts,
  sweepReviewReminders,
  sendWeeklyDigest
} from '../services/engagementService.js';
import {
  sweepStartScheduled,
  sweepEndExpired
} from '../services/flashSaleService.js';
import {
  sweepSellerLevels
} from '../services/sellerReputationService.js';

let WorkerClass = null;
let engagementWorker = null;

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

const JOB_HANDLERS = {
  'check-price-drops': (data) =>
    sweepPriceDrops({ limit: Number(data?.limit || 500) }),

  'check-back-in-stock': (data) =>
    sweepBackInStock({ limit: Number(data?.limit || 500) }),

  'check-abandoned-carts': (data) =>
    sweepAbandonedCarts({ limit: Number(data?.limit || 500) }),

  'check-seller-new-products': (data) =>
    sweepSellerNewProducts({ limit: Number(data?.limit || 500) }),

  'check-review-reminders': (data) =>
    sweepReviewReminders({ limit: Number(data?.limit || 300) }),

  'send-weekly-digest': (data) =>
    sendWeeklyDigest({ limit: Number(data?.limit || 100) }),

  'sweep-flash-sales': async (data) => {
    const limit = Number(data?.limit || 200);
    const [startResult, endResult] = await Promise.all([
      sweepStartScheduled({ limit }),
      sweepEndExpired({ limit })
    ]);
    return { started: startResult.started, ended: endResult.ended };
  },

  'recalculate-seller-levels': (data) =>
    sweepSellerLevels({ limit: Number(data?.limit || 100) })
};

export const initEngagementWorker = async () => {
  if (engagementWorker) return engagementWorker;

  const loaded = await loadWorkerClass();
  if (!loaded) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn('[engagement] BullMQ Worker unavailable. Worker disabled.');
    }
    return null;
  }

  engagementWorker = new WorkerClass(
    engagementQueueName,
    async (job) => {
      const name = String(job?.name || '').trim();
      const data = job?.data || {};

      const handler = JOB_HANDLERS[name];
      if (!handler) {
        console.warn(`[engagement] Unknown job: ${name}`);
        return { skipped: true, reason: 'unknown_job' };
      }

      const result = await handler(data);
      if (process.env.NODE_ENV !== 'test' && result.notificationsSent > 0) {
        console.log(`[engagement] ${name}: ${result.notificationsSent} notifications sent`);
      }
      return result;
    },
    {
      connection: redisConnection(),
      concurrency: Math.max(1, Number(process.env.ENGAGEMENT_WORKER_CONCURRENCY || 3))
    }
  );

  engagementWorker.on('failed', (job, error) => {
    if (process.env.NODE_ENV !== 'test') {
      console.error(
        '[engagement] job failed',
        { id: job?.id, name: job?.name },
        error?.message || error
      );
    }
  });

  await engagementWorker.waitUntilReady();
  return engagementWorker;
};

export const closeEngagementWorker = async () => {
  if (!engagementWorker) return;
  await safeAsync(async () => engagementWorker.close(), { fallback: null });
  engagementWorker = null;
};
