import express from 'express';
import Joi from 'joi';
import { protect } from '../middlewares/authMiddleware.js';
import { requireRole, requireFeedbackAccess, requirePaymentVerification, requireBoostManagement, requireComplaintAccess, requireDeliveryAccess, requireProductAccess } from '../middlewares/roleMiddleware.js';
import { validate, schemas } from '../middlewares/validate.js';
import { cacheMiddleware } from '../utils/cache.js';
import { upload } from '../utils/upload.js';
import {
  getDashboardStats,
  listUsers,
  updateUserAccountType,
  getUserAccountTypeHistory,
  blockUser,
  unblockUser,
  updateShopVerification,
  listVerifiedShopsAdmin,
  updateUserRole,
  updateAllProductSalesCount,
  listPaymentVerifiers,
  togglePaymentVerifier,
  listBoostManagers,
  toggleBoostManager,
  listComplaintManagers,
  toggleComplaintManager,
  listProductManagers,
  toggleProductManager,
  listDeliveryManagers,
  toggleDeliveryManager,
  listHelpCenterEditors,
  toggleHelpCenterEditor,
  getSalesTrends,
  getOrderHeatmap,
  getConversionMetrics,
  getCohortAnalysis,
  getOrdersByHour,
  broadcastNotification,
  exportPhones,
  getUserRestrictions,
  setUserRestriction,
  removeUserRestriction,
  getSellerReceivedOrders,
  listAuditLogs,
  getUserAuditLogs
} from '../controllers/adminController.js';
import { getAdminUserStats } from '../controllers/userController.js';
import {
  listBoostProductCandidatesAdmin,
  toggleProductBoost,
  getBoostStatistics,
  certifyProduct,
  listAdminProducts,
  getProductHistory
} from '../controllers/productController.js';
import {
  listBoostShopCandidatesAdmin,
  toggleShopBoost,
  getShopBoostStatistics
} from '../controllers/shopController.js';
import {
  listComplaintsAdmin,
  updateComplaintStatus
} from '../controllers/complaintController.js';
import {
  listReportsAdmin,
  updateReportStatus
} from '../controllers/contentReportController.js';
import {
  deleteCommentAdmin
} from '../controllers/commentController.js';
import {
  createProhibitedWord,
  listProhibitedWords,
  deleteProhibitedWord
} from '../controllers/prohibitedWordController.js';
import {
  createChatTemplate,
  sendSupportMessage
} from '../controllers/chatController.js';
import { updateAppLogoDesktop, updateAppLogoMobile, updateHeroBanner, updatePromoBanner, updateSplash } from '../controllers/siteSettingController.js';
import {
  listDeliveryGuysAdmin,
  createDeliveryGuyAdmin,
  updateDeliveryGuyAdmin,
  deleteDeliveryGuyAdmin
} from '../controllers/deliveryGuyController.js';
import {
  listImprovementFeedbackAdmin,
  markImprovementFeedbackRead,
  exportFeedbackPDF,
  listFeedbackReaders,
  toggleFeedbackReader
} from '../controllers/feedbackController.js';
import { generateReport } from '../controllers/reportController.js';
import { triggerReviewReminders } from '../controllers/reviewReminderController.js';
import {
  getAllShopConversionRequests,
  getShopConversionRequest,
  approveShopConversionRequest,
  rejectShopConversionRequest
} from '../controllers/shopConversionController.js';
import {
  getAllNetworks,
  getActiveNetworks,
  createNetwork,
  updateNetwork,
  deleteNetwork
} from '../controllers/networkSettingController.js';

const router = express.Router();

// Feedback routes - accessible by admin OR users with canReadFeedback permission
router.get('/feedback', protect, requireFeedbackAccess, listImprovementFeedbackAdmin);
router.get('/feedback/export-pdf', protect, requireFeedbackAccess, exportFeedbackPDF);
router.get('/feedback-readers', protect, requireRole(['admin']), listFeedbackReaders);
router.patch(
  '/feedback/:id/read',
  protect,
  requireFeedbackAccess,
  validate(schemas.idParam, 'params'),
  markImprovementFeedbackRead
);
router.patch(
  '/feedback-readers/:userId/toggle',
  protect,
  requireRole(['admin']),
  validate(Joi.object({ userId: Joi.string().hex().length(24).required() }), 'params'),
  toggleFeedbackReader
);

// Payment verifier routes - admin only
router.get('/payment-verifiers', protect, requireRole(['admin']), listPaymentVerifiers);
router.patch(
  '/payment-verifiers/:userId/toggle',
  protect,
  requireRole(['admin']),
  validate(Joi.object({ userId: Joi.string().hex().length(24).required() }), 'params'),
  togglePaymentVerifier
);

// Reports - admin only
router.get('/reports', protect, requireRole(['admin']), generateReport);

// Review reminders - admin only
router.post('/review-reminders/send', protect, requireRole(['admin']), triggerReviewReminders);
router.post(
  '/notifications/broadcast',
  protect,
  requireRole(['admin']),
  validate(Joi.object({ message: Joi.string().min(1).max(2000).required(), title: Joi.string().max(200).allow(''), target: Joi.string().valid('all', 'person', 'shop') })),
  broadcastNotification
);

// Stats endpoint - accessible by admin, manager, or users with payment verification access
router.get('/stats', protect, (req, res, next) => {
  const isAdminOrManager = ['admin', 'manager'].includes(req.user?.role);
  const canVerifyPayments = req.user?.canVerifyPayments === true;
  if (!isAdminOrManager && !canVerifyPayments) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  next();
}, cacheMiddleware({ ttl: 60000 }), getDashboardStats);

// Boost management routes - accessible by admin OR users with canManageBoosts permission
// These must be defined BEFORE the router.use() that requires admin/manager role
router.get('/products/boosts', protect, requireBoostManagement, listBoostProductCandidatesAdmin);
router.get('/products/boosts/stats', protect, requireBoostManagement, getBoostStatistics);
router.patch('/products/:id/boost', protect, requireBoostManagement, validate(schemas.idParam, 'params'), toggleProductBoost);
router.get('/shops/boosts', protect, requireBoostManagement, listBoostShopCandidatesAdmin);
router.get('/shops/boosts/stats', protect, requireBoostManagement, getShopBoostStatistics);
router.patch('/shops/:id/boost', protect, requireBoostManagement, validate(schemas.idParam, 'params'), toggleShopBoost);
router.get('/boost-managers', protect, requireRole(['admin']), listBoostManagers);
router.patch(
  '/boost-managers/:userId/toggle',
  protect,
  requireRole(['admin']),
  validate(Joi.object({ userId: Joi.string().hex().length(24).required() }), 'params'),
  toggleBoostManager
);

// Complaint access - admin, manager, or canManageComplaints
router.get('/complaints', protect, requireComplaintAccess, listComplaintsAdmin);
router.patch(
  '/complaints/:id/status',
  protect,
  requireComplaintAccess,
  validate(schemas.idParam, 'params'),
  validate(schemas.complaintStatusUpdate),
  updateComplaintStatus
);
// Complaint managers - admin only
router.get('/complaint-managers', protect, requireRole(['admin']), listComplaintManagers);
router.patch(
  '/complaint-managers/:userId/toggle',
  protect,
  requireRole(['admin']),
  validate(Joi.object({ userId: Joi.string().hex().length(24).required() }), 'params'),
  toggleComplaintManager
);
// Product managers - admin only
router.get('/product-managers', protect, requireRole(['admin']), listProductManagers);
router.patch(
  '/product-managers/:userId/toggle',
  protect,
  requireRole(['admin']),
  validate(Joi.object({ userId: Joi.string().hex().length(24).required() }), 'params'),
  toggleProductManager
);
// Delivery managers - admin only
router.get('/delivery-managers', protect, requireRole(['admin']), listDeliveryManagers);
router.patch(
  '/delivery-managers/:userId/toggle',
  protect,
  requireRole(['admin']),
  validate(Joi.object({ userId: Joi.string().hex().length(24).required() }), 'params'),
  toggleDeliveryManager
);
// Help center editors - admin only
router.get('/help-center-editors', protect, requireRole(['admin']), listHelpCenterEditors);
router.patch(
  '/help-center-editors/:userId/toggle',
  protect,
  requireRole(['admin']),
  validate(Joi.object({ userId: Joi.string().hex().length(24).required() }), 'params'),
  toggleHelpCenterEditor
);
// Content reports - admin, manager, or canManageComplaints
router.get('/content-reports', protect, requireComplaintAccess, listReportsAdmin);
router.patch(
  '/content-reports/:id/status',
  protect,
  requireComplaintAccess,
  validate(schemas.idParam, 'params'),
  validate(schemas.reportStatusUpdate),
  updateReportStatus
);
// Comments - admin only
router.delete(
  '/comments/:id',
  protect,
  requireRole(['admin']),
  validate(schemas.idParam, 'params'),
  deleteCommentAdmin
);

// Products - admin, manager, or canManageProducts
router.get('/products', protect, requireProductAccess, listAdminProducts);
router.get(
  '/products/:id/history',
  protect,
  requireProductAccess,
  validate(schemas.idParam, 'params'),
  getProductHistory
);
router.patch(
  '/products/:id/certify',
  protect,
  requireProductAccess,
  validate(schemas.idParam, 'params'),
  validate(schemas.adminProductCertification),
  certifyProduct
);

// Delivery guys - admin, manager, or canManageDelivery
router.get('/delivery-guys', protect, requireDeliveryAccess, listDeliveryGuysAdmin);
router.post(
  '/delivery-guys',
  protect,
  requireDeliveryAccess,
  validate(schemas.deliveryGuyCreate),
  createDeliveryGuyAdmin
);
router.patch(
  '/delivery-guys/:id',
  protect,
  requireDeliveryAccess,
  validate(schemas.idParam, 'params'),
  validate(schemas.deliveryGuyUpdate),
  updateDeliveryGuyAdmin
);
router.delete(
  '/delivery-guys/:id',
  protect,
  requireDeliveryAccess,
  validate(schemas.idParam, 'params'),
  deleteDeliveryGuyAdmin
);

// All other admin routes - require admin or manager role
router.use(protect, requireRole(['admin', 'manager']));
router.get('/analytics/sales-trends', cacheMiddleware({ ttl: 300000 }), getSalesTrends);
router.get('/analytics/order-heatmap', cacheMiddleware({ ttl: 300000 }), getOrderHeatmap);
router.get('/analytics/conversion', cacheMiddleware({ ttl: 300000 }), getConversionMetrics);
router.get('/analytics/cohorts', cacheMiddleware({ ttl: 300000 }), getCohortAnalysis);
router.get('/analytics/orders-by-hour', getOrdersByHour);
router.get('/users', listUsers);
router.get('/users/export-phones', protect, requireRole(['admin']), exportPhones);
router.get('/users/:id/stats', validate(schemas.idParam, 'params'), getAdminUserStats);
router.get('/users/:userId/account-type-history', getUserAccountTypeHistory);
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
router.patch(
  '/users/:id/shop-verification',
  validate(schemas.idParam, 'params'),
  validate(schemas.adminShopVerification),
  updateShopVerification
);
router.patch(
  '/users/:id/role',
  validate(schemas.idParam, 'params'),
  validate(schemas.adminUserRole),
  updateUserRole
);
// User restrictions management
router.get('/users/:id/restrictions', validate(schemas.idParam, 'params'), getUserRestrictions);
router.patch('/users/:id/restrictions/:type', validate(schemas.restrictionParam, 'params'), setUserRestriction);
router.delete('/users/:id/restrictions/:type', validate(schemas.restrictionParam, 'params'), removeUserRestriction);
// Seller received orders
router.get('/users/:id/received-orders', validate(schemas.idParam, 'params'), getSellerReceivedOrders);
// User audit logs
router.get('/users/:id/audit-logs', validate(schemas.idParam, 'params'), getUserAuditLogs);
// Global audit logs
router.get('/audit-logs', listAuditLogs);
router.get('/shops/verified', listVerifiedShopsAdmin);
router.post('/products/update-sales-count', updateAllProductSalesCount);
router.post('/chat/templates', createChatTemplate);
router.post('/chat/support-message', sendSupportMessage);
router.get('/prohibited-words', listProhibitedWords);
router.post(
  '/prohibited-words',
  validate(schemas.prohibitedWordCreate),
  createProhibitedWord
);
router.delete('/prohibited-words/:id', validate(schemas.idParam, 'params'), deleteProhibitedWord);
router.put('/hero-banner', upload.single('heroBanner'), updateHeroBanner);
router.put('/app-logo/desktop', upload.single('appLogoDesktop'), updateAppLogoDesktop);
router.put('/app-logo/mobile', upload.single('appLogoMobile'), updateAppLogoMobile);
router.put(
  '/promo-banner',
  upload.fields([
    { name: 'promoBanner', maxCount: 1 },
    { name: 'promoBannerMobile', maxCount: 1 }
  ]),
  updatePromoBanner
);
router.put('/splash', upload.single('splashImage'), updateSplash);
// Shop conversion requests - admin only
router.get('/shop-conversion-requests', protect, requireRole(['admin']), getAllShopConversionRequests);
router.get('/shop-conversion-requests/:id', protect, requireRole(['admin']), validate(schemas.idParam, 'params'), getShopConversionRequest);
router.patch('/shop-conversion-requests/:id/approve', protect, requireRole(['admin']), validate(schemas.idParam, 'params'), approveShopConversionRequest);
router.patch('/shop-conversion-requests/:id/reject', protect, requireRole(['admin']), validate(schemas.idParam, 'params'), rejectShopConversionRequest);
// Network settings - admin only
router.get('/networks', protect, requireRole(['admin']), getAllNetworks);
router.post('/networks', protect, requireRole(['admin']), createNetwork);
router.patch('/networks/:id', protect, requireRole(['admin']), validate(schemas.idParam, 'params'), updateNetwork);
router.delete('/networks/:id', protect, requireRole(['admin']), validate(schemas.idParam, 'params'), deleteNetwork);

export default router;
