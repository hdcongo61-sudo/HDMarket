import express from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import { requireRole } from '../middlewares/roleMiddleware.js';
import { idempotencyMiddleware } from '../middlewares/idempotencyMiddleware.js';
import {
  adminListQuotations,
  adminQuotationAnalytics,
  buyerAcceptCounter,
  buyerRejectQuotation,
  createQuotation,
  createQuotationOrder,
  getQuotation,
  listBuyerQuotations,
  listSellerQuotations,
  sellerRespondQuotation
} from '../controllers/quotationController.js';

const router = express.Router();
router.use(protect);

router.post('/', idempotencyMiddleware(), createQuotation);
router.get('/mine', listBuyerQuotations);
router.get('/seller', listSellerQuotations);
router.get('/admin/analytics', requireRole(['admin', 'manager', 'founder']), adminQuotationAnalytics);
router.get('/admin', requireRole(['admin', 'manager', 'founder']), adminListQuotations);
router.get('/:id', getQuotation);
router.post('/:id/respond', idempotencyMiddleware(), sellerRespondQuotation);
router.post('/:id/accept-counter', idempotencyMiddleware(), buyerAcceptCounter);
router.post('/:id/reject', idempotencyMiddleware(), buyerRejectQuotation);
router.post('/:id/order', idempotencyMiddleware(), createQuotationOrder);

export default router;
