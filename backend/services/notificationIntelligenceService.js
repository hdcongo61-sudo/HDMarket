import Notification from '../models/notificationModel.js';
import PushToken from '../models/pushTokenModel.js';
import { getRedisClient, initRedis, isRedisReady } from '../config/redisClient.js';

const ENV = String(process.env.CACHE_ENV || process.env.NODE_ENV || 'dev')
  .toLowerCase()
  .startsWith('prod')
  ? 'prod'
  : 'dev';

const CACHE_KEY = `${ENV}:founder:notifications:intelligence`;
const CACHE_TTL_SECONDS = Math.max(
  30,
  Number(process.env.FOUNDER_NOTIFICATIONS_CACHE_SECONDS || 60)
);

const asNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const pct = (value, total) => {
  if (!total) return 0;
  return Number((((asNumber(value) / asNumber(total)) * 100) || 0).toFixed(2));
};

const round = (value, digits = 2) => {
  const amount = asNumber(value, 0);
  return Number(amount.toFixed(digits));
};

const ensureRedis = async () => {
  if (isRedisReady()) return getRedisClient();
  return initRedis();
};

const readCache = async () => {
  try {
    const client = await ensureRedis();
    if (!client) return null;
    const raw = await client.get(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const writeCache = async (payload) => {
  try {
    const client = await ensureRedis();
    if (!client) return;
    await client.set(CACHE_KEY, JSON.stringify(payload), { EX: CACHE_TTL_SECONDS });
  } catch {
    // Ignore cache write failures.
  }
};

const withDateRange = (days) => {
  const now = new Date();
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - days);
  return { now, start };
};

const buildDateBuckets = (days = 14) => {
  const list = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(now);
    date.setUTCDate(now.getUTCDate() - i);
    const key = date.toISOString().slice(0, 10);
    list.push({
      key,
      label: date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
    });
  }
  return list;
};

export const computeFounderNotificationsAnalytics = async () => {
  const { now, start } = withDateRange(30);
  const start7 = new Date(now);
  start7.setUTCDate(start7.getUTCDate() - 7);
  const start14 = new Date(now);
  start14.setUTCDate(start14.getUTCDate() - 14);
  const start24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [
    totals30,
    totals7,
    totals1,
    pushDeliveryAgg,
    clickAgg,
    unreadBacklogTrendRaw,
    avgReadMsAgg,
    ignoredAgg,
    templateAgg,
    queueLatencyAgg,
    invalidTokenAgg,
    pendingTrendRaw,
    approvalLatencyAgg,
    approvalOutcomeAgg,
    delayedTypeAgg,
    workloadHeatmapAgg,
    pendingNowAgg,
    pendingPrev7Agg,
    pendingLast7Agg,
    disputeVolume24h
  ] = await Promise.all([
    Notification.countDocuments({ createdAt: { $gte: start } }),
    Notification.countDocuments({ createdAt: { $gte: start7 } }),
    Notification.countDocuments({ createdAt: { $gte: start24h } }),
    Notification.aggregate([
      { $match: { createdAt: { $gte: start } } },
      {
        $group: {
          _id: null,
          totalPushEligible: {
            $sum: {
              $cond: [
                { $in: ['PUSH', { $ifNull: ['$channels', []] }] },
                1,
                0
              ]
            }
          },
          pushDelivered: {
            $sum: {
              $cond: [{ $eq: ['$delivery.pushDelivered', true] }, 1, 0]
            }
          },
          openedAfterPush: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$delivery.pushDelivered', true] },
                    { $ne: ['$readAt', null] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      }
    ]),
    Notification.aggregate([
      { $match: { createdAt: { $gte: start } } },
      {
        $group: {
          _id: null,
          clicks: { $sum: { $ifNull: ['$metadata.clickCount', 0] } },
          withLink: {
            $sum: {
              $cond: [
                {
                  $or: [
                    { $ne: ['$deepLink', ''] },
                    { $ne: ['$actionLink', ''] },
                    { $ne: ['$metadata.deepLink', null] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      }
    ]),
    Notification.aggregate([
      { $match: { createdAt: { $gte: start14 } } },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          unread: {
            $sum: {
              $cond: [{ $eq: ['$readAt', null] }, 1, 0]
            }
          }
        }
      }
    ]),
    Notification.aggregate([
      {
        $match: {
          createdAt: { $gte: start },
          readAt: { $ne: null }
        }
      },
      {
        $project: {
          delayMs: { $subtract: ['$readAt', '$createdAt'] }
        }
      },
      { $group: { _id: null, avgDelayMs: { $avg: '$delayMs' } } }
    ]),
    Notification.aggregate([
      {
        $match: {
          createdAt: { $gte: start },
          readAt: null
        }
      },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 6 }
    ]),
    Notification.aggregate([
      { $match: { createdAt: { $gte: start } } },
      {
        $group: {
          _id: '$type',
          total: { $sum: 1 },
          opened: {
            $sum: {
              $cond: [{ $ne: ['$readAt', null] }, 1, 0]
            }
          }
        }
      },
      { $sort: { total: -1 } },
      { $limit: 8 }
    ]),
    Notification.aggregate([
      {
        $match: {
          createdAt: { $gte: start },
          'delivery.deliveredAt': { $ne: null }
        }
      },
      {
        $project: {
          latencyMs: { $subtract: ['$delivery.deliveredAt', '$createdAt'] }
        }
      },
      { $group: { _id: null, avgLatencyMs: { $avg: '$latencyMs' } } }
    ]),
    PushToken.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          invalid: {
            $sum: {
              $cond: [{ $eq: ['$lastFailureCode', 'invalid_registration_token'] }, 1, 0]
            }
          }
        }
      }
    ]),
    Notification.aggregate([
      {
        $match: {
          actionRequired: true,
          createdAt: { $gte: start14 }
        }
      },
      {
        $group: {
          _id: {
            day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }
          },
          created: { $sum: 1 },
          done: {
            $sum: {
              $cond: [{ $eq: ['$actionStatus', 'DONE'] }, 1, 0]
            }
          }
        }
      },
      { $sort: { '_id.day': 1 } }
    ]),
    Notification.aggregate([
      {
        $match: {
          actionRequired: true,
          actionStatus: 'DONE',
          createdAt: { $gte: start }
        }
      },
      {
        $project: {
          resolveMs: { $subtract: ['$updatedAt', '$createdAt'] }
        }
      },
      { $group: { _id: null, avgResolveMs: { $avg: '$resolveMs' } } }
    ]),
    Notification.aggregate([
      {
        $match: {
          actionRequired: true,
          actionStatus: 'DONE',
          createdAt: { $gte: start }
        }
      },
      {
        $group: {
          _id: '$metadata.validationOutcome',
          count: { $sum: 1 }
        }
      }
    ]),
    Notification.aggregate([
      {
        $match: {
          actionRequired: true,
          actionStatus: 'DONE',
          createdAt: { $gte: start }
        }
      },
      {
        $project: {
          validationType: '$validationType',
          resolveMs: { $subtract: ['$updatedAt', '$createdAt'] }
        }
      },
      {
        $group: {
          _id: '$validationType',
          avgResolveMs: { $avg: '$resolveMs' }
        }
      },
      { $sort: { avgResolveMs: -1 } },
      { $limit: 1 }
    ]),
    Notification.aggregate([
      {
        $match: {
          actionRequired: true,
          actionStatus: 'PENDING',
          createdAt: { $gte: start14 }
        }
      },
      {
        $group: {
          _id: {
            dayOfWeek: { $dayOfWeek: '$createdAt' },
            hour: { $hour: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 30 }
    ]),
    Notification.countDocuments({ actionRequired: true, actionStatus: 'PENDING' }),
    Notification.countDocuments({
      actionRequired: true,
      actionStatus: 'PENDING',
      createdAt: { $gte: start14, $lt: start7 }
    }),
    Notification.countDocuments({
      actionRequired: true,
      actionStatus: 'PENDING',
      createdAt: { $gte: start7 }
    }),
    Notification.countDocuments({
      type: { $in: ['dispute_created', 'dispute_under_review'] },
      createdAt: { $gte: start24h }
    })
  ]);

  const pushDelivery = pushDeliveryAgg?.[0] || {};
  const clickStats = clickAgg?.[0] || {};
  const invalidTokens = invalidTokenAgg?.[0] || {};
  const outcomes = approvalOutcomeAgg.reduce(
    (acc, row) => {
      const key = String(row?._id || '').toLowerCase();
      if (key === 'approved') acc.approved += asNumber(row?.count || 0);
      else if (key === 'rejected') acc.rejected += asNumber(row?.count || 0);
      return acc;
    },
    { approved: 0, rejected: 0 }
  );

  const unreadBucketMap = new Map(
    unreadBacklogTrendRaw.map((row) => [String(row?._id || ''), asNumber(row?.unread || 0)])
  );
  const pendingTrendMap = new Map(
    pendingTrendRaw.map((row) => [
      String(row?._id?.day || ''),
      {
        created: asNumber(row?.created || 0),
        done: asNumber(row?.done || 0)
      }
    ])
  );

  const buckets = buildDateBuckets(14);
  const unreadBacklogTrend = buckets.map((entry) => ({
    day: entry.label,
    key: entry.key,
    unread: asNumber(unreadBucketMap.get(entry.key) || 0)
  }));
  const pendingValidationsOverTime = buckets.map((entry) => ({
    day: entry.label,
    key: entry.key,
    created: asNumber(pendingTrendMap.get(entry.key)?.created || 0),
    completed: asNumber(pendingTrendMap.get(entry.key)?.done || 0)
  }));

  const alerts = [];
  const backlogIncreasing = asNumber(pendingLast7Agg || 0) > asNumber(pendingPrev7Agg || 0);
  const invalidRate = pct(invalidTokens.invalid || 0, Math.max(1, invalidTokens.total || 1));
  const openRate = pct(pushDelivery.openedAfterPush || 0, Math.max(1, pushDelivery.pushDelivered || 1));
  if (backlogIncreasing) {
    alerts.push({
      level: 'warning',
      code: 'validation_backlog_increasing',
      message: 'Le backlog de validations est en hausse sur les 7 derniers jours.'
    });
  }
  if (invalidRate >= 15) {
    alerts.push({
      level: 'critical',
      code: 'fcm_failure_spike',
      message: `Le taux de tokens invalides FCM est élevé (${invalidRate}%).`
    });
  }
  if (openRate < 25) {
    alerts.push({
      level: 'warning',
      code: 'low_open_rate',
      message: `Le taux d'ouverture push est faible (${openRate}%).`
    });
  }
  if (asNumber(disputeVolume24h || 0) >= 20) {
    alerts.push({
      level: 'warning',
      code: 'high_disputes_volume',
      message: 'Volume élevé de litiges détecté dans les dernières 24h.'
    });
  }

  return {
    generatedAt: now.toISOString(),
    cacheTtlSeconds: CACHE_TTL_SECONDS,
    metrics: {
      totalSent: {
        day: asNumber(totals1 || 0),
        week: asNumber(totals7 || 0),
        month: asNumber(totals30 || 0)
      },
      deliverySuccessRate: pct(pushDelivery.pushDelivered || 0, Math.max(1, pushDelivery.totalPushEligible || 1)),
      openRate,
      clickThroughRate: pct(clickStats.clicks || 0, Math.max(1, clickStats.withLink || 1)),
      unreadBacklogTrend,
      averageTimeToReadMinutes: round((avgReadMsAgg?.[0]?.avgDelayMs || 0) / 60000, 2),
      topIgnoredCategories: ignoredAgg.map((row) => ({
        type: String(row?._id || 'unknown'),
        unreadCount: asNumber(row?.count || 0)
      })),
      bestPerformingTemplates: templateAgg.map((row) => ({
        type: String(row?._id || 'unknown'),
        total: asNumber(row?.total || 0),
        openRate: pct(row?.opened || 0, Math.max(1, row?.total || 1))
      })),
      invalidTokenRate: invalidRate,
      queueLatencySeconds: round((queueLatencyAgg?.[0]?.avgLatencyMs || 0) / 1000, 2)
    },
    ops: {
      pendingValidationsNow: asNumber(pendingNowAgg || 0),
      pendingValidationsOverTime,
      averageTimeToApproveMinutes: round((approvalLatencyAgg?.[0]?.avgResolveMs || 0) / 60000, 2),
      approvalsVsRejectsRatio: {
        approved: outcomes.approved,
        rejected: outcomes.rejected,
        ratio: round(outcomes.approved / Math.max(1, outcomes.rejected), 2)
      },
      mostDelayedValidationType: delayedTypeAgg?.[0]
        ? {
            type: String(delayedTypeAgg[0]._id || 'other'),
            averageResolveMinutes: round((delayedTypeAgg[0].avgResolveMs || 0) / 60000, 2)
          }
        : null,
      adminWorkloadHeatmap: workloadHeatmapAgg.map((entry) => ({
        dayOfWeek: asNumber(entry?._id?.dayOfWeek || 0),
        hour: asNumber(entry?._id?.hour || 0),
        count: asNumber(entry?.count || 0)
      }))
    },
    alerts
  };
};

export const getFounderNotificationsAnalytics = async ({ forceRefresh = false } = {}) => {
  if (!forceRefresh) {
    const cached = await readCache();
    if (cached) {
      return {
        ...cached,
        cache: {
          hit: true,
          ttlSeconds: CACHE_TTL_SECONDS
        }
      };
    }
  }

  const payload = await computeFounderNotificationsAnalytics();
  await writeCache(payload);
  return {
    ...payload,
    cache: {
      hit: false,
      ttlSeconds: CACHE_TTL_SECONDS
    }
  };
};

