import asyncHandler from 'express-async-handler';
import PlatformDailyAnalytics from '../models/platformDailyAnalyticsModel.js';
import { aggregateDailyPresenceAnalytics, getOnlineStatsSnapshot } from '../services/presenceService.js';

export const getOnlineStatsAdmin = asyncHandler(async (req, res) => {
  const liveStats = await getOnlineStatsSnapshot();

  let daily = await PlatformDailyAnalytics.findOne({ day: liveStats.day }).lean();
  if (!daily) {
    daily = await aggregateDailyPresenceAnalytics({ dayKey: liveStats.day });
  }

  return res.json({
    totalOnline: Number(liveStats.totalOnline || 0),
    usersOnline: Number(liveStats.usersOnline || 0),
    sellersOnline: Number(liveStats.sellersOnline || 0),
    adminsOnline: Number(liveStats.adminsOnline || 0),
    dau: Number(liveStats.dau || daily?.dau || 0),
    weeklyActiveUsers: Number(liveStats.wau || daily?.wau || 0),
    peakToday: Number(liveStats.peakToday || daily?.peakConcurrent || 0),
    averageSessionDurationSeconds: Number(daily?.avgSessionDurationSeconds || 0),
    deviceDistribution: daily?.deviceDistribution || {
      mobile: 0,
      tablet: 0,
      desktop: 0,
      unknown: 0
    },
    topCities: Array.isArray(daily?.topCities) ? daily.topCities : [],
    activityHeatmap: Array.isArray(daily?.hourlyActivity) ? daily.hourlyActivity : [],
    updatedAt: liveStats.updatedAt
  });
});

