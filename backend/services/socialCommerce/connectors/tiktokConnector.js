import { SocialConnector } from './SocialConnector.js';

/**
 * TikTok direct messaging is NOT enabled in this release (spec §17/§61
 * Phase 5) — API availability varies and no provider is configured. This
 * stub exists purely so the Social Commerce Hub's architecture is uniform
 * (every channel is a SocialConnector) and so the admin Channels screen can
 * show a real, non-crashing "Not Available" status. It must never be
 * instantiated for actual webhook processing while SOCIAL_TIKTOK_MESSAGING
 * is off — the webhook controller checks the feature flag before routing to
 * any connector at all.
 */
export class TikTokConnector extends SocialConnector {
  constructor(opts) {
    super({ ...opts, channel: 'TIKTOK_MESSAGING' });
  }

  isConfigured() {
    return false;
  }

  verifyWebhook() {
    return { verified: false };
  }

  parseInbound() {
    return [];
  }

  async sendTextMessage() {
    return { success: false, error: 'TIKTOK_MESSAGING_NOT_AVAILABLE' };
  }

  getHealthStatus() {
    return {
      channel: this.channel,
      configured: false,
      status: 'DISABLED',
      lastWebhookAt: null,
      lastOutboundAt: null,
      lastErrorAt: null,
      lastErrorMessage: 'TikTok Messaging is not configured for this deployment.'
    };
  }
}
