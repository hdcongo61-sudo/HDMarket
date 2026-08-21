// Provider payload shapes differ (WhatsApp/Instagram/Messenger/TikTok), so
// each connector's parseInbound() does its own provider-specific extraction
// — this normalizer is the last, shared step: coerce whatever came out into
// a safe, uniform shape before it ever reaches the resolver/intent/response
// pipeline. In particular it defends against a non-string "text" (a NoSQL-
// injection-shaped payload like {$ne: null} sent as a field value) by
// forcing everything through String() before any further processing.
export const normalizeInboundMessage = (raw = {}) => ({
  channel: String(raw.channel || '').toUpperCase(),
  externalUserId: String(raw.externalUserId || '').trim().slice(0, 128),
  externalConversationId: String(raw.externalConversationId || '').trim().slice(0, 128),
  externalMessageId: String(raw.externalMessageId || '').trim().slice(0, 256),
  text: String(raw.text ?? '').trim().slice(0, 1000),
  timestamp: raw.timestamp instanceof Date ? raw.timestamp : new Date()
});
