import express from 'express';
import rateLimit from 'express-rate-limit';
import { protect } from '../middlewares/authMiddleware.js';
import { validate, schemas } from '../middlewares/validate.js';
import { upload } from '../utils/upload.js';
import { complaintUpload } from '../utils/complaintUpload.js';
import { cacheMiddleware } from '../utils/cache.js';
import {
  getProfile,
  clearMyCacheOnLogout,
  getProfileStats,
  updateProfile,
  updateShopLocation,
  updateProfileLocation,
  sendPasswordChangeCode,
  changePassword,
  getNotifications,
  getNotificationPreferences,
  updateNotificationPreferences,
  markNotificationsRead,
  deleteNotification,
  trackNotificationClick,
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
import { createPreviewImageReport, createReport } from '../controllers/contentReportController.js';
import {
  createImprovementFeedback,
  listMyImprovementFeedback
} from '../controllers/feedbackController.js';
import {
  createShopConversionRequest,
  getUserShopConversionRequests
} from '../controllers/shopConversionController.js';
import { updateUserPreferences } from '../controllers/settingsController.js';
import {
  downloadSellerAnalyticsPdf,
  getSellerAnalytics
} from '../controllers/sellerAnalyticsController.js';

const router = express.Router();
const shopLocationRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Trop de mises à jour de localisation. Réessayez dans quelques minutes.',
    code: 'SHOP_LOCATION_RATE_LIMIT'
  }
});

router.use(protect);

router.get('/profile', cacheMiddleware({ domain: 'users', scope: 'user', ttl: 60000 }), getProfile);
router.post('/logout-cache', clearMyCacheOnLogout);
router.patch('/preferences', validate(schemas.userPreferencesUpdate), updateUserPreferences);
router.get(
  '/profile/stats',
  cacheMiddleware({ domain: 'dashboard', scope: 'user', ttl: 60000 }),
  getProfileStats
);
router.get(
  '/profile/seller-analytics',
  cacheMiddleware({ domain: 'analytics', scope: 'seller', ttl: 90000 }),
  validate(schemas.sellerAnalyticsQuery, 'query'),
  getSellerAnalytics
);
router.get(
  '/profile/seller-analytics/report',
  validate(schemas.sellerAnalyticsQuery, 'query'),
  downloadSellerAnalyticsPdf
);
router.put(
  '/profile',
  upload.fields([
    { name: 'profileImage', maxCount: 1 },
    { name: 'shopLogo', maxCount: 1 },
    { name: 'shopBanner', maxCount: 1 }
  ]),
  validate(schemas.profileUpdate),
  updateProfile
);
router.put(
  '/profile/shop-location',
  shopLocationRateLimiter,
  validate(schemas.shopLocationUpdate),
  updateShopLocation
);
router.put(
  '/profile/location',
  validate(schemas.profileLocationUpdate),
  updateProfileLocation
);
router.post('/password/send-code', validate(schemas.passwordSendCode), sendPasswordChangeCode);
router.post('/password/change', validate(schemas.passwordChange), changePassword);
router.get(
  '/notifications',
  cacheMiddleware({ domain: 'notifications', scope: 'user', ttl: 45000 }),
  getNotifications
);
router.get('/notifications/stream', streamNotifications);
router.patch('/notifications/read', markNotificationsRead);
router.post('/notifications/:id/click', validate(schemas.idParam, 'params'), trackNotificationClick);
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
router.post('/reports', validate(schemas.reportCreate), createReport);
router.post(
  '/reports/preview-image',
  validate(schemas.reportPreviewImageCreate),
  createPreviewImageReport
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
