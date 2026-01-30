import express from 'express';
import Joi from 'joi';
import { protect } from '../middlewares/authMiddleware.js';
import { requireRole, requireFeedbackAccess, requirePaymentVerification, requireBoostManagement } from '../middlewares/roleMiddleware.js';
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
  getSalesTrends,
  getOrderHeatmap,
  getConversionMetrics,
  getCohortAnalysis,
  getOrdersByHour
} from '../controllers/adminController.js';
import { getAdminUserStats } from '../controllers/userController.js';
import {
  listBoostProductCandidatesAdmin,
  toggleProductBoost,
  getBoostStatistics,
  certifyProduct,
  listAdminProducts
} from '../controllers/productController.js';
import {
  listComplaintsAdmin,
  updateComplaintStatus
} from '../controllers/complaintController.js';
import {
  createProhibitedWord,
  listProhibitedWords,
  deleteProhibitedWord
} from '../controllers/prohibitedWordController.js';
import {
  createChatTemplate,
  sendSupportMessage
} from '../controllers/chatController.js';
import { updateAppLogoDesktop, updateAppLogoMobile, updateHeroBanner, updatePromoBanner } from '../controllers/siteSettingController.js';
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
router.get('/boost-managers', protect, requireRole(['admin']), listBoostManagers);
router.patch(
  '/boost-managers/:userId/toggle',
  protect,
  requireRole(['admin']),
  validate(Joi.object({ userId: Joi.string().hex().length(24).required() }), 'params'),
  toggleBoostManager
);

// All other admin routes - require admin or manager role
router.use(protect, requireRole(['admin', 'manager']));
router.get('/analytics/sales-trends', cacheMiddleware({ ttl: 300000 }), getSalesTrends);
router.get('/analytics/order-heatmap', cacheMiddleware({ ttl: 300000 }), getOrderHeatmap);
router.get('/analytics/conversion', cacheMiddleware({ ttl: 300000 }), getConversionMetrics);
router.get('/analytics/cohorts', cacheMiddleware({ ttl: 300000 }), getCohortAnalysis);
router.get('/analytics/orders-by-hour', getOrdersByHour);
router.get('/users', listUsers);
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
router.get('/shops/verified', listVerifiedShopsAdmin);
router.post('/products/update-sales-count', updateAllProductSalesCount);
router.get('/products', listAdminProducts);
router.patch(
  '/products/:id/certify',
  validate(schemas.idParam, 'params'),
  validate(schemas.adminProductCertification),
  certifyProduct
);
router.get('/complaints', listComplaintsAdmin);
router.post('/chat/templates', createChatTemplate);
router.post('/chat/support-message', sendSupportMessage);
router.patch(
  '/complaints/:id/status',
  validate(schemas.idParam, 'params'),
  validate(schemas.complaintStatusUpdate),
  updateComplaintStatus
);
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
router.get('/delivery-guys', listDeliveryGuysAdmin);
router.post(
  '/delivery-guys',
  validate(schemas.deliveryGuyCreate),
  createDeliveryGuyAdmin
);
router.patch(
  '/delivery-guys/:id',
  validate(schemas.idParam, 'params'),
  validate(schemas.deliveryGuyUpdate),
  updateDeliveryGuyAdmin
);
router.delete('/delivery-guys/:id', validate(schemas.idParam, 'params'), deleteDeliveryGuyAdmin);

export default router;
