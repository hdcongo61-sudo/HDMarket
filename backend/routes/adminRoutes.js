import express from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import { requireRole } from '../middlewares/roleMiddleware.js';
import { validate, schemas } from '../middlewares/validate.js';
import {
  getDashboardStats,
  listUsers,
  updateUserAccountType,
  blockUser,
  unblockUser
} from '../controllers/adminController.js';

const router = express.Router();

router.use(protect, requireRole(['admin']));

router.get('/stats', getDashboardStats);
router.get('/users', listUsers);
router.patch(
  '/users/:id/account-type',
  validate(schemas.idParam, 'params'),
  validate(schemas.adminUserAccountType),
  updateUserAccountType
);
router.patch(
  '/users/:id/block',
  validate(schemas.idParam, 'params'),
  validate(schemas.adminBlockUser),
  blockUser
);
router.patch(
  '/users/:id/unblock',
  validate(schemas.idParam, 'params'),
  unblockUser
);

export default router;
