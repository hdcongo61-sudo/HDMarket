import express from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import { validate, schemas } from '../middlewares/validate.js';
import { upload } from '../utils/upload.js';
import {
  getProfile,
  updateProfile,
  getNotifications,
  markNotificationsRead,
  getFavorites,
  addFavorite,
  removeFavorite
} from '../controllers/userController.js';

const router = express.Router();

router.use(protect);

router.get('/profile', getProfile);
router.put('/profile', upload.single('shopLogo'), validate(schemas.profileUpdate), updateProfile);
router.get('/notifications', getNotifications);
router.patch('/notifications/read', markNotificationsRead);
router.get('/favorites', getFavorites);
router.post('/favorites', validate(schemas.favoriteModify), addFavorite);
router.delete('/favorites/:id', validate(schemas.idParam, 'params'), removeFavorite);

export default router;
