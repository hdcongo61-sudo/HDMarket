import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  clickFindById: vi.fn(),
  clickExists: vi.fn(),
  interactionFindById: vi.fn(),
  campaignExists: vi.fn()
}));

vi.mock('../../models/socialClickModel.js', () => ({
  default: { findById: mocks.clickFindById, exists: mocks.clickExists }
}));
vi.mock('../../models/socialInteractionModel.js', () => ({ default: { findById: mocks.interactionFindById } }));
vi.mock('../../models/socialCampaignModel.js', () => ({ default: { exists: mocks.campaignExists } }));

const selectLean = (value) => ({ select: () => ({ lean: () => Promise.resolve(value) }) });

import { resolveAttributionForOrder } from './attributionService.js';

const VALID_ID_A = '507f1f77bcf86cd799439011';
const VALID_ID_B = '507f1f77bcf86cd799439012';

describe('attributionService.resolveAttributionForOrder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.clickExists.mockResolvedValue(false);
  });

  it('defaults to DIRECT when nothing is supplied', async () => {
    const result = await resolveAttributionForOrder({});
    expect(result.channel).toBe('DIRECT');
    expect(result.socialClickId).toBeNull();
  });

  it('defaults to DIRECT when the supplied ids are not valid ObjectIds (never trusts client input blindly)', async () => {
    const result = await resolveAttributionForOrder({ socialClickId: 'not-an-id' });
    expect(result.channel).toBe('DIRECT');
    expect(mocks.clickFindById).not.toHaveBeenCalled();
  });

  it('defaults to DIRECT when the referenced SocialClick does not actually exist', async () => {
    mocks.clickFindById.mockReturnValue(selectLean(null));
    const result = await resolveAttributionForOrder({ socialClickId: VALID_ID_A });
    expect(result.channel).toBe('DIRECT');
    expect(result.socialClickId).toBeNull();
  });

  it('maps a TIKTOK-sourced click to TIKTOK_WHATSAPP (spec: TikTok has no bare channel)', async () => {
    mocks.clickFindById.mockReturnValue(selectLean({ _id: VALID_ID_A, source: 'TIKTOK', socialCode: 'HD-8F42K' }));
    const result = await resolveAttributionForOrder({ socialClickId: VALID_ID_A });
    expect(result.channel).toBe('TIKTOK_WHATSAPP');
    expect(String(result.socialClickId)).toBe(VALID_ID_A);
    expect(result.sourceProductCode).toBe('HD-8F42K');
  });

  it('maps an INSTAGRAM-sourced click to INSTAGRAM_DM', async () => {
    mocks.clickFindById.mockReturnValue(selectLean({ _id: VALID_ID_A, source: 'INSTAGRAM', socialCode: 'HD-8F42K' }));
    const result = await resolveAttributionForOrder({ socialClickId: VALID_ID_A });
    expect(result.channel).toBe('INSTAGRAM_DM');
  });

  it('maps a WhatsApp SocialInteraction (no prior TikTok click) to plain WHATSAPP', async () => {
    mocks.interactionFindById.mockReturnValue(
      selectLean({ _id: VALID_ID_A, channel: 'WHATSAPP', socialCode: 'HD-8F42K', createdAt: new Date() })
    );
    const result = await resolveAttributionForOrder({ socialInteractionId: VALID_ID_A });
    expect(result.channel).toBe('WHATSAPP');
    expect(String(result.socialInteractionId)).toBe(VALID_ID_A);
  });

  it('maps a WhatsApp SocialInteraction WITH a recent TikTok click on the same code to TIKTOK_WHATSAPP (first-touch merge)', async () => {
    mocks.clickExists.mockResolvedValue(true);
    mocks.interactionFindById.mockReturnValue(
      selectLean({ _id: VALID_ID_A, channel: 'WHATSAPP', socialCode: 'HD-8F42K', createdAt: new Date() })
    );
    const result = await resolveAttributionForOrder({ socialInteractionId: VALID_ID_A });
    expect(result.channel).toBe('TIKTOK_WHATSAPP');
  });

  it('maps an INSTAGRAM SocialInteraction to INSTAGRAM_DM', async () => {
    mocks.interactionFindById.mockReturnValue(
      selectLean({ _id: VALID_ID_A, channel: 'INSTAGRAM', socialCode: 'HD-8F42K', createdAt: new Date() })
    );
    const result = await resolveAttributionForOrder({ socialInteractionId: VALID_ID_A });
    expect(result.channel).toBe('INSTAGRAM_DM');
  });

  it('maps a FACEBOOK_MESSENGER SocialInteraction to FACEBOOK_MESSENGER', async () => {
    mocks.interactionFindById.mockReturnValue(
      selectLean({ _id: VALID_ID_A, channel: 'FACEBOOK_MESSENGER', socialCode: 'HD-8F42K', createdAt: new Date() })
    );
    const result = await resolveAttributionForOrder({ socialInteractionId: VALID_ID_A });
    expect(result.channel).toBe('FACEBOOK_MESSENGER');
  });

  it('rejects a socialCampaignId that does not correspond to a real campaign', async () => {
    mocks.campaignExists.mockResolvedValue(null);
    const result = await resolveAttributionForOrder({ socialCampaignId: VALID_ID_B });
    expect(result.socialCampaignId).toBeNull();
  });

  it('accepts a socialCampaignId that is verified to exist', async () => {
    mocks.campaignExists.mockResolvedValue(true);
    const result = await resolveAttributionForOrder({ socialCampaignId: VALID_ID_B });
    expect(String(result.socialCampaignId)).toBe(VALID_ID_B);
  });
});
