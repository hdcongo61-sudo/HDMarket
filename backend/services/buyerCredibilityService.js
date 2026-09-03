import Order from '../models/orderModel.js';
import Dispute from '../models/disputeModel.js';
import User from '../models/userModel.js';

// Buyer credibility (Trust & Safety 2.0 foundation). A neutral, transparent
// score derived from order history and disputes — sellers see it when deciding
// to accept an order. Recalculated at most once per 24h per user.
const SIGNAL_WINDOW_DAYS = 180;
const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;

const clampScore = (value) => Math.max(0, Math.min(100, Math.round(value)));

// Pure scoring function — unit-testable without the database.
// Baseline 80: good history raises the score toward 100, bad history lowers it
// toward 0. New accounts are neither trusted nor distrusted.
export const computeBuyerCredibilityScore = ({
  deliveredOrders = 0,
  cancelledOrders = 0,
  disputesLost = 0,
  phoneVerified = false
} = {}) => {
  let score = 80;
  // Reliable history earns trust back slowly (cap +20).
  score += Math.min(Number(deliveredOrders) || 0, 10) * 2;
  // Cancellations erode trust; disputed losses strongly so.
  score -= Math.min(Number(cancelledOrders) || 0, 10) * 5;
  score -= Math.min(Number(disputesLost) || 0, 5) * 20;
  if (phoneVerified) score += 5;
  return clampScore(score);
};

export const recalculateBuyerCredibility = async (userId) => {
  const since = new Date(Date.now() - SIGNAL_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const [deliveredOrders, cancelledOrders, disputesLost, user] = await Promise.all([
    Order.countDocuments({ customer: userId, status: 'delivered', updatedAt: { $gte: since } }),
    Order.countDocuments({ customer: userId, status: 'cancelled', updatedAt: { $gte: since } }),
    Dispute.countDocuments({ clientId: userId, status: 'RESOLVED_SELLER', updatedAt: { $gte: since } }),
    User.findById(userId).select('phoneVerified').lean()
  ]);
  if (!user) return null;

  const score = computeBuyerCredibilityScore({
    deliveredOrders,
    cancelledOrders,
    disputesLost,
    phoneVerified: Boolean(user.phoneVerified)
  });
  const signals = { deliveredOrders, cancelledOrders, disputesLost };
  await User.updateOne(
    { _id: userId },
    { credibilityScore: score, credibilityUpdatedAt: new Date(), credibilitySignals: signals }
  );
  return { score, signals };
};

// Fire-and-forget refresh guard: profile reads never block on this, and each
// user is recomputed at most once per REFRESH_INTERVAL_MS.
export const refreshBuyerCredibilityIfStale = (userId) => {
  const normalizedId = String(userId || '').trim();
  if (!normalizedId) return;
  User.findById(normalizedId)
    .select('credibilityUpdatedAt')
    .lean()
    .then((user) => {
      const updatedAt = user?.credibilityUpdatedAt ? new Date(user.credibilityUpdatedAt).getTime() : 0;
      const stale = !updatedAt || Date.now() - updatedAt > REFRESH_INTERVAL_MS;
      if (stale) {
        recalculateBuyerCredibility(normalizedId).catch(() => {});
      }
    })
    .catch(() => {});
};
