import express from 'express';
import { getHeroBanner } from '../controllers/siteSettingController.js';

const router = express.Router();

router.get('/hero-banner', getHeroBanner);

export default router;
