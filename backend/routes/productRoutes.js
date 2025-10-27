import express from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import { requireRole } from '../middlewares/roleMiddleware.js';
import { upload } from '../utils/upload.js';
import { validate, schemas } from '../middlewares/validate.js';
import {
  createProduct,
  getPublicProducts,
  getPublicProductById,
  getMyProducts,
  getAllProductsAdmin,
  getProductById,
  updateProduct,
  deleteProduct,
  disableProduct,
  enableProduct,
  registerWhatsappClick
} from '../controllers/productController.js';
import { addComment, getCommentsForProduct } from '../controllers/commentController.js';
import {
  deleteRating,
  getRatingSummary,
  getUserRating,
  upsertRating
} from '../controllers/ratingController.js';

const router = express.Router();

// Public (validation query)
router.get('/public', validate(schemas.publicQuery, 'query'), getPublicProducts);
router.get('/public/:id/comments', getCommentsForProduct);
router.get('/public/:id/ratings', getRatingSummary);
router.get('/public/:id', getPublicProductById);
router.post('/public/:id/whatsapp-click', validate(schemas.idParam, 'params'), registerWhatsappClick);

// Détail protégé si non approuvé
router.post('/:id/comments', protect, validate(schemas.commentCreate), addComment);
router.get('/:id/rating', protect, getUserRating);
router.put('/:id/rating', protect, validate(schemas.ratingUpsert), upsertRating);
router.delete('/:id/rating', protect, deleteRating);
router.get('/:id', protect, getProductById);

// User
router.post('/', protect, upload.array('images', 5), validate(schemas.productCreate), createProduct);
router.get('/', protect, getMyProducts);
router.put('/:id', protect, upload.array('images', 5), validate(schemas.productUpdate), updateProduct);
router.delete('/:id', protect, deleteProduct);
router.patch('/:id/disable', protect, disableProduct);
router.patch('/:id/enable', protect, enableProduct);

// Admin
router.get('/admin/all', protect, requireRole(['admin']), getAllProductsAdmin);

export default router;
