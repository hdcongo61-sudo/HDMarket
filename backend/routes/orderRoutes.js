import express from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import { requireAnyPermission, requireRole } from '../middlewares/roleMiddleware.js';
import { validate, schemas } from '../middlewares/validate.js';
import { idempotencyMiddleware } from '../middlewares/idempotencyMiddleware.js';
import { cacheMiddleware } from '../utils/cache.js';

const skipCacheByHeader = (req) => String(req.headers['x-skip-cache'] || '').trim() === '1';
const orderCacheUser = (ttl = 45000) => cacheMiddleware({ domain: 'orders', scope: 'user', ttl, skipCache: skipCacheByHeader });
const orderCacheSeller = (ttl = 45000) => cacheMiddleware({ domain: 'orders', scope: 'seller', ttl, skipCache: skipCacheByHeader });
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
  resolveSponsorPayer,
  respondSponsorship,
  retrySponsorship,
  paySelfSponsorship,
  listIncomingSponsorships,
  listSentSponsorships,
  cancelSponsorship,
  adminPayForOtherStats,
  userListOrders,
  userOrdersSummary,
  getUserOrder,
  userUpdateOrderStatus,
  userUpdateOrderAddress,
  userSkipCancellationWindow,
  sellerListOrders,
  sellerOrdersSummary,
  sellerGetOrder,
  sellerUpdateOrderDeliveryFee,
  sellerSubmitDeliveryProof,
  sellerSendClientConfirmationReminder,
  clientConfirmDelivery,
  getOrderDeliveryLogs,
  sellerUpdateOrderStatus,
  walletCheckoutOrder,
  sellerCancelOrder,
  sellerDeliveryStatsOverview,
  sellerDeliveryStatsProducts,
  saveDraftOrder,
  getDraftOrders,
  deleteDraftOrder,
  createInquiryOrder
} from '../controllers/orderController.js';
import { getOrderTracking } from '../controllers/orderTrackingController.js';
import {
  requestPlatformDeliveryForOrder,
  sellerUpdateDeliveryPinForOrder
} from '../controllers/deliveryRequestController.js';
import {
  adminApplyOrderAction,
  adminOrderAlerts,
  adminOrderCommandCenter,
  adminRunInstallmentProofSlaSweep,
  adminRunInstallmentReminderSweep,
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
import {
  checkOrderReviewReminderStatus,
  getBuyerOrderReviewPage,
  updateBuyerOrderReviewReminder
} from '../controllers/reviewReminderController.js';
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
import { upload } from '../utils/upload.js';

const router = express.Router();

router.use(protect);

const adminRouter = express.Router();
adminRouter.use(requireRole(['admin', 'manager']));
adminRouter.use(requireAnyPermission(['manage_orders']));

adminRouter.get('/stats', adminOrderStats);
adminRouter.get('/pay-for-other-stats', adminPayForOtherStats);
adminRouter.get('/command-center', adminOrderCommandCenter);
adminRouter.get('/alerts', adminOrderAlerts);
adminRouter.get('/seller-performance', adminSellerPerformance);
adminRouter.get('/user-risk', adminUserRisk);
adminRouter.get('/:id/timeline', validate(schemas.idParam, 'params'), adminOrderTimeline);
adminRouter.post('/:id/actions', validate(schemas.idParam, 'params'), idempotencyMiddleware(), adminApplyOrderAction);
adminRouter.post('/automation/detect-delays', idempotencyMiddleware(), adminRunDelayDetection);
adminRouter.post('/automation/reminder-sweep', idempotencyMiddleware(), adminRunReminderSweep);
adminRouter.post('/automation/installment-reminders', idempotencyMiddleware(), adminRunInstallmentReminderSweep);
adminRouter.post('/automation/installment-proof-sla', idempotencyMiddleware(), adminRunInstallmentProofSlaSweep);
adminRouter.get('/customers', adminSearchCustomers);
adminRouter.get('/products', adminSearchProducts);
adminRouter.get('/', adminListOrders);
adminRouter.post('/', requireRole(['admin']), idempotencyMiddleware(), validate(schemas.orderCreate), adminCreateOrder);
adminRouter.patch('/:id', validate(schemas.idParam, 'params'), validate(schemas.orderUpdate), idempotencyMiddleware(), adminUpdateOrder);
adminRouter.delete('/:id', validate(schemas.idParam, 'params'), idempotencyMiddleware(), adminDeleteOrder);
adminRouter.post('/:id/reminder', validate(schemas.idParam, 'params'), idempotencyMiddleware(), adminSendOrderReminder);

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
router.post(
  '/wallet-checkout',
  idempotencyMiddleware(),
  walletCheckoutOrder
);
// "Ask a friend to pay" (sponsored payment)
router.get('/sponsor/resolve', resolveSponsorPayer);
router.get('/sponsor/incoming', listIncomingSponsorships);
router.get('/sponsor/sent', listSentSponsorships);
router.post(
  '/sponsor/:groupId/respond',
  validate(schemas.sponsorshipRespond),
  idempotencyMiddleware(),
  respondSponsorship
);
router.post('/sponsor/:groupId/cancel', idempotencyMiddleware(), cancelSponsorship);
router.post(
  '/sponsor/:groupId/retry',
  validate(schemas.sponsorshipRetry),
  idempotencyMiddleware(),
  retrySponsorship
);
router.post(
  '/sponsor/:groupId/pay-self',
  validate(schemas.sponsorshipPaySelf),
  idempotencyMiddleware(),
  paySelfSponsorship
);
router.get('/installment/eligibility', getInstallmentEligibility);
router.post(
  '/:id/installment/payments/:scheduleIndex/proof',
  validate(schemas.installmentScheduleParam, 'params'),
  validate(schemas.installmentPaymentProofSubmit),
  idempotencyMiddleware(),
  uploadInstallmentPaymentProof
);
router.patch(
  '/seller/:id/installment/confirm-sale',
  validate(schemas.idParam, 'params'),
  validate(schemas.installmentSaleConfirmation),
  idempotencyMiddleware(),
  sellerConfirmInstallmentSale
);
router.patch(
  '/seller/:id/installment/payments/:scheduleIndex/validate',
  validate(schemas.installmentScheduleParam, 'params'),
  validate(schemas.installmentPaymentValidation),
  idempotencyMiddleware(),
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
router.post('/inquiry', idempotencyMiddleware(), validate(schemas.orderInquiry), createInquiryOrder);
router.post('/draft', idempotencyMiddleware(), saveDraftOrder);
router.get('/draft', getDraftOrders);
router.delete('/draft/:id', validate(schemas.idParam, 'params'), deleteDraftOrder);
router.get('/summary', orderCacheUser(45000), userOrdersSummary);
router.get('/seller/summary', orderCacheSeller(45000), sellerOrdersSummary);
router.get('/seller', orderCacheSeller(45000), sellerListOrders);
router.get(
  '/detail/:id',
  orderCacheUser(30000),
  validate(schemas.idParam, 'params'),
  getUserOrder
);
router.get(
  '/seller/detail/:id',
  orderCacheSeller(30000),
  validate(schemas.idParam, 'params'),
  sellerGetOrder
);
router.patch(
  '/seller/:id/delivery-fee',
  validate(schemas.idParam, 'params'),
  validate(schemas.sellerDeliveryFeeUpdate, 'body'),
  idempotencyMiddleware(),
  sellerUpdateOrderDeliveryFee
);
router.post(
  '/seller/:id/delivery-proof',
  validate(schemas.idParam, 'params'),
  deliveryProofUpload.array('deliveryProofImages', 5),
  validate(schemas.deliveryProofSubmit),
  idempotencyMiddleware(),
  sellerSubmitDeliveryProof
);
router.post(
  '/seller/:id/confirmation-reminder',
  validate(schemas.idParam, 'params'),
  idempotencyMiddleware(),
  sellerSendClientConfirmationReminder
);
router.post(
  '/:id/confirm-delivery',
  idempotencyMiddleware(),
  validate(schemas.idParam, 'params'),
  validate(schemas.deliveryConfirm),
  clientConfirmDelivery
);
router.get('/:id/delivery-logs', validate(schemas.idParam, 'params'), getOrderDeliveryLogs);
router.get('/:id/tracking', protect, validate(schemas.idParam, 'params'), getOrderTracking);
router.post(
  '/:id/request-delivery',
  validate(schemas.idParam, 'params'),
  validate(schemas.orderRequestDelivery),
  idempotencyMiddleware(),
  requestPlatformDeliveryForOrder
);
router.post(
  '/:id/delivery-pin',
  validate(schemas.idParam, 'params'),
  validate(schemas.sellerDeliveryPinUpdate),
  idempotencyMiddleware(),
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
  idempotencyMiddleware(),
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
  upload.single('refundProof'),
  idempotencyMiddleware(),
  validate(schemas.idParam, 'params'),
  validate(schemas.sellerCancelOrder),
  sellerCancelOrder
);
// Order messages routes (must be before /:id routes to avoid conflicts)
router.get('/messages/conversations', getAllOrderConversations);
router.get('/messages/unread', getUnreadCount);
router.post('/:id/archive', validate(schemas.idParam, 'params'), idempotencyMiddleware(), archiveOrderConversation);
router.post('/:id/unarchive', validate(schemas.idParam, 'params'), idempotencyMiddleware(), unarchiveOrderConversation);
router.post('/:id/delete', validate(schemas.idParam, 'params'), idempotencyMiddleware(), deleteOrderConversation);

router.get('/', orderCacheUser(45000), userListOrders);
router.get('/:id/review-reminder-check', validate(schemas.idParam, 'params'), checkOrderReviewReminderStatus);
router.get('/:id/review', validate(schemas.idParam, 'params'), getBuyerOrderReviewPage);
router.post(
  '/:id/review/action',
  validate(schemas.idParam, 'params'),
  validate(schemas.orderReviewReminderAction),
  idempotencyMiddleware(),
  updateBuyerOrderReviewReminder
);

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
