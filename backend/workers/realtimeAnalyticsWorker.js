import { safeAsync } from '../utils/safeAsync.js';
import { realtimeAnalyticsQueueName } from '../queues/realtimeAnalyticsQueue.js';
import { getFounderIntelligence } from '../services/founderIntelligenceService.js';
import { aggregateDailyPresenceAnalytics, runPresencePeakSnapshot } from '../services/presenceService.js';

let WorkerClass = null;
let analyticsWorker = null;

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

export const initRealtimeAnalyticsWorker = async () => {
  if (analyticsWorker) return analyticsWorker;

  const loaded = await loadWorkerClass();
  if (!loaded) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn('[realtime-analytics] Worker unavailable; analytics worker disabled.');
    }
    return null;
  }

  analyticsWorker = new WorkerClass(
    realtimeAnalyticsQueueName,
    async (job) => {
      const name = String(job?.name || '').trim();
      const data = job?.data || {};

      if (name === 'presence-peak-snapshot') {
        return runPresencePeakSnapshot();
      }

      if (name === 'daily-analytics-rollup') {
        return aggregateDailyPresenceAnalytics({
          dayKey: data?.dayKey
        });
      }

      if (name === 'founder-cache-warm') {
        return getFounderIntelligence({ forceRefresh: true });
      }

      return { skipped: true, reason: `Unknown realtime analytics job: ${name}` };
    },
    {
      connection: redisConnection(),
      concurrency: Math.max(1, Number(process.env.REALTIME_ANALYTICS_WORKER_CONCURRENCY || 3))
    }
  );

  analyticsWorker.on('failed', (job, error) => {
    if (process.env.NODE_ENV !== 'test') {
      console.error('[realtime-analytics] job failed', { id: job?.id, name: job?.name }, error?.message || error);
    }
  });

  await analyticsWorker.waitUntilReady();
  return analyticsWorker;
};

export const closeRealtimeAnalyticsWorker = async () => {
  if (!analyticsWorker) return;
  await safeAsync(async () => analyticsWorker.close(), { fallback: null });
  analyticsWorker = null;
};

