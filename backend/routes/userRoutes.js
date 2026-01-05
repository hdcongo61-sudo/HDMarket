import express from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import { validate, schemas } from '../middlewares/validate.js';
import { upload } from '../utils/upload.js';
import { complaintUpload } from '../utils/complaintUpload.js';
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
  addSearchHistory,
  getSearchHistory,
  deleteSearchHistoryEntry,
  clearSearchHistory
} from '../controllers/userController.js';
import { createComplaint, getUserComplaints } from '../controllers/complaintController.js';

const router = express.Router();

router.use(protect);

router.get('/profile', getProfile);
router.get('/profile/stats', getProfileStats);
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
router.post('/search-history', addSearchHistory);
router.get('/search-history', getSearchHistory);
router.delete('/search-history/:id', validate(schemas.idParam, 'params'), deleteSearchHistoryEntry);
router.delete('/search-history', clearSearchHistory);

export default router;
