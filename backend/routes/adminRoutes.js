import express from 'express';
import Joi from 'joi';
import { protect } from '../middlewares/authMiddleware.js';
import { requireRole, requireFeedbackAccess, requirePaymentVerification, requireBoostManagement, requireComplaintAccess, requireDeliveryAccess } from '../middlewares/roleMiddleware.js';
import { validate, schemas } from '../middlewares/validate.js';
import { cacheMiddleware } from '../utils/cache.js';
import { upload } from '../utils/upload.js';
import { idempotencyMiddleware } from '../middlewares/idempotencyMiddleware.js';
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
  getUserAuditLogs,
  getCacheStatsAdmin,
  listProductManagers,
  toggleProductManager,
  listDeliveryManagers,
  toggleDeliveryManager,
  promoteUserToDeliveryGuy,
  unlinkUserFromDeliveryGuy,
  reviewShopLocation,
  getShopLocationTimeline,
  listChatTemplateManagers,
  toggleChatTemplateManager,
  setUserPassword,
  reviewAccountReactivation
} from '../controllers/adminController.js';
import { getAdminUserStats } from '../controllers/userController.js';
import {
  listBoostPricingAdmin,
  upsertBoostPricingAdmin,
  listSeasonalPricingAdmin,
  createSeasonalPricingAdmin,
  listBoostRequestsAdmin,
  updateBoostRequestStatusAdmin,
  getBoostRevenueDashboardAdmin
} from '../controllers/boostController.js';
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
  createProhibitedWord,
  listProhibitedWords,
  deleteProhibitedWord
} from '../controllers/prohibitedWordController.js';
import {
  createChatTemplate,
  sendSupportMessage
} from '../controllers/chatController.js';
import { updateAppFavicon, updateAppIcon, updateAppLogoDesktop, updateAppLogoMobile, updateHeroBanner, updatePromoBanner, updateSplash } from '../controllers/siteSettingController.js';
import {
  listDeliveryGuysAdmin,
  createDeliveryGuyAdmin,
  updateDeliveryGuyAdmin,
  deleteDeliveryGuyAdmin
} from '../controllers/deliveryGuyController.js';
import {
  listAdminDeliveryRequests,
  getAdminDeliveryAnalytics,
  createDeliveryRequestForOrderAdmin,
  acceptAdminDeliveryRequest,
  rejectAdminDeliveryRequest,
  assignAdminDeliveryRequest,
  unassignAdminDeliveryRequest,
  updateAdminDeliveryRequestPrice,
  updateAdminDeliveryRequestCoordinates,
  submitPickupProofAdmin,
  submitDeliveryProofAdmin
} from '../controllers/deliveryRequestController.js';
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
import {
  getOnlineStatsAdmin,
  getRealtimeMonitoringAdmin
} from '../controllers/realtimeAnalyticsController.js';
import {
  listReportsAdmin as listContentReportsAdmin,
  updateReportStatus as updateContentReportStatus
} from '../controllers/contentReportController.js';
import { getAdminSettings, updateAdminSetting } from '../controllers/settingsController.js';
import {
  getAdminRuntimeSettings,
  getAdminFeatureFlags,
  patchAdminRuntimeSetting,
  patchAdminFeatureFlag
} from '../controllers/configController.js';
import {
  listAdminPromoCodes,
  getAdminPromoAnalytics,
  getAdminPromoUsage,
  generateAdminPromoCode,
  createAdminPromoCode,
  updateAdminPromoCode,
  toggleAdminPromoCode
} from '../controllers/marketplacePromoCodeController.js';
import {
  getAdminCategoryTree,
  getCategoryAuditAdmin,
  createCategoryAdmin,
  updateCategoryAdmin,
  softDeleteCategoryAdmin,
  restoreCategoryAdmin,
  reorderCategoriesAdmin,
  importCategoriesAdmin,
  exportCategoriesAdmin,
  reassignCategoryProductsAdmin
} from '../controllers/categoryController.js';
import {
  getAdminTaskSummary,
  listRoleValidationTasks,
  markRoleValidationTaskDone
} from '../controllers/taskCenterController.js';
import {
  listCommunesAdmin,
  createCommuneAdmin,
  updateCommuneAdmin,
  deleteCommuneAdmin
} from '../controllers/communeController.js';
import {
  listCitiesAdmin,
  createCityAdmin,
  updateCityAdmin,
  deleteCityAdmin
} from '../controllers/cityController.js';

const router = express.Router();
const adminMutationIdempotency = idempotencyMiddleware({ ttlMs: 10 * 60 * 1000 });

// Online presence stats - must be registered early (same access as dashboard)
router.get('/online-stats', protect, (req, res, next) => {
  const isAdminManagerOrFounder = ['admin', 'manager', 'founder'].includes(req.user?.role);
  const canVerifyPayments = req.user?.canVerifyPayments === true;
  if (!isAdminManagerOrFounder && !canVerifyPayments) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  next();
}, getOnlineStatsAdmin);

router.get('/realtime-monitoring', protect, (req, res, next) => {
  const isAdminManagerOrFounder = ['admin', 'manager', 'founder'].includes(req.user?.role);
  const canVerifyPayments = req.user?.canVerifyPayments === true;
  if (!isAdminManagerOrFounder && !canVerifyPayments) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  next();
}, getRealtimeMonitoringAdmin);

// Cache stats - admin/founder only (ensureAdminRole inside controller)
router.get('/cache/stats', protect, requireRole(['admin', 'founder']), getCacheStatsAdmin);
router.get('/tasks/summary', protect, getAdminTaskSummary);
router.get('/tasks/validation', protect, listRoleValidationTasks);
router.patch(
  '/tasks/validation/:id/done',
  protect,
  validate(schemas.idParam, 'params'),
  markRoleValidationTaskDone
);

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
  validate(Joi.object({
    message: Joi.when('dryRun', {
      is: true,
      then: Joi.string().max(2000).allow(''),
      otherwise: Joi.string().min(1).max(2000).required()
    }),
    title: Joi.string().max(200).allow(''),
    target: Joi.string().valid('all', 'person', 'shop').default('all'),
    gender: Joi.string().valid('all', 'homme', 'femme').default('all'),
    city: Joi.string().trim().max(100).allow('').default(''),
    shopId: Joi.string().hex().length(24).allow('').default(''),
    actionLabel: Joi.string().trim().max(80).allow('').default(''),
    dryRun: Joi.boolean().default(false)
  })),
  broadcastNotification
);

// Stats endpoint - accessible by admin, manager, founder, or users with payment verification access
router.get('/stats', protect, (req, res, next) => {
  const isAdminManagerOrFounder = ['admin', 'manager', 'founder'].includes(req.user?.role);
  const canVerifyPayments = req.user?.canVerifyPayments === true;
  if (!isAdminManagerOrFounder && !canVerifyPayments) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  next();
}, cacheMiddleware({ ttl: 60000 }), getDashboardStats);

// Boost management routes - accessible by admin OR users with canManageBoosts permission
// These must be defined BEFORE the router.use() that requires admin/manager role
router.get('/products/boosts', protect, requireBoostManagement, listBoostProductCandidatesAdmin);
router.get('/products/boosts/stats', protect, requireBoostManagement, getBoostStatistics);
router.patch('/products/:id/boost', protect, requireBoostManagement, validate(schemas.idParam, 'params'), adminMutationIdempotency, toggleProductBoost);
router.get('/shops/boosts', protect, requireBoostManagement, listBoostShopCandidatesAdmin);
router.get('/shops/boosts/stats', protect, requireBoostManagement, getShopBoostStatistics);
router.patch('/shops/:id/boost', protect, requireBoostManagement, validate(schemas.idParam, 'params'), adminMutationIdempotency, toggleShopBoost);
router.get('/boost-managers', protect, requireRole(['admin']), listBoostManagers);
router.patch(
  '/boost-managers/:userId/toggle',
  protect,
  requireRole(['admin']),
  validate(Joi.object({ userId: Joi.string().hex().length(24).required() }), 'params'),
  adminMutationIdempotency,
  toggleBoostManager
);
router.get('/boost-pricing', protect, requireBoostManagement, listBoostPricingAdmin);
router.post('/boost-pricing', protect, requireBoostManagement, adminMutationIdempotency, upsertBoostPricingAdmin);
router.get('/seasonal-pricing', protect, requireBoostManagement, listSeasonalPricingAdmin);
router.post('/seasonal-pricing', protect, requireBoostManagement, adminMutationIdempotency, createSeasonalPricingAdmin);
router.get('/boost-requests', protect, requireBoostManagement, listBoostRequestsAdmin);
router.patch(
  '/boost-requests/:id/status',
  protect,
  requireBoostManagement,
  validate(schemas.idParam, 'params'),
  validate(
    Joi.object({
      status: Joi.string().valid('PENDING', 'APPROVED', 'REJECTED', 'ACTIVE', 'EXPIRED').required(),
      rejectionReason: Joi.string().max(500).allow('', null)
    }),
    'body'
  ),
  adminMutationIdempotency,
  updateBoostRequestStatusAdmin
);
router.get('/boosts/revenue-dashboard', protect, requireBoostManagement, getBoostRevenueDashboardAdmin);

// Complaint access - admin, manager, or canManageComplaints
router.get('/complaints', protect, requireComplaintAccess, listComplaintsAdmin);
router.patch(
  '/complaints/:id/status',
  protect,
  requireComplaintAccess,
  validate(schemas.idParam, 'params'),
  validate(schemas.complaintStatusUpdate),
  adminMutationIdempotency,
  updateComplaintStatus
);
// Complaint managers - admin only
router.get('/complaint-managers', protect, requireRole(['admin']), listComplaintManagers);
router.patch(
  '/complaint-managers/:userId/toggle',
  protect,
  requireRole(['admin']),
  validate(Joi.object({ userId: Joi.string().hex().length(24).required() }), 'params'),
  adminMutationIdempotency,
  toggleComplaintManager
);

// All other admin routes require admin/manager access. Delivery managers may only
// enter the delivery-request workflow and read the courier directory used for assignment.
router.use(protect, (req, res, next) => {
  const path = String(req.path || '');
  const isDeliveryRequestPath = /^\/delivery-requests(?:\/|$)/.test(path);
  const isCourierDirectoryRead = req.method === 'GET' && path === '/delivery-guys';
  if (isDeliveryRequestPath || isCourierDirectoryRead) {
    return requireDeliveryAccess(req, res, next);
  }
  return requireRole(['admin', 'manager'])(req, res, next);
});
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
  adminMutationIdempotency,
  updateUserAccountType
);
router.patch(
  '/users/:id/block', 
  validate(schemas.idParam, 'params'),
  validate(schemas.adminBlockUser),
  adminMutationIdempotency,
  blockUser
);
router.patch(
  '/users/:id/unblock',
  validate(schemas.idParam, 'params'),
  adminMutationIdempotency,
  unblockUser
);
router.patch(
  '/users/:id/reactivation-request',
  validate(schemas.idParam, 'params'),
  validate(
    Joi.object({
      decision: Joi.string().valid('approve', 'reject').required(),
      note: Joi.string().max(500).allow('', null)
    }),
    'body'
  ),
  adminMutationIdempotency,
  reviewAccountReactivation
);
router.patch(
  '/users/:id/shop-verification',
  validate(schemas.idParam, 'params'),
  validate(schemas.adminShopVerification),
  adminMutationIdempotency,
  updateShopVerification
);
router.patch(
  '/users/:id/role',
  validate(schemas.idParam, 'params'),
  validate(schemas.adminUserRole),
  adminMutationIdempotency,
  updateUserRole
);
router.post(
  '/users/:id/promote-delivery-guy',
  validate(schemas.idParam, 'params'),
  adminMutationIdempotency,
  promoteUserToDeliveryGuy
);
router.post(
  '/users/:id/unlink-delivery-guy',
  validate(schemas.idParam, 'params'),
  adminMutationIdempotency,
  unlinkUserFromDeliveryGuy
);
router.post(
  '/users/:id/set-password',
  validate(schemas.idParam, 'params'),
  validate(
    Joi.object({
      newPassword: Joi.string().min(6).max(200).required(),
      forceLogout: Joi.boolean().optional()
    }),
    'body'
  ),
  adminMutationIdempotency,
  setUserPassword
);
router.patch(
  '/users/:id/shop-location-review',
  validate(schemas.idParam, 'params'),
  validate(Joi.object({ decision: Joi.string().valid('approve', 'reject').required(), reason: Joi.string().max(500).allow('', null) }), 'body'),
  adminMutationIdempotency,
  reviewShopLocation
);
router.get('/users/:id/shop-location-timeline', validate(schemas.idParam, 'params'), getShopLocationTimeline);
// User restrictions management
router.get('/users/:id/restrictions', validate(schemas.idParam, 'params'), getUserRestrictions);
router.patch('/users/:id/restrictions/:type', validate(schemas.restrictionParam, 'params'), adminMutationIdempotency, setUserRestriction);
router.delete('/users/:id/restrictions/:type', validate(schemas.restrictionParam, 'params'), adminMutationIdempotency, removeUserRestriction);
// Seller received orders
router.get('/users/:id/received-orders', validate(schemas.idParam, 'params'), getSellerReceivedOrders);
// User audit logs
router.get('/users/:id/audit-logs', validate(schemas.idParam, 'params'), getUserAuditLogs);
// Global audit logs
router.get('/audit-logs', listAuditLogs);
router.get('/shops/verified', listVerifiedShopsAdmin);
router.post('/products/update-sales-count', adminMutationIdempotency, updateAllProductSalesCount);
router.get('/products', listAdminProducts);
router.get('/products/:id/history', validate(schemas.idParam, 'params'), getProductHistory);
router.patch(
  '/products/:id/certify',
  validate(schemas.idParam, 'params'),
  validate(schemas.adminProductCertification),
  adminMutationIdempotency,
  certifyProduct
);
router.post('/chat/templates', adminMutationIdempotency, createChatTemplate);
router.post('/chat/support-message', adminMutationIdempotency, sendSupportMessage);
router.get('/chat-template-managers', listChatTemplateManagers);
router.patch(
  '/chat-template-managers/:userId/toggle',
  validate(Joi.object({ userId: Joi.string().hex().length(24).required() }), 'params'),
  adminMutationIdempotency,
  toggleChatTemplateManager
);
router.get('/prohibited-words', listProhibitedWords);
router.post(
  '/prohibited-words',
  validate(schemas.prohibitedWordCreate),
  adminMutationIdempotency,
  createProhibitedWord
);
router.delete('/prohibited-words/:id', validate(schemas.idParam, 'params'), adminMutationIdempotency, deleteProhibitedWord);
router.get('/content-reports', listContentReportsAdmin);
router.patch(
  '/content-reports/:id/status',
  validate(schemas.idParam, 'params'),
  validate(
    Joi.object({
      status: Joi.string().valid('pending', 'reviewed', 'resolved', 'dismissed').required(),
      adminNote: Joi.string().max(1000).optional()
    }),
    'body'
  ),
  adminMutationIdempotency,
  updateContentReportStatus
);
router.get('/settings', getAdminSettings);
router.patch('/settings/:key', adminMutationIdempotency, updateAdminSetting);
router.get('/config/runtime', getAdminRuntimeSettings);
router.get('/config/feature-flags', getAdminFeatureFlags);
router.patch('/config/runtime/:key', adminMutationIdempotency, patchAdminRuntimeSetting);
router.patch('/config/feature-flags/:featureName', adminMutationIdempotency, patchAdminFeatureFlag);
router.get('/categories/tree', getAdminCategoryTree);
router.get('/categories/audit', getCategoryAuditAdmin);
router.get('/categories/export', exportCategoriesAdmin);
router.post('/categories', adminMutationIdempotency, createCategoryAdmin);
router.post('/categories/reorder', adminMutationIdempotency, reorderCategoriesAdmin);
router.post('/categories/import', adminMutationIdempotency, importCategoriesAdmin);
router.post('/categories/reassign-products', adminMutationIdempotency, reassignCategoryProductsAdmin);
router.patch('/categories/:id', validate(schemas.idParam, 'params'), adminMutationIdempotency, updateCategoryAdmin);
router.post('/categories/:id/soft-delete', validate(schemas.idParam, 'params'), adminMutationIdempotency, softDeleteCategoryAdmin);
router.post('/categories/:id/restore', validate(schemas.idParam, 'params'), adminMutationIdempotency, restoreCategoryAdmin);
router.put('/hero-banner', upload.single('heroBanner'), adminMutationIdempotency, updateHeroBanner);
router.put('/app-logo/desktop', upload.single('appLogoDesktop'), adminMutationIdempotency, updateAppLogoDesktop);
router.put('/app-logo/mobile', upload.single('appLogoMobile'), adminMutationIdempotency, updateAppLogoMobile);
router.put('/app-logo/icon', upload.single('appIcon'), adminMutationIdempotency, updateAppIcon);
router.put('/app-logo/favicon', upload.single('appFavicon'), adminMutationIdempotency, updateAppFavicon);
router.put(
  '/promo-banner',
  upload.fields([
    { name: 'promoBanner', maxCount: 1 },
    { name: 'promoBannerMobile', maxCount: 1 }
  ]),
  adminMutationIdempotency,
  updatePromoBanner
);
router.put('/splash', upload.single('splashImage'), adminMutationIdempotency, updateSplash);
router.get('/delivery-guys', listDeliveryGuysAdmin);
router.post(
  '/delivery-guys',
  validate(schemas.deliveryGuyCreate),
  adminMutationIdempotency,
  createDeliveryGuyAdmin
);
router.patch(
  '/delivery-guys/:id',
  validate(schemas.idParam, 'params'),
  validate(schemas.deliveryGuyUpdate),
  adminMutationIdempotency,
  updateDeliveryGuyAdmin
);
router.delete('/delivery-guys/:id', validate(schemas.idParam, 'params'), adminMutationIdempotency, deleteDeliveryGuyAdmin);
// Product managers (users with canManageProducts)
router.get('/product-managers', listProductManagers);
router.patch(
  '/product-managers/:userId/toggle',
  validate(Joi.object({ userId: Joi.string().hex().length(24).required() }), 'params'),
  adminMutationIdempotency,
  toggleProductManager
);
// Delivery managers (users with canManageDelivery) - admin/founder only
router.get('/delivery-managers', listDeliveryManagers);
router.patch(
  '/delivery-managers/:userId/toggle',
  validate(Joi.object({ userId: Joi.string().hex().length(24).required() }), 'params'),
  adminMutationIdempotency,
  toggleDeliveryManager
);
// Delivery requests (platform delivery) - list, analytics, and actions
router.get('/delivery-requests', listAdminDeliveryRequests);
router.get('/delivery-requests/analytics', getAdminDeliveryAnalytics);
router.post(
  '/delivery-requests/create-for-order/:id',
  validate(schemas.idParam, 'params'),
  adminMutationIdempotency,
  createDeliveryRequestForOrderAdmin
);
router.patch(
  '/delivery-requests/:id/accept',
  validate(schemas.idParam, 'params'),
  validate(schemas.adminDeliveryRequestAccept),
  adminMutationIdempotency,
  acceptAdminDeliveryRequest
);
router.patch(
  '/delivery-requests/:id/reject',
  validate(schemas.idParam, 'params'),
  validate(schemas.adminDeliveryRequestReject),
  adminMutationIdempotency,
  rejectAdminDeliveryRequest
);
router.patch(
  '/delivery-requests/:id/assign-delivery-guy',
  validate(schemas.idParam, 'params'),
  validate(schemas.adminDeliveryRequestAssign),
  adminMutationIdempotency,
  assignAdminDeliveryRequest
);
router.patch(
  '/delivery-requests/:id/unassign',
  validate(schemas.idParam, 'params'),
  validate(schemas.adminDeliveryRequestUnassign),
  adminMutationIdempotency,
  unassignAdminDeliveryRequest
);
router.patch(
  '/delivery-requests/:id/price',
  validate(schemas.idParam, 'params'),
  validate(schemas.adminDeliveryRequestPriceUpdate),
  adminMutationIdempotency,
  updateAdminDeliveryRequestPrice
);
router.patch(
  '/delivery-requests/:id/coordinates',
  validate(schemas.idParam, 'params'),
  validate(schemas.adminDeliveryRequestCoordinates),
  adminMutationIdempotency,
  updateAdminDeliveryRequestCoordinates
);
router.patch(
  '/delivery-requests/:id/pickup-proof',
  validate(schemas.idParam, 'params'),
  upload.fields([{ name: 'photos', maxCount: 4 }, { name: 'signatureFile', maxCount: 1 }]),
  adminMutationIdempotency,
  submitPickupProofAdmin
);
router.patch(
  '/delivery-requests/:id/delivery-proof',
  validate(schemas.idParam, 'params'),
  upload.fields([{ name: 'photos', maxCount: 4 }, { name: 'signatureFile', maxCount: 1 }]),
  adminMutationIdempotency,
  submitDeliveryProofAdmin
);
// Admin promo codes (marketplace)
router.get('/promo-codes', listAdminPromoCodes);
router.get('/promo-codes/analytics', getAdminPromoAnalytics);
router.get('/promo-codes/usage', getAdminPromoUsage);
router.post('/promo-codes/generate', adminMutationIdempotency, generateAdminPromoCode);
router.post('/promo-codes', adminMutationIdempotency, createAdminPromoCode);
router.patch('/promo-codes/:id', validate(schemas.idParam, 'params'), adminMutationIdempotency, updateAdminPromoCode);
router.patch('/promo-codes/:id/toggle', validate(schemas.idParam, 'params'), adminMutationIdempotency, toggleAdminPromoCode);
// Shop conversion requests - admin only
router.get('/shop-conversion-requests', protect, requireRole(['admin']), getAllShopConversionRequests);
router.get('/shop-conversion-requests/:id', protect, requireRole(['admin']), validate(schemas.idParam, 'params'), getShopConversionRequest);
router.patch('/shop-conversion-requests/:id/approve', protect, requireRole(['admin']), validate(schemas.idParam, 'params'), adminMutationIdempotency, approveShopConversionRequest);
router.patch('/shop-conversion-requests/:id/reject', protect, requireRole(['admin']), validate(schemas.idParam, 'params'), adminMutationIdempotency, rejectShopConversionRequest);
// Network settings - admin only
router.get('/networks', protect, requireRole(['admin']), getAllNetworks);
router.post('/networks', protect, requireRole(['admin']), adminMutationIdempotency, createNetwork);
router.patch('/networks/:id', protect, requireRole(['admin']), validate(schemas.idParam, 'params'), adminMutationIdempotency, updateNetwork);
router.delete('/networks/:id', protect, requireRole(['admin']), validate(schemas.idParam, 'params'), adminMutationIdempotency, deleteNetwork);

// Commune admin CRUD
router.get('/communes', listCommunesAdmin);
router.post('/communes', adminMutationIdempotency, createCommuneAdmin);
router.patch('/communes/:id', validate(schemas.idParam, 'params'), adminMutationIdempotency, updateCommuneAdmin);
router.delete('/communes/:id', validate(schemas.idParam, 'params'), adminMutationIdempotency, deleteCommuneAdmin);

// City admin CRUD
router.get('/cities', listCitiesAdmin);
router.post('/cities', adminMutationIdempotency, createCityAdmin);
router.patch('/cities/:id', validate(schemas.idParam, 'params'), adminMutationIdempotency, updateCityAdmin);
router.delete('/cities/:id', validate(schemas.idParam, 'params'), adminMutationIdempotency, deleteCityAdmin);

export default router;
