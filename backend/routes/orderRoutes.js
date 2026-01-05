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
  adminSendOrderReminder,
  adminUpdateOrder,
  userCheckoutOrder,
  userListOrders,
  userUpdateOrderStatus,
  sellerListOrders,
  sellerUpdateOrderStatus
} from '../controllers/orderController.js';

const router = express.Router();

router.use(protect);

const adminRouter = express.Router();
adminRouter.use(requireRole(['admin', 'manager']));

adminRouter.get('/stats', adminOrderStats);
adminRouter.get('/customers', adminSearchCustomers);
adminRouter.get('/products', adminSearchProducts);
adminRouter.get('/', adminListOrders);
adminRouter.post('/', requireRole(['admin']), validate(schemas.orderCreate), adminCreateOrder);
adminRouter.patch('/:id', validate(schemas.idParam, 'params'), validate(schemas.orderUpdate), adminUpdateOrder);
adminRouter.post('/:id/reminder', validate(schemas.idParam, 'params'), adminSendOrderReminder);

router.use('/admin', adminRouter);

router.post('/checkout', validate(schemas.orderCheckout), userCheckoutOrder);
router.patch(
  '/:id/status',
  validate(schemas.idParam, 'params'),
  validate(schemas.orderStatusUpdate),
  userUpdateOrderStatus
);
router.get('/seller', sellerListOrders);
router.patch(
  '/seller/:id/status',
  validate(schemas.idParam, 'params'),
  validate(schemas.sellerOrderStatusUpdate),
  sellerUpdateOrderStatus
);
router.get('/', userListOrders);

export default router;
