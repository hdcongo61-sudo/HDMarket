import express from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import { validate, schemas } from '../middlewares/validate.js';
import { upload } from '../utils/upload.js';
import { complaintUpload } from '../utils/complaintUpload.js';
import { cacheMiddleware } from '../utils/cache.js';
import {
  getProfile,
  getProfileStats,
  updateProfile,
  sendPasswordChangeCode,
  changePassword,
  getNotifications,
  getNotificationPreferences,
  updateNotificationPreferences,
  markNotificationsRead,
  deleteNotification,
  getFavorites,
  addFavorite,
  removeFavorite,
  streamNotifications,
  followShop,
  unfollowShop,
  getFollowingShops,
  registerPushToken,
  unregisterPushToken,
  addProductView,
  getProductViews,
  addSearchHistory,
  getSearchHistory,
  deleteSearchHistoryEntry,
  clearSearchHistory,
  togglePinSearchHistory,
  exportSearchHistory
} from '../controllers/userController.js';
import { createComplaint, getUserComplaints } from '../controllers/complaintController.js';
import {
  createImprovementFeedback,
  listMyImprovementFeedback
} from '../controllers/feedbackController.js';
import {
  createShopConversionRequest,
  getUserShopConversionRequests
} from '../controllers/shopConversionController.js';

const router = express.Router();

router.use(protect);

router.get('/profile', getProfile);
router.get('/profile/stats', cacheMiddleware({ ttl: 120000 }), getProfileStats);
router.put(
  '/profile',
  upload.fields([
    { name: 'shopLogo', maxCount: 1 },
    { name: 'shopBanner', maxCount: 1 }
  ]),
  validate(schemas.profileUpdate),
  updateProfile
);
router.post('/password/send-code', validate(schemas.passwordSendCode), sendPasswordChangeCode);
router.post('/password/change', validate(schemas.passwordChange), changePassword);
router.get('/notifications', getNotifications);
router.get('/notifications/stream', streamNotifications);
router.patch('/notifications/read', markNotificationsRead);
router.get('/notification-preferences', getNotificationPreferences);
router.patch(
  '/notification-preferences',
  validate(schemas.notificationPreferencesUpdate),
  updateNotificationPreferences
);
router.delete('/notifications/:id', validate(schemas.idParam, 'params'), deleteNotification);
router.get('/favorites', getFavorites);
router.post('/favorites', validate(schemas.favoriteModify), addFavorite);
router.delete('/favorites/:id', validate(schemas.idParam, 'params'), removeFavorite);
router.get('/complaints', getUserComplaints);
router.post(
  '/complaints',
  complaintUpload.array('attachments', 2),
  validate(schemas.complaintCreate),
  createComplaint
);
router.post('/shops/:id/follow', validate(schemas.idParam, 'params'), followShop);
router.delete('/shops/:id/follow', validate(schemas.idParam, 'params'), unfollowShop);
router.get('/shops/following', getFollowingShops);
router.post('/product-views/:id', validate(schemas.identifierParam, 'params'), addProductView);
router.get('/product-views', getProductViews);
router.post('/search-history', addSearchHistory);
router.get('/search-history', getSearchHistory);
router.get('/search-history/export', exportSearchHistory);
router.patch('/search-history/:id/pin', validate(schemas.idParam, 'params'), togglePinSearchHistory);
router.delete('/search-history/:id', validate(schemas.idParam, 'params'), deleteSearchHistoryEntry);
router.delete('/search-history', clearSearchHistory);
router.post('/push-tokens', validate(schemas.pushTokenRegister), registerPushToken);
router.delete('/push-tokens', validate(schemas.pushTokenRemove), unregisterPushToken);
router.get('/feedback', listMyImprovementFeedback);
router.post('/feedback', validate(schemas.feedbackCreate), createImprovementFeedback);
router.get('/shop-conversion-requests', getUserShopConversionRequests);
router.post(
  '/shop-conversion-requests',
  upload.fields([
    { name: 'shopLogo', maxCount: 1 },
    { name: 'paymentProof', maxCount: 1 }
  ]),
  createShopConversionRequest
);

export default router;
