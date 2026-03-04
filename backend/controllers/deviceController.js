import asyncHandler from 'express-async-handler';
import DeviceToken from '../models/deviceTokenModel.js';

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
