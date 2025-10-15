import express from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import { validate, schemas } from '../middlewares/validate.js';
import { addItem, clearCart, getCart, removeItem, updateItem } from '../controllers/cartController.js';

const router = express.Router();

router.use(protect);

router.get('/', getCart);
router.post('/items', validate(schemas.cartAdd), addItem);
router.put('/items/:productId', validate(schemas.cartUpdate), updateItem);
router.delete('/items/:productId', removeItem);
router.delete('/', clearCart);

export default router;
