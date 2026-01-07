import express from 'express';
import { getAppLogo, getHeroBanner } from '../controllers/siteSettingController.js';

const router = express.Router();

router.get('/hero-banner', getHeroBanner);
router.get('/app-logo', getAppLogo);

export default router;
