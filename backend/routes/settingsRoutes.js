import express from 'express';
import { getAppLogo, getHeroBanner, getPromoBanner, getSplash } from '../controllers/siteSettingController.js';
import { getActiveNetworks } from '../controllers/networkSettingController.js';
import { cacheMiddleware } from '../utils/cache.js';
import {
  getPublicSettings,
  getPublicCities,
  getPublicCurrencies,
  getPublicCommunes,
  getPublicManifest
} from '../controllers/settingsController.js';
import { getRuntimePublicConfig } from '../controllers/configController.js';
import { optionalProtect } from '../middlewares/authMiddleware.js';
import { attachCountryContext } from '../middlewares/countryMiddleware.js';

const router = express.Router();
const skipCacheByHeader = (req) =>
  String(req.headers['x-skip-cache'] || '').trim() === '1' ||
  Boolean(req.headers.authorization) ||
  Boolean(req.headers['x-device-id']) ||
  Boolean(req.headers['x-session-id']) ||
  Boolean(req.headers['x-user-city']) ||
  Boolean(req.headers['x-app-platform']) ||
  Boolean(req.headers['x-app-version']);

router.get('/public', optionalProtect, attachCountryContext, cacheMiddleware({ ttl: 120000, skipCache: skipCacheByHeader }), getPublicSettings);
router.get('/runtime', optionalProtect, attachCountryContext, cacheMiddleware({ ttl: 30000, skipCache: skipCacheByHeader }), getRuntimePublicConfig);
router.get('/cities', optionalProtect, attachCountryContext, cacheMiddleware({ ttl: 1800000, skipCache: skipCacheByHeader }), getPublicCities);
router.get('/communes', optionalProtect, attachCountryContext, cacheMiddleware({ ttl: 1800000, skipCache: skipCacheByHeader }), getPublicCommunes);
router.get('/currencies', optionalProtect, attachCountryContext, cacheMiddleware({ ttl: 1800000, skipCache: skipCacheByHeader }), getPublicCurrencies);
router.get('/hero-banner', getHeroBanner);
router.get('/app-logo', getAppLogo);
router.get('/promo-banner', getPromoBanner);
router.get('/splash', getSplash);
router.get('/networks', getActiveNetworks);
// Not wrapped in cacheMiddleware: on a cache hit it replays via res.json(),
// which forces Content-Type: application/json and would corrupt the
// application/manifest+json content-type this route needs. The controller's
// own Cache-Control header covers HTTP/CDN-level caching instead.
router.get('/manifest.webmanifest', getPublicManifest);

export default router;
