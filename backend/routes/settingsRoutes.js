import express from 'express';
import { getAppLogo, getHeroBanner, getPromoBanner } from '../controllers/siteSettingController.js';

const router = express.Router();

router.get('/hero-banner', getHeroBanner);
router.get('/app-logo', getAppLogo);
router.get('/promo-banner', getPromoBanner);

export default router;
