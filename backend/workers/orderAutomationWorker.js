import { safeAsync } from '../utils/safeAsync.js';
import { orderAutomationQueueName } from '../queues/orderAutomationQueue.js';
import { runAutomatedReminderSweep, runDelayedOrderDetection } from '../services/adminOrderAutomationService.js';

let WorkerClass = null;
let orderAutomationWorker = null;

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

export const initOrderAutomationWorker = async () => {
  if (orderAutomationWorker) return orderAutomationWorker;

  const loaded = await loadWorkerClass();
  if (!loaded) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn('[order-automation] Worker unavailable; automation worker disabled.');
    }
    return null;
  }

  orderAutomationWorker = new WorkerClass(
    orderAutomationQueueName,
    async (job) => {
      const name = String(job?.name || '').trim();
      const data = job?.data || {};

      if (name === 'detect-delays') {
        return runDelayedOrderDetection({
          limit: Number(data?.limit || 250),
          actorId: data?.actorId || null
        });
      }

      if (
        [
          'seller-reminders',
          'buyer-confirmation-reminders',
          'review-reminders',
          'experience-reminders',
          'escalation-reminders'
        ].includes(name)
      ) {
        const reminderTypeMap = {
          'seller-reminders': 'seller',
          'buyer-confirmation-reminders': 'buyer_confirmation',
          'review-reminders': 'review',
          'experience-reminders': 'experience',
          'escalation-reminders': 'escalation'
        };

        return runAutomatedReminderSweep({
          reminderType: data?.reminderType || reminderTypeMap[name] || 'seller',
          limit: Number(data?.limit || 120),
          actorId: data?.actorId || null
        });
      }

      return { skipped: true, reason: `Unknown job: ${name}` };
    },
    {
      connection: redisConnection(),
      concurrency: Math.max(1, Number(process.env.ORDER_AUTOMATION_WORKER_CONCURRENCY || 5))
    }
  );

  orderAutomationWorker.on('failed', (job, error) => {
    if (process.env.NODE_ENV !== 'test') {
      console.error('[order-automation] job failed', { id: job?.id, name: job?.name }, error?.message || error);
    }
  });

  await orderAutomationWorker.waitUntilReady();
  return orderAutomationWorker;
};

export const closeOrderAutomationWorker = async () => {
  if (!orderAutomationWorker) return;
  await safeAsync(async () => orderAutomationWorker.close(), { fallback: null });
  orderAutomationWorker = null;
};
