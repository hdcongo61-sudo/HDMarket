import express from 'express';
import {
  deleteShopReview,
  getMyShopReview,
  getShopProfile,
  getShopReviews,
  listShops,
  upsertShopReview
} from '../controllers/shopController.js';
import { protect } from '../middlewares/authMiddleware.js';
import { validate, schemas } from '../middlewares/validate.js';

const router = express.Router();

router.get('/', listShops);
router.get('/:id/reviews', validate(schemas.idParam, 'params'), getShopReviews);
router.get('/:id/reviews/user', protect, validate(schemas.idParam, 'params'), getMyShopReview);
router.post(
  '/:id/reviews',
  protect,
  validate(schemas.idParam, 'params'),
  validate(schemas.shopReviewUpsert),
  upsertShopReview
);
router.delete('/:id/reviews', protect, validate(schemas.idParam, 'params'), deleteShopReview);
router.get('/:id', validate(schemas.idParam, 'params'), getShopProfile);

export default router;
