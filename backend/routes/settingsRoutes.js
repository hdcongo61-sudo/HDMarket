import express from 'express';
import { getAppLogo, getHeroBanner, getPromoBanner, getSplash } from '../controllers/siteSettingController.js';

const router = express.Router();

router.get('/hero-banner', getHeroBanner);
router.get('/app-logo', getAppLogo);
router.get('/promo-banner', getPromoBanner);
router.get('/splash', getSplash);

export default router;
