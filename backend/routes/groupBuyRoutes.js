import express from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import {
  postCreateGroupBuy,
  postJoinGroupBuy,
  getGroupBuy,
  getGroupBuysForProduct,
  getActiveGroupBuys
} from '../controllers/groupBuyController.js';

const router = express.Router();

router.get('/active', getActiveGroupBuys);
router.get('/product/:productId', getGroupBuysForProduct);
router.get('/:id', getGroupBuy);
router.post('/', protect, postCreateGroupBuy);
router.post('/:id/join', protect, postJoinGroupBuy);

export default router;
