/**
 * Shared interface every channel connector implements. Business logic
 * (socialWebhookController, socialSellerController, etc.) must only ever
 * call through this interface — never a provider SDK/fetch call directly —
 * so HDMarket can add or swap providers later without touching callers.
 */
export class SocialConnector {
  constructor({ channel, connection = null, credentials = {} } = {}) {
    this.channel = channel;
    this.connection = connection; // SocialConnection doc, or null if unconfigured
    this.credentials = credentials || {};
  }

  /** @returns {boolean} whether this connector has enough credentials to operate at all. */
  isConfigured() {
    return false;
  }

  /**
   * Handles the provider's webhook verification handshake (GET) or inbound
   * signature check (POST). Returns a result the controller can act on
   * directly; never throws for "just not verified" (throwing is reserved
   * for programmer errors).
   */
  verifyWebhook(_req) {
    throw new Error(`${this.channel}: verifyWebhook not implemented`);
  }

  /**
   * @returns {Array<object>} zero or more normalized inbound messages
   *   ({ externalUserId, externalConversationId, externalMessageId, text, timestamp })
   *   extracted from one webhook delivery (a single delivery can batch
   *   several messages).
   */
  parseInbound(_payload) {
    throw new Error(`${this.channel}: parseInbound not implemented`);
  }

  async sendTextMessage(_params) {
    throw new Error(`${this.channel}: sendTextMessage not implemented`);
  }

  /** Default: text fallback — spec §50 requires this, rich cards are optional/later. */
  async sendProductMessage(params) {
    return this.sendTextMessage(params);
  }

  getHealthStatus() {
    return {
      channel: this.channel,
      configured: this.isConfigured(),
      status: this.connection?.status || 'DISCONNECTED',
      lastWebhookAt: this.connection?.lastWebhookAt || null,
      lastOutboundAt: this.connection?.lastOutboundAt || null,
      lastErrorAt: this.connection?.lastErrorAt || null,
      lastErrorMessage: this.connection?.lastErrorMessage || ''
    };
  }
}
