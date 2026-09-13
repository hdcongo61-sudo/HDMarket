# Taobao Mobile UX — What to Adopt for HDMarket (Sep 2026)

> Scope: **user-friendliness / UX patterns**, not feature parity (feature-level gaps are tracked in `TAOBAO_GAP_ANALYSIS_V2.md`).
> Method: Taobao's well-known mobile UX patterns cross-checked against the current HDMarket tree (files cited inline). Every "missing" claim was verified by grep before being listed.
>
> **Implemented 2026-09-12:** #1 recently viewed (shelf + `/recent` page), #2 voice search, #3 onboarding checklist, #4 "Me prévenir", #5 WhatsApp poster, #6 daily-deals strip, #8 EmptyState component (+TopFavorites), plus **image search** (admin-gated `enable_image_search`, color-based Cloudinary pipeline). #7 rebuy already existed in `UserOrders.jsx`. Voice/image search are off by default — enable via Admin > System Settings (`enable_voice_search`, `enable_image_search`).

---

## TL;DR — adopt in this order

| # | Pattern | Effort | Impact | Status in HDMarket |
|---|---|---|---|---|
| 1 | Recently viewed shelf + "footprint" page | 🟢 Low | High (resumption) | ❌ Missing |
| 2 | Voice search in the search bar | 🟢 Low | Medium (mobile input) | ❌ Missing (voice only in chat) |
| 3 | New-user in-app welcome checklist (surfaces existing onboarding sequences) | 🟡 Medium | High (activation) | 🟡 Backend only — delivered as notifications, no buyer UI |
| 4 | "Me prévenir" (notify me) button on out-of-stock / price-drop | 🟢 Low | Medium (retention) | 🟡 Backend engagement service exists, PDP entry point unclear |
| 5 | WhatsApp share poster (product image + price + QR) | 🟡 Medium | High (Congo = WhatsApp-first) | ❌ Missing (text share only) |
| 6 | Home "Deals du jour" strip with end-of-day countdown | 🟢 Low | Medium (urgency) | 🟡 Flash sales exist but no "today's deals" strip |
| 7 | Order hub polish: status chips + one-tap "Acheter à nouveau" | 🟢 Low | Medium (repeat) | 🟡 Tabs exist (`UserOrders.jsx`), repeat-buy unclear |
| 8 | Empty-state sweep (illustration + CTA on every dead end) | 🟢 Low | Medium (no dead ends) | 🟡 Partial — text-only in several places |
| 9 | Long-press image preview enablement | 🟢 None (flag flip) | Low-Medium | 🟡 Flag exists (`CLAUDE.md`) |
| 10 | Visual search (camera icon in search) | 🔴 High | Low today | ❌ Deferred (see V2 B.6) |

---

## 1. Recently viewed products — "Vus récemment" (浏览足迹)

**Taobao does:** keeps a persistent browsing footprint; a "Footprint" page lets you jump back to anything you viewed, days later. One of the highest-return resumption mechanisms in the app.

**HDMarket today:** ❌ no recently-viewed tracking anywhere (grep for `recentlyViewed` = 0 matches). Search history exists (`Navbar.jsx`), but product views are not tracked client-side.

**Build (frontend-only):**
- Hook `useRecentlyViewed` + localStorage ring buffer key `hdmarket:recently-viewed` (last 20 `{ id, slug, title, price, image, viewedAt }`).
- Write from `ProductDetails.jsx` on mount (or the wrapper, one line).
- UI: horizontal "Vus récemment" shelf on Home (reuse `ProductCard`); full page `/recent` reachable from the Profile/Menu list, with "Tout effacer".
- Keep it device-local (no backend) — works for logged-out browsers too, zero server load.

**Effort:** 🟢 ~1 day. **Impact:** resumption of considered purchases; cheap win for conversion.

---

## 2. Voice search in the search bar (语音搜索)

**Taobao does:** mic icon in the search field; tap, speak, results appear.

**HDMarket today:** ❌ no voice input anywhere in search (`Navbar.jsx`); voice exists only as chat messages (`OrderChat.jsx`).

**Build (frontend-only):**
- Mic icon in the `Navbar.jsx` search input; Web Speech API `SpeechRecognition` with `lang: 'fr-FR'` (fallback `fr`), `interimResults: false`.
- On result → set query + navigate to `/products?q=…` (or `/search`).
- Feature-detect once (`'SpeechRecognition' in window || 'webkitSpeechRecognition' in window`); hide the icon when unsupported; never block typing.
- Optional runtime flag `enable_voice_search` in `runtimeSettingsCatalog.js` for staged rollout.

**Effort:** 🟢 ~half a day. **Impact:** mobile typing in French is slow — voice lowers search friction; also an accessibility win.

---

## 3. New-user in-app welcome checklist (新人礼包)

**Taobao does:** first 7 days show a "new user gifts + tasks" card — complete tasks (profile, first search, first order, first review) → coupons. Deeply activation-focused.

**HDMarket today:** 🟡 backend onboarding sequences are real (`onboardingService.js`, `userOnboardingEnrollmentModel.js`, admin UI `AdminOnboardingSequences.jsx`) and users get enrolled at registration (`authController.js`), but steps are delivered **only as notifications** (`notificationCampaignWorker.js`) — there is no buyer-facing in-app surface.

**Build:**
- Buyer endpoint `GET /api/onboarding/me` → current enrollment, done steps, next step, reward preview (small controller + route).
- `OnboardingChecklistCard` on Home for newly-registered users (first 7 days): progress bar, tap-to-complete steps, hidden once complete.
- Completion already handled by `processEnrollmentStep` — the card just renders state and deep-links to each step's target.
- Style: compact dismissible card, not a modal wall.

**Effort:** 🟡 ~2-3 days (one endpoint + one card). **Impact:** new users currently receive "ghost" notifications with no visible program — surfacing it turns existing infra into real activation.

---

## 4. "Me prévenir" — notify me on price drop / restock

**Taobao does:** on out-of-stock or high-interest products, a bell button subscribes you to a restock/price alert.

**HDMarket today:** 🟡 `engagementService.js` already sends price-drop (1h) and back-in-stock (1h) notifications, but there is no obvious PDP entry point to subscribe (grep shows no "Me prévenir" UI).

**Build (mostly wiring, not new logic):**
- `ProductDetails.jsx`: on out-of-stock variant → "Me prévenir quand c'est dispo" button; on normal stock → "Suivre la baisse de prix" toggle.
- Backend: `POST /api/products/:id/alerts` upserts a subscription row (new tiny model, or reuse the existing engagement-subscription storage if one exists — check `engagementService.js` internals first).
- Verify the existing delivery path uses per-user subscriptions and simply exposes them.

**Effort:** 🟢 Low-Medium depending on what `engagementService` already stores. **Impact:** recovers lost out-of-stock sales; feeds the engagement engine it was built for.

---

## 5. WhatsApp share poster (营销海报)

**Taobao does:** one-tap generation of a promotional image (product photo, price, shop name, QR) for sharing on social/chat apps.

**Why Congo:** commerce happens in WhatsApp groups; a text link gets ignored, an image poster gets forwarded. HDMarket already has referral sharing, but no product poster.

**Build:**
- `ShareProductPoster.jsx` modal on PDP: canvas-rendered poster — primary image, title, price (reuse `formatPriceWithStoredSettings`), seller name, deep-link QR.
- QR: tiny client-side lib (`qrcode` package, already used elsewhere? verify — if not, add dev dep) or backend endpoint reusing existing QR util if one exists.
- Download via `canvas.toBlob` → share sheet (native `navigator.share` with file on Android/iOS Capacitor; fallback to image download).
- Deep link must route through the referral/landing pattern already used by `ReferralLanding.jsx`.

**Effort:** 🟡 ~2-3 days. **Impact:** organic WhatsApp distribution — the cheapest growth channel in this market.

---

## 6. Home "Deals du jour" strip

**Taobao does:** a "today's deals" zone with an end-of-day countdown, independent of flash sales.

**HDMarket today:** 🟡 flash sales + countdown exist (`FlashSales.jsx`, `CountdownTimer.jsx`); TopDeals/TopDiscounts pages exist; Home has no compact "se termine à minuit" strip.

**Build:** Home section `DailyDealsStrip` — top 6 discounted products with a `CountdownTimer` to local midnight. Either new endpoint `GET /api/products/public/top-sales/today` (already exists! `productRoutes.js` `getTopSalesTodayByCity`) or filter client-side from top-discounts. **Mostly composition of existing pieces.**

**Effort:** 🟢 ~1 day. **Impact:** daily urgency habit — a reason to open the app every evening.

---

## 7. Order hub polish — action chips + "Acheter à nouveau"

**Taobao does:** orders list with status chips per order and one-tap repeat purchase.

**HDMarket today:** 🟡 `UserOrders.jsx` has status tabs; per-order repeat-buy is unclear (grep `Acheter à nouveau` = no match).

**Build:**
- "Acheter à nouveau" button on delivered orders (re-adds the same items to cart; reuses `cartController` add flow).
- Status action chips (Suivre / Payer / Évaluer / Signaler un litige) already largely exist — just audit that each non-terminal status has exactly one primary action.

**Effort:** 🟢 ~1 day. **Impact:** repeat purchases are the cheapest GMV; the button removes re-search friction.

---

## 8. Empty-state sweep

**Taobao does:** no dead ends — every empty list has an illustration, a sentence, and a CTA button.

**HDMarket today:** 🟡 partial. `Favorites.jsx`, `Cart.jsx`, `UserOrders.jsx`, `Navbar.jsx` search all have empty states with CTAs; admin pages mostly text-only. Buyer-side gaps to check: Profile lists, ShopProfile reviews, chat list, delivery requests, wallet transactions, HDPoints history.

**Build:** shared `EmptyState` component (icon, title, hint, CTA) and a sweep of the buyer-facing pages listed above. Do **not** restyle admin-only screens.

**Effort:** 🟢 ~1-2 days. **Impact:** polish perception; fewer "the app is broken" complaints.

---

## 9. Quick flag/quality flips (near-zero code)

- **Long-press image preview** — feature-gated per `CLAUDE.md`; flip the runtime flag to on and smoke test.
- **`enable_live_location`** — already `defaultValue: true` per V2; confirm the prod value matches.
- **Skeleton loading** — just shipped (`RoutePageSkeleton.jsx`); ensure the Home/feeds use product-card skeletons (they already do via `ProductCardSkeleton`) so lazy routes never flash blank.

---

## 10. Deferred (deliberately)

- **Visual/camera search** — high effort, low today-value (V2 B.6 still stands).
- **Live-stream commerce** — infra/bandwidth risk in this market (V2 already says no).
- **Price history charts** — trust nice-to-have; revisit after order volume grows.

---

## Suggested sequence

1. Sprint 1: **Recently viewed** (#1) + **voice search** (#2) + **Deals du jour strip** (#6) — three frontend-only wins in ~2-3 days.
2. Sprint 2: **New-user checklist** (#3) + **"Me prévenir"** (#4) — surfaces existing backend infra.
3. Sprint 3: **WhatsApp poster** (#5) + **order-hub polish** (#7) + **empty-state sweep** (#8).
4. Backlog: visual search, price history.
