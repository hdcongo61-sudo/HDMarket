import express from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import { requireRole } from '../middlewares/roleMiddleware.js';
import { validate, schemas } from '../middlewares/validate.js';
import {
  createPayment,
  getMyPayments,
  listPaymentsAdmin,
  verifyPayment,
  rejectPayment
} from '../controllers/paymentController.js';

const router = express.Router();

// User
router.post('/', protect, validate(schemas.paymentCreate), createPayment);
router.get('/me', protect, getMyPayments);

// Admin
router.get('/admin', protect, requireRole(['admin']), listPaymentsAdmin);
router.put('/admin/:id/verify', protect, requireRole(['admin']), verifyPayment);
router.put('/admin/:id/reject', protect, requireRole(['admin']), rejectPayment);

export default router;
