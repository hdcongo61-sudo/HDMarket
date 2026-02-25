import express from 'express';
import rateLimit from 'express-rate-limit';
import { protect } from '../middlewares/authMiddleware.js';
import { requireRole } from '../middlewares/roleMiddleware.js';
import { upload } from '../utils/upload.js';
import { validate, schemas } from '../middlewares/validate.js';
import { cacheMiddleware } from '../utils/cache.js';
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
import { addComment, getCommentsForProduct } from '../controllers/commentController.js';
import {
  deleteRating,
  getRatingSummary,
  getUserRating,
  upsertRating
} from '../controllers/ratingController.js';

const router = express.Router();
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
router.get('/:id/rating', protect, validate(schemas.identifierParam, 'params'), getUserRating);
router.put('/:id/rating', protect, validate(schemas.identifierParam, 'params'), validate(schemas.ratingUpsert), upsertRating);
router.delete('/:id/rating', protect, validate(schemas.identifierParam, 'params'), deleteRating);
router.get('/:id/analytics', protect, validate(schemas.identifierParam, 'params'), getProductAnalytics);
router.get('/:id', protect, validate(schemas.identifierParam, 'params'), getProductById);

// User
router.post(
  '/',
  protect,
  upload.fields([
    { name: 'images', maxCount: 3 },
    { name: 'video', maxCount: 1 },
    { name: 'pdf', maxCount: 1 }
  ]),
  validate(schemas.productCreate),
  createProduct
);
router.get('/', protect, getMyProducts);
router.put(
  '/:id',
  protect,
  upload.fields([
    { name: 'images', maxCount: 3 },
    { name: 'video', maxCount: 1 },
    { name: 'pdf', maxCount: 1 }
  ]),
  validate(schemas.productUpdate),
  updateProduct
);
router.delete('/:id', protect, deleteProduct);
router.patch('/:id/disable', protect, disableProduct);
router.patch('/:id/enable', protect, enableProduct);
// Bulk actions
router.post('/bulk/enable', protect, validate(schemas.bulkProductAction), bulkEnableProducts);
router.post('/bulk/disable', protect, validate(schemas.bulkProductAction), bulkDisableProducts);
router.post('/bulk/delete', protect, validate(schemas.bulkProductAction), bulkDeleteProducts);

// Admin
router.get('/admin/all', protect, requireRole(['admin']), getAllProductsAdmin);

export default router;
