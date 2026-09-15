import express from 'express';
import { optionalProtect, protect, admin } from '../middlewares/authMiddleware.js';
import { attachCountryContext } from '../middlewares/countryMiddleware.js';
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
router.get('/', optionalProtect, attachCountryContext, listActiveFlashSales);
router.get('/:id', optionalProtect, attachCountryContext, getFlashSaleById);

// ─── ADMIN ──────────────────────────────────────────────────
router.get('/admin/list', protect, admin, adminListFlashSales);
router.post('/admin/create', protect, admin, adminCreateFlashSale);
router.patch('/admin/:id', protect, admin, adminUpdateFlashSale);
router.post('/admin/:id/cancel', protect, admin, adminCancelFlashSale);

export default router;
