import express from 'express';
import rateLimit from 'express-rate-limit';
import { protect } from '../middlewares/authMiddleware.js';
import { requirePaymentVerification } from '../middlewares/roleMiddleware.js';
import { validate, schemas } from '../middlewares/validate.js';
import { idempotencyMiddleware } from '../middlewares/idempotencyMiddleware.js';
import {
  createPayment,
  getMyPayments,
  listPaymentsAdmin,
  verifyTransactionCodeAvailability,
  verifyPayment,
  rejectPayment
} from '../controllers/paymentController.js';
import { validatePromoCodeForSeller } from '../controllers/promoCodeController.js';

const router = express.Router();

const promoValidationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: {
    message: 'Trop de tentatives de validation de code promo. Réessayez dans 15 minutes.'
  }
});

const paymentSubmissionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: {
    message: 'Trop de tentatives de soumission de paiement. Réessayez dans 15 minutes.'
  }
});

// User
router.post(
  '/promo-codes/validate',
  protect,
  promoValidationLimiter,
  validate(schemas.promoCodeValidate),
  validatePromoCodeForSeller
);
router.post(
  '/transaction-code/verify',
  protect,
  paymentSubmissionLimiter,
  validate(schemas.transactionCodeVerify),
  verifyTransactionCodeAvailability
);
router.post(
  '/',
  protect,
  paymentSubmissionLimiter,
  idempotencyMiddleware(),
  validate(schemas.paymentCreate),
  createPayment
);
router.get('/me', protect, getMyPayments);

// Payment verification - accessible by admin OR users with canVerifyPayments permission
router.get('/admin', protect, requirePaymentVerification, listPaymentsAdmin);
router.put(
  '/admin/:id/verify',
  protect,
  requirePaymentVerification,
  idempotencyMiddleware(),
  verifyPayment
);
router.put(
  '/admin/:id/reject',
  protect,
  requirePaymentVerification,
  idempotencyMiddleware(),
  rejectPayment
);

export default router;
