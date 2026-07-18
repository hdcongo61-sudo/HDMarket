import express from 'express';
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
router.get('/capabilities', getImageStudioCapabilities);
router.post('/analyze', upload.single('image'), analyzeImage);
router.post('/process', upload.single('image'), processImage);

export default router;
