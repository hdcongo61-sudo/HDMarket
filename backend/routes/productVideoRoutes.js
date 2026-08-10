import express from 'express';
import {
  createProductVideoComment,
  deleteSellerProductVideo,
  getAdminProductVideoAnalytics,
  getProductVideoById,
  getProductVideoCapabilities,
  getProductVideoFeed,
  getSavedProductVideos,
  getSellerProductVideoAnalytics,
  listAdminProductVideoReports,
  listAdminProductVideos,
  listProductVideoComments,
  listSellerProductVideos,
  listShopProductVideos,
  moderateProductVideo,
  recordProductVideoAction,
  recordProductVideoView,
  reportProductVideo,
  resolveAdminProductVideoReport,
  toggleProductVideoCommentLike,
  toggleProductVideoLike,
  toggleProductVideoSave,
  updateSellerProductVideo,
  uploadProductVideos
} from '../controllers/productVideoController.js';
import { admin, optionalProtect, protect } from '../middlewares/authMiddleware.js';
import { requireFeatureAccess } from '../middlewares/featureFlagMiddleware.js';
import { idempotencyMiddleware } from '../middlewares/idempotencyMiddleware.js';
import { upload } from '../utils/upload.js';

const router = express.Router();
const productVideoMutationIdempotency = idempotencyMiddleware({ ttlMs: 10 * 60 * 1000 });

router.use(optionalProtect, requireFeatureAccess('product_videos'));

router.get('/capabilities', getProductVideoCapabilities);
router.get('/feed', getProductVideoFeed);
router.get('/saved', protect, getSavedProductVideos);
router.get('/shop/:sellerId', listShopProductVideos);
router.get('/seller/mine', protect, listSellerProductVideos);
router.get('/seller/analytics', protect, getSellerProductVideoAnalytics);
router.post('/seller', protect, upload.array('video', 12), productVideoMutationIdempotency, uploadProductVideos);
router.patch('/seller/:id', protect, upload.single('video'), productVideoMutationIdempotency, updateSellerProductVideo);
router.delete('/seller/:id', protect, deleteSellerProductVideo);
router.get('/admin/analytics', protect, admin, getAdminProductVideoAnalytics);
router.get('/admin/reports', protect, admin, listAdminProductVideoReports);
router.patch('/admin/reports/:reportId', protect, admin, resolveAdminProductVideoReport);
router.get('/admin', protect, admin, listAdminProductVideos);
router.patch('/admin/:id', protect, admin, moderateProductVideo);
router.post('/comments/:commentId/like', protect, toggleProductVideoCommentLike);
router.get('/:id/comments', listProductVideoComments);
router.post('/:id/comments', protect, createProductVideoComment);
router.post('/:id/view', recordProductVideoView);
router.post('/:id/like', protect, toggleProductVideoLike);
router.post('/:id/save', protect, toggleProductVideoSave);
router.post('/:id/action', recordProductVideoAction);
router.post('/:id/report', protect, reportProductVideo);
router.get('/:id', getProductVideoById);

export default router;
