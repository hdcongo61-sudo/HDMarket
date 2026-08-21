import SocialInteraction from '../../models/socialInteractionModel.js';
import { resolveProductFromMessage, resolveProductById } from './productResolverService.js';
import { detectIntent } from './intentDetectorService.js';
import {
  buildSocialResponse,
  buildGreetingResponse,
  buildUnknownProductResponse,
  buildUnavailableProductResponse
} from './responseBuilderService.js';
import { getConversationContext, setConversationContext } from './conversationContextService.js';
import { isRateLimited } from './rateLimiter.js';
import { getConnector } from './connectorFactory.js';
import { enqueueSideEffectJob } from '../../queues/sideEffectQueue.js';

// Structured logs per spec §40 — event name first, safe fields only
// (channel/ids), never tokens/secrets/raw personal content.
const logSocialEvent = (event, fields = {}) => {
  console.log(event, fields);
};

const MAX_SEND_ATTEMPTS = 3;

/**
 * The single orchestration entry point for one normalized inbound message —
 * called by socialWebhookController for real provider webhooks and by the
 * dev-only simulate route with an identical shape, so both paths are
 * exercised the same way. Handles idempotency, product resolution
 * (including a short conversation-context follow-up), intent detection,
 * live response building, outbound send (with retry-on-failure via the
 * existing side-effect queue), and SocialInteraction persistence.
 */
export const handleInboundSocialMessage = async ({ channel, connectionId = null, message }) => {
  logSocialEvent('social.webhook.received', { channel, externalMessageId: message.externalMessageId });

  if (await isRateLimited(channel, message.externalUserId)) {
    logSocialEvent('social.response.failed', { channel, reason: 'rate_limited' });
    return { status: 'RATE_LIMITED' };
  }

  // Idempotency: the unique {channel, externalMessageId} index on
  // SocialInteraction does the real enforcement — a duplicate insert here
  // means "already processed", so acknowledge without repeating any
  // business action (spec §30/Scenario F).
  let interaction;
  try {
    interaction = await SocialInteraction.create({
      channel,
      connectionId,
      externalUserId: message.externalUserId,
      externalConversationId: message.externalConversationId || message.externalUserId,
      externalMessageId: message.externalMessageId,
      direction: 'INBOUND',
      text: message.text
    });
  } catch (error) {
    if (error?.code === 11000) {
      logSocialEvent('social.webhook.duplicate', { channel, externalMessageId: message.externalMessageId });
      return { status: 'DUPLICATE' };
    }
    throw error;
  }

  logSocialEvent('social.message.normalized', { channel, interactionId: interaction._id });

  const { intent, rawIntent } = detectIntent({ text: message.text });

  let resolution = await resolveProductFromMessage(message.text);
  if (!resolution.found && resolution.reason === 'PRODUCT_NOT_FOUND') {
    // No code in *this* message — check whether we recently discussed a
    // product with this same external user (spec §33 conversation context).
    const context = await getConversationContext(channel, message.externalUserId);
    if (context?.lastProductId && intent !== 'GREETING') {
      resolution = await resolveProductById(context.lastProductId);
    }
  }

  let responseText;
  if (resolution.found) {
    logSocialEvent('social.product.resolved', {
      channel,
      interactionId: interaction._id,
      productId: resolution.product._id,
      shopId: resolution.shop?._id || null
    });
    logSocialEvent('social.intent.detected', { channel, interactionId: interaction._id, intent });
    responseText = buildSocialResponse({
      channel,
      intent,
      product: resolution.product,
      shop: resolution.shop,
      socialCode: resolution.socialCode
    });
    await setConversationContext(channel, message.externalUserId, {
      lastProductId: resolution.product._id,
      lastIntent: intent
    });
  } else if (resolution.reason === 'PRODUCT_UNAVAILABLE') {
    responseText = buildUnavailableProductResponse();
  } else if (intent === 'GREETING') {
    responseText = buildGreetingResponse();
  } else {
    responseText = buildUnknownProductResponse();
  }

  const sendResult = await sendWithRetry({ channel, to: message.externalUserId, text: responseText });

  interaction.intent = intent;
  interaction.rawIntent = rawIntent;
  interaction.productId = resolution.product?._id || null;
  interaction.shopId = resolution.shop?._id || resolution.product?.user?._id || null;
  interaction.socialCode = resolution.socialCode || '';
  interaction.responseSent = sendResult.success;
  interaction.responseStatus = sendResult.success ? 'SENT' : sendResult.queued ? 'PENDING' : 'FAILED';
  await interaction.save();

  logSocialEvent(sendResult.success ? 'social.response.sent' : 'social.response.failed', {
    channel,
    interactionId: interaction._id,
    productId: interaction.productId,
    shopId: interaction.shopId
  });

  return { status: 'PROCESSED', interaction, responseText, sendResult };
};

// Best-effort inline send; on failure, hands off to the existing
// side-effect queue for a bounded, backed-off retry (spec §42) rather than
// blocking the webhook's own ack. If the queue itself is unavailable
// (no Redis), the failure is simply logged — a provider outage must never
// affect the rest of HDMarket (spec §60).
const sendWithRetry = async ({ channel, to, text }, attempt = 1) => {
  const connector = await getConnector(channel);
  if (!connector) return { success: false, error: 'CHANNEL_NOT_SUPPORTED' };
  if (!connector.isConfigured()) return { success: false, error: `${channel}_NOT_CONFIGURED` };

  const result = await connector.sendTextMessage({ to, text }).catch((error) => ({
    success: false,
    error: 'SEND_THREW',
    detail: String(error?.message || error).slice(0, 300)
  }));

  if (result.success || attempt >= MAX_SEND_ATTEMPTS) {
    return result;
  }

  const enqueued = await enqueueSideEffectJob(
    'social-outbound-retry',
    { channel, to, text, attempt: attempt + 1 },
    { delay: 2 ** attempt * 3000 }
  ).catch(() => null);

  return enqueued ? { ...result, queued: true } : result;
};

export const retryOutboundSocialMessage = async ({ channel, to, text, attempt = 1 }) =>
  sendWithRetry({ channel, to, text }, attempt);
