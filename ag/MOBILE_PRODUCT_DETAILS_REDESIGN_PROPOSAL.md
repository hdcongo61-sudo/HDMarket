# HDMarket - Mobile Product Details Page Redesign Proposals

## Current State Analysis

The current mobile product details page (`ProductDetails.jsx`, ~1900 lines) uses the **same layout for mobile and desktop**, with only minor differences:
- A sticky bottom action bar on mobile
- Shop gallery photos section (mobile only)
- Reviews modal bottom sheet (mobile only)
- `ProductPreview` page exists as a lightweight mobile-first alternative but redirects to full details on tap

### Key Mobile Issues

1. **No mobile-specific layout** — The page renders the full desktop 2-column grid on mobile, just stacked vertically
2. **Top navigation bar wastes space** — A full sticky nav with "Retour" button + share menu takes up vertical space
3. **Image gallery is basic** — Single image with small thumbnails below; no swipe gesture support
4. **Too many badges stacked on image** — Discount, "Nouveau", condition, certified badges all overlap on the left
5. **Price section is buried** — Price appears after title, category badge, date, rating stats, and comments/views/favorites counters
6. **Seller card is heavy** — Large gradient card with logo, name, address, badges, follow button, phone — takes a full screen
7. **Tabs section requires scrolling past everything** — Description, Specs, Reviews, Shipping tabs are far down the page
8. **Social share section is large** — 6 share buttons + copy link takes significant space
9. **Trust badges (paiement sécurisé, livraison) are generic** — Take space without adding real value on mobile
10. **Action bar only shows price + cart + WhatsApp** — No favorite toggle or share in the sticky bar
11. **No image swipe** — Users must tap tiny thumbnails; no native swipe gesture on the main image

---

## Proposal A: App-Style Product Sheet (Recommended)

**Concept:** Full-width immersive image gallery at top, followed by a compact info card, then expandable sections. Inspired by Shopee, Alibaba Mobile, and Instagram Shopping. Optimized for thumb-zone interaction.

### Structure

```
[Full-width Image Swiper - swipeable, dots indicator]
[Floating back + share + favorite buttons on image]
[Price Card - prominent, with discount badge]
[Seller Strip - compact horizontal, tap to expand]
[Quick Info Pills - condition, city, date]
[Description - collapsible]
[Reviews Summary - tap to open modal]
[Related Products - horizontal scroll]
[Sticky Bottom Bar - Cart + WhatsApp + Favorite]
```

### Key Changes

| Section | Current | Proposed |
|---------|---------|----------|
| Navigation | Sticky top bar with "Retour" button | **Floating transparent buttons** on image (back, share, favorite) |
| Image Gallery | Single image + thumbnail strip below | **Full-width Swiper** with dot indicators, swipe gestures |
| Badges on Image | 4 stacked badges (discount, new, condition, certified) | **Max 2 badges** on image (discount + certified); condition as pill below |
| Breadcrumb | Full breadcrumb below nav | **Removed** on mobile — back button is enough |
| Price | Below title, category, date, and ratings | **Immediately below image** — first thing users see |
| Discount display | Price + crossed original + savings badge | **Compact**: price, crossed original, % badge inline |
| Title | text-2xl font-black | **text-lg font-bold** — more compact |
| Rating/Stats bar | 3 separate colored boxes (comments, views, favorites) | **Single line** with compact icons: ★ 4.2 (12) · 👁 234 · ❤ 56 |
| Seller card | Large gradient card with logo, all info, buttons | **Compact strip**: avatar + name + badge + "Voir boutique >" |
| Seller details | Always expanded | **Tap to expand** — shows phone, address, follow button |
| Trust badges | 2 large cards (paiement sécurisé, livraison) | **Removed** from mobile — implied by platform |
| Tabs section | Full tab bar with 4 tabs | **Collapsible accordions**: Description, Spécifications, Livraison |
| Reviews | Inside tab, full form + comment list | **Separate section** with summary + "Voir tous les avis" button |
| Social share | 6 large buttons + copy | **In sticky bar** share icon; or native share sheet via `navigator.share` |
| Product code | Small text mixed in info | **Removed** from mobile view (admin-facing info) |
| Certification info | Mixed with other badges | **Single compact badge** below price if certified |
| Related Products | 2-column grid at bottom | **Horizontal scroll strip** — compact cards |
| Sticky bottom bar | Price + cart button + WhatsApp circle | **Price + Cart + WhatsApp + Favorite toggle** |
| Order messages link | Full-width banner | **Removed** from mobile product page |

### Mobile Wireframe

```
+----------------------------------+
|                                  |
|    [<]              [♡] [↗]    |  <- Floating buttons on image
|                                  |
|   +----------------------------+ |
|   |                            | |
|   |     FULL-WIDTH IMAGE       | |
|   |      (swipeable)           | |  <- Swiper with touch gestures
|   |                            | |
|   |                            | |
|   +----------------------------+ |
|            • ○ ○                 |  <- Dot indicators
+----------------------------------+
| 25,000 F  ̶3̶5̶,̶0̶0̶0̶ ̶F̶  [-29%]    |  <- Price first!
+----------------------------------+
| iPhone 14 Pro Max 256GB          |  <- Title
| ★ 4.2 (12) · 👁 234 · ❤ 56     |  <- Compact stats line
+----------------------------------+
| [Neuf]  [Brazzaville]  [3j]     |  <- Quick info pills
+----------------------------------+
| [🏪 avatar] Boutique XYZ ✓  [>] |  <- Seller strip (tap to expand)
+----------------------------------+
| ▼ Description                    |
|   Lorem ipsum dolor sit amet...  |  <- Collapsible, 3 lines + "Lire plus"
+----------------------------------+
| ▼ Spécifications                 |  <- Collapsible
+----------------------------------+
| Avis clients        [Voir tout]  |
| ★★★★☆ 4.2 · 12 avis            |
| "Excellent produit, très sati.." |  <- 1 preview comment
+----------------------------------+
| Produits similaires   [Voir >]   |
| [img] [img] [img] [img]  ->     |  <- Horizontal scroll
+----------------------------------+
|                                  |
| (spacer for sticky bar)          |
|                                  |
+==================================+
| 25,000 F  [🛒 Ajouter] [💬] [♡]|  <- Sticky bottom bar
+==================================+
```

### Benefits
- **Price visible within 0 scrolls** — immediately below image
- **Image takes center stage** — full-width swipeable gallery
- **~50% less vertical space** compared to current layout
- Seller info is compact, expandable on demand
- Collapsible sections reduce initial page length
- Familiar app-style pattern (Shopee, AliExpress)
- Sticky bar includes all primary actions

---

## Proposal B: Story Card Layout

**Concept:** The product page is a series of visually distinct, full-width cards that the user scrolls through. Each card has one purpose. Inspired by Instagram product pages and Apple product pages.

### Structure

```
[Image Card - full bleed, swipeable, overlaid price]
[Info Card - title, rating, seller strip]
[Action Card - cart, WhatsApp, favorite, share]
[Details Card - expandable description + specs]
[Reviews Card - rating + comments]
[Related Card - horizontal scroll]
```

### Mobile Wireframe

```
+----------------------------------+
| [<]                        [↗]  |
|                                  |
|   +----------------------------+ |
|   |                            | |
|   |    FULL-BLEED IMAGE        | |
|   |                            | |
|   |                    [-29%]  | |
|   |                            | |
|   | 25,000 F                   | |  <- Price overlaid on image
|   +----------------------------+ |
|            • ○ ○                 |
+----------------------------------+
| +------------------------------+ |
| | iPhone 14 Pro Max 256GB      | |
| | ★★★★☆ 4.2 (12 avis)        | |
| | [Neuf] [Brazzaville] [3j]   | |
| |                              | |
| | [🏪] Boutique XYZ ✓    [>]  | |
| +------------------------------+ |
+----------------------------------+
| +------------------------------+ |
| | [🛒 Ajouter au panier     ] | |
| | [💬 WhatsApp] [♡] [↗ Share] | |
| +------------------------------+ |
+----------------------------------+
| +------------------------------+ |
| | Description           [v]   | |
| | Spécifications        [v]   | |
| | Livraison             [v]   | |
| +------------------------------+ |
+----------------------------------+
| +------------------------------+ |
| | Avis clients                 | |
| | ★★★★☆ 4.2 · 12 avis        | |
| | [Preview comment...]        | |
| | [Voir tous les avis]        | |
| +------------------------------+ |
+----------------------------------+
| Similaires    [img][img][img] -> |
+----------------------------------+
```

### Benefits
- Clean card-based visual hierarchy
- Price overlaid on image for immediate visibility
- Dedicated action card makes all CTAs prominent
- Each card is self-contained and scannable
- No sticky bar needed (action card is always near top)

---

## Proposal C: Bottom Sheet Hybrid

**Concept:** The image takes the top half, and product info slides up from the bottom as a draggable sheet (like Google Maps or Apple Maps). The user can drag the sheet up to see more details. Inspired by Uber, Google Maps, and iOS share sheets.

### Structure

```
[Full-screen Image Gallery - top 55%]
[Draggable Bottom Sheet - starts at 45%]
  - Price + Title (peek state)
  - Pull up: full info, seller, description, reviews
  - Action buttons always visible at sheet bottom
```

### Mobile Wireframe

```
+----------------------------------+
| [<]                        [↗]  |
|                                  |
|                                  |
|      FULL IMAGE GALLERY          |
|       (55% of screen)            |
|        swipeable                 |
|                                  |
|            • ○ ○                 |
+==================================+  <- Draggable handle
|  ═══                             |  <- Drag indicator
|                                  |
| 25,000 F  ̶3̶5̶,̶0̶0̶0̶ ̶F̶  -29%     |
| iPhone 14 Pro Max 256GB         |
| ★ 4.2 (12) · [Neuf] · BZV     |
|                                  |
| --- Pull up for more ---        |
|                                  |
| [🛒 Ajouter]    [💬 WhatsApp]  |
+----------------------------------+

--- After pulling up ---

+----------------------------------+
|  ═══                             |
| 25,000 F  ̶3̶5̶,̶0̶0̶0̶ ̶F̶  -29%     |
| iPhone 14 Pro Max 256GB         |
| ★ 4.2 (12) · [Neuf] · BZV     |
+----------------------------------+
| [🏪] Boutique XYZ ✓       [>]  |
+----------------------------------+
| Description                      |
| Lorem ipsum dolor sit amet...    |
| [Lire plus]                      |
+----------------------------------+
| Spécifications                   |
| Condition: Neuf                  |
| Catégorie: Électronique          |
+----------------------------------+
| Avis (12)          [Voir tout]   |
| ★★★★☆ "Très bon produit..."    |
+----------------------------------+
| Similaires  [img][img][img] ->   |
+----------------------------------+
| [🛒 Ajouter]    [💬 WhatsApp]  |
+----------------------------------+
```

### Benefits
- Maximum image real estate
- Interactive, engaging UX pattern
- Sheet provides progressive disclosure
- Familiar pattern from maps/ride-sharing apps
- No sticky bar conflict — actions are part of the sheet

---

## Proposal D: TikTok-Style Vertical Swipe

**Concept:** Each product is a full-screen card. The main view shows image + price + quick actions. Swipe up reveals details. Similar products load as the next card on further swipe. Inspired by TikTok Shopping and Instagram Reels shopping.

### Structure

```
[Full-screen product card]
  - Background: product image (blurred edges)
  - Overlaid: price, title, action buttons (right side)
  - Swipe up: details sheet
  - Swipe to next: related product
```

### Mobile Wireframe

```
+----------------------------------+
|                                  |
|                                  |
|                                  |
|     FULL-SCREEN PRODUCT IMAGE    |
|                                  |
|                                  |
|                           [♡]   |
|                           [💬]  |  <- Side action buttons
|                           [🛒]  |
|                           [↗]   |
|                                  |
| iPhone 14 Pro Max              |
| 25,000 FCFA  ̶3̶5̶,̶0̶0̶0̶        |
| ★ 4.2 · Boutique XYZ ✓       |
|                                  |
| ↑ Glisser pour les détails      |
+----------------------------------+
```

### Benefits
- Maximum visual impact
- Extremely engaging, discovery-focused
- Side buttons are thumb-friendly
- Natural transition to related products
- Modern, trendy UX pattern

### Drawbacks
- High implementation complexity
- Unfamiliar for traditional e-commerce users
- Limited info visible without swiping
- Not great for comparison shopping

---

## Comparison Matrix

| Criteria | A: App-Style | B: Story Card | C: Bottom Sheet | D: TikTok-Style |
|----------|:-:|:-:|:-:|:-:|
| Price visibility | Immediate | Immediate | Immediate | Immediate |
| Image prominence | High | High | Very High | Maximum |
| Info density | High | Medium | Medium (expandable) | Low |
| Implementation complexity | **Low-Medium** | Medium | High | Very High |
| Familiarity for users | **Very High** | High | Medium | Low |
| Scroll depth to all info | Low | Medium | Low (pull up) | Medium (swipe) |
| Action accessibility | **High** (sticky bar) | High (card) | High (in sheet) | High (side) |
| Performance impact | **Low** | Low | Medium | High |
| Reuse of existing code | **High** | Medium | Low | Low |
| Touch/gesture support | Swipe images | Swipe images | Drag sheet + swipe | Full gesture |

---

## Recommendation

**Proposal A (App-Style Product Sheet)** is recommended because:

1. **Lowest implementation effort** — restructures existing sections without new gesture systems
2. **Proven pattern** — Shopee, AliExpress, Jumia all use this exact layout
3. **Price immediately visible** — first content below the image
4. **Reuses most existing logic** — same state, handlers, and data; just rearranged
5. **Collapsible sections** reduce page length by ~50% without removing content
6. **Sticky bar with all actions** — cart, WhatsApp, favorite all in thumb zone
7. **Swiper library already imported** — `swiper/react` is in the project dependencies
8. **Compatible with ProductPreview** — the preview page continues to work as a lightweight entry point

### Implementation Approach for Proposal A

1. **Image Gallery**: Replace static image + thumbnails with `<Swiper>` component (full-width, dot pagination, touch swipe)
2. **Floating Buttons**: Overlay back/share/favorite buttons on the image (absolute positioned, translucent backgrounds)
3. **Remove top nav**: No more sticky breadcrumb bar on mobile — floating back button replaces it
4. **Price-first layout**: Move price block directly below image, before title
5. **Compact title + stats line**: Title + single-line stats (rating · views · favorites) below price
6. **Quick info pills**: Condition, city, date as small rounded pills in a horizontal row
7. **Compact seller strip**: Horizontal card with avatar + name + verified badge + arrow; tap expands to show phone, address, follow button
8. **Collapsible sections**: Replace tab bar with accordion-style collapsibles for Description, Specs, Shipping
9. **Reviews summary**: Compact section with rating, count, 1 preview comment, "Voir tout" button opening the existing modal
10. **Related products strip**: Horizontal scroll instead of 2-column grid
11. **Enhanced sticky bar**: Add favorite toggle button to existing sticky action bar
12. **Use `navigator.share`**: Replace 6-button share section with native share API on supported devices, fallback to compact menu
13. **Remove from mobile**: Trust badges, order messages link, breadcrumb, certification admin button, product code

### Section Order (Top to Bottom)

```
1. Full-width Swiper gallery (with floating back/share/fav buttons)
2. Price block (price, original price, discount badge)
3. Title
4. Stats line (★ rating · views · favorites)
5. Quick info pills (condition, city, days ago)
6. Certified badge (if applicable)
7. Seller compact strip (expandable)
8. Collapsible: Description
9. Collapsible: Spécifications
10. Collapsible: Livraison
11. Reviews summary + "Voir tout"
12. Shop gallery photos (if professional shop)
13. Related products (horizontal scroll)
14. PDF/fiche produit (if exists)
15. [Spacer for sticky bar]
16. Sticky bottom bar: price + cart + WhatsApp + favorite
```

---

## Shared Design Tokens

### Spacing
- Section gap: `12px` (py-3)
- Card padding: `12px-16px`
- Image aspect ratio: `aspect-[4/5]` (taller for mobile)

### Typography
- Price: `text-2xl font-black`
- Title: `text-lg font-bold leading-tight`
- Stats: `text-xs text-gray-500`
- Section headers: `text-sm font-bold`

### Cards
- Border radius: `rounded-2xl` (16px)
- Background: `bg-white`
- Border: `border border-gray-100`
- Shadow: `shadow-sm` (minimal)

### Colors
- Primary CTA: `bg-indigo-600` (cart button)
- WhatsApp: `bg-emerald-500`
- Discount: `bg-red-500`
- Favorite active: `text-red-500 fill-red-500`
- Seller verified: `text-emerald-600`

### Touch Targets
- Floating buttons: `w-10 h-10` (40px)
- Sticky bar buttons: `min-h-[48px]`
- Pills: `py-1.5 px-3` with `rounded-full`
- Accordion headers: `py-4` (44px+ tap area)
