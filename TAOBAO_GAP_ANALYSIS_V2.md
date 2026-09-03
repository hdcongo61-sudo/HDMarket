# 🚀 HDMarket — Taobao Gap Analysis & Proposals V2

> Generated: July 19, 2026 | Based on full re-analysis of frontend (83 pages) + backend (60 models, 34 services, 5 BullMQ queue/worker pairs)
> Companion to `TAOBAO_INSPIRED_PROPOSALS.md` (June 2026) — this doc supersedes its roadmap, it does not replace it.
>
> **Updated: July 24, 2026** — B.1 (group buying), B.2 (HDPoints), B.3 (referrals) and B.4 (product Q&A) have since shipped end-to-end; their statuses are amended inline. A shared Taobao-style motion layer (entrance stagger, living gradient, shine sweep, pulse) for Home / Products / ProductDetails also shipped — scope details live in `CRAFTSMANSHIP_AUDIT.md` §1.
>
> **Updated: Sep 2, 2026** — re-verified against the current tree: **A.1 (live GPS) and A.2 (bundle checkout) have shipped**; **A.3's flag is now enabled** (`enabled: true`, 5% rollout, all roles) and the orphan `recommendationRoutes.js` was deleted (canonical path: `productRoutes.js` `/recommendations`). Remaining real gaps: A.3 rollout staging, A.4 wallet top-up, A.5 Image Studio, B.5 short video, Trust & Safety 2.0.

---

## Executive Summary

The June 2026 Taobao proposal batch has been **largely implemented**: flash sales, "Pour Vous" recommendations, Explorer feed, digital wallet, bundle suggestions, seller levels, engagement notifications, and Seller Analytics V2 all exist in code today. HDMarket is already substantially Taobao-like.

The remaining gap as of July 19 was in three places — **two of them are now closed** (July 24 update):

1. **Half-built features** — most are now closed (Sep 2026): live courier GPS (A.1) and bundle checkout (A.2) shipped. What remains is **rollout/activation work**, not construction: AI recs staged at 5% (A.3), manual wallet top-up (A.4), disabled Image Studio (A.5).
2. ~~**Buyer-side engagement**~~ — ✅ **Shipped.** HDPoints (B.2) and the referral program (B.3) are real and wired end-to-end (`rewardPointsModel.js`, `rewardPointsService.js`, `referralService.js`, `Referrals.jsx`, `ReferralLanding.jsx`).
3. ~~**Social commerce**~~ — ✅ **Shipped.** Group buying (B.1) and product Q&A (B.4) exist (`groupBuyModel.js`, `groupBuyService.js`, `GroupBuySection.jsx`, `GroupBuyHomeSection.jsx`, `productQuestionModel.js`, `ProductQuestionsSection.jsx`). The referral virality loop (B.3) ships with them.

---

## 📊 Part 1 — Status of the June 2026 Proposals

| # | Original Proposal | Status | Evidence |
|---|---|---|---|
| 1 | AI "Pour Vous" recommendations | ✅ Full (Sep 2026) | `recommendationService.js`, `Home.jsx` PourVousSection; rollout completed — `rolloutPercentage: 100`, all roles, live DB record synced via `scripts/enableAiRecommendationsRollout.js` |
| 2 | Flash sales & countdown deals | ✅ Full | `flashSaleModel.js`, 5-min BullMQ sweep, `FlashSales.jsx`, `FlashSaleCard.jsx`, `CountdownTimer.jsx` |
| 3 | Seller gamification & reputation | ✅ Full | `sellerReputationService.js` (5 tiers débutant→diamant, commission discounts), `SellerLevelBadge.jsx`, `SellerRatingQuiz.jsx`, 6h recalc job |
| 4 | Visual discovery feed ("Explorer") | ✅ Built | `Explorer.jsx` + `ProductMasonryGrid.jsx` |
| 5 | Real-time order tracking map | ✅ Shipped (Sep 2026) | Full chain verified — see A.1 |
| 6 | In-app digital wallet | ❌ Not in tree (Sep 2026) | No `walletModel`/`Wallet` page/wallet routes exist — the July claim was wrong. A.4 requires building the wallet first. |
| 7 | Bundle deals | ✅ Shipped (Sep 2026) | `bundleModel.js`, `applyBundleDiscountsForSellers` re-derived server-side at order creation (`orderController.js:1252,1606`), cart preview (`cartController.js:223`); see A.2 |
| 8 | Smart engagement notifications | ✅ Full | `engagementService.js` + scheduled jobs (price-drop 1h, back-in-stock 1h, abandoned-cart 6h, weekly digest) |
| 9 | Seller analytics dashboard | ✅ Full | `SellerAnalyticsV2.jsx`, `sellerAnalyticsV2Controller.js` |
| 10 | Trust & Safety 2.0 | 🟡 Partial → foundation shipped (Sep 2026) | Buyer credibility score shipped (`buyerCredibilityService.js`, `userModel` fields, Profile badge). Still open: seller guarantee deposit (needs wallet — A.4), AI moderation. |

**Never built from the original gap table:** live/video commerce, visual search. *(Group buying has since shipped — see B.1.)*

---

## 🔧 Part A — Quick Wins: Finish the Half-Built Taobao Features

These are not new proposals — they are completions of work already started. Ordered by ROI.

### A.1 Live courier GPS tracking (highest priority)

> ✅ **Shipped (re-verified Sep 2, 2026).** The July claims below were correct at the time, but the full chain has since landed — no implementation work remains. Verified end-to-end:
>
> - **Model** — `deliveryRequestModel.js` has `currentLocation` (GeoJSON Point), `currentLocationUpdatedAt`, `assignedDeliveryGuyId` (ref `DeliveryGuy`) and a `currentLocation: '2dsphere'` index.
> - **Write path** — `POST /api/courier/location/ping` → `pingDeliveryAgentLocation` (`courierDeliveryController.js:1736`): validates the courier owns the assignment, computes pickup/dropoff distances, enforces map-access locking (`locationLockEnabled` / `locationLockOnStatus`), writes `currentLocation`, and appends a `LOCATION_PING` `DeliveryLog` breadcrumb throttled to ~15 s.
> - **Socket push** — the ping emits `delivery:location:updated` (`emitDeliveryLocationUpdated`, `chatSocket.js:154`) to the buyer's and seller's `user:<id>` rooms; authed sockets auto-join their room (`server.js:547`).
> - **Buyer UI** — `OrderDetail.jsx` polls `GET /api/orders/:id/tracking` every 15 s while a platform delivery is non-terminal, plus `useDeliveryLocationUpdates` moves the map between polls; `OrderTrackingMap.jsx` renders the live position overlay, courier name and last-update time.
> - **Courier app** — `CourierDashboard.jsx` runs a foreground `watchPosition` while a delivery is `PICKUP`/`ON_ROUTE`, client-throttled to 15 s, gated on `enableLiveLocation` from the courier bootstrap.
> - **Flag** — `enable_live_location` (`runtimeSettingsCatalog.js`) is `defaultValue: true`.

**Taobao reference:** real-time logistics map with live courier position.

**Current state (verified):**
- `frontend/src/components/OrderTrackingMap.jsx` exists and renders in `OrderDetail.jsx`.
- `backend/controllers/orderTrackingController.js:33-85` **reads** `deliveryRequest.currentLocation.coordinates` and populates `courier` (name/phone)…
- …but `backend/models/deliveryRequestModel.js` **has no `currentLocation` or `courier` fields** — Mongoose strict mode silently drops them, so the map never has a live position or courier identity.
- `deliveryGuyModel.js` has no location field either; nothing writes courier positions anywhere.
- `enable_live_location` flag exists with default `false` and description *"Activer le suivi live du livreur (préparation future)"* (`runtimeSettingsCatalog.js:436`).

**Implementation:**
1. Add to `deliveryRequestModel.js`: `courier: { type: ObjectId, ref: 'DeliveryGuy' }` (or reuse the existing assignment field if one already plays this role) and `currentLocation: { type: { type: String, enum: ['Point'] }, coordinates: [Number] }` with a `2dsphere` index.
2. New endpoint `PATCH /api/delivery/:id/location` (courier-authenticated, in `deliveryRoutes`/`courierRoutes`): validates the courier owns the active assignment, updates `currentLocation`, appends a `DeliveryLog` breadcrumb (model already has lat/lng), throttled to ~1 write / 15s.
3. Courier app: foreground geolocation watch while a delivery is `IN_TRANSIT` (Capacitor geolocation plugin; reuse the existing `CourierDashboard.jsx`).
4. Flip `enable_live_location` to `true` once the write path is live; keep text-timeline fallback for deliveries without GPS.
5. Optionally push position updates over the existing Socket.io namespace so the buyer map moves without refresh.

**Effort:** 🟢 Low-Medium (schema + one endpoint + one client watcher). **Impact:** buyer trust, fewer "où est ma commande ?" support tickets.

---

### A.2 Bundle deals: enforce real bundle pricing at checkout

> ✅ **Shipped (re-verified Sep 2, 2026).** The July claim below was correct at the time, but bundle enforcement has since landed:
>
> - **Model** — `backend/models/bundleModel.js` exists (product sets, discount percent, auto/manual source).
> - **Server-side enforcement** — `applyBundleDiscountsForSellers` (`bundleService.js:54`) is applied at order creation in both order paths (`orderController.js:1252` and `:1606`), re-deriving the discount from the cart's actual contents — the client never supplies the discount.
> - **Cart preview** — `cartController.js:223` applies the same service so the cart total matches what checkout will charge.

**Taobao reference:** "frequently bought together" with a real bundle discount applied in-cart.

**Current state (verified):** `bundleService.js` computes co-occurrence suggestions with a hardcoded `BUNDLE_DISCOUNT_PCT = 5` (line 14) and exposes `GET /api/products/public/:id/bundle-suggestions`. `BundleDeal.jsx` renders them on the PDP. But there is **no Bundle model and no checkout enforcement** — the "bundle price" shown is display-only; adding items to cart loses the promised discount.

**Implementation:**
1. Lightweight `bundleModel.js`: `{ productIds: [ObjectId], sellerId, discountPercent, source: 'auto' | 'manual', active }` — sellers can override the auto 5% or curate their own bundles.
2. Cart/checkout: when cart contents match an active bundle set, apply the discount as a line-level adjustment inside the existing pricing path in `orderController.js` (smallest possible diff — this file is ~5,700 lines, edit surgically per CLAUDE.md).
3. Server-side validation re-computes the bundle discount at order creation (never trust the client).
4. `Cart.jsx` + `OrderCheckout.jsx`: show "Prix du lot appliqué (-X%)" badge.

**Effort:** 🟡 Medium. **Impact:** ⬆️ 10-20% AOV; closes a promise-to-buyer gap (showing a discount that isn't honored is a trust bug, not just a missing feature).

---

### A.3 Enable the AI recommendation rollout

> ✅ **Shipped (Sep 2, 2026).** `rolloutPercentage: 100` for all roles in both catalogs, and the live DB record was synced via `scripts/enableAiRecommendationsRollout.js` (Before: admin/founder — After: `user/shop/admin/manager/founder`, 100%). The orphan `recommendationRoutes.js` was deleted earlier; the canonical path is `GET /api/products/recommendations` (`productRoutes.js:67`). Reversible any time from Admin > System Settings > Feature Flags.

**Current state (verified):** `recommendationService.js` is live and powering the home "Pour Vous" section, but only for 5% of users.

**Implementation:**
1. Decide per-environment: either delete `recommendationRoutes.js` or mount it and remove the duplicate endpoint from `productRoutes`. One canonical path.
2. Stage the flag: 5% → 25% → 100% over two weeks, watching `platformDailyAnalyticsModel` engagement metrics and Redis cache hit rates on the recommendations cache.
3. Add the flag toggle to `AdminAppSettings` if not already surfaced there.

**Effort:** 🟢 Low (config + cleanup). **Impact:** the personalization already built actually reaches users.

---

### A.4 Automated Mobile Money wallet top-up

**Current state:** wallet top-up is a manual `deposit-request` flow: user sends Mobile Money externally, submits a reference, an admin verifies and credits. The app already integrates CinetPay/Flutterwave-style payment submission with verification statuses in `paymentController`/`paymentModel`.

**Implementation:**
1. Reuse the existing payment-verification pipeline for a new `wallet_topup` payment purpose.
2. On provider callback/webhook with success status, credit `walletModel.balance` via `walletService` inside the same transaction that marks the payment verified (idempotency key = provider transaction id).
3. Keep the manual flow as fallback for providers without callbacks.
4. Surface "Recharge instantanée" vs "Recharge manuelle" in `Wallet.jsx`.

**Effort:** 🟡 Medium (money path — needs careful idempotency + audit log). **Impact:** ⬆️ wallet adoption, ⬇️ admin workload; prerequisite for buyer rewards (B.2) and referral payouts (B.3).

---

### A.5 Activate Image Studio AI processing

> **Partially shipped (Sep 2, 2026).** `imageStudioService.capabilities()` now enables the standard Cloudinary operations — `shadow`, `relight`, `upscale` — for every Cloudinary-configured deployment (no AI add-on required). The generative operations (`background-remove`, `object-remove`) stay gated behind `IMAGE_STUDIO_GENERATIVE_AI_ENABLED=true` because they need Cloudinary's AI add-on on the account. To finish: enable that env var on the hosting platform once the add-on is confirmed, or keep them hidden.

**Current state (verified):** `imageStudioService.js:61` returns *"Ce traitement intelligent n'est pas encore activé sur ce serveur HDMarket."* — the whole Image Studio module (6 services, controller, routes, client-side editor) is shipped but server-side AI processing is disabled.

**Implementation:** decide go/no-go: either enable the processing path (background removal / enhancement via the existing `imageProcessingQueue`) or hide the entry points. Shipping a visible feature that always errors is worse than not shipping it.

**Effort:** 🟢 Low (config/decision + smoke test). **Impact:** seller listing quality — Taobao-grade product photos without a studio.

---

## 🆕 Part B — New Taobao Features (not proposed anywhere yet)

Checked against all 33 `ag/` proposals, `SKILL.md`, and the June doc — none of these are covered.

### B.1 Group buying (拼团) — "Achat groupé"

> ✅ **Built (shipped after this analysis).** `backend/models/groupBuyModel.js`, `backend/services/groupBuyService.js` (+ tests), `frontend/src/components/GroupBuySection.jsx` (PDP) and `GroupBuyHomeSection.jsx` (home, gated by `enable_group_buying`). Remaining polish: celebration moment on team fill — see `CRAFTSMANSHIP_AUDIT.md` §1.

**What Taobao does:** Pinduoduo-style team purchase: a product has a group price (e.g. -25%) unlocked when N buyers join within T hours. Buyers share the deal to fill their team. This is arguably the most powerful social-commerce mechanic ever built.

**Why it fits Congo:** buying decisions already happen in WhatsApp groups; group buying turns every buyer into a distribution channel. Payment reality: members pay individually (COD or wallet) — no need for a shared payment.

**Backend (new):**
```js
// backend/models/groupBuyModel.js
{
  productId: ObjectId, sellerId: ObjectId,
  groupPrice: Number, originalPrice: Number,
  targetSize: Number,            // e.g. 3 buyers
  deadline: Date,                // e.g. 24h from creation
  status: 'open' | 'filled' | 'expired' | 'cancelled',
  members: [{ userId, orderId, joinedAt }],
  createdBy: ObjectId            // the buyer who started the team
}
```
- Service `groupBuyService.js`: create/join/expire logic; on `filled` → convert each member's reservation into an order at `groupPrice`; on `expired` → release reservations, notify, refund wallet pre-payments automatically.
- Expiry sweep: extend the existing `orderAutomationQueue` (already runs flash-sale sweeps every 5 min).
- Endpoints: `POST /api/group-buys` (start), `POST /api/group-buys/:id/join`, `GET /api/group-buys/:id` (status + members), `GET /api/group-buys/active` (home section).

**Frontend:**
- PDP: dual CTA — *"Acheter seul : 10 000 XAF"* / *"Acheter en groupe (3 pers.) : 7 500 XAF"*.
- Group status page with share sheet (WhatsApp deep link with prefilled message + link).
- Home section "🔥 Achats groupés en cours" with team progress bars ("2/3 — il manque 1 acheteur").

**Complexity:** 🔴 High (order-flow integration, refunds, concurrency on join). **Impact:** ⬆️⬆️ new-user acquisition + GMV; the strongest growth lever in this document.

---

### B.2 Buyer rewards program — "HDPoints" (淘金币)

> ✅ **Built (shipped after this analysis).** `backend/models/rewardPointsModel.js`, `backend/services/rewardPointsService.js`, `frontend/src/components/RewardPointsCard.jsx` and `RewardPointsRedeemBox.jsx`.

**What Taobao does:** Taobao Gold Coins: daily check-in, coins per purchase, per review, per share; coins pay part of an order. Buyers open the app daily even without buying.

**Current gap:** sellers have a full gamification system; buyers have zero.

**Implementation:**
- Extend the existing wallet ledger pattern: `pointsBalance` + `pointsTransactions` on `walletModel` (or a sibling `rewardPointsModel` if you prefer separation).
- Earning rules (runtime settings, so they can be tuned without deploys): daily check-in (streak bonus), X points per 1 000 XAF spent, points per verified review, points per answered Q&A (feeds B.4).
- Spending: checkout option "Utiliser mes points" — capped at e.g. 10-20% of order value; conversion rate is a runtime setting; deducted server-side in the pricing path.
- BullMQ: check-in streak evaluation piggybacks on existing engagement schedules.
- UI: points widget in `Wallet.jsx` + check-in card on Home; points history list.

**Complexity:** 🟡 Medium. **Impact:** ⬆️ DAU, ⬆️ repeat purchase rate — the retention engine Taobao runs on.

---

### B.3 Referral program — "Parrainage"

> ✅ **Built (shipped after this analysis).** `backend/services/referralService.js`, `frontend/src/pages/Referrals.jsx` and `ReferralLanding.jsx` (`/r/:code`-style landing flow).

**What Taobao does:** invite friends, both sides get rewarded (coupons/credit) when the invitee completes a first order.

**Current state (verified):** no referral system exists anywhere (matches for "invite/referral" are promo codes and shop assistants).

**Implementation:**
- `userModel`: add `referralCode` (unique, auto-generated) and `referredBy`.
- Reward trigger: invitee's first **delivered** order (not registration — avoids fake-account farming), validated in the order status flow.
- Reward: wallet credit (needs A.4 for real value) or a `marketplacePromoCodeModel` coupon (already exists — zero new payment surface). Start with coupons.
- Fraud guards: same-device check via existing `userSessionModel`/push tokens, `phoneBlacklistModel`, one-referral-per-device, reward only after the 72h dispute window closes (dispute system already enforces this window).
- UI: "Invite tes amis" in Profile with WhatsApp share; landing route `/r/:code` that persists the code through registration.

**Complexity:** 🟡 Medium. **Impact:** ⬆️ organic growth at near-zero CAC — critical for a marketplace still building density.

---

### B.4 Product Q&A — "Questions & Réponses" (问大家)

> ✅ **Built (shipped after this analysis).** `backend/models/productQuestionModel.js`, `frontend/src/components/ProductQuestionsSection.jsx` on the PDP.

**What Taobao does:** on every PDP, buyers ask questions ("Est-ce que la taille 42 taille grand ?"); the seller and previous buyers answer. Reduces pre-sale chat load and conversion anxiety.

**Current state:** product comments exist (`commentModel`) but they're reviews/discussion, not structured Q&A; pre-sale questions today go through 1:1 chat, which doesn't scale for the seller and doesn't help the next buyer.

**Implementation:**
- `productQuestionModel.js`: `{ productId, askedBy, question, answers: [{ userId, isSeller, isVerifiedBuyer, text, createdAt }], upvotes, status }`.
- Verified-buyer answers weighted first (order linkage already exists for reviews).
- Notifications via existing infra: seller notified on new question; asker notified on answer; Q&A answer earns HDPoints (B.2).
- `ProductDetails.jsx`: new "Questions (12)" tab above reviews. ⚠️ This file is ~5,100 lines with a kept-as-reference desktop render — add the tab surgically to the mobile render only, per CLAUDE.md.

**Complexity:** 🟢 Low-Medium. **Impact:** ⬆️ conversion on considered purchases, ⬇️ seller chat burden.

---

### B.5 Short-video product discovery — "Vidéos"

> ✅ **Shipped (Sep 2, 2026).** `Explorer.jsx` now renders products with a video as muted, looping, play-in-viewport tiles (`AutoplayVideo` — IntersectionObserver play/pause, poster fallback to the primary image); products without video keep the image card.

**What Taobao does:** video-first browsing; live streaming commerce. Live streaming is **not recommended** for HDMarket (bandwidth cost, infra weight, market readiness) — but short product videos are realistic: products already support video (Cloudinary video uploads) and the Explorer feed exists.

**Implementation:**
- Extend `Explorer.jsx` with a vertical autoplay video mode (muted, loop, IntersectionObserver play/pause — the pattern the masonry grid already uses for visibility).
- Prefer products with existing video assets; fall back gracefully.
- Seller side: encourage video at upload time (badge "avec vidéo" in listings; optionally a small search-ranking boost via existing boost weights).

**Complexity:** 🟡 Medium (mostly frontend + bandwidth-conscious loading). **Impact:** ⬆️ session duration, ⬆️ conversion on visual products (fashion, cosmetics).

---

### B.6 Visual search (image-upload search)

**What Taobao does:** photograph an item → find similar listings.

**Assessment:** lowest priority for HDMarket — upload bandwidth, no existing similarity index, and text/category search already works. If pursued later: Cloudinary perceptual hashing or a third-party vision API behind a queue, never synchronous. **Recommendation: defer** and revisit after B.1-B.5.

**Complexity:** 🔴 High. **Impact:** 🟢 Low-Medium (in this market, today).

---

## 🧭 Part C — UX areas no proposal covers yet

The `ag/` folder has 30+ redesign proposals, but the audit shows these user journeys have **never** been proposed:

- **Courier/delivery experience** — `CourierDashboard.jsx` exists but no proposal covers the courier workflow (earnings view, route clarity, proof flow UX).
- **Disputes UI** — dispute backend is solid; buyer/seller dispute UX (`MyComplaints.jsx`, `SellerDisputes.jsx`) has no redesign proposal.
- **Wallet UX** — the wallet shipped recently; no polish proposal (empty states, transaction clarity, withdrawal status tracking).
- **Installments UI** — installment logic is deep backend-wise; buyer-facing installment journey has no proposal.
- **Onboarding** — first-run experience for new buyers and new sellers (Taobao invests heavily here; HDMarket has nothing).

Recommend these as the next batch of `ag/`-style proposals after Parts A/B are scheduled.

---

## 🗺️ Roadmap

```
Phase 1 (Weeks 1-2) — Finish what's started        [small diffs, immediate payoff]
├── A.1 Live courier GPS tracking                  ✅ shipped (Sep 2026)
├── A.3 AI recommendations rollout staging (5% → 25% → 100%)  [flag enabled ✅, route cleanup ✅]
└── A.5 Image Studio go/no-go

Phase 2 (Weeks 3-6) — Buyer-side retention engine  [✅ core shipped]
├── B.2 HDPoints (check-in + earn + spend)          ✅ shipped
├── B.3 Referral program (coupon rewards first)     ✅ shipped
└── A.4 Automated wallet top-up (deepens B.2/B.3 payout value)

Phase 3 (Weeks 7-12) — Social commerce             [✅ core shipped]
├── B.1 Group buying (flagship)                     ✅ shipped
├── B.4 Product Q&A                                 ✅ shipped
└── A.2 Bundle checkout enforcement                  ✅ shipped (Sep 2026)

Phase 4 (Later) — Rich media & beyond
├── B.5 Short-video discovery
├── Part C UX proposal batch (courier, disputes, wallet, installments, onboarding)
└── B.6 Visual search (deferred, revisit)
```

**July 24, 2026 addendum — shipped alongside:** a shared Taobao-style motion layer (CSS keyframes + `--home-anim-delay` staggering in `index.css`, `prefers-reduced-motion`-gated) across Home, Products, `ProductMasonryGrid` (all listing feeds) and ProductDetails. See `CRAFTSMANSHIP_AUDIT.md` §1 for what remains (hero moments, skeleton choreography).

## 📈 Impact / effort matrix

| Feature | Effort | AOV | Conversion | Retention | Growth |
|---|---|---|---|---|---|
| A.1 Live GPS tracking | 🟢 | — | +3% | +10% | — |
| A.2 Bundle checkout | 🟡 ✅ shipped | +10-20% | +5% | — | — |
| A.3 Recs rollout | 🟢 | +5% | +10% | +10% | — |
| A.4 Auto wallet top-up | 🟡 | +5% | +10% | +10% | — |
| A.5 Image Studio activation | 🟢 | — | +3% | — | +5% (seller quality) |
| B.1 Group buying | 🔴 | +10% | +15% | +10% | **+30%** |
| B.2 HDPoints | 🟡 | +5% | +10% | **+25%** | +5% |
| B.3 Referral program | 🟡 | — | +5% | +10% | **+20%** |
| B.4 Product Q&A | 🟢 | — | +8% | +5% | — |
| B.5 Short-video feed | 🟡 | +5% | +8% | +15% | — |

---

## 🤔 Recommendation: where to start

> **Sep 2, 2026 update:** **A.1 and A.2 are now shipped** (see their inline amendments), and **A.3 is reduced to rollout staging** — the flag is enabled at 5% and the orphan route is gone. The highest-ROI remaining work: **A.3 staging (5% → 25% → 100%)**, then **A.4 (automated wallet top-up)** — it deepens the shipped HDPoints and referral rewards — and **A.5** just needs a go/no-go. B.5 (short video), Trust & Safety 2.0 (guarantee deposit, buyer credibility score, AI moderation), and the Part C UX batch follow.

> **July 24 update:** the original Phase 2/3 core (B.1-B.4) is done, so the recommendation shifts entirely to Phase 1 and the leftovers. **A.3 (recs rollout)** remains the main Phase-1 item — **A.1 (live GPS tracking) is now shipped too** (re-verified Sep 2026, see the amendment at A.1). Then **A.4 (automated wallet top-up)**, which now has real consumers: it deepens the shipped HDPoints and referral rewards. **A.2 (bundle checkout enforcement)** closes the remaining promise-to-buyer gap, and **A.5** just needs a go/no-go. B.5 (short video) and the Part C UX batch follow once Phase 1 is clear.

---

**End of V2 analysis. Status claims were verified against the codebase on July 19, 2026; the July 24, 2026 amendments (B.1-B.4 shipped, motion layer) and the Sep 2, 2026 amendments (A.1 + A.2 + A.3 + B.5 shipped, A.5 partial, credibility score shipped, wallet absent from the tree — see A.4) were re-verified against the same tree — file paths are cited inline for re-checking.**
