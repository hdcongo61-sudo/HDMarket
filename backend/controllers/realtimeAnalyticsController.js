import asyncHandler from 'express-async-handler';
import crypto from 'crypto';
import PlatformDailyAnalytics from '../models/platformDailyAnalyticsModel.js';
import { getRuntimeConfig } from '../services/configService.js';
import { aggregateDailyPresenceAnalytics, getOnlineStatsSnapshot } from '../services/presenceService.js';
import { getRealtimeMonitoringSnapshot, recordRealtimeMonitoringEvent } from '../services/realtimeMonitoringService.js';

const toBoundedInt = (value, { min = 1, max = 100, fallback = 10 } = {}) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, Math.min(max, Math.round(numeric)));
};

const toBoundedRate = (value, fallback = 1) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  if (numeric <= 0) return 0;
  if (numeric >= 1) return 1;
  return numeric;
};

const getClientIp = (req = {}) => {
  const forwarded = String(req.headers?.['x-forwarded-for'] || '')
    .split(',')[0]
    .trim();
  return forwarded || req.ip || req.socket?.remoteAddress || '0.0.0.0';
};

const buildVisitorFingerprint = (req = {}) => {
  const ip = getClientIp(req);
  const userAgent = String(req.headers?.['user-agent'] || '').slice(0, 200);
  const language = String(req.headers?.['accept-language'] || '').slice(0, 64);
  const raw = `${ip}|${userAgent}|${language}`;
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 32);
};

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

export const trackRealtimeMonitoringEvent = asyncHandler(async (req, res) => {
  const monitoringEnabled = await getRuntimeConfig('realtime_monitoring_enabled', {
    fallback: true
  });
  if (!Boolean(monitoringEnabled)) {
    return res.status(202).json({ tracked: false, reason: 'disabled' });
  }

  const sampleRate = toBoundedRate(
    await getRuntimeConfig('realtime_monitoring_sample_rate', {
      fallback: 1
    }),
    1
  );
  if (sampleRate < 1 && Math.random() > sampleRate) {
    return res.status(202).json({ tracked: false, sampledOut: true });
  }

  const payload = req.body || {};
  const eventType = String(payload.eventType || '').trim();
  if (!eventType) {
    return res.status(400).json({ message: 'eventType requis.' });
  }

  const eventPath =
    String(payload.path || '').trim() ||
    (() => {
      const referer = String(req.headers?.referer || '').trim();
      if (!referer) return '';
      try {
        const parsed = new URL(referer);
        return parsed.pathname || '';
      } catch {
        return '';
      }
    })();

  await recordRealtimeMonitoringEvent({
    eventType,
    path: eventPath,
    entityType: payload.entityType,
    entityId: payload.entityId,
    role: payload.role,
    accountType: payload.accountType,
    visitorId: buildVisitorFingerprint(req)
  });

  return res.status(202).json({ tracked: true });
});

export const getRealtimeMonitoringAdmin = asyncHandler(async (req, res) => {
  const windowMinutes = toBoundedInt(req.query?.windowMinutes, {
    min: 5,
    max: 180,
    fallback: 60
  });
  const topLimit = toBoundedInt(req.query?.topLimit, {
    min: 3,
    max: 20,
    fallback: 8
  });
  const recentLimit = toBoundedInt(req.query?.recentLimit, {
    min: 5,
    max: 40,
    fallback: 16
  });

  const snapshot = await getRealtimeMonitoringSnapshot({
    windowMinutes,
    topLimit,
    recentLimit
  });

  return res.json(snapshot);
});

export const getRealtimeMonitoringFounder = asyncHandler(async (req, res) => {
  const windowMinutes = toBoundedInt(req.query?.windowMinutes, {
    min: 5,
    max: 180,
    fallback: 60
  });
  const topLimit = toBoundedInt(req.query?.topLimit, {
    min: 3,
    max: 20,
    fallback: 8
  });
  const recentLimit = toBoundedInt(req.query?.recentLimit, {
    min: 5,
    max: 40,
    fallback: 16
  });

  const snapshot = await getRealtimeMonitoringSnapshot({
    windowMinutes,
    topLimit,
    recentLimit
  });

  return res.json(snapshot);
});
