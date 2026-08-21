import mongoose from 'mongoose';

export const SOCIAL_CLICK_SOURCES = Object.freeze(['TIKTOK', 'WHATSAPP', 'INSTAGRAM', 'FACEBOOK', 'OTHER']);

// One row per /s/:socialCode visit — the click event behind a smart link.
// Deliberately light: sessionId/userId are only set when already available
// (an authenticated user or an existing anonymous session), never used to
// build a new invasive tracking identity.
const socialClickSchema = new mongoose.Schema(
  {
    socialCode: { type: String, trim: true, uppercase: true, required: true, index: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    source: { type: String, enum: SOCIAL_CLICK_SOURCES, default: 'OTHER' },
    campaign: { type: String, trim: true, default: '' },
    campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'SocialCampaign', default: null },
    sessionId: { type: String, trim: true, default: '' },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    converted: { type: Boolean, default: false },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
    clickedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

socialClickSchema.index({ productId: 1, clickedAt: -1 });
socialClickSchema.index({ shopId: 1, clickedAt: -1 });
socialClickSchema.index({ campaignId: 1, clickedAt: -1 });

export default mongoose.models.SocialClick || mongoose.model('SocialClick', socialClickSchema);
