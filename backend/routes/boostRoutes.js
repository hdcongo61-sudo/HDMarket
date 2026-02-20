import express from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import { validate, schemas } from '../middlewares/validate.js';
import { upload } from '../utils/upload.js';
import {
  createBoostRequest,
  getBoostPricePreview,
  listMyBoostRequests,
  trackBoostClick,
  trackBoostImpressions
} from '../controllers/boostController.js';

const router = express.Router();

router.get(
  '/pricing/preview',
  protect,
  validate(schemas.boostPricingPreview, 'query'),
  getBoostPricePreview
);
router.get('/my/requests', protect, validate(schemas.boostRequestListQuery, 'query'), listMyBoostRequests);
router.post(
  '/requests',
  protect,
  upload.single('paymentProofImage'),
  validate(schemas.boostRequestCreate),
  createBoostRequest
);
router.post('/track/impressions', validate(schemas.boostTrackImpressions), trackBoostImpressions);
router.post('/requests/:id/click', validate(schemas.idParam, 'params'), trackBoostClick);

export default router;
