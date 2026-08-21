# Social Commerce Hub

Connects social traffic (TikTok, Instagram, Facebook) and messaging (WhatsApp,
Instagram DM, Facebook Messenger) to HDMarket products, while keeping HDMarket
as the sole source of truth for products, prices, checkout, orders, payments,
and delivery.

```
TikTok → WhatsApp → HDMarket
Instagram → DM → HDMarket
Facebook → Messenger → HDMarket
HDMarket → Product Page → Checkout → Order
```

Social platforms generate interest. **HDMarket owns the transaction.** No
connector, response, or deep link ever tries to complete a sale outside
HDMarket's own checkout.

## Status

**Implemented and working** (exercisable via the dev webhook simulator, see
below — no live WhatsApp/Instagram/Messenger credentials were available in
the environment this was built in, so the real Meta APIs were never actually
called end-to-end):

- Product social codes (`HD-XXXXX`), generated automatically, collision-safe,
  immutable after creation.
- Smart trackable links (`/s/:socialCode?source=...&campaign=...`).
- Click + attribution tracking, flowing into `Order.acquisition` (server-side
  validated — a client never gets to assert its own channel).
- A channel-agnostic engine: product resolver, intent detector (FR/EN
  keyword rules), response builder (always reads live price/wholesale/
  installment data off the product document).
- Real connectors for **WhatsApp** (Meta Cloud API), **Instagram Messaging**,
  and **Facebook Messenger** (all three share one Meta webhook signature
  scheme and ~90% of their logic via `MetaMessagingConnector`).
- A **TikTok Messaging** connector stub, permanently OFF, satisfying "TikTok
  → WhatsApp → HDMarket" as the actual TikTok journey.
- Webhook signature verification, idempotency (duplicate delivery = one
  reply, not two), per-user rate limiting, short-lived conversation context
  (Redis-preferred, in-memory fallback).
- Seller: per-product Share/Promote bottom sheet (copy code, HDMarket link,
  WhatsApp link, TikTok caption, Instagram message, Facebook post), a
  Social Commerce dashboard (clicks/conversations/orders/conversion,
  campaigns).
- Admin: channel connections (connect/disconnect/test, encrypted
  credentials), interactions list (PII-masked), platform analytics.
- Feature flags (all OFF by default), RBAC permissions, audit log entries
  for channel connect/disconnect.

**Requires external provider credentials/configuration from you** before any
of this can process real traffic:

- A Meta Business/App with WhatsApp Cloud API, Instagram Messaging, and/or
  Messenger Platform enabled, plus a verified WhatsApp Business phone
  number.
- Webhook URLs (`https://<your-domain>/api/webhooks/social/whatsapp`, `.../instagram`,
  `.../messenger`) registered in the Meta App dashboard, subscribed to the
  `messages` field.
- The env vars in `backend/.env.example`'s Social Commerce section filled
  in, **or** the equivalent entered via Admin → Social Commerce → Channels
  (founder-only — those get encrypted at rest).
- The relevant `social_*` feature flags turned on via the existing generic
  Admin → Feature Management screen (they're seeded OFF).

## Architecture

```
backend/
├── models/
│   ├── socialConnectionModel.js      SocialConnection (platform/shop channel config)
│   ├── socialInteractionModel.js     One row per inbound/outbound message
│   ├── socialCampaignModel.js        Seller/admin campaign definitions
│   └── socialClickModel.js           /s/:code click events
├── services/socialCommerce/
│   ├── socialCodeService.js          generate/normalize/extract HD-XXXXX codes
│   ├── productResolverService.js     text/id -> {product, shop, socialCode}
│   ├── intentDetectorService.js      deterministic FR/EN keyword rules
│   ├── responseBuilderService.js     live price/wholesale/installment text
│   ├── smartUrlService.js            /s/:code URL builder
│   ├── shareLinksService.js          seller Share modal snippets
│   ├── attributionService.js         validates client-asserted attribution
│   ├── socialAnalyticsService.js     seller + admin aggregates
│   ├── conversationContextService.js short-lived "last product" memory
│   ├── rateLimiter.js                per-user automated-reply throttle
│   ├── credentialCrypto.js           AES-256-GCM wrapper (server-only key)
│   ├── webhookSecurity.js            Meta signature + handshake verification
│   ├── normalizeSocialMessage.js     safe coercion of parsed inbound messages
│   ├── socialCommerceService.js      orchestrates all of the above per message
│   ├── connectorFactory.js           resolves credentials -> connector instance
│   └── connectors/
│       ├── SocialConnector.js        shared interface (verifyWebhook, parseInbound, sendTextMessage, ...)
│       ├── whatsappConnector.js      Meta WhatsApp Cloud API
│       ├── metaMessagingConnector.js shared IG/Messenger base (same payload shape)
│       ├── instagramConnector.js
│       ├── messengerConnector.js
│       └── tiktokConnector.js        stub, always "not configured"
├── controllers/ + routes/
│   ├── socialWebhookController.js / socialWebhookRoutes.js   GET+POST /api/webhooks/social/:channel
│   ├── socialSellerController.js / socialSellerRoutes.js     /api/social-commerce/*
│   ├── socialAdminController.js / socialAdminRoutes.js       /api/admin/social-commerce/*
│   └── devSocialRoutes.js            POST /api/dev/social/simulate (non-production only)
└── scripts/
    ├── seedSocialCommerceFeatureFlags.js
    └── backfillProductSocialCodes.js

frontend/src/
├── pages/SocialRedirect.jsx          /s/:socialCode — resolves, records click, redirects
├── pages/SellerSocialCommerce.jsx    /seller/social-commerce
├── pages/AdminSocialCommerce.jsx     /admin/social-commerce
├── components/social/ShareProductModal.jsx
└── utils/socialAttribution.js        localStorage attribution, read once at checkout
```

Every channel connector implements the same `SocialConnector` interface
(`verifyWebhook`, `parseInbound`, `sendTextMessage`, `sendProductMessage`,
`getHealthStatus`) — business logic never calls a provider SDK/fetch
directly, only through this interface, so a provider can be swapped later
without touching the resolver/intent/response pipeline.

## Data model

- **`Product.socialCode`** — generated once in the existing `pre('validate')`
  hook (same file as the slug/confirmationNumber generators), immutable
  after creation. Format `HD-XXXXX`, 31-character alphabet excluding
  `0/O/1/I/L` for readability, collision-retried against the DB.
- **`Order.acquisition`** — additive, defaults to `DIRECT`. Only ever
  populated server-side, and only after `attributionService` confirms the
  referenced `SocialClick`/`SocialInteraction` really exists — the client
  never gets to assert a bare channel string.
- **`SocialInteraction`** — one row per inbound/outbound message.
  `{channel, externalMessageId}` has a partial unique index for
  idempotency. Data-minimized: no names, no raw phone numbers beyond the
  provider's own opaque user id (which for WhatsApp *is* the phone number —
  masked in the admin Interactions list).
- **`SocialClick`** — one row per `/s/:code` visit.
- **`SocialCampaign`** — seller/admin campaign definitions, auto-generated
  `campaignCode`.
- **`SocialConnection`** — one document per `{ownerType, ownerId, channel,
  countryId}`. `credentialsEncrypted` is `select: false` by default and
  encrypted with a server-only key (`SOCIAL_CREDENTIAL_ENCRYPTION_KEY`,
  never stored in the DB) — reading the database alone is not enough to
  recover provider tokens.

## Feature flags

Seeded (all `enabled: false`, `rollout: TEST`, `rolesAllowed: ['admin', 'founder']`)
by `node scripts/seedSocialCommerceFeatureFlags.js`:

| Flag | Gates |
|---|---|
| `social_commerce` | Master switch — all Social Commerce UI + the public product-lookup/click API |
| `social_whatsapp` | WhatsApp webhook processing |
| `social_instagram` | Instagram webhook processing |
| `social_facebook_messenger` | Messenger webhook processing |
| `social_tiktok_messaging` | Always off — no provider integrated |
| `social_shop_connections` | Shop-owned (vs. platform-owned) channels — model-ready, UI not built |
| `social_campaigns` | Campaign creation/listing |
| `social_analytics` | Analytics endpoints/UI |

Toggle them from the existing generic **Admin → Feature Management** screen
(they use the same `FeatureFlag` model as every other flag in HDMarket —
no new flag system was introduced). When `social_commerce` is off: webhook
routes still ack `200` (never break a provider's webhook subscription) but
skip all processing; every Social Commerce UI entry point stays hidden.

## Webhook setup (per channel, once you have Meta credentials)

1. In the Meta App dashboard, add a webhook subscribed to the `messages`
   field, pointing at `https://<domain>/api/webhooks/social/whatsapp` (or
   `/instagram`, `/messenger`).
2. Set the verify token to match `WHATSAPP_VERIFY_TOKEN` /
   `INSTAGRAM_VERIFY_TOKEN` / `FACEBOOK_VERIFY_TOKEN` (or `META_WEBHOOK_VERIFY_TOKEN`
   as a shared fallback).
3. Meta calls `GET .../:channel?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...`
   once — `socialWebhookController.verifySocialWebhook` echoes the challenge
   back when the token matches.
4. From then on, inbound messages arrive as `POST .../:channel`, verified via
   `X-Hub-Signature-256` (HMAC-SHA256 over the raw body, keyed by the app
   secret) before any processing.

Credentials can come from either the env vars in `.env.example`, **or** an
admin-entered `SocialConnection` (Admin → Social Commerce → Channels →
Connect, founder-only) — the connection, if `CONNECTED`, takes priority.

## Local development

No real Meta account needed. With the server running (`NODE_ENV` not
`production`):

```bash
curl -X POST http://localhost:5001/api/dev/social/simulate \
  -H "Content-Type: application/json" \
  -d '{"channel": "WHATSAPP", "message": "prix HD-8F42K", "externalUserId": "test-user-1"}'
```

This runs the exact same `handleInboundSocialMessage` pipeline a real
webhook would (idempotency, resolver, intent, response, interaction
persistence) — it just skips signature verification and provider HTTP
calls. `/api/dev/social/simulate` is never mounted when `NODE_ENV === 'production'`.

## Testing

```bash
cd backend && npm test -- services/socialCommerce
```

76 tests across 7 files: code generation/normalization, intent detection
(all 9 spec examples + edge cases), response building (including "price
change reflects immediately" and currency-from-product, not hardcoded),
webhook signature verification (valid/tampered/wrong-secret/missing),
product resolution (found/not-found/unavailable, never leaking a raw
Mongo id), attribution validation (rejects unverified ids, TikTok→WhatsApp
mapping, first-touch merge), and the orchestrator (rate limiting,
duplicate-webhook idempotency, unknown/unavailable product replies,
conversation-context follow-up, retry-on-send-failure).

## Deployment

1. `node scripts/seedSocialCommerceFeatureFlags.js` (idempotent, safe to
   re-run).
2. `node scripts/backfillProductSocialCodes.js --dry-run` to preview, then
   without `--dry-run` to actually backfill existing products (new products
   get a code automatically on creation — this is only needed once, for
   products that existed before this feature shipped).
3. Set the env vars you have credentials for (WhatsApp first — it's the
   channel every TikTok/Instagram/Facebook post ultimately points customers
   to).
4. Register webhooks in the Meta App dashboard (see above).
5. Turn on `social_commerce` + the specific channel flag(s) via Admin →
   Feature Management, scoped to `TEST` rollout / your own admin account
   first, then `APPROVED` for a wider release.

## Security

- Every webhook POST is signature-verified before any processing; invalid
  signatures get `403`, never processed.
- Idempotency via a unique `{channel, externalMessageId}` index — a
  redelivered webhook event is a no-op the second time.
- `attributionService` never trusts a client-sent channel string — it looks
  up the referenced `SocialClick`/`SocialInteraction` and derives the
  channel server-side.
- Provider credentials are AES-256-GCM encrypted at rest with a key that is
  never stored in the database (`SOCIAL_CREDENTIAL_ENCRYPTION_KEY`), and
  `credentialsEncrypted` is `select: false` on the schema.
- `MANAGE_SOCIAL_CHANNELS` (connect/disconnect/enter credentials) is
  founder-only; admins get `MANAGE_SOCIAL_COMMERCE`/`VIEW_SOCIAL_ANALYTICS`
  but never see raw credentials.
- Admin's Interactions list masks `externalUserId` (WhatsApp's is a real
  phone number) — only the first/last 3 characters are shown.
- Per-user rate limiting on automated replies; a rate-limited user gets no
  reply rather than a flood.
- A provider outage or misconfiguration can only affect Social Commerce
  itself — every connector call is wrapped so a failure never touches
  checkout, browsing, or order creation.

## TikTok limitation

TikTok direct messaging is **not** part of this release. There is no
`SOCIAL_TIKTOK_MESSAGING` provider integrated, and the feature flag is
permanently seeded off. The `TikTokConnector` class exists only so the
Social Commerce Hub's architecture is uniform (every channel is a
`SocialConnector`) and so the admin Channels screen can show a real,
non-crashing "Not Available" status instead of hiding TikTok entirely.

**TikTok traffic today routes through WhatsApp**: a seller's TikTok
caption/bio contains the product's `HD-XXXXX` code and a prompt to message
HDMarket's WhatsApp number; the customer's WhatsApp message is what
actually reaches this system. This is intentional, not a shortcut — see
spec section 14 ("TikTok workflow") for the full reasoning. If TikTok ever
exposes a suitable direct-messaging API, `TikTokConnector` is the only file
that needs real implementation; nothing else in the engine depends on which
provider a channel uses.
