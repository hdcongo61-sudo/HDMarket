import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  interactionCreate: vi.fn(),
  resolveProductFromMessage: vi.fn(),
  resolveProductById: vi.fn(),
  detectIntent: vi.fn(),
  buildSocialResponse: vi.fn(),
  buildGreetingResponse: vi.fn(),
  buildUnknownProductResponse: vi.fn(),
  buildUnavailableProductResponse: vi.fn(),
  getConversationContext: vi.fn(),
  setConversationContext: vi.fn(),
  isRateLimited: vi.fn(),
  getConnector: vi.fn(),
  enqueueSideEffectJob: vi.fn()
}));

vi.mock('../../models/socialInteractionModel.js', () => ({ default: { create: mocks.interactionCreate } }));
vi.mock('./productResolverService.js', () => ({
  resolveProductFromMessage: mocks.resolveProductFromMessage,
  resolveProductById: mocks.resolveProductById
}));
vi.mock('./intentDetectorService.js', () => ({ detectIntent: mocks.detectIntent }));
vi.mock('./responseBuilderService.js', () => ({
  buildSocialResponse: mocks.buildSocialResponse,
  buildGreetingResponse: mocks.buildGreetingResponse,
  buildUnknownProductResponse: mocks.buildUnknownProductResponse,
  buildUnavailableProductResponse: mocks.buildUnavailableProductResponse
}));
vi.mock('./conversationContextService.js', () => ({
  getConversationContext: mocks.getConversationContext,
  setConversationContext: mocks.setConversationContext
}));
vi.mock('./rateLimiter.js', () => ({ isRateLimited: mocks.isRateLimited }));
vi.mock('./connectorFactory.js', () => ({ getConnector: mocks.getConnector }));
vi.mock('../../queues/sideEffectQueue.js', () => ({ enqueueSideEffectJob: mocks.enqueueSideEffectJob }));

import { handleInboundSocialMessage } from './socialCommerceService.js';

const buildMessage = (overrides = {}) => ({
  externalUserId: 'user-123',
  externalConversationId: 'user-123',
  externalMessageId: 'wamid.ABC',
  text: 'prix HD-8F42K',
  ...overrides
});

const okConnector = (result = { success: true }) => ({
  isConfigured: () => true,
  sendTextMessage: vi.fn().mockResolvedValue(result)
});

describe('socialCommerceService.handleInboundSocialMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isRateLimited.mockResolvedValue(false);
    mocks.detectIntent.mockReturnValue({ intent: 'PRICE', rawIntent: 'PRICE' });
    mocks.getConversationContext.mockResolvedValue(null);
    mocks.getConnector.mockResolvedValue(okConnector());
  });

  it('suppresses processing when the external user is rate limited', async () => {
    mocks.isRateLimited.mockResolvedValue(true);
    const result = await handleInboundSocialMessage({ channel: 'WHATSAPP', message: buildMessage() });
    expect(result.status).toBe('RATE_LIMITED');
    expect(mocks.interactionCreate).not.toHaveBeenCalled();
  });

  it('acknowledges a duplicate webhook delivery without reprocessing (Scenario F)', async () => {
    const duplicateError = Object.assign(new Error('duplicate'), { code: 11000 });
    mocks.interactionCreate.mockRejectedValue(duplicateError);
    const result = await handleInboundSocialMessage({ channel: 'WHATSAPP', message: buildMessage() });
    expect(result.status).toBe('DUPLICATE');
    expect(mocks.resolveProductFromMessage).not.toHaveBeenCalled();
  });

  it('replies with the unknown-product message and does not hallucinate (Scenario E)', async () => {
    const savedInteraction = { _id: 'interaction-1', save: vi.fn().mockResolvedValue(undefined) };
    mocks.interactionCreate.mockResolvedValue(savedInteraction);
    mocks.resolveProductFromMessage.mockResolvedValue({ found: false, reason: 'PRODUCT_NOT_FOUND' });
    mocks.buildUnknownProductResponse.mockReturnValue('Je n’ai pas trouvé le produit.');

    const result = await handleInboundSocialMessage({ channel: 'WHATSAPP', message: buildMessage({ text: 'prix HD-XXXXX' }) });

    expect(result.status).toBe('PROCESSED');
    expect(result.responseText).toContain('trouv');
    expect(savedInteraction.responseSent).toBe(true);
  });

  it('replies with the unavailable-product message for a deleted/disabled product (Scenario deleted product)', async () => {
    const savedInteraction = { _id: 'interaction-1', save: vi.fn().mockResolvedValue(undefined) };
    mocks.interactionCreate.mockResolvedValue(savedInteraction);
    mocks.resolveProductFromMessage.mockResolvedValue({ found: false, reason: 'PRODUCT_UNAVAILABLE' });
    mocks.buildUnavailableProductResponse.mockReturnValue('Ce produit n’est plus disponible.');

    const result = await handleInboundSocialMessage({ channel: 'WHATSAPP', message: buildMessage() });

    expect(mocks.buildUnavailableProductResponse).toHaveBeenCalled();
    expect(result.responseText).toContain('plus disponible');
  });

  it('resolves a product, builds a live response, sends it, and persists the interaction', async () => {
    const savedInteraction = { _id: 'interaction-1', save: vi.fn().mockResolvedValue(undefined) };
    mocks.interactionCreate.mockResolvedValue(savedInteraction);
    const product = { _id: 'prod-1' };
    const shop = { _id: 'shop-1' };
    mocks.resolveProductFromMessage.mockResolvedValue({ found: true, product, shop, socialCode: 'HD-8F42K' });
    mocks.buildSocialResponse.mockReturnValue('Prix : 45 000 FCFA');

    const result = await handleInboundSocialMessage({ channel: 'WHATSAPP', message: buildMessage() });

    expect(result.status).toBe('PROCESSED');
    expect(result.responseText).toBe('Prix : 45 000 FCFA');
    expect(savedInteraction.productId).toBe(product._id);
    expect(savedInteraction.shopId).toBe(shop._id);
    expect(savedInteraction.responseStatus).toBe('SENT');
    expect(mocks.setConversationContext).toHaveBeenCalledWith('WHATSAPP', 'user-123', { lastProductId: product._id, lastIntent: 'PRICE' });
  });

  it('falls back to the conversation context when a follow-up message has no code', async () => {
    const savedInteraction = { _id: 'interaction-2', save: vi.fn().mockResolvedValue(undefined) };
    mocks.interactionCreate.mockResolvedValue(savedInteraction);
    mocks.detectIntent.mockReturnValue({ intent: 'DELIVERY', rawIntent: 'DELIVERY' });
    mocks.resolveProductFromMessage.mockResolvedValue({ found: false, reason: 'PRODUCT_NOT_FOUND' });
    mocks.getConversationContext.mockResolvedValue({ lastProductId: 'prod-1', lastIntent: 'PRICE' });
    const product = { _id: 'prod-1' };
    mocks.resolveProductById.mockResolvedValue({ found: true, product, shop: null, socialCode: 'HD-8F42K' });
    mocks.buildSocialResponse.mockReturnValue('La livraison dépend de votre zone.');

    const result = await handleInboundSocialMessage({
      channel: 'WHATSAPP',
      message: buildMessage({ text: 'vous livrez à Bacongo ?' })
    });

    expect(mocks.resolveProductById).toHaveBeenCalledWith('prod-1');
    expect(result.responseText).toContain('livraison');
  });

  it('queues a retry when the outbound send fails, instead of blocking the webhook ack', async () => {
    const savedInteraction = { _id: 'interaction-3', save: vi.fn().mockResolvedValue(undefined) };
    mocks.interactionCreate.mockResolvedValue(savedInteraction);
    mocks.resolveProductFromMessage.mockResolvedValue({ found: false, reason: 'PRODUCT_NOT_FOUND' });
    mocks.getConnector.mockResolvedValue(okConnector({ success: false, error: 'SEND_FAILED' }));
    mocks.enqueueSideEffectJob.mockResolvedValue({ id: 'job-1' });

    const result = await handleInboundSocialMessage({ channel: 'WHATSAPP', message: buildMessage() });

    expect(mocks.enqueueSideEffectJob).toHaveBeenCalledWith(
      'social-outbound-retry',
      expect.objectContaining({ channel: 'WHATSAPP', attempt: 2 }),
      expect.any(Object)
    );
    expect(result.status).toBe('PROCESSED');
    expect(savedInteraction.responseStatus).toBe('PENDING');
  });
});
