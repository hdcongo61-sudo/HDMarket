import express from 'express';
import Joi from 'joi';
import rateLimit from 'express-rate-limit';
import { protect } from '../middlewares/authMiddleware.js';
import {
  requireRole,
  requireFeedbackAccess,
  requirePaymentVerification,
  requireBoostManagement,
  requireComplaintAccess,
  requireDeliveryAccess,
  requireProductAccess,
  requireAnyPermission
} from '../middlewares/roleMiddleware.js';
import { validate, schemas } from '../middlewares/validate.js';
import { cacheMiddleware } from '../utils/cache.js';
import { upload } from '../utils/upload.js';
import { deliveryProofUpload } from '../utils/deliveryProofUpload.js';
import {
  getDashboardStats,
  getCacheStatsAdmin,
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
  listChatTemplateManagers,
  toggleChatTemplateManager,
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
  getUserAuditLogs,
  reviewShopLocation,
  getShopLocationTimeline
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
  listAdminChatTemplates,
  createChatTemplate,
  updateChatTemplate,
  deleteChatTemplate,
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
  listAdminDeliveryRequests,
  acceptAdminDeliveryRequest,
  rejectAdminDeliveryRequest,
  assignAdminDeliveryRequest,
  submitPickupProofAdmin,
  submitDeliveryProofAdmin,
  getAdminDeliveryAnalytics
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
  createPromoCode,
  listPromoCodesAdmin,
  updatePromoCode,
  togglePromoCodeStatus,
  getPromoCodeAnalytics,
  getPromoCodeUsageHistory,
  generatePromoCodeSample,
  previewPromoCommission
} from '../controllers/promoCodeController.js';
import {
  createSeasonalPricingAdmin,
  getBoostRevenueDashboardAdmin,
  listBoostPricingAdmin,
  listBoostRequestsAdmin,
  listSeasonalPricingAdmin,
  updateBoostPricingAdmin,
  updateBoostRequestStatusAdmin,
  updateSeasonalPricingAdmin,
  upsertBoostPricingAdmin
} from '../controllers/boostController.js';
import {
  createCategoryAdmin,
  exportCategoriesAdmin,
  getAdminCategoryTree,
  getCategoryAuditAdmin,
  importCategoriesAdmin,
  reassignCategoryProductsAdmin,
  reorderCategoriesAdmin,
  restoreCategoryAdmin,
  softDeleteCategoryAdmin,
  updateCategoryAdmin
} from '../controllers/categoryController.js';
import { validateCategory } from '../middlewares/categoryValidation.js';
import {
  getAdminSettings,
  updateAdminSetting,
  listAdminCurrencies,
  createAdminCurrency,
  updateAdminCurrency,
  getAdminLanguages,
  patchAdminLanguages,
  listAdminCities,
  createAdminCity,
  updateAdminCity,
  deleteAdminCity,
  listAdminCommunes,
  createAdminCommune,
  updateAdminCommune,
  deleteAdminCommune
} from '../controllers/settingsController.js';
import { getOnlineStatsAdmin } from '../controllers/realtimeAnalyticsController.js';
import {
  flushRuntimeConfigCache,
  getAdminFeatureFlags,
  getAdminRuntimeSetting,
  getAdminRuntimeSettings,
  patchAdminFeatureFlag,
  patchAdminRuntimeSetting,
  patchAdminRuntimeSettingsBulk,
  warmRuntimeConfigCache
} from '../controllers/configController.js';
import {
  forceLogoutUser,
  lockUserAccount,
  setManagedUserPassword,
  triggerPasswordResetForManagedUser,
  unlockUserAccount
} from '../controllers/founderController.js';

const router = express.Router();
const requireViewAdminDashboard = requireAnyPermission(['view_admin_dashboard']);
const requireManageUsers = requireAnyPermission(['manage_users']);
const requireManageOrders = requireAnyPermission(['manage_orders']);
const requireManageSettings = requireAnyPermission(['manage_settings']);
const requireManageSellers = requireAnyPermission(['manage_sellers']);
const requireManagePermissions = requireAnyPermission(['manage_permissions']);
const requireResetPasswords = requireAnyPermission(['reset_passwords']);
const requireForceLogoutPermission = requireAnyPermission(['force_logout']);
const requireLockAccounts = requireAnyPermission(['lock_accounts']);
const requireViewLogs = requireAnyPermission(['view_logs']);
const categoriesImportRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Trop de tentatives d’import. Réessayez dans 1 minute.' }
});

const categoriesExportRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Trop de téléchargements d’export. Réessayez dans 1 minute.' }
});

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
  requireManagePermissions,
  validate(Joi.object({ userId: Joi.string().hex().length(24).required() }), 'params'),
  toggleFeedbackReader
);

// Payment verifier routes - admin only
router.get('/payment-verifiers', protect, requireRole(['admin']), requireManagePermissions, listPaymentVerifiers);
router.patch(
  '/payment-verifiers/:userId/toggle',
  protect,
  requireRole(['admin']),
  requireManagePermissions,
  validate(Joi.object({ userId: Joi.string().hex().length(24).required() }), 'params'),
  togglePaymentVerifier
);

// Promo codes - admin only
router.get('/promo-codes', protect, requireRole(['admin']), requireManageSettings, listPromoCodesAdmin);
router.get('/promo-codes/analytics', protect, requireRole(['admin']), requireManageSettings, getPromoCodeAnalytics);
router.get('/promo-codes/usage', protect, requireRole(['admin']), requireManageSettings, getPromoCodeUsageHistory);
router.post(
  '/promo-codes',
  protect,
  requireRole(['admin']),
  requireManageSettings,
  validate(schemas.promoCodeCreate),
  createPromoCode
);
router.post(
  '/promo-codes/generate',
  protect,
  requireRole(['admin']),
  requireManageSettings,
  validate(schemas.promoCodeGenerate),
  generatePromoCodeSample
);
router.post(
  '/promo-codes/preview',
  protect,
  requireRole(['admin']),
  requireManageSettings,
  validate(schemas.promoCommissionPreview),
  previewPromoCommission
);
router.patch(
  '/promo-codes/:id',
  protect,
  requireRole(['admin']),
  requireManageSettings,
  validate(schemas.idParam, 'params'),
  validate(schemas.promoCodeUpdate),
  updatePromoCode
);
router.patch(
  '/promo-codes/:id/toggle',
  protect,
  requireRole(['admin']),
  requireManageSettings,
  validate(schemas.idParam, 'params'),
  validate(schemas.promoCodeToggle),
  togglePromoCodeStatus
);

// Reports - admin only
router.get('/reports', protect, requireRole(['admin']), requireViewLogs, generateReport);

// Review reminders - admin only
router.post('/review-reminders/send', protect, requireRole(['admin']), requireManageOrders, triggerReviewReminders);
router.post(
  '/notifications/broadcast',
  protect,
  requireRole(['admin']),
  requireManageSettings,
  validate(Joi.object({ message: Joi.string().min(1).max(2000).required(), title: Joi.string().max(200).allow(''), target: Joi.string().valid('all', 'person', 'shop') })),
  broadcastNotification
);

// Stats endpoint - accessible by admin, manager, or users with payment verification access
router.get(
  '/stats',
  protect,
  requireViewAdminDashboard,
  cacheMiddleware({ domain: 'admin', scope: 'role', ttl: 60000 }),
  getDashboardStats
);
router.get(
  '/online-stats',
  protect,
  requireViewAdminDashboard,
  cacheMiddleware({ domain: 'admin', scope: 'role', ttl: 5000 }),
  getOnlineStatsAdmin
);
router.get(
  '/cache/stats',
  protect,
  requireRole(['admin']),
  requireViewAdminDashboard,
  cacheMiddleware({ domain: 'admin', scope: 'role', ttl: 15000 }),
  getCacheStatsAdmin
);

// Boost management routes - accessible by admin OR users with canManageBoosts permission
// These must be defined BEFORE the router.use() that requires admin/manager role
router.get('/products/boosts', protect, requireBoostManagement, listBoostProductCandidatesAdmin);
router.get('/products/boosts/stats', protect, requireBoostManagement, getBoostStatistics);
router.patch('/products/:id/boost', protect, requireBoostManagement, validate(schemas.idParam, 'params'), toggleProductBoost);
router.get('/shops/boosts', protect, requireBoostManagement, listBoostShopCandidatesAdmin);
router.get('/shops/boosts/stats', protect, requireBoostManagement, getShopBoostStatistics);
router.patch('/shops/:id/boost', protect, requireBoostManagement, validate(schemas.idParam, 'params'), toggleShopBoost);
router.get('/boost-managers', protect, requireRole(['admin']), requireManagePermissions, listBoostManagers);
router.patch(
  '/boost-managers/:userId/toggle',
  protect,
  requireRole(['admin']),
  requireManagePermissions,
  validate(Joi.object({ userId: Joi.string().hex().length(24).required() }), 'params'),
  toggleBoostManager
);
router.get('/boost-pricing', protect, requireRole(['admin']), requireManageSettings, listBoostPricingAdmin);
router.post(
  '/boost-pricing',
  protect,
  requireRole(['admin']),
  requireManageSettings,
  validate(schemas.adminBoostPricingUpsert),
  upsertBoostPricingAdmin
);
router.patch(
  '/boost-pricing/:id',
  protect,
  requireRole(['admin']),
  requireManageSettings,
  validate(schemas.idParam, 'params'),
  validate(schemas.adminBoostPricingUpdate),
  updateBoostPricingAdmin
);
router.get('/seasonal-pricing', protect, requireRole(['admin']), requireManageSettings, listSeasonalPricingAdmin);
router.post(
  '/seasonal-pricing',
  protect,
  requireRole(['admin']),
  requireManageSettings,
  validate(schemas.adminSeasonalPricingCreate),
  createSeasonalPricingAdmin
);
router.patch(
  '/seasonal-pricing/:id',
  protect,
  requireRole(['admin']),
  requireManageSettings,
  validate(schemas.idParam, 'params'),
  validate(schemas.adminSeasonalPricingUpdate),
  updateSeasonalPricingAdmin
);
router.get(
  '/boost-requests',
  protect,
  requireBoostManagement,
  validate(schemas.adminBoostRequestListQuery, 'query'),
  listBoostRequestsAdmin
);
router.patch(
  '/boost-requests/:id/status',
  protect,
  requireBoostManagement,
  validate(schemas.idParam, 'params'),
  validate(schemas.adminBoostRequestStatusUpdate),
  updateBoostRequestStatusAdmin
);
router.get('/boosts/revenue-dashboard', protect, requireRole(['admin']), requireViewAdminDashboard, getBoostRevenueDashboardAdmin);

// Settings management - admin only
router.get('/settings', protect, requireRole(['admin', 'founder']), requireManageSettings, getAdminSettings);
router.patch(
  '/settings/:key',
  protect,
  requireRole(['admin', 'founder']),
  requireManageSettings,
  validate(schemas.adminSettingKeyParam, 'params'),
  validate(schemas.adminSettingUpdate),
  updateAdminSetting
);
router.get('/currencies', protect, requireRole(['admin', 'founder']), requireManageSettings, listAdminCurrencies);
router.post(
  '/currencies',
  protect,
  requireRole(['admin', 'founder']),
  requireManageSettings,
  validate(schemas.adminCurrencyCreate),
  createAdminCurrency
);
router.patch(
  '/currencies/:code',
  protect,
  requireRole(['admin', 'founder']),
  requireManageSettings,
  validate(schemas.adminCurrencyCodeParam, 'params'),
  validate(schemas.adminCurrencyUpdate),
  updateAdminCurrency
);
router.get('/languages', protect, requireRole(['admin', 'founder']), requireManageSettings, getAdminLanguages);
router.patch(
  '/languages',
  protect,
  requireRole(['admin', 'founder']),
  requireManageSettings,
  validate(schemas.adminLanguagesUpdate),
  patchAdminLanguages
);
router.get('/cities', protect, requireRole(['admin', 'founder']), requireManageSettings, listAdminCities);
router.post(
  '/cities',
  protect,
  requireRole(['admin', 'founder']),
  requireManageSettings,
  validate(schemas.adminCityCreate),
  createAdminCity
);
router.patch(
  '/cities/:id',
  protect,
  requireRole(['admin', 'founder']),
  requireManageSettings,
  validate(schemas.idParam, 'params'),
  validate(schemas.adminCityUpdate),
  updateAdminCity
);
router.delete(
  '/cities/:id',
  protect,
  requireRole(['admin', 'founder']),
  requireManageSettings,
  validate(schemas.idParam, 'params'),
  deleteAdminCity
);
router.get('/communes', protect, requireRole(['admin', 'founder']), requireManageSettings, listAdminCommunes);
router.post(
  '/communes',
  protect,
  requireRole(['admin', 'founder']),
  requireManageSettings,
  validate(schemas.adminCommuneCreate),
  createAdminCommune
);
router.patch(
  '/communes/:id',
  protect,
  requireRole(['admin', 'founder']),
  requireManageSettings,
  validate(schemas.idParam, 'params'),
  validate(schemas.adminCommuneUpdate),
  updateAdminCommune
);
router.delete(
  '/communes/:id',
  protect,
  requireRole(['admin', 'founder']),
  requireManageSettings,
  validate(schemas.idParam, 'params'),
  deleteAdminCommune
);

// Runtime config center (admin + founder)
router.get('/config/runtime', protect, requireRole(['admin', 'founder']), requireManageSettings, getAdminRuntimeSettings);
router.get(
  '/config/runtime/:key',
  protect,
  requireRole(['admin', 'founder']),
  requireManageSettings,
  validate(schemas.adminRuntimeSettingKeyParam, 'params'),
  getAdminRuntimeSetting
);
router.patch(
  '/config/runtime/:key',
  protect,
  requireRole(['admin', 'founder']),
  requireManageSettings,
  validate(schemas.adminRuntimeSettingKeyParam, 'params'),
  validate(schemas.adminRuntimeSettingUpdate),
  patchAdminRuntimeSetting
);
router.patch(
  '/config/runtime-bulk',
  protect,
  requireRole(['admin', 'founder']),
  requireManageSettings,
  validate(schemas.adminRuntimeSettingBulkUpdate),
  patchAdminRuntimeSettingsBulk
);
router.get('/config/feature-flags', protect, requireRole(['admin', 'founder']), requireManageSettings, getAdminFeatureFlags);
router.patch(
  '/config/feature-flags/:featureName',
  protect,
  requireRole(['admin', 'founder']),
  requireManageSettings,
  validate(schemas.adminFeatureFlagParam, 'params'),
  validate(schemas.adminFeatureFlagUpdate),
  patchAdminFeatureFlag
);
router.post('/config/cache/invalidate', protect, requireRole(['admin', 'founder']), requireManageSettings, flushRuntimeConfigCache);
router.post(
  '/config/cache/refresh',
  protect,
  requireRole(['admin', 'founder']),
  requireManageSettings,
  validate(schemas.adminConfigRefresh),
  warmRuntimeConfigCache
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
router.get('/complaint-managers', protect, requireRole(['admin']), requireManagePermissions, listComplaintManagers);
router.patch(
  '/complaint-managers/:userId/toggle',
  protect,
  requireRole(['admin']),
  requireManagePermissions,
  validate(Joi.object({ userId: Joi.string().hex().length(24).required() }), 'params'),
  toggleComplaintManager
);
// Product managers - admin only
router.get('/product-managers', protect, requireRole(['admin']), requireManagePermissions, listProductManagers);
router.patch(
  '/product-managers/:userId/toggle',
  protect,
  requireRole(['admin']),
  requireManagePermissions,
  validate(Joi.object({ userId: Joi.string().hex().length(24).required() }), 'params'),
  toggleProductManager
);
// Delivery managers - admin only
router.get('/delivery-managers', protect, requireRole(['admin']), requireManagePermissions, listDeliveryManagers);
router.patch(
  '/delivery-managers/:userId/toggle',
  protect,
  requireRole(['admin']),
  requireManagePermissions,
  validate(Joi.object({ userId: Joi.string().hex().length(24).required() }), 'params'),
  toggleDeliveryManager
);
// Chat template managers - admin only
router.get('/chat-template-managers', protect, requireRole(['admin']), requireManagePermissions, listChatTemplateManagers);
router.patch(
  '/chat-template-managers/:userId/toggle',
  protect,
  requireRole(['admin']),
  requireManagePermissions,
  validate(Joi.object({ userId: Joi.string().hex().length(24).required() }), 'params'),
  toggleChatTemplateManager
);
// Help center editors - admin only
router.get('/help-center-editors', protect, requireRole(['admin']), requireManagePermissions, listHelpCenterEditors);
router.patch(
  '/help-center-editors/:userId/toggle',
  protect,
  requireRole(['admin']),
  requireManagePermissions,
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
router.get(
  '/delivery-requests',
  protect,
  requireDeliveryAccess,
  validate(schemas.adminDeliveryRequestsListQuery, 'query'),
  listAdminDeliveryRequests
);
router.get(
  '/delivery-requests/analytics',
  protect,
  requireDeliveryAccess,
  validate(schemas.adminDeliveryRequestsListQuery, 'query'),
  getAdminDeliveryAnalytics
);
router.patch(
  '/delivery-requests/:id/accept',
  protect,
  requireDeliveryAccess,
  validate(schemas.idParam, 'params'),
  validate(schemas.adminDeliveryRequestAccept),
  acceptAdminDeliveryRequest
);
router.patch(
  '/delivery-requests/:id/reject',
  protect,
  requireDeliveryAccess,
  validate(schemas.idParam, 'params'),
  validate(schemas.adminDeliveryRequestReject),
  rejectAdminDeliveryRequest
);
router.patch(
  '/delivery-requests/:id/assign-delivery-guy',
  protect,
  requireDeliveryAccess,
  validate(schemas.idParam, 'params'),
  validate(schemas.adminDeliveryRequestAssign),
  assignAdminDeliveryRequest
);
router.patch(
  '/delivery-requests/:id/pickup-proof',
  protect,
  requireDeliveryAccess,
  validate(schemas.idParam, 'params'),
  deliveryProofUpload.fields([
    { name: 'photos', maxCount: 3 },
    { name: 'signatureFile', maxCount: 1 }
  ]),
  submitPickupProofAdmin
);
router.patch(
  '/delivery-requests/:id/delivery-proof',
  protect,
  requireDeliveryAccess,
  validate(schemas.idParam, 'params'),
  deliveryProofUpload.fields([
    { name: 'photos', maxCount: 3 },
    { name: 'signatureFile', maxCount: 1 }
  ]),
  submitDeliveryProofAdmin
);

// Categories management - admin only
router.get(
  '/categories/tree',
  protect,
  requireRole(['admin']),
  requireManageSettings,
  validateCategory.treeQuery,
  getAdminCategoryTree
);
router.post(
  '/categories',
  protect,
  requireRole(['admin']),
  requireManageSettings,
  validateCategory.create,
  createCategoryAdmin
);
router.patch(
  '/categories/:id',
  protect,
  requireRole(['admin']),
  requireManageSettings,
  validateCategory.idParam,
  validateCategory.update,
  updateCategoryAdmin
);
router.post(
  '/categories/:id/soft-delete',
  protect,
  requireRole(['admin']),
  requireManageSettings,
  validateCategory.idParam,
  validateCategory.softDelete,
  softDeleteCategoryAdmin
);
router.post(
  '/categories/:id/restore',
  protect,
  requireRole(['admin']),
  requireManageSettings,
  validateCategory.idParam,
  validateCategory.restore,
  restoreCategoryAdmin
);
router.post(
  '/categories/reorder',
  protect,
  requireRole(['admin']),
  requireManageSettings,
  validateCategory.reorder,
  reorderCategoriesAdmin
);
router.post(
  '/categories/reassign-products',
  protect,
  requireRole(['admin']),
  requireManageSettings,
  validateCategory.reassignProducts,
  reassignCategoryProductsAdmin
);
router.get(
  '/categories/export',
  protect,
  requireRole(['admin']),
  requireManageSettings,
  categoriesExportRateLimit,
  validateCategory.exportQuery,
  exportCategoriesAdmin
);
router.post(
  '/categories/import',
  protect,
  requireRole(['admin']),
  requireManageSettings,
  categoriesImportRateLimit,
  validateCategory.importQuery,
  validateCategory.importBody,
  importCategoriesAdmin
);
router.get(
  '/categories/audit',
  protect,
  requireRole(['admin']),
  requireViewLogs,
  validateCategory.auditQuery,
  getCategoryAuditAdmin
);

// All other admin routes - require admin or manager role
router.use(protect, requireRole(['admin', 'manager']));
router.get('/analytics/sales-trends', requireViewAdminDashboard, cacheMiddleware({ ttl: 300000 }), getSalesTrends);
router.get('/analytics/order-heatmap', requireViewAdminDashboard, cacheMiddleware({ ttl: 300000 }), getOrderHeatmap);
router.get('/analytics/conversion', requireViewAdminDashboard, cacheMiddleware({ ttl: 300000 }), getConversionMetrics);
router.get('/analytics/cohorts', requireViewAdminDashboard, cacheMiddleware({ ttl: 300000 }), getCohortAnalysis);
router.get('/analytics/orders-by-hour', requireViewAdminDashboard, getOrdersByHour);
router.get('/users', requireManageUsers, listUsers);
router.get('/users/export-phones', protect, requireRole(['admin']), requireManageUsers, exportPhones);
router.get('/users/:id/stats', requireManageUsers, validate(schemas.idParam, 'params'), getAdminUserStats);
router.get('/users/:userId/account-type-history', requireManageUsers, getUserAccountTypeHistory);
router.patch(
  '/users/:id/account-type',
  requireManageSellers,
  validate(schemas.idParam, 'params'),
  validate(schemas.adminUserAccountType),
  updateUserAccountType
);
router.patch(
  '/users/:id/block', 
  requireLockAccounts,
  validate(schemas.idParam, 'params'),
  validate(schemas.adminBlockUser),
  blockUser
);
router.patch(
  '/users/:id/unblock',
  requireLockAccounts,
  validate(schemas.idParam, 'params'),
  unblockUser
);
router.patch(
  '/users/:id/shop-verification',
  requireManageSellers,
  validate(schemas.idParam, 'params'),
  validate(schemas.adminShopVerification),
  updateShopVerification
);
router.patch(
  '/users/:id/shop-location-review',
  requireManageSellers,
  validate(schemas.idParam, 'params'),
  validate(schemas.adminShopLocationReview),
  reviewShopLocation
);
router.get(
  '/users/:id/shop-location-timeline',
  requireManageSellers,
  validate(schemas.idParam, 'params'),
  getShopLocationTimeline
);
router.patch(
  '/users/:id/role',
  requireManagePermissions,
  validate(schemas.idParam, 'params'),
  validate(schemas.adminUserRole),
  updateUserRole
);
router.post(
  '/users/:id/force-password-reset',
  requireRole(['admin']),
  requireResetPasswords,
  validate(schemas.idParam, 'params'),
  triggerPasswordResetForManagedUser
);
router.post(
  '/users/:id/set-password',
  requireRole(['admin']),
  requireResetPasswords,
  validate(schemas.idParam, 'params'),
  validate(schemas.adminDirectPasswordUpdate),
  setManagedUserPassword
);
router.post(
  '/users/:id/force-logout',
  requireRole(['admin']),
  requireForceLogoutPermission,
  validate(schemas.idParam, 'params'),
  forceLogoutUser
);
router.post(
  '/users/:id/lock-account',
  requireRole(['admin']),
  requireLockAccounts,
  validate(schemas.idParam, 'params'),
  lockUserAccount
);
router.post(
  '/users/:id/unlock-account',
  requireRole(['admin']),
  requireLockAccounts,
  validate(schemas.idParam, 'params'),
  unlockUserAccount
);
// User restrictions management
router.get('/users/:id/restrictions', requireManageUsers, validate(schemas.idParam, 'params'), getUserRestrictions);
router.patch('/users/:id/restrictions/:type', requireManageUsers, validate(schemas.restrictionParam, 'params'), setUserRestriction);
router.delete('/users/:id/restrictions/:type', requireManageUsers, validate(schemas.restrictionParam, 'params'), removeUserRestriction);
// Seller received orders
router.get('/users/:id/received-orders', requireManageOrders, validate(schemas.idParam, 'params'), getSellerReceivedOrders);
// User audit logs
router.get('/users/:id/audit-logs', requireViewLogs, validate(schemas.idParam, 'params'), getUserAuditLogs);
// Global audit logs
router.get('/audit-logs', requireViewLogs, listAuditLogs);
router.get('/shops/verified', requireManageSellers, listVerifiedShopsAdmin);
router.post('/products/update-sales-count', requireAnyPermission(['manage_products']), updateAllProductSalesCount);
router.get('/chat/templates', requireAnyPermission(['manage_chat_templates']), listAdminChatTemplates);
router.post('/chat/templates', requireAnyPermission(['manage_chat_templates']), createChatTemplate);
router.patch('/chat/templates/:id', requireAnyPermission(['manage_chat_templates']), validate(schemas.idParam, 'params'), updateChatTemplate);
router.delete('/chat/templates/:id', requireAnyPermission(['manage_chat_templates']), validate(schemas.idParam, 'params'), deleteChatTemplate);
router.post('/chat/support-message', requireAnyPermission(['manage_chat_templates']), sendSupportMessage);
router.get('/prohibited-words', requireManageSettings, listProhibitedWords);
router.post(
  '/prohibited-words',
  requireManageSettings,
  validate(schemas.prohibitedWordCreate),
  createProhibitedWord
);
router.delete('/prohibited-words/:id', requireManageSettings, validate(schemas.idParam, 'params'), deleteProhibitedWord);
router.put('/hero-banner', requireManageSettings, upload.single('heroBanner'), updateHeroBanner);
router.put('/app-logo/desktop', requireManageSettings, upload.single('appLogoDesktop'), updateAppLogoDesktop);
router.put('/app-logo/mobile', requireManageSettings, upload.single('appLogoMobile'), updateAppLogoMobile);
router.put(
  '/promo-banner',
  requireManageSettings,
  upload.fields([
    { name: 'promoBanner', maxCount: 1 },
    { name: 'promoBannerMobile', maxCount: 1 }
  ]),
  updatePromoBanner
);
router.put('/splash', requireManageSettings, upload.single('splashImage'), updateSplash);
// Shop conversion requests - admin only
router.get('/shop-conversion-requests', protect, requireRole(['admin']), requireManageSellers, getAllShopConversionRequests);
router.get('/shop-conversion-requests/:id', protect, requireRole(['admin']), requireManageSellers, validate(schemas.idParam, 'params'), getShopConversionRequest);
router.patch('/shop-conversion-requests/:id/approve', protect, requireRole(['admin']), requireManageSellers, validate(schemas.idParam, 'params'), approveShopConversionRequest);
router.patch('/shop-conversion-requests/:id/reject', protect, requireRole(['admin']), requireManageSellers, validate(schemas.idParam, 'params'), rejectShopConversionRequest);
// Network settings - admin only
router.get('/networks', protect, requireRole(['admin']), requireManageSettings, getAllNetworks);
router.post('/networks', protect, requireRole(['admin']), requireManageSettings, createNetwork);
router.patch('/networks/:id', protect, requireRole(['admin']), requireManageSettings, validate(schemas.idParam, 'params'), updateNetwork);
router.delete('/networks/:id', protect, requireRole(['admin']), requireManageSettings, validate(schemas.idParam, 'params'), deleteNetwork);

export default router;
