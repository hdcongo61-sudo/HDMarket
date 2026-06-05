/**
 * Seller Reputation Service — Gamification & Reputation System
 * Proposal 3 of HDMarket Taobao-Inspired Improvements
 *
 * Seller Levels:
 *   🌱 débutant  — < 10 completed orders
 *   🌿 confirmé  — 10-50 orders + avg rating ≥ 4.0
 *   🌳 avancé    — 50-200 orders + avg rating ≥ 4.3
 *   🥇 or        — 200+ orders + avg rating ≥ 4.5 + verified
 *   💎 diamant   — 500+ orders + avg rating ≥ 4.7 + < 2% dispute rate
 */

import mongoose from 'mongoose';
import User from '../models/userModel.js';
import ShopReview from '../models/shopReviewModel.js';
import Order from '../models/orderModel.js';

// ─── LEVEL DEFINITIONS ────────────────────────────────────

const LEVEL_CONFIG = [
  {
    key: 'diamant',
    label: 'Diamant',
    emoji: '💎',
    color: '#3B82F6',
    bgClass: 'bg-blue-100',
    textClass: 'text-blue-700',
    minOrders: 500,
    minRating: 4.7,
    maxDisputeRate: 2,
    requireVerified: true,
    commissionDiscount: 100, // 0% commission
    searchBoost: 5
  },
  {
    key: 'or',
    label: 'Or',
    emoji: '🥇',
    color: '#F59E0B',
    bgClass: 'bg-amber-100',
    textClass: 'text-amber-700',
    minOrders: 200,
    minRating: 4.5,
    maxDisputeRate: null,
    requireVerified: true,
    commissionDiscount: 50,
    searchBoost: 3
  },
  {
    key: 'avance',
    label: 'Avancé',
    emoji: '🌳',
    color: '#6B7280',
    bgClass: 'bg-gray-100',
    textClass: 'text-gray-700',
    minOrders: 50,
    minRating: 4.3,
    maxDisputeRate: null,
    requireVerified: false,
    commissionDiscount: 25,
    searchBoost: 2
  },
  {
    key: 'confirme',
    label: 'Confirmé',
    emoji: '🌿',
    color: '#22C55E',
    bgClass: 'bg-green-100',
    textClass: 'text-green-700',
    minOrders: 10,
    minRating: 4.0,
    maxDisputeRate: null,
    requireVerified: false,
    commissionDiscount: 0,
    searchBoost: 1
  },
  {
    key: 'debutant',
    label: 'Débutant',
    emoji: '🌱',
    color: '#9CA3AF',
    bgClass: 'bg-gray-50',
    textClass: 'text-gray-500',
    minOrders: 0,
    minRating: 0,
    maxDisputeRate: null,
    requireVerified: false,
    commissionDiscount: 0,
    searchBoost: 0
  }
];

// ─── HELPERS ─────────────────────────────────────────────

const getLevelConfig = (key) => LEVEL_CONFIG.find((l) => l.key === key) || LEVEL_CONFIG[LEVEL_CONFIG.length - 1];

const computeLevel = (stats) => {
  const { totalCompletedOrders = 0, avgRating = 0, shopVerified = false, disputeRate = 0 } = stats;

  for (const config of LEVEL_CONFIG) {
    if (totalCompletedOrders < config.minOrders) continue;
    if (config.minRating > 0 && avgRating < config.minRating) continue;
    if (config.requireVerified && !shopVerified) continue;
    if (config.maxDisputeRate !== null && disputeRate > config.maxDisputeRate) continue;
    return config.key;
  }

  return 'debutant';
};

// ─── STATS COMPUTATION ───────────────────────────────────

export const computeSellerStats = async (sellerId) => {
  const sellerObjId = new mongoose.Types.ObjectId(sellerId);

  // Completed orders count
  const completedStatuses = [
    'delivery_proof_submitted', 'delivered', 'picked_up_confirmed',
    'confirmed_by_client', 'completed'
  ];
  const totalCompletedOrders = await Order.countDocuments({
    seller: sellerObjId,
    status: { $in: completedStatuses }
  });

  // Shop reviews aggregation
  const reviewAgg = await ShopReview.aggregate([
    { $match: { shop: sellerObjId } },
    {
      $group: {
        _id: null,
        totalReviews: { $sum: 1 },
        avgRating: { $avg: '$rating' },
        avgDescriptionRating: {
          $avg: { $cond: [{ $gt: ['$descriptionRating', null] }, '$descriptionRating', null] }
        },
        avgCommunicationRating: {
          $avg: { $cond: [{ $gt: ['$communicationRating', null] }, '$communicationRating', null] }
        },
        avgDeliveryRating: {
          $avg: { $cond: [{ $gt: ['$deliveryRating', null] }, '$deliveryRating', null] }
        }
      }
    }
  ]);

  const reviewStats = reviewAgg[0] || {
    totalReviews: 0,
    avgRating: 0,
    avgDescriptionRating: 0,
    avgCommunicationRating: 0,
    avgDeliveryRating: 0
  };

  // Dispute rate
  const totalOrders = await Order.countDocuments({ seller: sellerObjId }) || 1;
  const disputedOrders = await Order.countDocuments({
    seller: sellerObjId,
    dispute: { $exists: true, $ne: null }
  });
  const disputeRate = Math.round((disputedOrders / totalOrders) * 100);

  return {
    totalCompletedOrders,
    totalReviews: reviewStats.totalReviews,
    avgRating: Math.round((reviewStats.avgRating || 0) * 10) / 10,
    avgDescriptionRating: Math.round(((reviewStats.avgDescriptionRating || 0)) * 10) / 10,
    avgCommunicationRating: Math.round(((reviewStats.avgCommunicationRating || 0)) * 10) / 10,
    avgDeliveryRating: Math.round(((reviewStats.avgDeliveryRating || 0)) * 10) / 10,
    disputeRate
  };
};

// ─── LEVEL UPDATE ─────────────────────────────────────────

export const recalculateSellerLevel = async (sellerId) => {
  const seller = await User.findById(sellerId).select(
    'shopVerified sellerLevel totalCompletedOrders avgRating disputeRate'
  );
  if (!seller || seller.accountType !== 'shop') return null;

  const stats = await computeSellerStats(sellerId);
  const level = computeLevel({
    ...stats,
    shopVerified: seller.shopVerified
  });

  await User.updateOne(
    { _id: sellerId },
    {
      $set: {
        sellerLevel: level,
        sellerLevelUpdatedAt: new Date(),
        totalCompletedOrders: stats.totalCompletedOrders,
        avgRating: stats.avgRating,
        avgDescriptionRating: stats.avgDescriptionRating,
        avgCommunicationRating: stats.avgCommunicationRating,
        avgDeliveryRating: stats.avgDeliveryRating,
        disputeRate: stats.disputeRate,
        totalReviews: stats.totalReviews
      }
    }
  );

  const config = getLevelConfig(level);
  return { level, config, stats };
};

// ─── SWEEP ───────────────────────────────────────────────

export const sweepSellerLevels = async ({ limit = 100 } = {}) => {
  const sellers = await User.find({
    accountType: 'shop',
    isActive: { $ne: false }
  })
    .select('_id')
    .limit(limit)
    .lean();

  let updated = 0;
  for (const seller of sellers) {
    try {
      const result = await recalculateSellerLevel(seller._id);
      if (result) updated += 1;
    } catch (err) {
      console.error('[seller-reputation] Error recalculating level for', seller._id, err.message);
    }
  }

  return { updated, checked: sellers.length };
};

// ─── PUBLIC ──────────────────────────────────────────────

export const getSellerReputation = async (sellerId) => {
  const seller = await User.findById(sellerId).select(
    'shopVerified sellerLevel sellerLevelUpdatedAt totalCompletedOrders avgRating avgDescriptionRating avgCommunicationRating avgDeliveryRating disputeRate totalReviews shopName shopLogo followersCount'
  ).lean();

  if (!seller) return null;

  const config = getLevelConfig(seller.sellerLevel || 'debutant');

  return {
    level: seller.sellerLevel || 'debutant',
    levelLabel: config.label,
    levelEmoji: config.emoji,
    levelColor: config.color,
    bgClass: config.bgClass,
    textClass: config.textClass,
    shopVerified: !!seller.shopVerified,
    totalCompletedOrders: seller.totalCompletedOrders || 0,
    totalReviews: seller.totalReviews || 0,
    followersCount: seller.followersCount || 0,
    avgRating: seller.avgRating || 0,
    avgDescriptionRating: seller.avgDescriptionRating || 0,
    avgCommunicationRating: seller.avgCommunicationRating || 0,
    avgDeliveryRating: seller.avgDeliveryRating || 0,
    disputeRate: seller.disputeRate || 0,
    lastUpdated: seller.sellerLevelUpdatedAt
  };
};

export { LEVEL_CONFIG, getLevelConfig, computeLevel };
