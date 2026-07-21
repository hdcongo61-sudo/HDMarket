import asyncHandler from 'express-async-handler';
import { getOrCreateRewardPoints, checkIn } from '../services/rewardPointsService.js';
import { getRuntimeConfig } from '../services/configService.js';

export const getMyRewardPoints = asyncHandler(async (req, res) => {
  const userId = req.user.id || req.user._id;
  const [enabled, conversionXaf, maxPercent, record] = await Promise.all([
    getRuntimeConfig('enable_reward_points', { fallback: false }),
    getRuntimeConfig('reward_points_conversion_xaf', { fallback: 1 }),
    getRuntimeConfig('reward_points_max_order_percent', { fallback: 20 }),
    getOrCreateRewardPoints(userId)
  ]);

  const today = new Date();
  const checkedInToday =
    record.lastCheckinAt &&
    new Date(record.lastCheckinAt).toDateString() === today.toDateString();

  return res.json({
    enabled: Boolean(enabled),
    balance: record.balance,
    lifetimeEarned: record.lifetimeEarned,
    checkinStreak: record.checkinStreak,
    checkedInToday: Boolean(checkedInToday),
    conversionXaf: Number(conversionXaf || 1),
    maxOrderPercent: Number(maxPercent || 20),
    transactions: [...record.transactions]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 50)
  });
});

export const postCheckIn = asyncHandler(async (req, res) => {
  const userId = req.user.id || req.user._id;
  const result = await checkIn(userId);
  if (!result) {
    return res.status(403).json({ message: 'Le programme de points est désactivé.' });
  }
  return res.json(result);
});
