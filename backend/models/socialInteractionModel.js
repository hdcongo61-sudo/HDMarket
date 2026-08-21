import mongoose from 'mongoose';

export const SOCIAL_INTERACTION_DIRECTIONS = Object.freeze(['INBOUND', 'OUTBOUND']);
export const SOCIAL_RESPONSE_STATUSES = Object.freeze(['PENDING', 'SENT', 'FAILED']);
export const SOCIAL_INTENTS = Object.freeze([
  'PRICE',
  'AVAILABILITY',
  'DELIVERY',
  'ORDER',
  'PRODUCT_INFO',
  'SHOP_INFO',
  'WHOLESALE',
  'INSTALLMENT',
  'GREETING',
  'UNKNOWN'
]);

// One row per inbound/outbound social message. Data-minimized by design
// (§39/§19 of the spec): we store the provider's external user/conversation
// IDs, not names or phone numbers, and never the raw message text longer
// than needed for support/debugging.
const socialInteractionSchema = new mongoose.Schema(
  {
    channel: { type: String, required: true, index: true },
    connectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'SocialConnection', default: null },
    externalUserId: { type: String, trim: true, required: true },
    externalConversationId: { type: String, trim: true, default: '' },
    // Idempotency key (with channel) — a provider redelivering the same
    // webhook event must never be processed twice. See the unique index below.
    externalMessageId: { type: String, trim: true, default: '' },
    direction: { type: String, enum: SOCIAL_INTERACTION_DIRECTIONS, required: true },
    rawIntent: { type: String, trim: true, default: '' },
    intent: { type: String, enum: SOCIAL_INTENTS, default: 'UNKNOWN' },
    text: { type: String, trim: true, maxlength: 1000, default: '' },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null, index: true },
    shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    socialCode: { type: String, trim: true, uppercase: true, default: '' },
    responseSent: { type: Boolean, default: false },
    responseStatus: { type: String, enum: SOCIAL_RESPONSE_STATUSES, default: 'PENDING' },
    clickedProduct: { type: Boolean, default: false },
    converted: { type: Boolean, default: false },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

// Idempotency: a given provider message can only ever create one interaction.
// Partial (only when externalMessageId is a real non-empty string) so dev/
// simulated messages without a provider ID don't collide with each other.
socialInteractionSchema.index(
  { channel: 1, externalMessageId: 1 },
  { unique: true, partialFilterExpression: { externalMessageId: { $type: 'string', $gt: '' } } }
);
socialInteractionSchema.index({ shopId: 1, createdAt: -1 });
socialInteractionSchema.index({ productId: 1, createdAt: -1 });
socialInteractionSchema.index({ channel: 1, externalUserId: 1, createdAt: -1 });

export default mongoose.models.SocialInteraction ||
  mongoose.model('SocialInteraction', socialInteractionSchema);
