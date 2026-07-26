import express from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import { validate, schemas } from '../middlewares/validate.js';
import { upload } from '../utils/upload.js';
import {
  uploadGlobalNotificationImage,
  getGlobalNotificationPricePreview,
  createGlobalNotificationRequest,
  listMyGlobalNotificationRequests,
  listGlobalNotificationPricingAdmin,
  upsertGlobalNotificationPricingAdmin,
  listGlobalNotificationRequestsAdmin,
  approveAndSendGlobalNotificationAdmin,
  rejectGlobalNotificationRequestAdmin
} from '../controllers/globalNotificationController.js';

const router = express.Router();

// Shop-facing
router.post('/upload-image', protect, upload.single('image'), uploadGlobalNotificationImage);
router.get(
  '/pricing/preview',
  protect,
  validate(schemas.globalNotificationPricePreview, 'query'),
  getGlobalNotificationPricePreview
);
router.get(
  '/my/requests',
  protect,
  validate(schemas.globalNotificationListQuery, 'query'),
  listMyGlobalNotificationRequests
);
router.post(
  '/requests',
  protect,
  validate(schemas.globalNotificationRequestCreate),
  createGlobalNotificationRequest
);

// Admin-facing
router.get('/admin/pricing', protect, listGlobalNotificationPricingAdmin);
router.post(
  '/admin/pricing',
  protect,
  validate(schemas.adminGlobalNotificationPricingUpsert),
  upsertGlobalNotificationPricingAdmin
);
router.get(
  '/admin/requests',
  protect,
  validate(schemas.globalNotificationListQuery, 'query'),
  listGlobalNotificationRequestsAdmin
);
router.post('/admin/requests/:id/send', protect, approveAndSendGlobalNotificationAdmin);
router.post(
  '/admin/requests/:id/reject',
  protect,
  validate(schemas.adminGlobalNotificationReject),
  rejectGlobalNotificationRequestAdmin
);

export default router;
