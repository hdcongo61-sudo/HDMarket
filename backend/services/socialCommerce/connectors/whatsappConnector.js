import { SocialConnector } from './SocialConnector.js';
import { verifyMetaSignature, verifyMetaWebhookChallenge } from '../webhookSecurity.js';

const GRAPH_API_VERSION = 'v20.0';

/**
 * Meta WhatsApp Cloud API connector. Provider-specific HTTP/payload details
 * live only here — everything else in the Social Commerce Hub talks to the
 * SocialConnector interface.
 */
export class WhatsAppConnector extends SocialConnector {
  constructor(opts) {
    super({ ...opts, channel: 'WHATSAPP' });
  }

  isConfigured() {
    return Boolean(this.credentials.accessToken && this.credentials.phoneNumberId);
  }

  verifyWebhook(req) {
    if (req.method === 'GET') {
      const { verified, challenge } = verifyMetaWebhookChallenge({
        query: req.query,
        expectedVerifyToken: this.credentials.verifyToken
      });
      return { verified, challenge };
    }
    const verified = verifyMetaSignature({
      rawBody: req.rawBody,
      signatureHeader: req.get?.('x-hub-signature-256') || req.headers?.['x-hub-signature-256'],
      appSecret: this.credentials.appSecret
    });
    return { verified };
  }

  parseInbound(payload) {
    const messages = [];
    const entries = Array.isArray(payload?.entry) ? payload.entry : [];
    for (const entry of entries) {
      const changes = Array.isArray(entry.changes) ? entry.changes : [];
      for (const change of changes) {
        const value = change.value || {};
        const inboundMessages = Array.isArray(value.messages) ? value.messages : [];
        for (const message of inboundMessages) {
          // Only text messages are handled in this phase (spec §50: text
          // fallback always ships; rich media types are a later addition).
          if (message.type !== 'text' || !message.text?.body) continue;
          messages.push({
            channel: 'WHATSAPP',
            externalUserId: String(message.from || ''),
            externalConversationId: String(message.from || ''),
            externalMessageId: String(message.id || ''),
            text: String(message.text.body || ''),
            timestamp: message.timestamp ? new Date(Number(message.timestamp) * 1000) : new Date()
          });
        }
        // value.statuses (delivery/read receipts) intentionally ignored —
        // not a new inbound message.
      }
    }
    return messages;
  }

  async sendTextMessage({ to, text }) {
    if (!this.isConfigured()) {
      return { success: false, error: 'WHATSAPP_NOT_CONFIGURED' };
    }
    const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${this.credentials.phoneNumberId}/messages`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.credentials.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: text, preview_url: true }
      })
    });
    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      return { success: false, error: `WHATSAPP_SEND_FAILED_${response.status}`, detail: errorBody.slice(0, 300) };
    }
    const data = await response.json().catch(() => ({}));
    return { success: true, providerMessageId: data?.messages?.[0]?.id || null };
  }
}
