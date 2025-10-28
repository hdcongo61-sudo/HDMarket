import express from 'express';
import { getShopProfile, listShops } from '../controllers/shopController.js';

const router = express.Router();

router.get('/', listShops);
router.get('/:id', getShopProfile);

export default router;
