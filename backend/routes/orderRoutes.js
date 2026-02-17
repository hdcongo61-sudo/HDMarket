import express from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import { requireRole } from '../middlewares/roleMiddleware.js';
import { validate, schemas } from '../middlewares/validate.js';
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
  sellerUpdateOrderStatus,
  sellerCancelOrder,
  saveDraftOrder,
  getDraftOrders,
  deleteDraftOrder,
  createInquiryOrder
} from '../controllers/orderController.js';
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
adminRouter.delete('/:id', validate(schemas.idParam, 'params'), adminDeleteOrder);
adminRouter.post('/:id/reminder', validate(schemas.idParam, 'params'), adminSendOrderReminder);

router.use('/admin', adminRouter);

router.post('/checkout', validate(schemas.orderCheckout), userCheckoutOrder);
router.post(
  '/installment/checkout',
  validate(schemas.installmentCheckout),
  checkoutInstallmentOrder
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
router.get('/seller/installment/analytics', sellerInstallmentAnalytics);
router.post('/inquiry', validate(schemas.orderInquiry), createInquiryOrder);
router.post('/draft', saveDraftOrder);
router.get('/draft', getDraftOrders);
router.delete('/draft/:id', validate(schemas.idParam, 'params'), deleteDraftOrder);
router.get('/seller', sellerListOrders);
router.get('/detail/:id', validate(schemas.idParam, 'params'), getUserOrder);
router.get('/seller/detail/:id', validate(schemas.idParam, 'params'), sellerGetOrder);
router.patch(
  '/:id/status',
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
  validate(schemas.idParam, 'params'),
  userSkipCancellationWindow
);
router.patch(
  '/seller/:id/status',
  validate(schemas.idParam, 'params'),
  validate(schemas.sellerOrderStatusUpdate),
  sellerUpdateOrderStatus
);
router.post(
  '/seller/:id/cancel',
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

router.get('/', userListOrders);
router.get('/:id/review-reminder-check', validate(schemas.idParam, 'params'), checkOrderReviewReminderStatus);

// Order messages routes for specific order
router.get('/:orderId/messages', getOrderMessages);
router.post(
  '/:orderId/messages',
  validate(schemas.orderMessage),
  sendOrderMessage
);
router.patch('/:orderId/messages/:messageId', validate(schemas.orderMessageUpdate, 'body'), updateOrderMessage);
router.delete('/:orderId/messages/:messageId', deleteOrderMessage);
router.post('/messages/upload', chatUpload.single('file'), uploadOrderMessageAttachment);
router.post('/messages/:messageId/reactions', addOrderMessageReaction);
router.delete('/messages/:messageId/reactions', removeOrderMessageReaction);

export default router;
