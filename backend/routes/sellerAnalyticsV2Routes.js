import express from 'express';
import { protect, admin } from '../middlewares/authMiddleware.js';
import {
  requireShop,
  getSellerOverview,
  getSellerProductPerformance,
  getSellerCustomerInsights,
  adminGetSellerAnalytics
} from '../controllers/sellerAnalyticsV2Controller.js';

const router = express.Router();

// ─── SELLER ────────────────────────────────────────────
router.get('/overview', protect, requireShop, getSellerOverview);
router.get('/products', protect, requireShop, getSellerProductPerformance);
router.get('/customers', protect, requireShop, getSellerCustomerInsights);

// ─── ADMIN ─────────────────────────────────────────────
router.get('/admin/:sellerId', protect, admin, adminGetSellerAnalytics);

export default router;
