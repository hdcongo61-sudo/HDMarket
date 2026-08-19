import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import NotificationCampaign, {
  NOTIFICATION_CAMPAIGN_PRIORITIES,
  NOTIFICATION_CAMPAIGN_STATUSES,
  NOTIFICATION_CAMPAIGN_TYPES
} from '../models/notificationCampaignModel.js';
import {
  computeCampaignAnalytics,
  deliverCampaign,
  previewAudienceCount
} from '../services/notificationCampaignService.js';
import { enqueueCampaignDelivery } from '../queues/notificationCampaignQueue.js';
import { createAuditLogEntry } from '../services/auditLogService.js';

const actorId = (req) => req.user?.id || req.user?._id || null;

const clean = (value = '') => String(value || '').trim();

const sanitizeAudience = (audience = {}) => ({
  userTypes: Array.isArray(audience.userTypes) ? audience.userTypes.map(clean).filter(Boolean) : [],
  roles: Array.isArray(audience.roles) ? audience.roles.map(clean).filter(Boolean) : [],
  countryIds: Array.isArray(audience.countryIds) ? audience.countryIds.filter(mongoose.isValidObjectId) : [],
  cityIds: Array.isArray(audience.cityIds) ? audience.cityIds.filter(mongoose.isValidObjectId) : [],
  communeIds: Array.isArray(audience.communeIds) ? audience.communeIds.filter(mongoose.isValidObjectId) : [],
  specificUserIds: Array.isArray(audience.specificUserIds)
    ? audience.specificUserIds.filter(mongoose.isValidObjectId)
    : [],
  testerGroup: Boolean(audience.testerGroup)
});

const sanitizeAction = (action = {}) => ({
  enabled: Boolean(action.enabled),
  label: clean(action.label).slice(0, 60),
  type: ['internal_route', 'product', 'shop', 'category', 'feature', 'external_url', 'none'].includes(action.type)
    ? action.type
    : 'none',
  target: clean(action.target).slice(0, 500)
});

const sanitizeChannels = (channels = {}) => ({
  inApp: channels.inApp !== false,
  push: channels.push !== false,
  email: Boolean(channels.email),
  sms: Boolean(channels.sms)
});

const buildCampaignPayload = (body = {}, actor) => {
  const title = clean(body.title);
  const message = clean(body.message);
  if (!title) throw Object.assign(new Error('Le titre est requis.'), { status: 400 });
  if (!message) throw Object.assign(new Error('Le message est requis.'), { status: 400 });

  const payload = {
    title,
    message,
    shortDescription: clean(body.shortDescription).slice(0, 160),
    imageUrl: clean(body.imageUrl),
    icon: clean(body.icon),
    type: NOTIFICATION_CAMPAIGN_TYPES.includes(body.type) ? body.type : 'announcement',
    priority: NOTIFICATION_CAMPAIGN_PRIORITIES.includes(body.priority) ? body.priority : 'normal',
    audience: sanitizeAudience(body.audience),
    action: sanitizeAction(body.action),
    channels: sanitizeChannels(body.channels),
    featureFlagId: mongoose.isValidObjectId(body.featureFlagId) ? body.featureFlagId : null,
    schedule: {
      startAt: body.schedule?.startAt ? new Date(body.schedule.startAt) : null,
      endAt: body.schedule?.endAt ? new Date(body.schedule.endAt) : null
    },
    updatedBy: actor
  };
  return payload;
};

export const listNotificationCampaigns = asyncHandler(async (req, res) => {
  const status = clean(req.query?.status).toLowerCase();
  const filter = NOTIFICATION_CAMPAIGN_STATUSES.includes(status) ? { status } : {};
  const page = Math.max(1, Number(req.query?.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query?.limit) || 20));

  const [items, total] = await Promise.all([
    NotificationCampaign.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('createdBy', 'name email')
      .lean(),
    NotificationCampaign.countDocuments(filter)
  ]);

  res.json({ items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
});

export const getNotificationCampaign = asyncHandler(async (req, res) => {
  const campaign = await NotificationCampaign.findById(req.params.id).populate('createdBy', 'name email').lean();
  if (!campaign) return res.status(404).json({ message: 'Campagne introuvable.' });
  res.json({ item: campaign });
});

export const previewNotificationCampaignAudience = asyncHandler(async (req, res) => {
  let audience = {};
  try {
    audience = JSON.parse(clean(req.query?.audience) || '{}');
  } catch {
    return res.status(400).json({ message: 'Paramètre audience invalide.' });
  }
  const count = await previewAudienceCount(sanitizeAudience(audience));
  res.json({ estimatedRecipients: count });
});

export const createNotificationCampaign = asyncHandler(async (req, res) => {
  const payload = buildCampaignPayload(req.body, actorId(req));
  const campaign = await NotificationCampaign.create({
    ...payload,
    createdBy: actorId(req)
  });
  await createAuditLogEntry({
    performedBy: actorId(req),
    actionType: 'NOTIFICATION_CAMPAIGN_CREATED',
    newValue: { campaignId: String(campaign._id), title: campaign.title, status: campaign.status },
    req,
    meta: { module: 'notificationCampaigns' }
  });
  console.log(`[notification-campaign] campaign created id=${campaign._id} by=${actorId(req)}`);
  res.status(201).json({ item: campaign });
});

export const updateNotificationCampaign = asyncHandler(async (req, res) => {
  const campaign = await NotificationCampaign.findById(req.params.id);
  if (!campaign) return res.status(404).json({ message: 'Campagne introuvable.' });
  if (!['draft', 'scheduled', 'paused'].includes(campaign.status)) {
    return res.status(409).json({ message: 'Cette campagne ne peut plus être modifiée.' });
  }
  const payload = buildCampaignPayload({ ...campaign.toObject(), ...req.body }, actorId(req));
  Object.assign(campaign, payload);
  await campaign.save();
  res.json({ item: campaign });
});

export const deleteNotificationCampaign = asyncHandler(async (req, res) => {
  const campaign = await NotificationCampaign.findById(req.params.id);
  if (!campaign) return res.status(404).json({ message: 'Campagne introuvable.' });
  if (!['draft', 'cancelled'].includes(campaign.status)) {
    return res.status(409).json({ message: 'Seules les campagnes brouillon ou annulées peuvent être supprimées.' });
  }
  await campaign.deleteOne();
  res.json({ message: 'Campagne supprimée.' });
});

/** Send now, or schedule for later — idempotent: refuses if already sent/sending. */
export const sendNotificationCampaign = asyncHandler(async (req, res) => {
  const campaign = await NotificationCampaign.findById(req.params.id);
  if (!campaign) return res.status(404).json({ message: 'Campagne introuvable.' });
  if (!['draft', 'paused'].includes(campaign.status)) {
    return res.status(409).json({
      message: 'Cette campagne a déjà été envoyée ou planifiée.',
      code: 'CAMPAIGN_ALREADY_PROCESSED'
    });
  }

  const scheduleAt = req.body?.scheduleAt ? new Date(req.body.scheduleAt) : new Date();
  const isFuture = scheduleAt.getTime() > Date.now() + 60 * 1000;

  campaign.status = 'scheduled';
  campaign.schedule.startAt = scheduleAt;
  await campaign.save();
  console.log(`[notification-campaign] campaign scheduled id=${campaign._id} startAt=${scheduleAt.toISOString()}`);

  if (!isFuture) {
    const job = await enqueueCampaignDelivery(campaign._id).catch(() => null);
    if (!job) {
      // No queue configured — delivering inline keeps "Send now" actually instant.
      deliverCampaign(campaign._id).catch((error) =>
        console.error(`[notification-campaign] inline send failed for ${campaign._id}`, error)
      );
    }
  }

  await createAuditLogEntry({
    performedBy: actorId(req),
    actionType: 'NOTIFICATION_CAMPAIGN_SENT',
    newValue: { campaignId: String(campaign._id), scheduleAt: scheduleAt.toISOString() },
    req,
    meta: { module: 'notificationCampaigns' }
  });

  res.json({ message: isFuture ? 'Campagne planifiée.' : 'Campagne en cours d’envoi.', item: campaign });
});

export const pauseNotificationCampaign = asyncHandler(async (req, res) => {
  const campaign = await NotificationCampaign.findById(req.params.id);
  if (!campaign) return res.status(404).json({ message: 'Campagne introuvable.' });
  if (!['scheduled', 'active'].includes(campaign.status)) {
    return res.status(409).json({ message: 'Seule une campagne planifiée ou active peut être mise en pause.' });
  }
  campaign.status = 'paused';
  await campaign.save();
  res.json({ message: 'Campagne mise en pause.', item: campaign });
});

export const resumeNotificationCampaign = asyncHandler(async (req, res) => {
  const campaign = await NotificationCampaign.findById(req.params.id);
  if (!campaign) return res.status(404).json({ message: 'Campagne introuvable.' });
  if (campaign.status !== 'paused') {
    return res.status(409).json({ message: 'Seule une campagne en pause peut être reprise.' });
  }
  campaign.status = 'scheduled';
  campaign.schedule.startAt = new Date();
  await campaign.save();
  res.json({ message: 'Campagne reprise — elle repartira au prochain cycle (sans redoubler les envois déjà faits).', item: campaign });
});

export const cancelNotificationCampaign = asyncHandler(async (req, res) => {
  const campaign = await NotificationCampaign.findById(req.params.id);
  if (!campaign) return res.status(404).json({ message: 'Campagne introuvable.' });
  if (['completed', 'cancelled'].includes(campaign.status)) {
    return res.status(409).json({ message: 'Cette campagne est déjà terminée ou annulée.' });
  }
  campaign.status = 'cancelled';
  campaign.cancelledAt = new Date();
  await campaign.save();
  res.json({ message: 'Campagne annulée.', item: campaign });
});

export const getNotificationCampaignAnalytics = asyncHandler(async (req, res) => {
  const campaign = await NotificationCampaign.findById(req.params.id).lean();
  if (!campaign) return res.status(404).json({ message: 'Campagne introuvable.' });
  const analytics = await computeCampaignAnalytics(req.params.id);
  res.json({
    stats: campaign.stats,
    analytics,
    deliveryRate: campaign.stats.targeted ? Math.round((campaign.stats.sent / campaign.stats.targeted) * 100) : 0,
    openRate: analytics.delivered ? Math.round((analytics.opened / analytics.delivered) * 100) : 0,
    clickThroughRate: analytics.delivered ? Math.round((analytics.clicked / analytics.delivered) * 100) : 0
  });
});
