import express from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import { requireAnyPermission, requireRole } from '../middlewares/roleMiddleware.js';
import { validate, schemas } from '../middlewares/validate.js';
import { idempotencyMiddleware } from '../middlewares/idempotencyMiddleware.js';
import { cacheMiddleware } from '../utils/cache.js';
import {
  adminCreateOrder,
  adminDeleteOrder,
  adminListOrders,
  adminOrderStats,
  adminSearchCustomers,
  adminSearchProducts,
  adminSendOrderReminder,
  adminUpdateOrder,
  userCheckoutOrder,
  userListOrders,
  getUserOrder,
  userUpdateOrderStatus,
  userUpdateOrderAddress,
  userSkipCancellationWindow,
  sellerListOrders,
  sellerGetOrder,
  sellerUpdateOrderDeliveryFee,
  sellerSubmitDeliveryProof,
  clientConfirmDelivery,
  getOrderDeliveryLogs,
  sellerUpdateOrderStatus,
  sellerCancelOrder,
  sellerDeliveryStatsOverview,
  sellerDeliveryStatsProducts,
  saveDraftOrder,
  getDraftOrders,
  deleteDraftOrder,
  createInquiryOrder
} from '../controllers/orderController.js';
import {
  requestPlatformDeliveryForOrder,
  sellerUpdateDeliveryPinForOrder
} from '../controllers/deliveryRequestController.js';
import {
  adminApplyOrderAction,
  adminOrderAlerts,
  adminOrderCommandCenter,
  adminOrderTimeline,
  adminRunDelayDetection,
  adminRunReminderSweep,
  adminSellerPerformance,
  adminUserRisk
} from '../controllers/adminOrderCommandCenterController.js';
import {
  checkoutInstallmentOrder,
  getInstallmentEligibility,
  sellerConfirmInstallmentSale,
  sellerInstallmentAnalytics,
  sellerValidateInstallmentPayment,
  uploadInstallmentPaymentProof
} from '../controllers/installmentController.js';
import { checkOrderReviewReminderStatus } from '../controllers/reviewReminderController.js';
import {
  getOrderMessages,
  sendOrderMessage,
  getUnreadCount,
  getAllOrderConversations,
  archiveOrderConversation,
  unarchiveOrderConversation,
  deleteOrderConversation,
  uploadOrderMessageAttachment,
  addOrderMessageReaction,
  removeOrderMessageReaction,
  deleteOrderMessage,
  updateOrderMessage
} from '../controllers/orderMessageController.js';
import { chatUpload } from '../utils/chatUpload.js';
import { deliveryProofUpload } from '../utils/deliveryProofUpload.js';

const router = express.Router();

router.use(protect);

const adminRouter = express.Router();
adminRouter.use(requireRole(['admin', 'manager']));
adminRouter.use(requireAnyPermission(['manage_orders']));

adminRouter.get('/stats', adminOrderStats);
adminRouter.get('/command-center', adminOrderCommandCenter);
adminRouter.get('/alerts', adminOrderAlerts);
adminRouter.get('/seller-performance', adminSellerPerformance);
adminRouter.get('/user-risk', adminUserRisk);
adminRouter.get('/:id/timeline', validate(schemas.idParam, 'params'), adminOrderTimeline);
adminRouter.post('/:id/actions', validate(schemas.idParam, 'params'), adminApplyOrderAction);
adminRouter.post('/automation/detect-delays', adminRunDelayDetection);
adminRouter.post('/automation/reminder-sweep', adminRunReminderSweep);
adminRouter.get('/customers', adminSearchCustomers);
adminRouter.get('/products', adminSearchProducts);
adminRouter.get('/', adminListOrders);
adminRouter.post('/', requireRole(['admin']), validate(schemas.orderCreate), adminCreateOrder);
adminRouter.patch('/:id', validate(schemas.idParam, 'params'), validate(schemas.orderUpdate), adminUpdateOrder);
adminRouter.delete('/:id', validate(schemas.idParam, 'params'), adminDeleteOrder);
adminRouter.post('/:id/reminder', validate(schemas.idParam, 'params'), adminSendOrderReminder);

router.use('/admin', adminRouter);

router.post(
  '/installment/checkout',
  idempotencyMiddleware(),
  validate(schemas.installmentCheckout),
  checkoutInstallmentOrder
);
router.post(
  '/checkout',
  idempotencyMiddleware(),
  validate(schemas.orderCheckout),
  userCheckoutOrder
);
router.get('/installment/eligibility', getInstallmentEligibility);
router.post(
  '/:id/installment/payments/:scheduleIndex/proof',
  validate(schemas.installmentScheduleParam, 'params'),
  validate(schemas.installmentPaymentProofSubmit),
  uploadInstallmentPaymentProof
);
router.patch(
  '/seller/:id/installment/confirm-sale',
  validate(schemas.idParam, 'params'),
  validate(schemas.installmentSaleConfirmation),
  sellerConfirmInstallmentSale
);
router.patch(
  '/seller/:id/installment/payments/:scheduleIndex/validate',
  validate(schemas.installmentScheduleParam, 'params'),
  validate(schemas.installmentPaymentValidation),
  sellerValidateInstallmentPayment
);
router.get(
  '/seller/installment/analytics',
  cacheMiddleware({ domain: 'analytics', scope: 'seller', ttl: 120000 }),
  sellerInstallmentAnalytics
);
router.get(
  '/seller/delivery-stats/overview',
  cacheMiddleware({ domain: 'dashboard', scope: 'seller', ttl: 90000 }),
  sellerDeliveryStatsOverview
);
router.get(
  '/seller/delivery-stats/products',
  cacheMiddleware({ domain: 'dashboard', scope: 'seller', ttl: 90000 }),
  sellerDeliveryStatsProducts
);
router.post('/inquiry', validate(schemas.orderInquiry), createInquiryOrder);
router.post('/draft', saveDraftOrder);
router.get('/draft', getDraftOrders);
router.delete('/draft/:id', validate(schemas.idParam, 'params'), deleteDraftOrder);
router.get('/seller', cacheMiddleware({ domain: 'orders', scope: 'seller', ttl: 45000 }), sellerListOrders);
router.get(
  '/detail/:id',
  cacheMiddleware({ domain: 'orders', scope: 'user', ttl: 30000 }),
  validate(schemas.idParam, 'params'),
  getUserOrder
);
router.get(
  '/seller/detail/:id',
  cacheMiddleware({ domain: 'orders', scope: 'seller', ttl: 30000 }),
  validate(schemas.idParam, 'params'),
  sellerGetOrder
);
router.patch(
  '/seller/:id/delivery-fee',
  validate(schemas.idParam, 'params'),
  validate(schemas.sellerDeliveryFeeUpdate, 'body'),
  sellerUpdateOrderDeliveryFee
);
router.post(
  '/seller/:id/delivery-proof',
  validate(schemas.idParam, 'params'),
  deliveryProofUpload.array('deliveryProofImages', 5),
  validate(schemas.deliveryProofSubmit),
  sellerSubmitDeliveryProof
);
router.post(
  '/:id/confirm-delivery',
  idempotencyMiddleware(),
  validate(schemas.idParam, 'params'),
  validate(schemas.deliveryConfirm),
  clientConfirmDelivery
);
router.get('/:id/delivery-logs', validate(schemas.idParam, 'params'), getOrderDeliveryLogs);
router.post(
  '/:id/request-delivery',
  validate(schemas.idParam, 'params'),
  validate(schemas.orderRequestDelivery),
  requestPlatformDeliveryForOrder
);
router.post(
  '/:id/delivery-pin',
  validate(schemas.idParam, 'params'),
  validate(schemas.sellerDeliveryPinUpdate),
  sellerUpdateDeliveryPinForOrder
);
router.patch(
  '/:id/status',
  idempotencyMiddleware(),
  validate(schemas.idParam, 'params'),
  validate(schemas.orderStatusUpdate),
  userUpdateOrderStatus
);
router.patch(
  '/:id/address',
  validate(schemas.idParam, 'params'),
  validate(schemas.orderAddressUpdate),
  userUpdateOrderAddress
);
router.post(
  '/:id/skip-cancellation-window',
  idempotencyMiddleware(),
  validate(schemas.idParam, 'params'),
  userSkipCancellationWindow
);
router.patch(
  '/seller/:id/status',
  idempotencyMiddleware(),
  validate(schemas.idParam, 'params'),
  validate(schemas.sellerOrderStatusUpdate),
  sellerUpdateOrderStatus
);
router.post(
  '/seller/:id/cancel',
  idempotencyMiddleware(),
  validate(schemas.idParam, 'params'),
  validate(schemas.sellerCancelOrder),
  sellerCancelOrder
);
// Order messages routes (must be before /:id routes to avoid conflicts)
router.get('/messages/conversations', getAllOrderConversations);
router.get('/messages/unread', getUnreadCount);
router.post('/:id/archive', validate(schemas.idParam, 'params'), archiveOrderConversation);
router.post('/:id/unarchive', validate(schemas.idParam, 'params'), unarchiveOrderConversation);
router.post('/:id/delete', validate(schemas.idParam, 'params'), deleteOrderConversation);

router.get('/', cacheMiddleware({ domain: 'orders', scope: 'user', ttl: 45000 }), userListOrders);
router.get('/:id/review-reminder-check', validate(schemas.idParam, 'params'), checkOrderReviewReminderStatus);

// Order messages routes for specific order
router.get('/:orderId/messages', getOrderMessages);
router.post(
  '/:orderId/messages',
  idempotencyMiddleware(),
  validate(schemas.orderMessage),
  sendOrderMessage
);
router.patch(
  '/:orderId/messages/:messageId',
  idempotencyMiddleware(),
  validate(schemas.orderMessageUpdate, 'body'),
  updateOrderMessage
);
router.delete('/:orderId/messages/:messageId', idempotencyMiddleware(), deleteOrderMessage);
router.post('/messages/upload', chatUpload.single('file'), uploadOrderMessageAttachment);
router.post('/messages/:messageId/reactions', idempotencyMiddleware(), addOrderMessageReaction);
router.delete('/messages/:messageId/reactions', idempotencyMiddleware(), removeOrderMessageReaction);

export default router;
