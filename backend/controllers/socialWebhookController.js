import asyncHandler from 'express-async-handler';
import { isFeatureEnabled } from '../services/configService.js';
import { getConnector } from '../services/socialCommerce/connectorFactory.js';
import { normalizeInboundMessage } from '../services/socialCommerce/normalizeSocialMessage.js';
import { handleInboundSocialMessage } from '../services/socialCommerce/socialCommerceService.js';
import SocialConnection, { SOCIAL_CHANNELS } from '../models/socialConnectionModel.js';

const CHANNEL_FEATURE_FLAGS = {
  WHATSAPP: 'social_whatsapp',
  INSTAGRAM: 'social_instagram',
  FACEBOOK_MESSENGER: 'social_facebook_messenger',
  TIKTOK_MESSAGING: 'social_tiktok_messaging'
};

const normalizeChannelParam = (raw) => {
  const value = String(raw || '').toUpperCase();
  return SOCIAL_CHANNELS.includes(value) ? value : null;
};

// GET /api/webhooks/social/:channel — Meta's one-time webhook subscription
// handshake (hub.mode/hub.verify_token/hub.challenge). Same shape for
// WhatsApp/Instagram/Messenger; TikTok's stub connector always fails it
// (not configured), which is correct — there's nothing to verify.
export const verifySocialWebhook = asyncHandler(async (req, res) => {
  const channel = normalizeChannelParam(req.params.channel);
  if (!channel) return res.sendStatus(404);

  const connector = await getConnector(channel);
  const result = connector.verifyWebhook(req);
  if (result.verified) {
    return res.status(200).send(result.challenge);
  }
  return res.sendStatus(403);
});

// POST /api/webhooks/social/:channel — inbound message delivery. Always
// verifies the signature first (reject bad signatures outright — spec §30),
// then checks the per-channel feature flag: if disabled, acknowledge with
// 200 but do NOT process (spec §26/Scenario G) — providers back off/disable
// a webhook that doesn't 200, so silently ack-and-skip is required, not a 404.
export const receiveSocialWebhook = asyncHandler(async (req, res) => {
  const channel = normalizeChannelParam(req.params.channel);
  if (!channel) return res.sendStatus(404);

  const connector = await getConnector(channel);
  const verify = connector.verifyWebhook(req);
  if (!verify.verified) {
    return res.sendStatus(403);
  }

  const flagKey = CHANNEL_FEATURE_FLAGS[channel];
  const flag = await isFeatureEnabled(flagKey, {}).catch(() => ({ enabled: false }));
  if (!flag.enabled) {
    return res.sendStatus(200);
  }

  await SocialConnection.updateOne(
    { ownerType: 'PLATFORM', channel },
    { $set: { lastWebhookAt: new Date() } }
  ).catch(() => {});

  const rawMessages = connector.parseInbound(req.body);
  // Sequential on purpose: idempotency + rate-limit checks touch shared
  // per-user state, and a single delivery rarely batches more than a
  // handful of messages, so the latency cost is negligible.
  for (const raw of rawMessages) {
    const message = normalizeInboundMessage(raw);
    if (!message.externalUserId) continue;
    try {
      // eslint-disable-next-line no-await-in-loop
      await handleInboundSocialMessage({ channel, connectionId: connector.connection?._id || null, message });
    } catch (error) {
      console.error('social.webhook.processing_error', { channel, error: String(error?.message || error) });
    }
  }

  return res.sendStatus(200);
});
