import { getPawaPayConfig } from '../services/pawapayService.js';

export const rejectLegacyPaymentWhenPawaPayOnly = (req, res, next) => {
  if (!getPawaPayConfig().exclusiveMode) return next();
  // Only an explicitly free publication may use the non-provider endpoint.
  // Its commission is recalculated server-side by createPayment.
  if (req.body?.paymentMethod === 'promo' && req.body?.amount === 0 &&
      (req.body?.amountPaid == null || req.body.amountPaid === 0)) return next();
  return res.status(403).json({ code: 'PAWAPAY_ONLY', message: 'Utilisez PawaPay pour régler ce paiement.' });
};
