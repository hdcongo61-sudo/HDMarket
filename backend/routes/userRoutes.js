import express from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import { validate, schemas } from '../middlewares/validate.js';
import { upload } from '../utils/upload.js';
import {
  getProfile,
  getProfileStats,
  updateProfile,
  getNotifications,
  getNotificationPreferences,
  updateNotificationPreferences,
  markNotificationsRead,
  deleteNotification,
  getFavorites,
  addFavorite,
  removeFavorite,
  streamNotifications
} from '../controllers/userController.js';

const router = express.Router();

router.use(protect);

router.get('/profile', getProfile);
router.get('/profile/stats', getProfileStats);
router.put('/profile', upload.single('shopLogo'), validate(schemas.profileUpdate), updateProfile);
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

export default router;
