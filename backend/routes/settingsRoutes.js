import express from 'express';
import { getAppLogo, getHeroBanner, getPromoBanner, getSplash } from '../controllers/siteSettingController.js';
import { getActiveNetworks } from '../controllers/networkSettingController.js';

const router = express.Router();

router.get('/hero-banner', getHeroBanner);
router.get('/app-logo', getAppLogo);
router.get('/promo-banner', getPromoBanner);
router.get('/splash', getSplash);
router.get('/networks', getActiveNetworks);

export default router;
