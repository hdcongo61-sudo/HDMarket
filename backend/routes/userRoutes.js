import express from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import { validate, schemas } from '../middlewares/validate.js';
import { getProfile, updateProfile, getNotifications, markNotificationsRead } from '../controllers/userController.js';

const router = express.Router();

router.use(protect);

router.get('/profile', getProfile);
router.put('/profile', validate(schemas.profileUpdate), updateProfile);
router.get('/notifications', getNotifications);
router.patch('/notifications/read', markNotificationsRead);

export default router;
