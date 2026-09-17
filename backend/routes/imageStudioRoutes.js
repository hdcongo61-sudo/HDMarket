import express from 'express';
import multer from 'multer';
import { requireRole } from '../middlewares/roleMiddleware.js';
import { requireCountryContext } from '../middlewares/countryMiddleware.js';
import { adminImageEditJobs, recoverImageEditJob, getImageEditPricing, createImageEditJob, getImageEditJob, listImageEditJobs, runImageEditJob } from '../controllers/paidImageEditController.js';
import rateLimit from 'express-rate-limit';
import { protect } from '../middlewares/authMiddleware.js';
import { upload } from '../utils/upload.js';
import { analyzeImage, getImageStudioCapabilities, processImage } from '../controllers/imageStudioController.js';

const router = express.Router();
const imageStudioLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Math.max(3, Number(process.env.IMAGE_STUDIO_RATE_LIMIT || 15)),
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Trop de traitements photo. Réessayez dans un instant.' }
});

router.use(protect, imageStudioLimiter);
router.get('/paid/admin/jobs', requireRole(['admin']), requireCountryContext, adminImageEditJobs);
router.post('/paid/admin/jobs/:id/recover', requireRole(['admin']), requireCountryContext, recoverImageEditJob);
router.get('/paid/pricing', requireCountryContext, getImageEditPricing);
router.get('/paid/jobs', listImageEditJobs);
router.post('/paid/jobs', requireCountryContext, rateLimit({ windowMs: 3600000, max: 20, standardHeaders: true, legacyHeaders: false }), multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 4 } }).single('image'), createImageEditJob);
router.get('/paid/jobs/:id', getImageEditJob);
router.post('/paid/jobs/:id/run', runImageEditJob);
router.get('/capabilities', getImageStudioCapabilities);
router.post('/analyze', upload.single('image'), analyzeImage);
router.post('/process', upload.single('image'), processImage);

export default router;
