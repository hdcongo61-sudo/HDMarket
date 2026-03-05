import asyncHandler from 'express-async-handler';
import DeviceToken from '../models/deviceTokenModel.js';
import { isPushConfigured } from '../utils/pushService.js';
import { getRuntimeConfig } from '../services/configService.js';

const normalizePlatform = (value) => {
  const platform = String(value || 'unknown').toLowerCase();
  if (['ios', 'android', 'web'].includes(platform)) return platform;
  return 'unknown';
};

export const registerDeviceToken = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const token = String(req.body?.token || '').trim();
  if (!token) {
    return res.status(400).json({ message: 'Token appareil requis.' });
  }

  const platform = normalizePlatform(req.body?.platform);
  const deviceId = String(req.body?.deviceId || req.body?.deviceInfo?.deviceId || '').trim();
  const deviceInfo = req.body?.deviceInfo && typeof req.body.deviceInfo === 'object'
    ? req.body.deviceInfo
    : {};

  const saved = await DeviceToken.findOneAndUpdate(
    { token },
    {
      user: userId,
      token,
      platform,
      deviceId,
      deviceInfo,
      isActive: true,
      lastSeenAt: new Date(),
      disabledReason: '',
      lastFailureAt: null,
      lastFailureCode: ''
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  res.json({
    success: true,
    device: {
      id: saved._id,
      token: saved.token,
      platform: saved.platform
    }
  });
});

export const unregisterDeviceToken = asyncHandler(async (req, res) => {
  const token = String(req.body?.token || '').trim();
  if (!token) {
    return res.status(400).json({ message: 'Token appareil requis.' });
  }

  await DeviceToken.updateOne(
    { user: req.user.id, token },
    { $set: { isActive: false, disabledReason: 'user_unregister', lastSeenAt: new Date() } }
  );

  res.json({ success: true });
});

export const getPushStatus = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const [pushEnabled, pushWhenOnline, pushHighOnly, tokens] = await Promise.all([
    getRuntimeConfig('push_enabled', { fallback: true }),
    getRuntimeConfig('push_when_online', { fallback: false }),
    getRuntimeConfig('push_for_priority_high_only', { fallback: false }),
    DeviceToken.find({ user: userId })
      .select('platform isActive lastSeenAt lastDeliveredAt disabledReason createdAt')
      .sort({ updatedAt: -1 })
      .lean()
  ]);

  const tokensByPlatform = tokens.reduce((acc, item) => {
    const platform = String(item?.platform || 'unknown');
    if (!acc[platform]) {
      acc[platform] = { total: 0, active: 0 };
    }
    acc[platform].total += 1;
    if (item?.isActive !== false) acc[platform].active += 1;
    return acc;
  }, {});

  res.json({
    success: true,
    pushConfigured: isPushConfigured(),
    settings: {
      pushEnabled: Boolean(pushEnabled),
      pushWhenOnline: Boolean(pushWhenOnline),
      pushForPriorityHighOnly: Boolean(pushHighOnly)
    },
    tokenStats: {
      total: tokens.length,
      active: tokens.filter((item) => item?.isActive !== false).length,
      byPlatform: tokensByPlatform
    }
  });
});
