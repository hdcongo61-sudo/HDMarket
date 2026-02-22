import { safeAsync } from '../utils/safeAsync.js';
import { notificationQueueName } from '../queues/notificationQueue.js';
import { dispatchNotificationPayload } from '../utils/notificationDispatcher.js';

let WorkerClass = null;
let notificationWorker = null;

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

export const initNotificationWorker = async () => {
  if (notificationWorker) return notificationWorker;

  const loaded = await loadWorkerClass();
  if (!loaded) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn('[notifications] BullMQ Worker unavailable. Worker disabled.');
    }
    return null;
  }

  notificationWorker = new WorkerClass(
    notificationQueueName,
    async (job) => {
      const payload = job?.data || {};
      const result = await dispatchNotificationPayload({
        ...payload,
        queueJobId: String(job?.id || '')
      });
      if (result?.channels?.viaPush && result?.pushError) {
        throw new Error(result.pushError);
      }
      return result;
    },
    {
      connection: redisConnection(),
      concurrency: Math.max(1, Number(process.env.NOTIFICATION_WORKER_CONCURRENCY || 15))
    }
  );

  notificationWorker.on('failed', (job, error) => {
    if (process.env.NODE_ENV !== 'test') {
      console.error(
        '[notifications] job failed',
        { id: job?.id, notificationId: job?.data?.notificationId },
        error?.message || error
      );
    }
  });

  await notificationWorker.waitUntilReady();
  return notificationWorker;
};

export const closeNotificationWorker = async () => {
  if (!notificationWorker) return;
  await safeAsync(async () => notificationWorker.close(), { fallback: null });
  notificationWorker = null;
};
