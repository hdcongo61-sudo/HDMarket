import express from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import { validate, schemas } from '../middlewares/validate.js';
import { upload } from '../utils/upload.js';
import {
  getProfile,
  getProfileStats,
  updateProfile,
  getNotifications,
  markNotificationsRead,
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
router.get('/favorites', getFavorites);
router.post('/favorites', validate(schemas.favoriteModify), addFavorite);
router.delete('/favorites/:id', validate(schemas.idParam, 'params'), removeFavorite);

export default router;
