import mongoose from 'mongoose';

// Admin-authored broadcast campaigns (announcements, promos, feature launches,
// maintenance notices, ...). Distinct from GlobalNotificationRequest, which is
// the unrelated seller-paid "sponsor a broadcast" feature — do not merge them.
export const NOTIFICATION_CAMPAIGN_TYPES = Object.freeze([
  'announcement',
  'promotion',
  'feature',
  'maintenance',
  'important',
  'custom'
]);

export const NOTIFICATION_CAMPAIGN_PRIORITIES = Object.freeze(['low', 'normal', 'high', 'urgent']);

export const NOTIFICATION_CAMPAIGN_STATUSES = Object.freeze([
  'draft',
  'scheduled',
  'active',
  'paused',
  'completed',
  'cancelled'
]);

const audienceSchema = new mongoose.Schema(
  {
    userTypes: { type: [String], default: [] }, // 'all' | 'new_users' | 'buyers' | 'sellers' | 'shops' | 'delivery_agents'
    roles: { type: [String], default: [] },
    countryIds: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Country' }], default: [] },
    cityIds: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'City' }], default: [] },
    communeIds: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Commune' }], default: [] },
    specificUserIds: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], default: [] },
    testerGroup: { type: Boolean, default: false } // true = betaTester-only
  },
  { _id: false }
);

// Exported so onboardingSequenceModel.js's per-step action/channels can reuse
// the exact same shape instead of drifting out of sync.
export const notificationActionSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: false },
    label: { type: String, trim: true, maxlength: 60, default: '' },
    type: {
      type: String,
      enum: ['internal_route', 'product', 'shop', 'category', 'feature', 'external_url', 'none'],
      default: 'none'
    },
    target: { type: String, trim: true, maxlength: 500, default: '' }
  },
  { _id: false }
);

// Stored for forward-compatibility / admin UI display only — no email/SMS
// provider is wired up in this codebase yet, see notificationCampaignService.js.
export const notificationChannelsSchema = new mongoose.Schema(
  {
    inApp: { type: Boolean, default: true },
    push: { type: Boolean, default: true },
    email: { type: Boolean, default: false },
    sms: { type: Boolean, default: false }
  },
  { _id: false }
);

const actionSchema = notificationActionSchema;
const channelsSchema = notificationChannelsSchema;

const statsSchema = new mongoose.Schema(
  {
    targeted: { type: Number, default: 0, min: 0 },
    queued: { type: Number, default: 0, min: 0 },
    sent: { type: Number, default: 0, min: 0 },
    failed: { type: Number, default: 0, min: 0 }
  },
  { _id: false }
);

const notificationCampaignSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    message: { type: String, required: true, trim: true, maxlength: 500 },
    shortDescription: { type: String, trim: true, maxlength: 160, default: '' },
    imageUrl: { type: String, trim: true, default: '' },
    icon: { type: String, trim: true, default: '' },
    type: { type: String, enum: NOTIFICATION_CAMPAIGN_TYPES, default: 'announcement', index: true },
    // Maps 1:1 onto Notification.priority (LOW/NORMAL/HIGH/CRITICAL) — 'urgent'
    // here becomes 'CRITICAL' there, see notificationCampaignService.js.
    priority: { type: String, enum: NOTIFICATION_CAMPAIGN_PRIORITIES, default: 'normal' },
    audience: { type: audienceSchema, default: () => ({}) },
    action: { type: actionSchema, default: () => ({}) },
    channels: { type: channelsSchema, default: () => ({}) },
    status: { type: String, enum: NOTIFICATION_CAMPAIGN_STATUSES, default: 'draft', index: true },
    schedule: {
      startAt: { type: Date, default: null },
      endAt: { type: Date, default: null }
    },
    // Gate the campaign behind a feature flag's eligibility resolver — a
    // recipient who can't access the feature is never sent the announcement
    // (see services/configService.js isFeatureEnabled, used by
    // notificationCampaignService.js).
    featureFlagId: { type: mongoose.Schema.Types.ObjectId, ref: 'FeatureFlag', default: null },
    stats: { type: statsSchema, default: () => ({}) },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    lastError: { type: String, trim: true, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { timestamps: true }
);

notificationCampaignSchema.index({ status: 1, createdAt: -1 });
notificationCampaignSchema.index({ 'schedule.startAt': 1, status: 1 });
notificationCampaignSchema.index({ createdAt: -1 });

export default mongoose.models.NotificationCampaign ||
  mongoose.model('NotificationCampaign', notificationCampaignSchema);
