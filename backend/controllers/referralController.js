import asyncHandler from 'express-async-handler';
import User from '../models/userModel.js';
import { getRuntimeConfig } from '../services/configService.js';

export const getMyReferralSummary = asyncHandler(async (req, res) => {
  const userId = req.user.id || req.user._id;
  const [user, enabled, rewardXaf, referredUsers] = await Promise.all([
    User.findById(userId).select('referralCode').lean(),
    getRuntimeConfig('enable_referral_program', { fallback: false }),
    getRuntimeConfig('referral_reward_xaf', { fallback: 500 }),
    User.find({ referredBy: userId }).select('name createdAt referralRewardGranted').sort({ createdAt: -1 }).lean()
  ]);

  return res.json({
    enabled: Boolean(enabled),
    referralCode: user?.referralCode || '',
    rewardXaf: Number(rewardXaf || 0),
    referredCount: referredUsers.length,
    rewardedCount: referredUsers.filter((u) => u.referralRewardGranted).length,
    referredUsers: referredUsers.map((u) => ({
      name: u.name,
      joinedAt: u.createdAt,
      rewardGranted: Boolean(u.referralRewardGranted)
    }))
  });
});
