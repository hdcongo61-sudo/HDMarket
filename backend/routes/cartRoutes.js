import express from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import { validate, schemas } from '../middlewares/validate.js';
import { cacheMiddleware } from '../utils/cache.js';
import { addItem, clearCart, getCart, removeItem, updateItem, previewGuestCart, mergeGuestCart, estimateCartDelivery } from '../controllers/cartController.js';
import Joi from 'joi';
import rateLimit from 'express-rate-limit';
import { requireCountryContext } from '../middlewares/countryMiddleware.js';

const router = express.Router();
const guestItems = Joi.array().max(50).items(Joi.object({
  productId: Joi.string().hex().length(24).required(),
  quantity: Joi.number().integer().min(1).max(9999).required(),
  selectedAttributes: Joi.array().max(20).items(Joi.object({ name: Joi.string().max(100).required(), value: Joi.string().max(200).required() })).default([])
})).required();
router.post('/preview', rateLimit({ windowMs: 60000, max: 120 }), requireCountryContext,
  validate(Joi.object({ items: guestItems })), previewGuestCart);
router.post('/delivery-estimate', rateLimit({ windowMs: 60000, max: 120 }), requireCountryContext,
  validate(Joi.object({ items: guestItems.min(1), cityId: Joi.string().hex().length(24).required(), communeId: Joi.string().hex().length(24).required() })), estimateCartDelivery);

router.use(protect, requireCountryContext);
router.post('/merge', validate(Joi.object({ items: guestItems, mergeId: Joi.string().min(8).max(150).required() })), mergeGuestCart);

router.get('/', cacheMiddleware({ domain: 'cart', scope: 'user', ttl: 60 * 1000 }), getCart);
router.post('/items', validate(schemas.cartAdd), addItem);
router.put('/items/:productId', validate(schemas.cartUpdate), updateItem);
router.delete('/items/:productId', removeItem);
router.delete('/', clearCart);

export default router;
