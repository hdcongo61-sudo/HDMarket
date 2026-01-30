import express from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import { requirePaymentVerification } from '../middlewares/roleMiddleware.js';
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

// Payment verification - accessible by admin OR users with canVerifyPayments permission
router.get('/admin', protect, requirePaymentVerification, listPaymentsAdmin);
router.put('/admin/:id/verify', protect, requirePaymentVerification, verifyPayment);
router.put('/admin/:id/reject', protect, requirePaymentVerification, rejectPayment);

export default router;
