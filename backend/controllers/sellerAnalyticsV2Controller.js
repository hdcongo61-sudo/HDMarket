import asyncHandler from 'express-async-handler';
import User from '../models/userModel.js';
import { getOverview, getProductPerformance, getCustomerInsights } from '../services/sellerAnalyticsV2Service.js';

// Only shop accounts can access
export const requireShop = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id).select('accountType role').lean();
  if (!user || (user.accountType !== 'shop' && !['admin', 'founder'].includes(user.role))) {
    return res.status(403).json({ message: 'Réservé aux boutiques.' });
  }
  next();
});

// ─── OVERVIEW ─────────────────────────────────────────

export const getSellerOverview = asyncHandler(async (req, res) => {
  const data = await getOverview(req.user.id);
  res.json(data);
});

export const getSellerProductPerformance = asyncHandler(async (req, res) => {
  const { sort = 'salesCount', order = 'desc' } = req.query;
  const data = await getProductPerformance(req.user.id);

  // Sort
  const key = sort || 'salesCount';
  const dir = order === 'asc' ? 1 : -1;
  data.items.sort((a, b) => (a[key] || 0) > (b[key] || 0) ? dir : -dir);

  res.json(data);
});

export const getSellerCustomerInsights = asyncHandler(async (req, res) => {
  const data = await getCustomerInsights(req.user.id);
  res.json(data);
});

// ─── ADMIN ────────────────────────────────────────────

export const adminGetSellerAnalytics = asyncHandler(async (req, res) => {
  const [overview, products, customers] = await Promise.all([
    getOverview(req.params.sellerId),
    getProductPerformance(req.params.sellerId),
    getCustomerInsights(req.params.sellerId)
  ]);
  res.json({ overview, products, customers });
});
