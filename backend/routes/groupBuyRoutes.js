import express from 'express';
import { optionalProtect, protect } from '../middlewares/authMiddleware.js';
import { attachCountryContext } from '../middlewares/countryMiddleware.js';
import {
  postCreateGroupBuy,
  postJoinGroupBuy,
  getGroupBuy,
  getGroupBuysForProduct,
  getActiveGroupBuys
} from '../controllers/groupBuyController.js';

const router = express.Router();

// Users only see group buys from the country they are registered in.
router.use(optionalProtect, attachCountryContext);

router.get('/active', getActiveGroupBuys);
router.get('/product/:productId', getGroupBuysForProduct);
router.get('/:id', getGroupBuy);
router.post('/', protect, postCreateGroupBuy);
router.post('/:id/join', protect, postJoinGroupBuy);

export default router;
