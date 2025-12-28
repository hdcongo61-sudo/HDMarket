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
router.get('/admin', protect, requireRole(['admin', 'manager']), listPaymentsAdmin);
router.put('/admin/:id/verify', protect, requireRole(['admin', 'manager']), verifyPayment);
router.put('/admin/:id/reject', protect, requireRole(['admin', 'manager']), rejectPayment);

export default router;
