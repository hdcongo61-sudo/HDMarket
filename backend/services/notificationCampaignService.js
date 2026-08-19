import NotificationCampaign from '../models/notificationCampaignModel.js';
import FeatureFlag from '../models/featureFlagModel.js';
import User from '../models/userModel.js';
import Notification from '../models/notificationModel.js';
import { createNotification } from '../utils/notificationService.js';
import { isFeatureEnabled } from './configService.js';
import { buildAudienceFilter } from './notificationAudienceResolver.js';

const BATCH_SIZE = 200; // matches the existing seller-broadcast batch size in globalNotificationController.js

const CAMPAIGN_PRIORITY_TO_NOTIFICATION_PRIORITY = Object.freeze({
  low: 'LOW',
  normal: 'NORMAL',
  high: 'HIGH',
  urgent: 'CRITICAL'
});

const USER_SELECT_FIELDS =
  'role accountType countryId country city commune betaTester isBlocked isActive';

/** Structured action -> a concrete deepLink string, resolved server-side (never trust a frontend-built URL). */
export const resolveCampaignDeepLink = async (action = {}) => {
  if (!action?.enabled) return '';
  const target = String(action.target || '').trim();
  if (!target) return '';
  switch (action.type) {
    case 'product':
      return `/product/${encodeURIComponent(target)}`;
    case 'shop':
      return `/shop/${encodeURIComponent(target)}`;
    case 'category':
      return `/category/${encodeURIComponent(target)}`;
    case 'feature':
      return target.startsWith('/') ? target : `/${target}`;
    case 'internal_route':
      // Must stay in-app — reject anything that looks like an absolute URL.
      return /^https?:\/\//i.test(target) ? '' : target.startsWith('/') ? target : `/${target}`;
    case 'external_url':
      return /^https:\/\//i.test(target) ? target : '';
    default:
      return '';
  }
};

/** Fast, index-backed count for the composer's "Estimated recipients" preview. Does not evaluate feature-flag eligibility per user (see file header note in notificationAudienceResolver.js) — for a feature-gated campaign this is an upper bound, not an exact count. */
export const previewAudienceCount = async (audience = {}) => {
  const filter = buildAudienceFilter(audience);
  return User.countDocuments(filter);
};

const buildFeatureContext = (user) => ({
  role: user.role,
  accountType: user.accountType,
  userId: String(user._id),
  country: user.country,
  countryId: user.countryId ? String(user.countryId) : undefined,
  city: user.city,
  commune: user.commune,
  isBetaTester: Boolean(user.betaTester),
  isDeveloper: ['admin', 'founder'].includes(String(user.role || '').toLowerCase())
});

/**
 * Delivers a campaign to every matching, eligible recipient. Idempotent:
 * relies entirely on createNotification's existing {user,dedupeKey} unique
 * index (see utils/notificationService.js) — running this twice for the same
 * campaign is a no-op for users already delivered to.
 *
 * Cursor-based batching so this never loads the whole audience into memory,
 * suitable for hundreds of thousands of recipients.
 */
export const deliverCampaign = async (campaignId) => {
  const campaign = await NotificationCampaign.findById(campaignId);
  if (!campaign) throw new Error(`NotificationCampaign ${campaignId} not found`);
  if (!['scheduled', 'active'].includes(campaign.status)) {
    // Already completed/cancelled/paused — nothing to do (idempotent no-op).
    return { skipped: true, reason: `status is ${campaign.status}` };
  }

  campaign.status = 'active';
  campaign.startedAt = campaign.startedAt || new Date();
  await campaign.save();
  console.log(`[notificationCampaign] started campaign=${campaignId}`);

  let featureName = null;
  if (campaign.featureFlagId) {
    const flag = await FeatureFlag.findById(campaign.featureFlagId).select('featureName').lean();
    featureName = flag?.featureName || null;
  }

  const deepLink = await resolveCampaignDeepLink(campaign.action);
  const notificationPriority =
    CAMPAIGN_PRIORITY_TO_NOTIFICATION_PRIORITY[campaign.priority] || 'NORMAL';
  // Email/SMS are stored on the campaign for forward-compat / admin display
  // only — never forwarded to the delivery engine (no provider exists yet).
  const channels = ['IN_APP', ...(campaign.channels?.push !== false ? ['PUSH'] : [])];

  const filter = buildAudienceFilter(campaign.audience);
  const cursor = User.find(filter).select(USER_SELECT_FIELDS).lean().cursor();

  let targeted = 0;
  let sent = 0;
  let failed = 0;
  let batch = [];

  const flushBatch = async () => {
    if (!batch.length) return;
    const results = await Promise.all(
      batch.map(async (user) => {
        if (featureName) {
          const result = await isFeatureEnabled(featureName, buildFeatureContext(user)).catch(() => ({
            enabled: false
          }));
          if (!result.enabled) return null;
        }
        return createNotification({
          userId: user._id,
          actorId: campaign.createdBy,
          allowSelf: true,
          type: 'admin_campaign',
          priority: notificationPriority,
          channels,
          entityType: 'notificationCampaign',
          entityId: String(campaign._id),
          dedupeKey: `campaign:${campaign._id}`,
          deepLink,
          actionLink: deepLink,
          title: campaign.title,
          message: campaign.message,
          metadata: {
            campaignType: campaign.type,
            imageUrl: campaign.imageUrl || '',
            icon: campaign.icon || ''
          }
        }).catch(() => null);
      })
    );
    sent += results.filter(Boolean).length;
    failed += results.filter((result) => result === null).length;
    batch = [];
  };

  for await (const user of cursor) {
    targeted += 1;
    batch.push(user);
    if (batch.length >= BATCH_SIZE) {
      await flushBatch();
      await NotificationCampaign.updateOne(
        { _id: campaign._id },
        { $set: { 'stats.targeted': targeted, 'stats.sent': sent, 'stats.failed': failed } }
      );
      console.log(
        `[notificationCampaign] batch processed campaign=${campaignId} targeted=${targeted} sent=${sent} failed=${failed}`
      );
    }
  }
  await flushBatch();

  campaign.stats.targeted = targeted;
  campaign.stats.sent = sent;
  campaign.stats.failed = failed;
  campaign.status = 'completed';
  campaign.completedAt = new Date();
  await campaign.save();
  console.log(`[notificationCampaign] completed campaign=${campaignId} targeted=${targeted} sent=${sent} failed=${failed}`);

  return { targeted, sent, failed };
};

/** Admin campaign-analytics: reuses the exact aggregation pattern already established for the (unrelated) seller-broadcast feature — see computeCampaignStats in controllers/globalNotificationController.js. No dedicated analytics collection needed. */
export const computeCampaignAnalytics = async (campaignId) => {
  const rows = await Notification.aggregate([
    { $match: { entityType: 'notificationCampaign', entityId: String(campaignId) } },
    {
      $group: {
        _id: null,
        delivered: { $sum: 1 },
        opened: { $sum: { $cond: [{ $ne: ['$readAt', null] }, 1, 0] } },
        clicked: { $sum: { $cond: [{ $gt: ['$clickCount', 0] }, 1, 0] } },
        dismissed: { $sum: { $cond: [{ $ne: ['$deletedAt', null] }, 1, 0] } }
      }
    }
  ]);
  return (
    rows[0] || { delivered: 0, opened: 0, clicked: 0, dismissed: 0 }
  );
};

export default { previewAudienceCount, deliverCampaign, computeCampaignAnalytics, resolveCampaignDeepLink };
