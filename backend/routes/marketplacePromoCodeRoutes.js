import express from 'express';
import rateLimit from 'express-rate-limit';
import { protect } from '../middlewares/authMiddleware.js';
import { validate, schemas } from '../middlewares/validate.js';
import {
  createMarketplacePromoCode,
  getMarketplacePromoHomeData,
  getMyMarketplacePromoAnalytics,
  listMyMarketplacePromoCodes,
  previewMarketplacePromoCode,
  toggleMyMarketplacePromoCode,
  updateMyMarketplacePromoCode
} from '../controllers/marketplacePromoCodeController.js';

const router = express.Router();

router.get('/public/home', getMarketplacePromoHomeData);

const promoPreviewLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: {
    message: 'Trop de tentatives de validation de code promo. Réessayez dans 15 minutes.'
  }
});

router.post(
  '/preview',
  protect,
  promoPreviewLimiter,
  validate(schemas.marketplacePromoPreview),
  previewMarketplacePromoCode
);

router.get('/my', protect, listMyMarketplacePromoCodes);
router.get('/my/analytics', protect, getMyMarketplacePromoAnalytics);
router.post('/my', protect, validate(schemas.marketplacePromoCreate), createMarketplacePromoCode);
router.patch(
  '/my/:id',
  protect,
  validate(schemas.idParam, 'params'),
  validate(schemas.marketplacePromoUpdate),
  updateMyMarketplacePromoCode
);
router.patch(
  '/my/:id/toggle',
  protect,
  validate(schemas.idParam, 'params'),
  validate(schemas.marketplacePromoToggle),
  toggleMyMarketplacePromoCode
);

export default router;
