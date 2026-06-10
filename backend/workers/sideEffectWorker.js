import { safeAsync } from '../utils/safeAsync.js';
import { sideEffectQueueName } from '../queues/sideEffectQueue.js';
import { processSideEffectJob } from '../services/sideEffectJobService.js';

let WorkerClass = null;
let sideEffectWorker = null;

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

const REDIS_ENABLED = Boolean(
  process.env.REDIS_URL ||
    (process.env.REDIS_HOST && process.env.REDIS_PORT)
);

export const initSideEffectWorker = async () => {
  if (!REDIS_ENABLED) return null;
  if (sideEffectWorker) return sideEffectWorker;

  const loaded = await loadWorkerClass();
  if (!loaded) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn('[side-effects] Worker unavailable; side-effect worker disabled.');
    }
    return null;
  }

  sideEffectWorker = new WorkerClass(
    sideEffectQueueName,
    async (job) => processSideEffectJob({ name: job?.name, data: job?.data || {} }),
    {
      connection: redisConnection(),
      concurrency: Math.max(1, Number(process.env.SIDE_EFFECT_WORKER_CONCURRENCY || 8))
    }
  );

  sideEffectWorker.on('failed', (job, error) => {
    if (process.env.NODE_ENV !== 'test') {
      console.error('[side-effects] job failed', { id: job?.id, name: job?.name }, error?.message || error);
    }
  });

  await sideEffectWorker.waitUntilReady();
  return sideEffectWorker;
};

export const closeSideEffectWorker = async () => {
  if (!sideEffectWorker) return;
  await safeAsync(async () => sideEffectWorker.close(), { fallback: null });
  sideEffectWorker = null;
};
