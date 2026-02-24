import express from 'express';
import { getAppLogo, getHeroBanner, getPromoBanner, getSplash } from '../controllers/siteSettingController.js';
import { getActiveNetworks } from '../controllers/networkSettingController.js';
import { cacheMiddleware } from '../utils/cache.js';
import {
  getPublicSettings,
  getPublicCities,
  getPublicCurrencies,
  getPublicCommunes
} from '../controllers/settingsController.js';
import { getRuntimePublicConfig } from '../controllers/configController.js';

const router = express.Router();

router.get('/public', cacheMiddleware({ ttl: 120000 }), getPublicSettings);
router.get('/runtime', cacheMiddleware({ ttl: 30000 }), getRuntimePublicConfig);
router.get('/cities', cacheMiddleware({ ttl: 1800000 }), getPublicCities);
router.get('/communes', cacheMiddleware({ ttl: 1800000 }), getPublicCommunes);
router.get('/currencies', cacheMiddleware({ ttl: 1800000 }), getPublicCurrencies);
router.get('/hero-banner', getHeroBanner);
router.get('/app-logo', getAppLogo);
router.get('/promo-banner', getPromoBanner);
router.get('/splash', getSplash);
router.get('/networks', getActiveNetworks);

export default router;
