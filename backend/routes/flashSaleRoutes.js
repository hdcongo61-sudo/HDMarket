import express from 'express';
import { protect, admin } from '../middlewares/authMiddleware.js';
import {
  listActiveFlashSales,
  getFlashSaleById,
  adminListFlashSales,
  adminCreateFlashSale,
  adminCancelFlashSale,
  adminUpdateFlashSale
} from '../controllers/flashSaleController.js';

const router = express.Router();

// ─── PUBLIC ─────────────────────────────────────────────────
router.get('/', listActiveFlashSales);
router.get('/:id', getFlashSaleById);

// ─── ADMIN ──────────────────────────────────────────────────
router.get('/admin/list', protect, admin, adminListFlashSales);
router.post('/admin/create', protect, admin, adminCreateFlashSale);
router.patch('/admin/:id', protect, admin, adminUpdateFlashSale);
router.post('/admin/:id/cancel', protect, admin, adminCancelFlashSale);

export default router;
