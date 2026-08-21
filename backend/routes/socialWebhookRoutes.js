import express from 'express';
import rateLimit from 'express-rate-limit';
import { verifySocialWebhook, receiveSocialWebhook } from '../controllers/socialWebhookController.js';

const router = express.Router();

// Generous but bounded — a misbehaving/compromised provider integration
// must never be able to hammer this endpoint unbounded (spec §30/§32).
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false
});

router.use(webhookLimiter);

router.get('/:channel', verifySocialWebhook);
router.post('/:channel', receiveSocialWebhook);

export default router;
