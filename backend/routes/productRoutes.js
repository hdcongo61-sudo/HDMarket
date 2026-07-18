import express from 'express';
import rateLimit from 'express-rate-limit';
import { protect } from '../middlewares/authMiddleware.js';
import { requireRole } from '../middlewares/roleMiddleware.js';
import { getBundleSuggestions } from '../services/bundleService.js';
import { upload } from '../utils/upload.js';
import { validate, schemas } from '../middlewares/validate.js';
import { cacheMiddleware } from '../utils/cache.js';
import { idempotencyMiddleware } from '../middlewares/idempotencyMiddleware.js';
import {
  createProduct,
  getPublicProducts,
  getPublicInstallmentProducts,
  getPublicWholesaleProducts,
  getPublicPickupOnlyProducts,
  getPublicHighlights,
  getPublicProductById,
  registerPublicProductView,
  getMyProducts,
  getAssistantShopProducts,
  requestAssistantProductAction,
  getAllProductsAdmin,
  getProductById,
  updateProduct,
  deleteProduct,
  disableProduct,
  enableProduct,
  bulkEnableProducts,
  bulkDisableProducts,
  bulkDeleteProducts,
  registerWhatsappClick,
  getTopSales,
  getTopSalesTodayByCity,
  getProductAnalytics
} from '../controllers/productController.js';
import { addComment, deleteCommentAdmin, deleteMyComment, getCommentsForProduct } from '../controllers/commentController.js';
import {
  deleteRating,
  getRatingSummary,
  getUserRating,
  upsertRating
} from '../controllers/ratingController.js';
import { getUserRecommendations } from '../controllers/recommendationController.js';

const router = express.Router();
const productMutationIdempotency = idempotencyMiddleware({ ttlMs: 10 * 60 * 1000 });
const productViewRateLimiter = rateLimit({
  windowMs: Math.max(30_000, Number(process.env.PRODUCT_VIEW_RATE_WINDOW_MS || 60_000)),
  max: Math.max(10, Number(process.env.PRODUCT_VIEW_RATE_MAX || 80)),
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, _next, options) => {
    res.status(options.statusCode || 429).json({
      success: false,
      message: 'Trop de vues enregistrées en peu de temps. Réessayez dans un instant.',
      code: 'PRODUCT_VIEW_RATE_LIMITED'
    });
  }
});

// Personalized recommendations (authenticated, cached)
router.get(
  '/recommendations',
  protect,
  cacheMiddleware({ ttl: 120000, scope: 'user' }),
  getUserRecommendations
);

// Public (validation query) - with caching
router.get('/public/highlights', cacheMiddleware({ ttl: 300000 }), getPublicHighlights);
router.get('/public/installments', cacheMiddleware({ ttl: 300000 }), getPublicInstallmentProducts);
router.get('/public/wholesale', cacheMiddleware({ ttl: 300000 }), getPublicWholesaleProducts);
router.get('/wholesale', cacheMiddleware({ ttl: 300000 }), getPublicWholesaleProducts);
router.get('/public/pickup-only', cacheMiddleware({ ttl: 300000 }), getPublicPickupOnlyProducts);
router.get('/public/top-sales', cacheMiddleware({ ttl: 300000 }), getTopSales);
router.get('/public/top-sales/today', cacheMiddleware({ ttl: 120000 }), getTopSalesTodayByCity);
router.get('/public', cacheMiddleware({ ttl: 180000 }), validate(schemas.publicQuery, 'query'), getPublicProducts);
router.get('/public/:id/comments', cacheMiddleware({ ttl: 120000 }), getCommentsForProduct);
router.get('/public/:id/ratings', cacheMiddleware({ ttl: 120000 }), getRatingSummary);
// Bundle suggestions — frequently bought together (Proposal 7)
router.get('/public/:id/bundle-suggestions', cacheMiddleware({ ttl: 600000 }), async (req, res) => {
  try {
    const result = await getBundleSuggestions(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Erreur suggestion bundle' });
  }
});
router.post(
  '/public/:id/view',
  productViewRateLimiter,
  validate(schemas.identifierParam, 'params'),
  registerPublicProductView
);
router.get('/public/:id', cacheMiddleware({ ttl: 300000 }), getPublicProductById);
router.post('/public/:id/whatsapp-click', validate(schemas.identifierParam, 'params'), registerWhatsappClick);

// Détail protégé si non approuvé
router.post('/:id/comments', protect, validate(schemas.identifierParam, 'params'), validate(schemas.commentCreate), addComment);
router.delete('/comments/:id', protect, deleteMyComment);
router.delete('/comments/:id/admin', protect, requireRole(['admin', 'manager']), deleteCommentAdmin);
router.get('/:id/rating', protect, validate(schemas.identifierParam, 'params'), getUserRating);
router.put('/:id/rating', protect, validate(schemas.identifierParam, 'params'), validate(schemas.ratingUpsert), upsertRating);
router.delete('/:id/rating', protect, validate(schemas.identifierParam, 'params'), deleteRating);
router.get('/:id/analytics', protect, validate(schemas.identifierParam, 'params'), getProductAnalytics);
router.get('/assistant/shop-products', protect, getAssistantShopProducts);
router.post('/assistant/products/:id/action-request', protect, requestAssistantProductAction);
router.get('/:id', protect, validate(schemas.identifierParam, 'params'), getProductById);

// User
router.post(
  '/',
  protect,
  upload.fields([
    { name: 'images', maxCount: 20 },
    { name: 'editedImages', maxCount: 20 },
    { name: 'video', maxCount: 1 },
    { name: 'pdf', maxCount: 1 }
  ]),
  productMutationIdempotency,
  validate(schemas.productCreate),
  createProduct
);
router.get('/', protect, getMyProducts);
router.put(
  '/:id',
  protect,
  upload.fields([
    { name: 'images', maxCount: 20 },
    { name: 'editedImages', maxCount: 20 },
    { name: 'video', maxCount: 1 },
    { name: 'pdf', maxCount: 1 }
  ]),
  productMutationIdempotency,
  validate(schemas.productUpdate),
  updateProduct
);
router.delete('/:id', protect, productMutationIdempotency, deleteProduct);
router.patch('/:id/disable', protect, productMutationIdempotency, disableProduct);
router.patch('/:id/enable', protect, productMutationIdempotency, enableProduct);
// Bulk actions
router.post('/bulk/enable', protect, productMutationIdempotency, validate(schemas.bulkProductAction), bulkEnableProducts);
router.post('/bulk/disable', protect, productMutationIdempotency, validate(schemas.bulkProductAction), bulkDisableProducts);
router.post('/bulk/delete', protect, productMutationIdempotency, validate(schemas.bulkProductAction), bulkDeleteProducts);

// Admin
router.get('/admin/all', protect, requireRole(['admin']), getAllProductsAdmin);

// Promo code preview for listing fee (wallet payment)
router.post('/promo-preview', protect, async (req, res) => {
  try {
    const { code, price } = req.body || {};
    if (!code || !price) {
      return res.status(400).json({ valid: false, message: 'Code promo et prix requis.' });
    }
    const { previewPromoForSeller } = await import('../utils/promoCodeService.js');
    const { getRuntimeConfig } = await import('../services/configService.js');
    const configuredRate = Number(await getRuntimeConfig('commission_rate', { fallback: 3 }));
    const commissionRate = Number.isFinite(configuredRate) ? configuredRate : 3;
    const preview = await previewPromoForSeller({
      code: String(code).trim().toUpperCase(),
      sellerId: req.user.id,
      productPrice: Number(price),
      commissionRate
    });
    res.json(preview);
  } catch (error) {
    res.status(400).json({ valid: false, message: error.message || 'Erreur code promo.' });
  }
});

export default router;
