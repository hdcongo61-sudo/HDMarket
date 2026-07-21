# 🎨 HDMarket — Craftsmanship & Polish Audit

> Generated: July 21, 2026 | Companion to `TAOBAO_GAP_ANALYSIS_V2.md` (feature gaps) — this doc is scoped to *quality of execution*, not missing features.

---

## Thesis

HDMarket's feature depth is no longer the gap — installments, wholesale, verified shops, the wallet, and (as of this session) group buying, HDPoints, referrals and product Q&A are all real and wired end-to-end. The `Revue UX.dc.html` redesign pass already fixed the most visible inconsistency problem: one accent color, unified badges, unified status pills, 44px touch targets, black prices. What's left is the harder, less checklist-able layer — animation quality, visual hierarchy under real data (not the demo screenshot), emotional payoff at the moments that matter, personalization depth, and dark-mode/edge-case coverage on everything built *after* that redesign pass.

---

## 1. Animation quality — inconsistent vocabulary, no "hero moments"

**What exists today:** `framer-motion` is used, but thinly and inconsistently — `OrderMiniRail.jsx` animates its fill bar (`duration: 0.7, ease: 'easeOut'`), `GlassHeader.jsx` does a simple slide-in, `NotificationItem.jsx` has swipe/long-press motion. Most of the app (every list, every card grid, every modal open/close) relies on Tailwind's default transitions or nothing at all — `active:scale-95` on tap is the closest thing to a universal micro-interaction, and it's applied unevenly (present on `ProductCard`'s CTA, absent on most list rows).

**What's missing:**
- **No shared motion tokens.** Durations/easings are hand-picked per component (`0.7s easeOut` here, a bare CSS `transition` there). A `frontend/src/utils/motion.js` (or a few exported `framer-motion` variants) would let every "enter/exit/success" animation feel like the same product.
- **No hero moments for the events that just got built this session.** A group-buy team filling, a referral reward landing, HDPoints being earned, a check-in streak — all of these currently resolve to a `showToast(...)` one-liner. Pinduoduo/Taobao's entire growth loop *is* the celebration moment (confetti, a bounce, a sound cue on native). Right now `GroupBuySection.jsx`'s "Équipe complète !" state is a static banner with a `PartyPopper` icon — functionally correct, emotionally flat.
- **No skeleton-to-content choreography.** Most pages jump from `ShimmerSkeleton`/spinner straight to final content with no crossfade, so content "pops" rather than resolving.

**Recommended first targets (highest emotional stakes, lowest engineering cost):** order-delivered confirmation, group-buy fill, first sale as a new seller, HDPoints check-in streak milestone (7-day, 30-day).

---

## 2. Visual hierarchy — solid on redesigned screens, untested on new ones

**What's solid:** Everything the `Revue UX` pass touched (`Home.jsx`, `ProductDetails.jsx` mobile render, `Cart.jsx`, `OrderCheckout.jsx`, `ShopProfile.jsx`, `SellerOrders.jsx`, `UserOrders.jsx`, `Login.jsx`, `AdminLayout.jsx`, `NotificationPage.jsx`) — verified in this session to faithfully match the "b" versions: one badge max on product cards, unified section headers, single accent color, black prices.

**What's untested / likely inconsistent:**
- **Everything built this session** (`RewardPointsCard.jsx`, `RewardPointsRedeemBox.jsx`, `GroupBuySection.jsx`, `GroupBuyHomeSection.jsx`, `ProductQuestionsSection.jsx`, `Referrals.jsx`, `ReferralLanding.jsx`) was built functionally-first, styled to *approximately* match the existing flat design language, but never put through the same design-review rigor as the `Revue UX` pass. They're consistent in spirit (same accent orange, same rounded-2xl cards, same font weights) but haven't been scrutinized for the same details: badge stacking discipline, touch-target sizing under `min-h-11`, information density on small screens.
- **`ProductCard.jsx`'s non-`useCommerceMobileCard` branch** (list views, shop-profile compact cards) still stacks up to 5-6 badges (promo, discount, certified, free-delivery, hot-sale, best-seller) — the "one badge max" rule from the redesign was only applied to the primary mobile card variant, not this one.
- **`Footer.jsx`** still uses the pre-redesign `#ff6a00` instead of the `--hd-accent` token on 7 icons (cosmetic, but a genuine one-token-off inconsistency a careful eye will catch).

---

## 3. Emotional storytelling — functional, not felt

Taobao/Pinduoduo's retention isn't the feature list, it's how each feature *makes the user feel noticed*. Concrete gaps:

- **No arrival narrative.** A new user signs up and lands on the same Home feed as everyone else — no "welcome, here's what HDMarket is" moment, no guided first action. `CommerceAuthPanel.jsx`'s right-side panel (3 benefits) is the only "why should I care" surface, and it's desktop-only (`hidden ... lg:block`).
- **No milestone recognition.** A seller's first sale, a buyer's 10th order, a referral streak — none of these are surfaced as *moments*. They exist as data (order count, wallet ledger, points balance) but never as a celebration screen.
- **Empty states are functional, not warm.** `ProductQuestionsSection.jsx`: *"Aucune question pour ce produit. Soyez le premier à demander !"* is fine copy but has zero visual treatment (no illustration, no distinct styling from an error state). Same for most empty lists across the app.
- **Notifications read as system logs, not a relationship.** Even with this session's additions (`points_earned`, `referral_reward_earned`, `group_buy_filled`), the copy is accurate and complete but transactional (*"Vous avez gagné 15 HDPoints."*) rather than warm (*"🎉 +15 HDPoints — merci d'avoir répondu !"*). Small copy delta, real perceived-quality delta.

---

## 4. Personalization — the infrastructure exists, the surface doesn't use it yet

- **`PourVousSection`** (Home.jsx) is a flat 8-item horizontal scroll from `recommendationService.js` — no explanation of *why* something is recommended ("because you viewed X" / "trending in your city"), no distinction between cold-start and warmed-up recommendations.
- **HDPoints, referral status, and group-buy activity are each their own destination page** (`/rewards` implied via Wallet, `/referrals`, PDP-embedded group buys) rather than surfaced contextually on Home — e.g. a "you're 2 points from your next reward" nudge, or "3 of your friends are shopping in [category]" from referral graph data that already exists (`referredBy`) but isn't queried for anything beyond the reward sweep.
- **City/location personalization is coarse.** `effectiveUserCity` drives a city selector chip, but doesn't obviously reorder the feed by proximity/local sellers beyond whatever `recommendationService.js` already does server-side (worth confirming, not verified this session).

---

## 5. Premium polish details

- **Dark mode on new surfaces is unverified.** `index.css`'s global fallback (`.dark :where(...)`) catches ordinary Tailwind utility classes (`bg-white`, `border-gray-100`, `text-gray-800` — used throughout this session's new components), so basic theming likely works. But it does *not* catch hardcoded hex (`bg-[#fff0e4]`, `text-[#e85d00]` — used for brand-accent styling in `RewardPointsCard.jsx`, `GroupBuySection.jsx`, `Referrals.jsx`) — those need a manual dark-mode check, not an assumption that the fallback covers them.
- **Chunk size / load performance**: `vendor-exceljs` (936 kB), `vendor-pdf` (619 kB), and `heic2any` (1.35 MB) are in the production bundle unconditionally per the build output — these are admin-export and HEIC-conversion dependencies that most buyer sessions never touch. Code-splitting them behind the admin routes / conditional dynamic `import()` would cut the buyer-facing bundle meaningfully — a "feels fast" lever most users would never consciously notice but would benefit from on every load.
- **No haptic/native-feel layer.** On Capacitor builds, `active:scale-95` is a CSS approximation of a tap response — the app has `@capacitor/core` already; a thin haptics wrapper (`Haptics.impact()` on key actions: add to cart, place order, check-in) is a small, native-feeling upgrade path Taobao's app leans on constantly.

---

## Where to start

Given engineering cost vs. perceived-quality payoff, in order:

1. **Dark-mode pass on this session's new components** (cheap, mechanical, closes a real gap).
2. **A shared motion vocabulary + 3 hero-moment animations**: order delivered, group-buy filled, HDPoints milestone.
3. **`ProductCard.jsx`'s non-primary badge variant** brought in line with the "one badge" rule.
4. **Notification/empty-state copy pass** for warmth (no code risk, pure copy + minor styling).
5. **Code-split `exceljs`/`pdf`/`heic2any`** out of the default bundle.
