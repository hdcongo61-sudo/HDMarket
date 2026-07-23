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
import {
  receivePawaPayCallback,
  createPawaPayCheckout,
  getMyPawaPayCheckout,
  listPawaPayRefundsAdmin,
  refreshPawaPayRefundAdmin,
  verifyPawaPayContentDigest,
  verifyPawaPaySignature
} from '../controllers/pawapayController.js';
import { getPawaPayConfig } from '../services/pawapayService.js';
import {
  listSellerPayoutsAdmin,
  refreshSellerPayoutAdmin,
  retrySellerPayoutAdmin
} from '../controllers/settlementController.js';

const router = express.Router();

const rejectLegacyPaymentWhenPawaPayOnly = (req, res, next) => {
  if (!getPawaPayConfig().exclusiveMode) return next();
  if (Number(req.body?.amount || 0) === 0) return next();
  return res.status(403).json({
    code: 'PAWAPAY_ONLY',
    message: 'Les paiements manuels et les identifiants de transaction sont désactivés. Utilisez PawaPay.'
  });
};

// Public provider callbacks. PawaPay does not send an HDMarket user token.
// Keep these routes above all authenticated payment routes.
const pawaPayCallbackMiddleware = [verifyPawaPayContentDigest, verifyPawaPaySignature];
router.post('/pawapay/callbacks/checkouts', ...pawaPayCallbackMiddleware, receivePawaPayCallback('checkout'));
router.post('/pawapay/callbacks/deposits', ...pawaPayCallbackMiddleware, receivePawaPayCallback('deposit'));
router.post('/pawapay/callbacks/payouts', ...pawaPayCallbackMiddleware, receivePawaPayCallback('payout'));
router.post('/pawapay/callbacks/refunds', ...pawaPayCallbackMiddleware, receivePawaPayCallback('refund'));

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

router.post(
  '/pawapay/checkouts',
  protect,
  paymentSubmissionLimiter,
  idempotencyMiddleware({ ttlMs: 15 * 60 * 1000 }),
  createPawaPayCheckout
);
router.get('/pawapay/checkouts/:checkoutId', protect, getMyPawaPayCheckout);
router.get('/pawapay/refunds', protect, requirePaymentVerification, listPawaPayRefundsAdmin);
router.post('/pawapay/refunds/:refundId/refresh', protect, requirePaymentVerification, refreshPawaPayRefundAdmin);
router.get('/pawapay/payouts', protect, requirePaymentVerification, listSellerPayoutsAdmin);
router.post('/pawapay/payouts/:payoutId/retry', protect, requirePaymentVerification, retrySellerPayoutAdmin);
router.post('/pawapay/payouts/:payoutId/refresh', protect, requirePaymentVerification, refreshSellerPayoutAdmin);

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
  rejectLegacyPaymentWhenPawaPayOnly,
  paymentSubmissionLimiter,
  validate(schemas.transactionCodeVerify),
  verifyTransactionCodeAvailability
);
router.post(
  '/',
  protect,
  rejectLegacyPaymentWhenPawaPayOnly,
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
