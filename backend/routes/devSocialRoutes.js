import express from 'express';
import asyncHandler from 'express-async-handler';
import { SOCIAL_CHANNELS } from '../models/socialConnectionModel.js';
import { normalizeInboundMessage } from '../services/socialCommerce/normalizeSocialMessage.js';
import { handleInboundSocialMessage } from '../services/socialCommerce/socialCommerceService.js';

const router = express.Router();

// Dev/test-only simulator (spec §55) — lets the whole inbound pipeline
// (idempotency, product resolution, intent detection, live response,
// interaction persistence) be exercised without any real WhatsApp/
// Instagram/Messenger account or webhook. Mounting is gated in server.js to
// NODE_ENV !== 'production' — this file must never be reachable in prod.
router.post(
  '/simulate',
  asyncHandler(async (req, res) => {
    const channel = String(req.body?.channel || '').toUpperCase();
    if (!SOCIAL_CHANNELS.includes(channel)) {
      return res.status(400).json({ success: false, message: 'channel must be one of ' + SOCIAL_CHANNELS.join(', ') });
    }
    const externalUserId = String(req.body?.externalUserId || '').trim();
    if (!externalUserId) {
      return res.status(400).json({ success: false, message: 'externalUserId is required' });
    }

    const message = normalizeInboundMessage({
      channel,
      externalUserId,
      externalConversationId: externalUserId,
      externalMessageId: req.body?.externalMessageId || `sim-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      text: req.body?.message || ''
    });

    const result = await handleInboundSocialMessage({ channel, message });
    return res.json({ success: true, data: result });
  })
);

export default router;
