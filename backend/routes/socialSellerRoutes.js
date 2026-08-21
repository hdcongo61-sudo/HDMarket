import express from 'express';
import { protect, optionalProtect } from '../middlewares/authMiddleware.js';
import { requireFeatureAccess } from '../middlewares/featureFlagMiddleware.js';
import { validate, schemas } from '../middlewares/validate.js';
import {
  getProductBySocialCode,
  resolveSocialClick,
  listMySocialProducts,
  getProductShareLinks,
  createSocialCampaign,
  listSocialCampaigns,
  toggleSocialCampaign,
  getSellerSocialAnalytics
} from '../controllers/socialSellerController.js';

const router = express.Router();

// Public — no auth required, but SOCIAL_COMMERCE must be on. A 404 here
// correctly hides the whole feature when the flag is off (spec §26).
router.get('/product/:socialCode', requireFeatureAccess('social_commerce'), getProductBySocialCode);
router.get('/resolve/:socialCode', requireFeatureAccess('social_commerce'), optionalProtect, resolveSocialClick);

// Seller-scoped — every route below requires auth + the feature flag.
router.use(protect, requireFeatureAccess('social_commerce'));

router.get('/products', listMySocialProducts);
router.get('/product/:productId/share-links', getProductShareLinks);
router.get('/analytics', getSellerSocialAnalytics);

router.post(
  '/campaigns',
  requireFeatureAccess('social_campaigns'),
  validate(schemas.socialCampaignCreate),
  createSocialCampaign
);
router.get('/campaigns', requireFeatureAccess('social_campaigns'), listSocialCampaigns);
router.patch(
  '/campaigns/:id',
  requireFeatureAccess('social_campaigns'),
  validate(schemas.socialCampaignToggle),
  toggleSocialCampaign
);

export default router;
