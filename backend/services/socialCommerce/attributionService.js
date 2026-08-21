import mongoose from 'mongoose';
import SocialClick from '../../models/socialClickModel.js';
import SocialInteraction from '../../models/socialInteractionModel.js';
import SocialCampaign from '../../models/socialCampaignModel.js';

const isValidId = (value) => Boolean(value) && mongoose.Types.ObjectId.isValid(String(value));

// SocialClick.source -> Order.acquisition.channel when the customer never
// actually messaged anyone (browsed straight from the smart link to
// checkout). TIKTOK has no bare "TIKTOK" channel in the Order enum by
// design — the architecture is always TikTok -> WhatsApp -> HDMarket, so a
// TikTok-sourced click maps to TIKTOK_WHATSAPP even before/without a
// confirmed WhatsApp conversation.
const CLICK_SOURCE_TO_CHANNEL = {
  TIKTOK: 'TIKTOK_WHATSAPP',
  WHATSAPP: 'WHATSAPP',
  INSTAGRAM: 'INSTAGRAM_DM',
  FACEBOOK: 'FACEBOOK_MESSENGER',
  OTHER: 'DIRECT'
};

const INTERACTION_CHANNEL_TO_ORDER_CHANNEL = {
  WHATSAPP: 'WHATSAPP',
  INSTAGRAM: 'INSTAGRAM_DM',
  FACEBOOK_MESSENGER: 'FACEBOOK_MESSENGER',
  TIKTOK_MESSAGING: 'TIKTOK_MESSAGING'
};

const FIRST_TOUCH_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

// Best-effort first-touch merge: a WhatsApp conversation about a product
// that was also recently smart-linked from a TikTok click (same socialCode)
// is attributed as TIKTOK_WHATSAPP rather than plain WHATSAPP. This can't be
// a guaranteed cross-device link (WhatsApp doesn't share the browser's
// localStorage) — it's a practical approximation, not a certainty.
const resolveWhatsappChannel = async (interaction) => {
  if (!interaction?.socialCode) return 'WHATSAPP';
  const since = new Date(interaction.createdAt || Date.now());
  since.setTime(since.getTime() - FIRST_TOUCH_WINDOW_MS);
  const priorTikTokClick = await SocialClick.exists({
    socialCode: interaction.socialCode,
    source: 'TIKTOK',
    clickedAt: { $gte: since, $lte: interaction.createdAt || new Date() }
  });
  return priorTikTokClick ? 'TIKTOK_WHATSAPP' : 'WHATSAPP';
};

/**
 * Validates a client-supplied social attribution payload against real
 * SocialClick/SocialInteraction records — never trusts a bare channel string
 * from the client (spec §9/§30). Returns the shape to assign directly to
 * `order.acquisition`; defaults to DIRECT when nothing valid is supplied.
 */
export const resolveAttributionForOrder = async ({ socialClickId, socialInteractionId, socialCampaignId } = {}) => {
  const base = {
    channel: 'DIRECT',
    socialInteractionId: null,
    socialCampaignId: null,
    socialClickId: null,
    sourceProductCode: ''
  };

  if (isValidId(socialInteractionId)) {
    const interaction = await SocialInteraction.findById(socialInteractionId)
      .select('channel socialCode createdAt')
      .lean();
    if (interaction) {
      const mapped = INTERACTION_CHANNEL_TO_ORDER_CHANNEL[interaction.channel];
      if (mapped) {
        base.channel = mapped === 'WHATSAPP' ? await resolveWhatsappChannel(interaction) : mapped;
        base.socialInteractionId = interaction._id;
        base.sourceProductCode = interaction.socialCode || '';
      }
    }
  }

  if (isValidId(socialClickId)) {
    const click = await SocialClick.findById(socialClickId)
      .select('source socialCode campaignId')
      .lean();
    if (click) {
      base.socialClickId = click._id;
      if (!base.sourceProductCode) base.sourceProductCode = click.socialCode || '';
      // Only use the click's channel mapping if no (stronger) interaction
      // signal already set one above.
      if (base.channel === 'DIRECT') {
        base.channel = CLICK_SOURCE_TO_CHANNEL[click.source] || 'DIRECT';
      }
      if (!base.socialCampaignId && click.campaignId) {
        base.socialCampaignId = click.campaignId;
      }
    }
  }

  if (isValidId(socialCampaignId) && !base.socialCampaignId) {
    // Verify it actually exists rather than trusting a client-supplied id
    // outright — same "never trust directly" principle as the click/
    // interaction lookups above.
    const campaignExists = await SocialCampaign.exists({ _id: socialCampaignId });
    if (campaignExists) base.socialCampaignId = new mongoose.Types.ObjectId(String(socialCampaignId));
  }

  return base;
};
