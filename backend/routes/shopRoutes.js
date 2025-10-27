import express from 'express';
import { getShopProfile } from '../controllers/shopController.js';

const router = express.Router();

router.get('/:id', getShopProfile);

export default router;

