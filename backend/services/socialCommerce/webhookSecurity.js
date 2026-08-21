import crypto from 'crypto';

// Shared by WhatsApp Cloud API, Instagram Messaging and Messenger Platform —
// all three are Meta Graph API products and use the exact same
// X-Hub-Signature-256 HMAC-SHA256-over-raw-body verification scheme, keyed
// by the app secret (not the page/business access token).
export const verifyMetaSignature = ({ rawBody, signatureHeader, appSecret }) => {
  if (!appSecret || !rawBody) return false;
  const header = String(signatureHeader || '');
  if (!header.startsWith('sha256=')) return false;
  const expected = crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
  const provided = header.slice('sha256='.length);
  if (expected.length !== provided.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(provided, 'hex'));
  } catch {
    return false;
  }
};

// The GET /api/webhooks/social/:channel handshake Meta performs once when a
// webhook subscription is first configured (hub.mode=subscribe).
export const verifyMetaWebhookChallenge = ({ query, expectedVerifyToken }) => {
  const mode = query?.['hub.mode'];
  const token = query?.['hub.verify_token'];
  const challenge = query?.['hub.challenge'];
  if (mode === 'subscribe' && token && expectedVerifyToken && token === expectedVerifyToken) {
    return { verified: true, challenge };
  }
  return { verified: false, challenge: null };
};
