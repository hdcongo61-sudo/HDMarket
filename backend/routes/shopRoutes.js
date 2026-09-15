import express from 'express';
import {
  deleteShopReview,
  getMyShopReview,
  getShopProfile,
  getShopReviews,
  listFreeDeliveryShops,
  listShops,
  upsertShopReview
} from '../controllers/shopController.js';
import { protect, optionalProtect } from '../middlewares/authMiddleware.js';
import { attachCountryContext } from '../middlewares/countryMiddleware.js';
import { validate, schemas } from '../middlewares/validate.js';

const router = express.Router();

router.get('/', optionalProtect, attachCountryContext, listShops);
router.get('/free-delivery', optionalProtect, attachCountryContext, listFreeDeliveryShops);
router.get('/:id/reviews', validate(schemas.slugParam, 'params'), getShopReviews);
router.get('/:id/reviews/user', protect, validate(schemas.slugParam, 'params'), getMyShopReview);
router.post(
  '/:id/reviews',
  protect,
  validate(schemas.slugParam, 'params'),
  validate(schemas.shopReviewUpsert),
  upsertShopReview
);
router.delete('/:id/reviews', protect, validate(schemas.slugParam, 'params'), deleteShopReview);
router.get('/:id', optionalProtect, attachCountryContext, validate(schemas.slugParam, 'params'), getShopProfile);

export default router;
