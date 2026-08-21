import { SocialConnector } from './SocialConnector.js';
import { verifyMetaSignature, verifyMetaWebhookChallenge } from '../webhookSecurity.js';

const GRAPH_API_VERSION = 'v20.0';

/**
 * Instagram Messaging and Facebook Messenger are both "Messenger Platform"
 * Graph API products with an identical webhook/send shape — this base class
 * holds that shared logic so InstagramConnector/MessengerConnector don't
 * duplicate it (spec §16: "do not duplicate business logic between
 * Instagram and Messenger"). Subclasses only set channel/pageAccessToken
 * source and the recipient-id semantics.
 */
export class MetaMessagingConnector extends SocialConnector {
  isConfigured() {
    return Boolean(this.credentials.pageAccessToken);
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
      const events = Array.isArray(entry.messaging) ? entry.messaging : [];
      for (const event of events) {
        const text = event.message?.text;
        // Echoes (is_echo: our own outbound message reflected back) and
        // non-text events (attachments, postbacks) are skipped in this
        // phase — text fallback only, per spec §50.
        if (!text || event.message?.is_echo) continue;
        messages.push({
          channel: this.channel,
          externalUserId: String(event.sender?.id || ''),
          externalConversationId: String(event.sender?.id || ''),
          externalMessageId: String(event.message?.mid || ''),
          text: String(text),
          timestamp: event.timestamp ? new Date(Number(event.timestamp)) : new Date()
        });
      }
    }
    return messages;
  }

  async sendTextMessage({ to, text }) {
    if (!this.isConfigured()) {
      return { success: false, error: `${this.channel}_NOT_CONFIGURED` };
    }
    const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/me/messages`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.credentials.pageAccessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        recipient: { id: to },
        messaging_type: 'RESPONSE',
        message: { text }
      })
    });
    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      return { success: false, error: `${this.channel}_SEND_FAILED_${response.status}`, detail: errorBody.slice(0, 300) };
    }
    const data = await response.json().catch(() => ({}));
    return { success: true, providerMessageId: data?.message_id || null };
  }
}
