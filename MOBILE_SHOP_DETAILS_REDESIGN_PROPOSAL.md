# HDMarket - Mobile Shop Details Page Redesign Proposals

## Current State Analysis (Post-Redesign)

The current shop profile page (`ShopProfile.jsx`) has been updated with mobile-specific improvements:

### Implemented Mobile Changes ✅

- **Compact hero** — Smaller logo (64px vs 96px), tighter padding, line-clamped description
- **Stats grid** — Condensed 3-column layout with abbreviated labels ("Prod." vs "Prod. disponibles")
- **Action buttons** — Stacked full-width on mobile in hero; sticky bottom bar with Call + Follow
- **Reviews section** — Reduced padding, smaller headers, full-width "Voir tous les commentaires" button
- **Category filters** — Horizontal scroll for category chips on mobile
- **Comments modal** — Bottom sheet style on mobile (slides up from bottom)
- **Sticky bottom bar** — Fixed Call + Follow buttons always accessible in thumb zone

### Remaining Mobile Pain Points

1. **Hero is still dense** — Logo + name + stats + description + 2 buttons take ~400px before products
2. **Hours section** — Full list always visible; could be collapsible on mobile
3. **Top selling products** — 2-column grid is good, but cards could be more compact
4. **No quick contact strip** — Phone/address require scroll; could add a floating "Call" FAB
5. **Product grid** — 2 columns is standard, but card density could be tuned
6. **Share action** — No native share for the shop on mobile
7. **Reviews form** — Rating buttons wrap on small screens; could use a star picker instead
8. **Loading/error states** — No skeleton loaders; generic text only

---

## Proposal A: App-Style Shop Sheet (Recommended)

**Concept:** Immersive shop banner at top, compact info card, collapsible sections, and a persistent action bar. Inspired by Instagram Shop, Shopee Seller Profile, and Jumia Store pages.

### Structure

```
[Full-width Banner - shop image or gradient]
[Floating back + share buttons]
[Compact Shop Card - logo, name, verified, stats row]
[Sticky Action Bar - Call | Follow | Message]
[Collapsible: À propos]
[Collapsible: Horaires]
[Avis - summary + expand]
[Top Selling - horizontal scroll]
[All Products - 2-col grid with category pills]
```

### Key Changes

| Section | Current | Proposed |
|---------|---------|----------|
| Banner | Part of hero card | **Full-width top**, no rounded corners on mobile |
| Back button | Browser/nav | **Floating back** on banner (safe area) |
| Share | None | **Floating share** → `navigator.share` or copy link |
| Shop card | Large hero block | **Compact card** below banner: logo 48px, name, 1-line stats |
| Action bar | Bottom sticky | **Same**, add optional **Message** (WhatsApp to shop) |
| Description | Always visible | **Collapsible** "À propos" accordion |
| Hours | Always visible | **Collapsible** "Horaires" accordion |
| Reviews | Full section | **Summary line** + tap to expand full section |
| Top selling | 2-col grid | **Horizontal scroll** strip (like product details) |
| Products | 2-col grid | **Keep**, improve card density |

### Mobile Wireframe

```
+----------------------------------+
| [<]                        [↗]  |  <- Floating buttons
|                                  |
|     SHOP BANNER (full bleed)     |
|                                  |
+----------------------------------+
| [logo] Shop Name ✓               |
| 42 prod. · ★ 4.2 · 1.2k abonnés |
+----------------------------------+
| [📞 Appeler] [♥ Suivre] [💬]     |  <- Sticky bar
+----------------------------------+
| ▼ À propos                       |
|   Description... [Lire plus]     |
+----------------------------------+
| ▼ Horaires d'ouverture           |
|   Lun–Ven 8h–18h · Aujourd'hui ✓ |
+----------------------------------+
| Avis & Commentaires  [Voir tout] |
| ★★★★☆ 4.2 · 12 avis             |
+----------------------------------+
| Produits les plus vendus         |
| [img][img][img][img]  →          |
+----------------------------------+
| [Tous][Électronique][Mode] →     |
| [  ][  ]  [  ][  ]  [  ][  ]     |
+----------------------------------+
```

### Benefits

- **Banner first** — Strong visual identity
- **~30% less scroll** with collapsible sections
- **Thumb-zone actions** always visible
- **Horizontal scroll** for top products reduces vertical space
- Familiar pattern from major marketplaces

---

## Proposal B: Bottom Sheet Primary

**Concept:** The shop page is a series of cards. The main view shows banner + compact info. Key details (hours, full description, reviews) live in a draggable bottom sheet that the user pulls up. Similar to Uber/Lyft driver profile or Google Maps place details.

### Structure

```
[Full-width Banner]
[Compact Shop Card]
[Primary CTA Bar - Call, Follow]
[Hint: "Glissez pour en savoir plus"]
--- Draggable handle ---
[Bottom Sheet - snap points at 25%, 50%, 90%]
  - Peek: Next 2 sections (À propos, Horaires)
  - Mid: + Reviews summary
  - Full: + Full reviews, products
```

### Mobile Wireframe

```
+----------------------------------+
| [<]                        [↗]  |
|     BANNER                       |
+----------------------------------+
| [logo] Shop Name ✓               |
| 42 prod. · ★ 4.2 · 1.2k abonnés |
| [📞 Appeler] [♥ Suivre]          |
+----------------------------------+
|         ═══                       |  <- Drag handle
| ▼ À propos                        |
|   Lorem ipsum dolor...            |
| ▼ Horaires                        |
|   Lun–Ven 8h–18h                  |
| --- Glissez pour plus ---        |
+----------------------------------+

--- After full drag ---
+----------------------------------+
| Avis (12) · ★ 4.2                |
| [Preview comment...]              |
| [Voir tous]                       |
+----------------------------------+
| Produits les plus vendus         |
| [img][img][img] →                |
+----------------------------------+
| Tous les produits                |
| [grid...]                         |
+----------------------------------+
```

### Benefits

- Maximum use of screen for branding
- Progressive disclosure reduces overwhelm
- Engaging, native-feeling interaction
- Single scroll surface in sheet

### Drawbacks

- Higher implementation complexity
- Requires gesture handling
- Less conventional for e-commerce shops

---

## Proposal C: Tab-Based Layout

**Concept:** Four tabs at top: **Boutique** | **Produits** | **Avis** | **Infos**. Each tab shows one focused view. Reduces scrolling and groups related content.

### Structure

```
[Banner + Compact Shop Card]
[Tab Bar: Boutique | Produits | Avis | Infos]
[Tab Content - single column]
```

### Tab Contents

| Tab | Content |
|-----|---------|
| Boutique | Description, hours, contact, top selling strip |
| Produits | Category filters + product grid |
| Avis | Rating summary, review form, comment list |
| Infos | Address, phone, map link, social links |

### Benefits

- Clear separation of concerns
- Predictable navigation
- Reduces scroll depth per "mode"

### Drawbacks

- More taps to see all info
- Tab bar consumes vertical space
- Some users may not discover all tabs

---

## Proposal D: Story-Style Shop Profile

**Concept:** Shop profile as a vertical story/carousel. Each "slide" is a full-screen card: Banner, About, Hours, Top Products, All Products, Reviews. Swipe up/down to navigate. Inspired by Instagram Stories and TikTok profiles.

### Structure

```
[Full-screen Slide 1: Banner + Shop name + CTAs]
[Full-screen Slide 2: Description + Hours]
[Full-screen Slide 3: Top selling products]
[Full-screen Slide 4: All products grid]
[Full-screen Slide 5: Reviews]
```

### Benefits

- Highly visual, engaging
- Each section gets full attention
- Modern, app-native feel

### Drawbacks

- Unfamiliar for traditional shop browsing
- Harder to jump to specific section
- Implementation complexity high

---

## Comparison Matrix

| Criteria | A: App-Style | B: Bottom Sheet | C: Tabs | D: Story |
|----------|:-:|:-:|:-:|:-:|
| Implementation effort | **Low** | High | Medium | Very High |
| Scroll reduction | **High** | Very High | High | N/A (swipe) |
| Familiarity | **Very High** | Medium | High | Low |
| Info discoverability | **High** | Medium | Medium | Low |
| Thumb-zone CTAs | **Yes** | Yes | Yes | Yes |
| Reuse existing code | **High** | Medium | High | Low |
| Performance | **Low impact** | Medium | Low | Medium |

---

## Recommendation

**Proposal A (App-Style Shop Sheet)** is recommended for the next iteration:

1. **Builds on current work** — Collapsible sections and horizontal scroll are incremental
2. **Proven pattern** — Shopee, Jumia, AliExpress use similar layouts
3. **Full-width banner** — Stronger visual impact with minimal code change
4. **Floating back/share** — Improves navigation and shareability
5. **Message CTA** — Add WhatsApp link to shop (if API supports) for direct contact
6. **Horizontal top products** — Aligns with product details page; less scroll

### Implementation Phases

#### Phase 1 (Quick wins)
- [ ] Full-width banner on mobile (remove rounded corners, extend edge-to-edge)
- [ ] Floating back + share buttons on banner
- [ ] Collapsible "À propos" section
- [ ] Collapsible "Horaires" section
- [ ] `navigator.share` for shop URL on mobile

#### Phase 2 (Layout)
- [ ] Convert Top Selling from 2-col grid to horizontal scroll
- [ ] Add Message/WhatsApp CTA to sticky bar (if shop has WhatsApp)
- [ ] Skeleton loaders for shop, products, reviews

#### Phase 3 (Polish)
- [ ] Star picker instead of number buttons for review rating on mobile
- [ ] Pull-to-refresh for shop data
- [ ] Haptic feedback on key actions (follow, call)

---

## Shared Design Tokens (Mobile)

### Spacing
- Section gap: `12px` (gap-4)
- Card padding: `12px` mobile, `24px` desktop
- Banner height: `120px` min (aspect-video on larger phones)

### Typography
- Shop name: `text-xl font-bold` mobile
- Stats: `text-xs text-gray-500`
- Section headers: `text-base font-bold`
- Body: `text-sm`

### Touch Targets
- Sticky bar buttons: `min-h-[48px]` (iOS HIG)
- Floating buttons: `w-10 h-10`
- Accordion headers: `py-4`

### Colors
- Primary CTA (Call): `bg-emerald-600`
- Secondary (Follow): `border-indigo-200 bg-indigo-50`
- Follow active: `border-emerald-300 bg-emerald-50 text-emerald-700`

---

**Ready for Phase 1 implementation.** 🚀
