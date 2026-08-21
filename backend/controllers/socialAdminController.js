import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import SocialConnection, { SOCIAL_CHANNELS } from '../models/socialConnectionModel.js';
import SocialInteraction from '../models/socialInteractionModel.js';
import { getConnector } from '../services/socialCommerce/connectorFactory.js';
import { encryptCredentials } from '../services/socialCommerce/credentialCrypto.js';
import { computeAdminSocialAnalytics } from '../services/socialCommerce/socialAnalyticsService.js';
import { createAuditLogEntry } from '../services/auditLogService.js';

const isValidId = (value) => Boolean(value) && mongoose.Types.ObjectId.isValid(String(value));

// PII minimization (spec §39): WhatsApp's externalUserId is the customer's
// real phone number (wa_id). Admin debugging never needs the full number —
// mask the middle digits.
const maskExternalUserId = (value) => {
  const raw = String(value || '');
  if (raw.length <= 6) return raw.replace(/./g, '*');
  return `${raw.slice(0, 3)}${'*'.repeat(raw.length - 6)}${raw.slice(-3)}`;
};

// GET /api/admin/social-commerce/connections — every channel, including
// ones with no SocialConnection row yet (shown as DISCONNECTED, or
// "not available" for TikTok), so the admin screen always shows all 4.
export const listSocialConnections = asyncHandler(async (req, res) => {
  const connections = await SocialConnection.find({ ownerType: 'PLATFORM' }).select('-credentialsEncrypted').lean();
  const byChannel = new Map(connections.map((connection) => [connection.channel, connection]));

  const results = await Promise.all(
    SOCIAL_CHANNELS.map(async (channel) => {
      const connector = await getConnector(channel);
      const health = connector.getHealthStatus();
      const existing = byChannel.get(channel);
      return {
        channel,
        connectionId: existing?._id || null,
        status: health.status,
        configured: health.configured,
        lastWebhookAt: health.lastWebhookAt,
        lastOutboundAt: health.lastOutboundAt,
        lastErrorAt: health.lastErrorAt,
        lastErrorMessage: health.lastErrorMessage,
        metadata: existing?.metadata || {}
      };
    })
  );

  return res.json({ success: true, data: results });
});

// POST /api/admin/social-commerce/connections/:channel — founder only
// (MANAGE_SOCIAL_CHANNELS, enforced at the route level). Encrypts and
// stores provider credentials; never returns them back in the response.
export const upsertSocialConnection = asyncHandler(async (req, res) => {
  const channel = String(req.params.channel || '').toUpperCase();
  if (!SOCIAL_CHANNELS.includes(channel)) {
    return res.status(404).json({ success: false, code: 'CHANNEL_NOT_FOUND', message: 'Canal inconnu.' });
  }
  if (channel === 'TIKTOK_MESSAGING') {
    return res.status(409).json({
      success: false,
      code: 'TIKTOK_MESSAGING_NOT_AVAILABLE',
      message: 'TikTok Messaging n’est pas disponible sur ce déploiement.'
    });
  }

  const { status = 'CONNECTED', credentials = {}, metadata = {} } = req.body || {};
  const credentialsEncrypted = Object.keys(credentials).length ? encryptCredentials(credentials) : undefined;
  if (Object.keys(credentials).length && !credentialsEncrypted) {
    return res.status(500).json({
      success: false,
      code: 'ENCRYPTION_KEY_MISSING',
      message: 'SOCIAL_CREDENTIAL_ENCRYPTION_KEY n’est pas configurée côté serveur.'
    });
  }

  const update = {
    ownerType: 'PLATFORM',
    channel,
    status,
    metadata,
    connectedBy: req.user.id,
    connectedAt: new Date()
  };
  if (credentialsEncrypted) update.credentialsEncrypted = credentialsEncrypted;

  const connection = await SocialConnection.findOneAndUpdate(
    { ownerType: 'PLATFORM', channel },
    { $set: update },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).select('-credentialsEncrypted');

  await createAuditLogEntry({
    performedBy: req.user.id,
    actionType: 'SOCIAL_CHANNEL_CONNECTED',
    newValue: { channel, status },
    req,
    meta: { connectionId: connection._id, channel }
  }).catch(() => {});

  return res.json({ success: true, data: connection });
});

// DELETE /api/admin/social-commerce/connections/:id — founder only.
export const disconnectSocialConnection = asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) {
    return res.status(404).json({ success: false, code: 'CONNECTION_NOT_FOUND', message: 'Connexion introuvable.' });
  }
  const connection = await SocialConnection.findByIdAndUpdate(
    req.params.id,
    { $set: { status: 'DISCONNECTED', credentialsEncrypted: null } },
    { new: true }
  ).select('-credentialsEncrypted');
  if (!connection) {
    return res.status(404).json({ success: false, code: 'CONNECTION_NOT_FOUND', message: 'Connexion introuvable.' });
  }

  await createAuditLogEntry({
    performedBy: req.user.id,
    actionType: 'SOCIAL_CHANNEL_DISCONNECTED',
    newValue: { channel: connection.channel },
    req,
    meta: { connectionId: connection._id }
  }).catch(() => {});

  return res.json({ success: true, data: connection });
});

// POST /api/admin/social-commerce/connections/:channel/test — a real,
// lightweight Graph API call (not just "isConfigured()"), so "Connected"
// actually means the credentials work right now.
export const testSocialConnection = asyncHandler(async (req, res) => {
  const channel = String(req.params.channel || '').toUpperCase();
  if (!SOCIAL_CHANNELS.includes(channel)) {
    return res.status(404).json({ success: false, code: 'CHANNEL_NOT_FOUND', message: 'Canal inconnu.' });
  }
  const connector = await getConnector(channel);
  if (!connector.isConfigured()) {
    return res.json({ success: true, data: { ok: false, reason: 'NOT_CONFIGURED' } });
  }

  try {
    const token = connector.credentials.accessToken || connector.credentials.pageAccessToken;
    const idField = channel === 'WHATSAPP' ? connector.credentials.phoneNumberId : 'me';
    const response = await fetch(`https://graph.facebook.com/v20.0/${idField}?fields=id`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const ok = response.ok;
    await SocialConnection.updateOne(
      { ownerType: 'PLATFORM', channel },
      ok
        ? { $set: { lastErrorAt: null, lastErrorMessage: '' } }
        : { $set: { lastErrorAt: new Date(), lastErrorMessage: `Test failed: HTTP ${response.status}` } }
    );
    return res.json({ success: true, data: { ok, status: response.status } });
  } catch (error) {
    await SocialConnection.updateOne(
      { ownerType: 'PLATFORM', channel },
      { $set: { lastErrorAt: new Date(), lastErrorMessage: String(error?.message || error).slice(0, 300) } }
    );
    return res.json({ success: true, data: { ok: false, reason: 'REQUEST_FAILED' } });
  }
});

// GET /api/admin/social-commerce/interactions — recent interactions,
// externalUserId masked (spec §39).
export const listSocialInteractions = asyncHandler(async (req, res) => {
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const filter = {};
  if (req.query.channel) filter.channel = String(req.query.channel).toUpperCase();

  const interactions = await SocialInteraction.find(filter)
    .populate('productId', 'title socialCode')
    .populate('shopId', 'shopName name')
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return res.json({
    success: true,
    data: interactions.map((interaction) => ({
      ...interaction,
      externalUserId: maskExternalUserId(interaction.externalUserId)
    }))
  });
});

// GET /api/admin/social-commerce/analytics — platform-wide.
export const getAdminSocialAnalytics = asyncHandler(async (req, res) => {
  const days = Math.min(365, Math.max(1, Number(req.query.days) || 30));
  const analytics = await computeAdminSocialAnalytics({ days });
  return res.json({ success: true, data: analytics });
});

// GET /api/admin/social-commerce/health (spec §41)
export const getSocialHealth = asyncHandler(async (req, res) => {
  const results = await Promise.all(
    SOCIAL_CHANNELS.map(async (channel) => {
      const connector = await getConnector(channel);
      return connector.getHealthStatus();
    })
  );
  return res.json({ success: true, data: results });
});
