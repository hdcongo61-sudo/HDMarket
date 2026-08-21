import SocialConnection from '../../models/socialConnectionModel.js';
import { decryptCredentials } from './credentialCrypto.js';
import { WhatsAppConnector } from './connectors/whatsappConnector.js';
import { InstagramConnector } from './connectors/instagramConnector.js';
import { MessengerConnector } from './connectors/messengerConnector.js';
import { TikTokConnector } from './connectors/tiktokConnector.js';

const CONNECTOR_CLASSES = {
  WHATSAPP: WhatsAppConnector,
  INSTAGRAM: InstagramConnector,
  FACEBOOK_MESSENGER: MessengerConnector,
  TIKTOK_MESSAGING: TikTokConnector
};

// Env-var fallback per channel (spec §48) — used when no admin-configured
// SocialConnection exists yet, so WhatsApp/Instagram/Messenger are usable
// from a single .env in dev/early production without going through the
// admin "connect" UI first. An admin-entered, encrypted SocialConnection
// always takes priority when present and CONNECTED.
const envCredentials = (channel) => {
  const appSecret = process.env.META_APP_SECRET || '';
  switch (channel) {
    case 'WHATSAPP':
      return {
        phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
        accessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
        verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || process.env.META_WEBHOOK_VERIFY_TOKEN || '',
        appSecret: process.env.WHATSAPP_APP_SECRET || appSecret
      };
    case 'INSTAGRAM':
      return {
        pageAccessToken: process.env.INSTAGRAM_PAGE_ACCESS_TOKEN || '',
        businessAccountId: process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID || '',
        verifyToken: process.env.INSTAGRAM_VERIFY_TOKEN || process.env.META_WEBHOOK_VERIFY_TOKEN || '',
        appSecret
      };
    case 'FACEBOOK_MESSENGER':
      return {
        pageAccessToken: process.env.FACEBOOK_PAGE_ACCESS_TOKEN || '',
        pageId: process.env.FACEBOOK_PAGE_ID || '',
        verifyToken: process.env.FACEBOOK_VERIFY_TOKEN || process.env.META_WEBHOOK_VERIFY_TOKEN || '',
        appSecret
      };
    default:
      return {};
  }
};

/**
 * Resolves the platform-level SocialConnection for a channel (Phase 1: only
 * PLATFORM-owned connections are used; SHOP-owned connections stay behind
 * SOCIAL_SHOP_CONNECTIONS, unused here) and returns a ready-to-use connector
 * instance. This is the ONLY place that should ever construct a connector —
 * controllers/services must call this rather than `new WhatsAppConnector()`
 * directly, so credential resolution stays centralized.
 */
export const getConnector = async (channel) => {
  const ConnectorClass = CONNECTOR_CLASSES[channel];
  if (!ConnectorClass) return null;

  const connection = await SocialConnection.findOne({ ownerType: 'PLATFORM', channel })
    .select('+credentialsEncrypted')
    .lean();

  let credentials = envCredentials(channel);
  if (connection?.status === 'CONNECTED' && connection.credentialsEncrypted) {
    const decrypted = decryptCredentials(connection.credentialsEncrypted);
    if (decrypted) credentials = { ...credentials, ...decrypted };
  }

  return new ConnectorClass({ connection, credentials });
};
