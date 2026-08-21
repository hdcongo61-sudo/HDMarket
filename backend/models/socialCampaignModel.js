import mongoose from 'mongoose';

const slugifyUpper = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

export const SOCIAL_CAMPAIGN_CHANNELS = Object.freeze(['TIKTOK', 'WHATSAPP', 'INSTAGRAM', 'FACEBOOK', 'OTHER']);

// A seller/admin-created promotional grouping around one product + channel,
// used to build a campaign-tagged smart link
// (/s/HD-8F42K?source=tiktok&campaign=TK-AUG-01) and to attribute orders back
// to that specific push, not just the channel in general.
const socialCampaignSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, required: true, maxlength: 120 },
    shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    channel: { type: String, enum: SOCIAL_CAMPAIGN_CHANNELS, required: true },
    campaignCode: { type: String, trim: true, uppercase: true, unique: true, index: true },
    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { timestamps: true }
);

socialCampaignSchema.index({ shopId: 1, createdAt: -1 });

// Own collision-retry loop (not utils/slugUtils.js's generateUniqueSlug) —
// that helper's candidate strings are lowercase, but this field is stored
// uppercase (schema `uppercase: true`), so a lowercase existence check would
// never see a real collision. Same retry shape as Product's
// confirmationNumber/socialCode generators.
socialCampaignSchema.pre('validate', async function assignCampaignCode(next) {
  if (this.campaignCode) return next();
  try {
    const base = slugifyUpper(`${this.channel || 'SOCIAL'}-${this.name || this._id}`) || `CAMPAIGN-${Date.now()}`;
    const Model = this.constructor;
    let candidate = base;
    let suffix = 0;
    while (await Model.exists({ campaignCode: candidate, _id: { $ne: this._id } })) {
      suffix += 1;
      candidate = `${base}-${suffix}`;
    }
    this.campaignCode = candidate;
    next();
  } catch (error) {
    next(error);
  }
});

export default mongoose.models.SocialCampaign || mongoose.model('SocialCampaign', socialCampaignSchema);
