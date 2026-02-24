import mongoose from 'mongoose';
import Order from '../models/orderModel.js';
import User from '../models/userModel.js';
import UserSession from '../models/userSessionModel.js';
import OrderMessage from '../models/orderMessageModel.js';
import Rating from '../models/ratingModel.js';
import Notification from '../models/notificationModel.js';
import PlatformDailyAnalytics from '../models/platformDailyAnalyticsModel.js';
import { getRedisClient, initRedis, isRedisReady } from '../config/redisClient.js';

const ENV = String(process.env.CACHE_ENV || process.env.NODE_ENV || 'dev')
  .toLowerCase()
  .startsWith('prod')
  ? 'prod'
  : 'dev';

const FOUNDER_CACHE_KEY = `${ENV}:founder:intelligence`;
const FOUNDER_CACHE_TTL_SECONDS = Math.max(
  30,
  Number(process.env.FOUNDER_INTELLIGENCE_CACHE_SECONDS || 60)
);
const HIGH_VALUE_THRESHOLD = Math.max(10000, Number(process.env.HIGH_VALUE_USER_THRESHOLD || 100000));

const ACTIVE_ORDER_STATUSES = [
  'paid',
  'ready_for_pickup',
  'picked_up_confirmed',
  'ready_for_delivery',
  'out_for_delivery',
  'delivery_proof_submitted',
  'confirmed_by_client',
  'confirmed',
  'delivering',
  'delivered',
  'completed',
  'installment_active'
];
const RISKY_ORDER_STATUSES = ['overdue_installment', 'dispute_opened', 'cancelled'];

const asNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const pct = (value, total) => {
  if (!total) return 0;
  return Number((((asNumber(value) / asNumber(total)) * 100) || 0).toFixed(2));
};

const safeDiv = (a, b) => (b ? asNumber(a) / asNumber(b) : 0);

const toObjectIdList = (list = []) =>
  list
    .map((value) => {
      try {
        return new mongoose.Types.ObjectId(String(value));
      } catch {
        return null;
      }
    })
    .filter(Boolean);

const normalizeId = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (value instanceof mongoose.Types.ObjectId) return value.toString();
  if (typeof value === 'object' && value._id) return String(value._id);
  return String(value);
};

const startOfDayUtc = (date) => {
  const d = new Date(date);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};

const ensureRedis = async () => {
  if (isRedisReady()) return getRedisClient();
  return initRedis();
};

const readCache = async () => {
  try {
    const client = await ensureRedis();
    if (!client) return null;
    const raw = await client.get(FOUNDER_CACHE_KEY);
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
    await client.set(FOUNDER_CACHE_KEY, JSON.stringify(payload), {
      EX: FOUNDER_CACHE_TTL_SECONDS
    });
  } catch {
    // Cache failures should not fail request.
  }
};

const buildEngagementScore = ({ orders = 0, sessions = 0, hoursSpent = 0, messages = 0, reviews = 0 } = {}) => {
  const rawScore =
    asNumber(orders) * 12 +
    asNumber(sessions) * 4 +
    asNumber(hoursSpent) * 2 +
    asNumber(messages) * 1.5 +
    asNumber(reviews) * 6;
  return Math.max(0, Math.min(100, Number(rawScore.toFixed(2))));
};

const setIntersectionSize = (a = new Set(), b = new Set()) => {
  let count = 0;
  a.forEach((value) => {
    if (b.has(value)) count += 1;
  });
  return count;
};

export const computeFounderIntelligence = async () => {
  const now = new Date();
  const startToday = startOfDayUtc(now);
  const startYesterday = new Date(startToday);
  startYesterday.setUTCDate(startYesterday.getUTCDate() - 1);
  const start7 = new Date(now);
  start7.setUTCDate(start7.getUTCDate() - 7);
  const start14 = new Date(now);
  start14.setUTCDate(start14.getUTCDate() - 14);
  const start30 = new Date(now);
  start30.setUTCDate(start30.getUTCDate() - 30);
  const start60 = new Date(now);
  start60.setUTCDate(start60.getUTCDate() - 60);
  const startWeek = new Date(startToday);
  startWeek.setUTCDate(startWeek.getUTCDate() - 7);
  const startPrevWeek = new Date(startWeek);
  startPrevWeek.setUTCDate(startPrevWeek.getUTCDate() - 7);

  const [
    revenueAgg30,
    ordersAgg30,
    active30Ids,
    active7Ids,
    activePrev7Ids,
    activePrev30Ids,
    conversionOrderByCity,
    usersByCity,
    sellerBaseRanking,
    userRevenueRanking,
    timeToFirstPurchaseAgg,
    newUsersToday,
    newUsersYesterday,
    newUsersWeek,
    newUsersPrevWeek,
    messageCountsByUser,
    ratingCountsByUser,
    sessionStatsByUser,
    trafficHourAgg,
    trafficDayAgg,
    deviceRatioAgg,
    pushOpenAgg,
    shortSessionAgg,
    dailyAnalyticsDocs
  ] = await Promise.all([
    Order.aggregate([
      {
        $match: {
          createdAt: { $gte: start30 },
          status: { $in: ACTIVE_ORDER_STATUSES }
        }
      },
      {
        $group: {
          _id: null,
          revenue: {
            $sum: {
              $cond: [
                { $gt: [{ $ifNull: ['$paidAmount', 0] }, 0] },
                '$paidAmount',
                { $ifNull: ['$totalAmount', 0] }
              ]
            }
          }
        }
      }
    ]),
    Order.aggregate([
      {
        $match: {
          createdAt: { $gte: start30 },
          status: { $ne: 'cancelled' }
        }
      },
      { $group: { _id: null, count: { $sum: 1 } } }
    ]),
    UserSession.distinct('userId', { connectedAt: { $gte: start30 } }),
    UserSession.distinct('userId', { connectedAt: { $gte: start7 } }),
    UserSession.distinct('userId', { connectedAt: { $gte: start14, $lt: start7 } }),
    UserSession.distinct('userId', { connectedAt: { $gte: start60, $lt: start30 } }),
    Order.aggregate([
      {
        $match: {
          createdAt: { $gte: start30 },
          status: { $ne: 'cancelled' },
          deliveryCity: { $exists: true, $ne: '' }
        }
      },
      { $group: { _id: '$deliveryCity', orders: { $sum: 1 } } },
      { $sort: { orders: -1 } }
    ]),
    User.aggregate([
      { $match: { city: { $exists: true, $ne: '' } } },
      { $group: { _id: '$city', users: { $sum: 1 } } }
    ]),
    Order.aggregate([
      { $match: { createdAt: { $gte: start30 } } },
      { $unwind: '$items' },
      {
        $match: {
          'items.snapshot.shopId': { $ne: null }
        }
      },
      {
        $group: {
          _id: '$items.snapshot.shopId',
          orderIds: { $addToSet: '$_id' },
          revenue: {
            $sum: {
              $ifNull: [
                '$items.lineTotal',
                {
                  $multiply: [
                    { $ifNull: ['$items.snapshot.price', 0] },
                    { $ifNull: ['$items.quantity', 1] }
                  ]
                }
              ]
            }
          },
          riskyOrders: {
            $sum: {
              $cond: [{ $in: ['$status', RISKY_ORDER_STATUSES] }, 1, 0]
            }
          },
          cancelledOrders: {
            $sum: {
              $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0]
            }
          }
        }
      },
      {
        $project: {
          revenue: 1,
          orders: { $size: '$orderIds' },
          riskyOrders: 1,
          cancelledOrders: 1
        }
      },
      { $sort: { revenue: -1 } },
      { $limit: 15 }
    ]),
    Order.aggregate([
      {
        $match: {
          status: { $in: ACTIVE_ORDER_STATUSES }
        }
      },
      {
        $group: {
          _id: '$customer',
          revenue: {
            $sum: {
              $cond: [
                { $gt: [{ $ifNull: ['$paidAmount', 0] }, 0] },
                '$paidAmount',
                { $ifNull: ['$totalAmount', 0] }
              ]
            }
          },
          orders: { $sum: 1 },
          lastOrderAt: { $max: '$createdAt' }
        }
      },
      { $sort: { revenue: -1 } },
      { $limit: 120 }
    ]),
    Order.aggregate([
      { $match: { status: { $in: ACTIVE_ORDER_STATUSES } } },
      { $group: { _id: '$customer', firstOrderAt: { $min: '$createdAt' } } },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      {
        $project: {
          diffHours: {
            $divide: [{ $subtract: ['$firstOrderAt', '$user.createdAt'] }, 1000 * 60 * 60]
          }
        }
      },
      { $match: { diffHours: { $gte: 0 } } },
      { $group: { _id: null, avgHours: { $avg: '$diffHours' } } }
    ]),
    User.countDocuments({ createdAt: { $gte: startToday } }),
    User.countDocuments({ createdAt: { $gte: startYesterday, $lt: startToday } }),
    User.countDocuments({ createdAt: { $gte: startWeek } }),
    User.countDocuments({ createdAt: { $gte: startPrevWeek, $lt: startWeek } }),
    OrderMessage.aggregate([
      { $match: { createdAt: { $gte: start30 } } },
      { $group: { _id: '$sender', count: { $sum: 1 } } }
    ]),
    Rating.aggregate([
      { $match: { createdAt: { $gte: start30 } } },
      { $group: { _id: '$user', count: { $sum: 1 } } }
    ]),
    UserSession.aggregate([
      { $match: { connectedAt: { $gte: start30 } } },
      {
        $group: {
          _id: '$userId',
          sessions: { $sum: 1 },
          durationSeconds: { $sum: '$durationSeconds' }
        }
      }
    ]),
    UserSession.aggregate([
      { $match: { connectedAt: { $gte: start30 } } },
      { $group: { _id: { $hour: '$connectedAt' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]),
    UserSession.aggregate([
      { $match: { connectedAt: { $gte: start30 } } },
      { $group: { _id: { $dayOfWeek: '$connectedAt' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]),
    UserSession.aggregate([
      { $match: { connectedAt: { $gte: start30 } } },
      { $group: { _id: '$device', count: { $sum: 1 } } }
    ]),
    Notification.aggregate([
      {
        $match: {
          createdAt: { $gte: start30 },
          'delivery.pushDelivered': true
        }
      },
      {
        $group: {
          _id: null,
          delivered: { $sum: 1 },
          opened: {
            $sum: {
              $cond: [{ $ne: ['$readAt', null] }, 1, 0]
            }
          }
        }
      }
    ]),
    UserSession.aggregate([
      { $match: { connectedAt: { $gte: start30 } } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          short: {
            $sum: {
              $cond: [{ $lt: ['$durationSeconds', 60] }, 1, 0]
            }
          }
        }
      }
    ]),
    PlatformDailyAnalytics.find({ date: { $gte: start30 } })
      .sort({ date: -1 })
      .limit(30)
      .lean()
  ]);

  const revenue30 = asNumber(revenueAgg30?.[0]?.revenue || 0);
  const orders30 = asNumber(ordersAgg30?.[0]?.count || 0);
  const activeUsers30 = active30Ids.length;
  const avgOrderValue = safeDiv(revenue30, orders30);
  const revenuePerActiveUser = safeDiv(revenue30, activeUsers30);

  const active7Set = new Set(active7Ids.map(normalizeId));
  const activePrev7Set = new Set(activePrev7Ids.map(normalizeId));
  const active30Set = new Set(active30Ids.map(normalizeId));
  const activePrev30Set = new Set(activePrev30Ids.map(normalizeId));

  const retained7 = setIntersectionSize(activePrev7Set, active7Set);
  const retained30 = setIntersectionSize(activePrev30Set, active30Set);
  const retention7Day = pct(retained7, activePrev7Set.size);
  const retention30Day = pct(retained30, activePrev30Set.size);

  const cityUsersMap = new Map(
    usersByCity.map((entry) => [String(entry?._id || ''), asNumber(entry?.users || 0)])
  );
  const conversionByCity = conversionOrderByCity.slice(0, 10).map((entry) => {
    const city = String(entry?._id || 'Inconnue');
    const orders = asNumber(entry?.orders || 0);
    const cityUsers = cityUsersMap.get(city) || 0;
    return {
      city,
      orders,
      users: cityUsers,
      conversionRate: pct(orders, cityUsers)
    };
  });

  const sellerIds = sellerBaseRanking.map((entry) => normalizeId(entry?._id)).filter(Boolean);
  const sellerUsers = sellerIds.length
    ? await User.find({ _id: { $in: toObjectIdList(sellerIds) } })
        .select('_id name shopName city createdAt')
        .lean()
    : [];
  const sellerMap = new Map(
    sellerUsers.map((seller) => [
      normalizeId(seller?._id),
      {
        id: normalizeId(seller?._id),
        name: seller?.shopName || seller?.name || 'Boutique',
        city: seller?.city || '',
        yearsActive: seller?.createdAt
          ? Number(((Date.now() - new Date(seller.createdAt).getTime()) / (1000 * 60 * 60 * 24 * 365)).toFixed(1))
          : 0
      }
    ])
  );

  const messageMap = new Map(messageCountsByUser.map((entry) => [normalizeId(entry?._id), asNumber(entry?.count)]));

  const sellerRanking = sellerBaseRanking.map((entry) => {
    const sellerId = normalizeId(entry?._id);
    const orders = asNumber(entry?.orders || 0);
    const riskyOrders = asNumber(entry?.riskyOrders || 0);
    const cancelledOrders = asNumber(entry?.cancelledOrders || 0);
    const delayRate = pct(riskyOrders, orders);
    const cancellationRate = pct(cancelledOrders, orders);
    const riskScore = Number((delayRate * 0.6 + cancellationRate * 0.4).toFixed(2));
    return {
      sellerId,
      sellerName: sellerMap.get(sellerId)?.name || 'Boutique',
      city: sellerMap.get(sellerId)?.city || '',
      yearsActive: sellerMap.get(sellerId)?.yearsActive || 0,
      revenue: asNumber(entry?.revenue || 0),
      orders,
      delayRate,
      cancellationRate,
      riskScore,
      engagementLevel: messageMap.get(sellerId) || 0
    };
  });

  const top10Sellers = sellerRanking
    .slice()
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  const highValueUsers = userRevenueRanking.filter((entry) => asNumber(entry?.revenue) >= HIGH_VALUE_THRESHOLD);
  const highValueUserIdSet = new Set(highValueUsers.map((entry) => normalizeId(entry?._id)));

  const highValueInactive = Array.from(highValueUserIdSet).filter((userId) => !active30Set.has(userId));
  const churnDetectionRate = pct(highValueInactive.length, highValueUserIdSet.size || 1);

  const active30ObjectIds = toObjectIdList(Array.from(active30Set));
  const newActiveUsersCount = active30ObjectIds.length
    ? await User.countDocuments({
        _id: { $in: active30ObjectIds },
        createdAt: { $gte: start30 }
      })
    : 0;
  const returningUsersCount = Math.max(0, active30Set.size - newActiveUsersCount);

  const userIdsForTop = userRevenueRanking.slice(0, 30).map((entry) => normalizeId(entry?._id));
  const userDocs = userIdsForTop.length
    ? await User.find({ _id: { $in: toObjectIdList(userIdsForTop) } })
        .select('_id name email phone city createdAt')
        .lean()
    : [];
  const userMap = new Map(
    userDocs.map((u) => [
      normalizeId(u?._id),
      {
        id: normalizeId(u?._id),
        name: u?.name || 'Utilisateur',
        email: u?.email || '',
        phone: u?.phone || '',
        city: u?.city || '',
        createdAt: u?.createdAt || null
      }
    ])
  );

  const ratingMap = new Map(ratingCountsByUser.map((entry) => [normalizeId(entry?._id), asNumber(entry?.count)]));
  const sessionMap = new Map(
    sessionStatsByUser.map((entry) => [
      normalizeId(entry?._id),
      {
        sessions: asNumber(entry?.sessions || 0),
        durationSeconds: asNumber(entry?.durationSeconds || 0)
      }
    ])
  );

  const topUsers = userRevenueRanking.slice(0, 20).map((entry) => {
    const userId = normalizeId(entry?._id);
    const sessions = sessionMap.get(userId)?.sessions || 0;
    const durationHours = Number(((sessionMap.get(userId)?.durationSeconds || 0) / 3600).toFixed(2));
    const orders = asNumber(entry?.orders || 0);
    const messages = messageMap.get(userId) || 0;
    const reviews = ratingMap.get(userId) || 0;
    const engagementScore = buildEngagementScore({
      orders,
      sessions,
      hoursSpent: durationHours,
      messages,
      reviews
    });
    return {
      userId,
      name: userMap.get(userId)?.name || 'Utilisateur',
      city: userMap.get(userId)?.city || '',
      revenue: asNumber(entry?.revenue || 0),
      orders,
      lastOrderAt: entry?.lastOrderAt || null,
      sessions,
      durationHours,
      messages,
      reviews,
      engagementScore
    };
  });

  const powerBuyers = topUsers.filter((user) => user.orders >= 5 || user.revenue >= HIGH_VALUE_THRESHOLD).slice(0, 10);
  const inactiveHighValueUsers = topUsers.filter((user) => highValueInactive.includes(user.userId)).slice(0, 10);
  const dropOffUsers = Array.from(activePrev30Set)
    .filter((id) => !active30Set.has(id))
    .slice(0, 25);
  const potentialChurnUsers = Array.from(activePrev30Set)
    .filter((id) => !active30Set.has(id))
    .slice(0, 25);
  const highEngagementUsers = topUsers
    .slice()
    .sort((a, b) => b.engagementScore - a.engagementScore)
    .slice(0, 10);

  const bestHour = trafficHourAgg?.[0];
  const bestDay = trafficDayAgg?.[0];
  const deviceStats = deviceRatioAgg.reduce(
    (acc, entry) => {
      const key = ['mobile', 'tablet', 'desktop'].includes(String(entry?._id)) ? String(entry?._id) : 'unknown';
      acc[key] += asNumber(entry?.count || 0);
      return acc;
    },
    { mobile: 0, tablet: 0, desktop: 0, unknown: 0 }
  );
  const totalDeviceSessions =
    deviceStats.mobile + deviceStats.tablet + deviceStats.desktop + deviceStats.unknown;

  const pushDelivered = asNumber(pushOpenAgg?.[0]?.delivered || 0);
  const pushOpened = asNumber(pushOpenAgg?.[0]?.opened || 0);
  const shortSessions = asNumber(shortSessionAgg?.[0]?.short || 0);
  const totalSessions = asNumber(shortSessionAgg?.[0]?.total || 0);

  const timeToFirstPurchaseHours = asNumber(timeToFirstPurchaseAgg?.[0]?.avgHours || 0);
  const growthVelocityDaily = pct(newUsersToday - newUsersYesterday, Math.max(newUsersYesterday, 1));
  const growthVelocityWeekly = pct(newUsersWeek - newUsersPrevWeek, Math.max(newUsersPrevWeek, 1));

  const responseSummary = {
    generatedAt: now.toISOString(),
    cacheTtlSeconds: FOUNDER_CACHE_TTL_SECONDS,
    kpis: {
      revenuePerActiveUser: Number(revenuePerActiveUser.toFixed(2)),
      conversionRateByCity: conversionByCity,
      retention7Day,
      retention30Day,
      averageOrderValue: Number(avgOrderValue.toFixed(2)),
      churnDetectionRate,
      timeToFirstPurchaseHours: Number(timeToFirstPurchaseHours.toFixed(2)),
      growthVelocity: {
        daily: growthVelocityDaily,
        weekly: growthVelocityWeekly
      },
      newVsReturningRatio: {
        newUsers: newActiveUsersCount,
        returningUsers: returningUsersCount,
        ratio: Number(safeDiv(newActiveUsersCount, Math.max(returningUsersCount, 1)).toFixed(3))
      },
      highValueUsers: highValueUserIdSet.size
    },
    userIntelligence: {
      powerBuyers,
      inactiveHighValueUsers,
      dropOffUsersCount: dropOffUsers.length,
      potentialChurnUsersCount: potentialChurnUsers.length,
      highEngagementUsers
    },
    sellerIntelligence: {
      top10Sellers,
      leaderboard: sellerRanking.slice(0, 10),
      averageSellerRiskScore: Number(
        safeDiv(
          sellerRanking.reduce((sum, entry) => sum + asNumber(entry.riskScore), 0),
          Math.max(sellerRanking.length, 1)
        ).toFixed(2)
      )
    },
    trafficIntelligence: {
      mostActiveHour: bestHour ? Number(bestHour._id) : null,
      mostActiveDay: bestDay ? Number(bestDay._id) : null,
      mobileVsDesktopRatio: {
        mobile: deviceStats.mobile,
        desktop: deviceStats.desktop,
        tablet: deviceStats.tablet,
        unknown: deviceStats.unknown,
        mobilePercent: pct(deviceStats.mobile, totalDeviceSessions),
        desktopPercent: pct(deviceStats.desktop, totalDeviceSessions)
      },
      pushNotificationOpenRate: pct(pushOpened, Math.max(pushDelivered, 1)),
      sessionDropOffRate: pct(shortSessions, Math.max(totalSessions, 1)),
      recentHeatmap: dailyAnalyticsDocs
        .slice()
        .reverse()
        .map((entry) => ({
          day: entry.day,
          hourlyActivity: entry.hourlyActivity || []
        }))
    },
    predictive: {
      growthProjection: {
        dailyNewUsersEstimate: Math.max(0, Math.round((newUsersToday + newUsersYesterday) / 2)),
        weeklyNewUsersEstimate: Math.max(0, Math.round((newUsersWeek + newUsersPrevWeek) / 2))
      },
      revenueForecast30Days: Number((revenue30 * (1 + growthVelocityWeekly / 100)).toFixed(2)),
      sellerChurnRiskCount: sellerRanking.filter((entry) => entry.riskScore >= 40).length,
      engagementDeclineRiskCount: potentialChurnUsers.length
    },
    executiveSummary: {
      revenueLast30Days: Number(revenue30.toFixed(2)),
      activeUsers30Days: activeUsers30,
      ordersLast30Days: orders30,
      keyRisks: [
        `${inactiveHighValueUsers.length} utilisateurs à forte valeur sont inactifs.`,
        `${sellerRanking.filter((entry) => entry.riskScore >= 40).length} vendeurs ont un score de risque élevé.`,
        `${pct(shortSessions, Math.max(totalSessions, 1)).toFixed(2)}% des sessions se terminent en moins d'une minute.`
      ]
    }
  };

  return responseSummary;
};

export const getFounderIntelligence = async ({ forceRefresh = false } = {}) => {
  if (!forceRefresh) {
    const cached = await readCache();
    if (cached) return { ...cached, cache: { hit: true, ttlSeconds: FOUNDER_CACHE_TTL_SECONDS } };
  }
  const data = await computeFounderIntelligence();
  await writeCache(data);
  return { ...data, cache: { hit: false, ttlSeconds: FOUNDER_CACHE_TTL_SECONDS } };
};

