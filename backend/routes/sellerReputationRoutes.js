import express from 'express';
import { protect, admin } from '../middlewares/authMiddleware.js';
import {
  getSellerReputationBySlug,
  getSellerReputationById,
  adminRecalculateSellerLevel,
  adminListSellersByLevel
} from '../controllers/sellerReputationController.js';

const router = express.Router();

// ─── PUBLIC ──────────────────────────────────────────────
router.get('/shop/:slug/reputation', getSellerReputationBySlug);
router.get('/:id', getSellerReputationById);

// ─── ADMIN ───────────────────────────────────────────────
router.post('/admin/:id/recalculate', protect, admin, adminRecalculateSellerLevel);
router.get('/admin/list', protect, admin, adminListSellersByLevel);

export default router;
