import express from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import { requireRole } from '../middlewares/roleMiddleware.js';
import { validate, schemas } from '../middlewares/validate.js';
import {
  adminCreateOrder,
  adminListOrders,
  adminOrderStats,
  adminSearchCustomers,
  adminSearchProducts,
  adminUpdateOrder,
  userListOrders
} from '../controllers/orderController.js';

const router = express.Router();

router.use(protect);

const adminRouter = express.Router();
adminRouter.use(requireRole(['admin', 'manager']));

adminRouter.get('/stats', adminOrderStats);
adminRouter.get('/customers', adminSearchCustomers);
adminRouter.get('/products', adminSearchProducts);
adminRouter.get('/', adminListOrders);
adminRouter.post('/', validate(schemas.orderCreate), adminCreateOrder);
adminRouter.patch('/:id', validate(schemas.idParam, 'params'), validate(schemas.orderUpdate), adminUpdateOrder);

router.use('/admin', adminRouter);

router.get('/', userListOrders);

export default router;
