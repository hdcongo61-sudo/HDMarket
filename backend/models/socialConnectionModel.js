import mongoose from 'mongoose';

export const SOCIAL_CHANNELS = Object.freeze([
  'WHATSAPP',
  'INSTAGRAM',
  'FACEBOOK_MESSENGER',
  'TIKTOK_MESSAGING'
]);

export const SOCIAL_CONNECTION_STATUSES = Object.freeze([
  'DISCONNECTED',
  'PENDING',
  'CONNECTED',
  'ERROR',
  'DISABLED'
]);

// A platform-level or shop-level channel configuration. Provider credentials
// live only in credentialsEncrypted (AES-256-GCM via utils/encryption.js) —
// never returned to the frontend, never logged. See
// services/socialCommerce/connectors/SocialConnector.js for how a connector
// consumes this document.
const socialConnectionSchema = new mongoose.Schema(
  {
    ownerType: { type: String, enum: ['PLATFORM', 'SHOP'], required: true, default: 'PLATFORM' },
    // Required when ownerType === 'SHOP' (a User with accountType 'shop');
    // null for platform-level connections.
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    channel: { type: String, enum: SOCIAL_CHANNELS, required: true },
    // Optional country scoping for the multi-country future (e.g. a
    // "HDMarket Congo WhatsApp" vs "HDMarket Cameroon WhatsApp") — null means
    // this connection currently serves every country.
    countryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Country', default: null },
    provider: { type: String, trim: true, default: 'meta' },
    status: { type: String, enum: SOCIAL_CONNECTION_STATUSES, default: 'DISCONNECTED' },
    // { encrypted, iv, salt, tag } from utils/encryption.js — opaque here.
    credentialsEncrypted: { type: mongoose.Schema.Types.Mixed, default: null, select: false },
    // Non-sensitive display metadata only (e.g. phone number display name,
    // Instagram handle, page name) — never tokens.
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    lastWebhookAt: { type: Date, default: null },
    lastOutboundAt: { type: Date, default: null },
    lastErrorAt: { type: Date, default: null },
    lastErrorMessage: { type: String, trim: true, default: '' },
    connectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    connectedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

// One connection per (owner, channel, country) — prevents accidentally
// creating two competing "platform WhatsApp" connections.
socialConnectionSchema.index(
  { ownerType: 1, ownerId: 1, channel: 1, countryId: 1 },
  { unique: true }
);

export default mongoose.models.SocialConnection ||
  mongoose.model('SocialConnection', socialConnectionSchema);
