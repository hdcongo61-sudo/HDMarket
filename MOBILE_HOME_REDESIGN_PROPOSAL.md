# HDMarket - Mobile Home Page Redesign Proposals

## Current State Analysis

The current mobile home page has **16 sections** stacked vertically, resulting in a very long scroll. Key issues:

- **Too many sections** before reaching products (Hero, Promo Banner, Delivery Promise, Trust Indicators, Categories, Deals, Promotions = 7 sections before best sellers)
- **Repetitive product sections** (Bonnes Affaires, Promotions, Best Sellers, City Products, Top Products, Certified Products, All Products = 7 product sections)
- **Large vertical footprint** for hero and trust indicators
- **Categories take full screen** with 2-column grid
- **No quick-access shortcuts** for returning users
- **No sticky category/filter bar** for easy navigation while scrolling

---

## Proposal A: Compact Feed Layout (Recommended)

**Concept:** Reduce pre-product content to a minimal header, prioritize products immediately, and use horizontal scrolling for secondary sections. Inspired by Jumia, AliExpress, and Temu mobile layouts.

### Structure

```
[Search Bar - sticky top]
[Horizontal Category Pills]
[Promo Banner - compact carousel]
[Flash Deals - horizontal scroll]
[Product Grid - 2 columns, infinite scroll]
  (interspersed with):
  - Verified Shops strip (after 4 products)
  - City Highlights strip (after 12 products)
  - Best Sellers strip (after 20 products)
```

### Key Changes

| Section | Current | Proposed |
|---------|---------|----------|
| Hero | Full-screen gradient with CTA buttons | **Removed** - replaced by sticky search bar |
| Search | Inside navbar only | **Sticky search bar** at top of home page |
| Categories | 2-column grid (8 items, full width) | **Horizontal scrollable pills** (single row) |
| Trust Indicators | 2x2 grid section | **Removed** from home - moved to product detail page |
| Delivery Promise | Full-width card | **Removed** - compact badge in product cards instead |
| Promo Banner | Large aspect-ratio image | **Compact auto-sliding carousel** (aspect-[2/1]) |
| Bonnes Affaires | 1-column grid, full cards | **Horizontal scroll strip** "Flash Deals" |
| Promotions | Separate section | **Merged** with Flash Deals |
| Best Sellers | 1-column grid | **Horizontal scroll strip** interspersed in feed |
| City Products | 4 separate Swiper sections | **Single horizontal strip** with city tabs |
| Top Products | 4 list sections (Favorites, Rated, New, Used) | **Removed** from home - accessible via category pills |
| Filters & Sort | Full section with buttons | **Compact filter bar** above product grid |
| Verified Shops | 1-column grid | **Horizontal scroll strip** in feed |
| Certified Products | 2-column grid | **Merged** into main product grid with badge |
| All Products | 2-column infinite scroll | **Primary content** - starts much earlier |
| Cities Navigation | Button section | **Removed** - city accessible via pills |

### Mobile Wireframe

```
+----------------------------------+
| [<] [  Search HDMarket...  ] [=] |  <- Sticky header
+----------------------------------+
| Tout | Electronique | Mode | ... |  <- Horizontal category pills
+----------------------------------+
| +------------------------------+ |
| |     PROMO BANNER CAROUSEL    | |  <- Auto-slide, compact
| |        (aspect 2:1)          | |
| +------------------------------+ |
+----------------------------------+
| Flash Deals            Voir tout>|
| +------+ +------+ +------+      |
| | img  | | img  | | img  |  ->  |  <- Horizontal scroll
| | -30% | | -50% | | -20% |      |
| | 5000F| | 3000F| | 8000F|      |
| +------+ +------+ +------+      |
+----------------------------------+
| [Trier v] [Prix v] [Etat v]     |  <- Compact filter chips
+----------------------------------+
| +-------+ +-------+             |
| | prod  | | prod  |             |
| | img   | | img   |             |  <- 2-column product grid
| | title | | title |             |
| | price | | price |             |
| +-------+ +-------+             |
| +-------+ +-------+             |
| | prod  | | prod  |             |
| | img   | | img   |             |
| | title | | title |             |
| | price | | price |             |
| +-------+ +-------+             |
+----------------------------------+
| Boutiques verifiees    Voir tout>|
| +------+ +------+ +------+      |  <- Horizontal strip
| | shop | | shop | | shop |  ->  |     between products
| +------+ +------+ +------+      |
+----------------------------------+
| +-------+ +-------+             |
| | prod  | | prod  |             |  <- More products
| | ...   | | ...   |             |     (infinite scroll)
| +-------+ +-------+             |
+----------------------------------+
```

### Benefits
- Products visible within **1 scroll** instead of 5+
- Horizontal strips reduce vertical space by ~60%
- Sticky search encourages discovery
- Category pills allow quick filtering without leaving the page
- Feed-style layout keeps users scrolling

---

## Proposal B: Story-Style Sections

**Concept:** Use full-width card sections that feel like stories/cards the user swipes through vertically. Each section is contained, visually distinct, and has a clear action. Inspired by Instagram Shopping and Pinterest.

### Structure

```
[Sticky Navbar with search]
[Welcome Card + Quick Actions]
[Story-style Promo Cards - horizontal swipe]
[Category Grid - 2x2 with "More" button]
[Featured Product Spotlight - full width]
[Product Grid - 2 columns]
  (with pull-to-refresh)
```

### Key Changes

| Section | Proposed Change |
|---------|----------------|
| Hero | **Welcome card** - "Bonjour [name]!" with 4 quick action buttons (Mes commandes, Favoris, Boutiques, Promos) |
| Promo + Deals | **Story cards** - horizontal swipe, each card is a deal with countdown timer |
| Categories | **2x2 grid** showing top 4 + "Voir toutes les categories" button |
| Trust/Delivery | **Removed** - single trust badge in navbar |
| Products | **Full-width spotlight** for #1 product, then 2-column grid |
| City sections | **Removed** from home - accessible via search/filter |
| Top lists | **Removed** - merged into sort options |

### Mobile Wireframe

```
+----------------------------------+
| HD  [  Rechercher...  ]  [bell] |
+----------------------------------+
| +------------------------------+ |
| | Bonjour, Jean!               | |
| | +------+ +------+           | |
| | |Orders| |Favs  |           | |
| | +------+ +------+           | |
| | +------+ +------+           | |
| | |Shops | |Promos|           | |
| | +------+ +------+           | |
| +------------------------------+ |
+----------------------------------+
| [story1] [story2] [story3] ->   |  <- Swipeable deal stories
+----------------------------------+
| Categories                       |
| +------+ +------+               |
| |Electr| | Mode |               |
| +------+ +------+               |
| +------+ +------+               |
| |Maison| |Sport |               |
| +------+ +------+               |
| [ Voir toutes les categories ]  |
+----------------------------------+
| +------------------------------+ |
| |  FEATURED PRODUCT            | |
| |  [Full-width hero image]     | |  <- Spotlight card
| |  Product Name                | |
| |  25,000 FCFA    [Acheter]   | |
| +------------------------------+ |
+----------------------------------+
| Pour vous                        |
| +-------+ +-------+             |
| | prod  | | prod  |             |
| | ...   | | ...   |             |  <- Infinite scroll
| +-------+ +-------+             |
+----------------------------------+
```

### Benefits
- Personalized feel with greeting and quick actions
- Story-style deals create urgency (timer)
- Fewer but larger, more impactful sections
- Clean visual hierarchy
- Quick actions for returning users

---

## Proposal C: Tab-Based Navigation Home

**Concept:** Replace the single long-scroll page with a tabbed interface at the top. Each tab loads a focused view. Inspired by Amazon and Shopee mobile apps.

### Structure

```
[Sticky Search + Cart icons]
[Tab Bar: Accueil | Promos | Categories | Tendances]
  - Accueil tab: Promo banner + product grid
  - Promos tab: All deals and discounts
  - Categories tab: Full category browser
  - Tendances tab: Top sellers, favorites, ratings
```

### Key Changes

| Section | Proposed Change |
|---------|----------------|
| All sections | **Split across 4 tabs** instead of one long page |
| Hero | **Removed** - promo banner serves as hero |
| Trust/Delivery | **Removed** from home |
| Categories | **Own tab** with full grid + subcategories |
| Deals + Promos | **Own tab** with timer, filters |
| Top lists | **Own tab** "Tendances" with toggleable lists |
| Products | **Main tab** - clean 2-column grid with filters |
| Verified Shops | Moved to Categories tab |
| City Products | Moved to filter in main product grid |

### Mobile Wireframe

```
+----------------------------------+
| [<] [  Search HDMarket...  ] [P] |
+----------------------------------+
| Accueil | Promos | Cat. | Trend |  <- Tab bar
+==================================+
|                                  |
| [  PROMO BANNER CAROUSEL  ]     |
|                                  |
| +-------+ +-------+             |
| | prod  | | prod  |             |
| | img   | | img   |             |
| | title | | title |             |
| | price | | price |             |
| +-------+ +-------+             |
| +-------+ +-------+             |
| | prod  | | prod  |             |
| | ...   | | ...   |             |
| +-------+ +-------+             |
|                                  |
| (infinite scroll)                |
+----------------------------------+
```

### Benefits
- Much shorter page per tab
- Easy to find specific content (deals, categories)
- Faster navigation between sections
- Each tab can lazy-load independently
- Familiar pattern from major e-commerce apps

---

## Proposal D: Visual Discovery Feed

**Concept:** Pinterest/TikTok-inspired masonry layout where products are the star. Minimal chrome, maximum product visibility. Designed for browsing and discovery.

### Structure

```
[Minimal sticky header: logo + search + cart]
[Promo Banner - slim]
[Masonry product grid - variable height cards]
  (with floating category filter button)
  (interspersed banners for deals/shops)
```

### Key Changes

| Section | Proposed Change |
|---------|----------------|
| Hero | **Removed entirely** |
| Categories | **Floating filter button** (bottom-right FAB) that opens a bottom sheet |
| Trust/Delivery | **Removed** |
| All product sections | **Merged into one masonry feed** |
| Deals | **Inline banner cards** in the masonry grid |
| Shops | **Inline shop cards** in the masonry grid |
| Filters | **Bottom sheet** triggered by FAB button |

### Mobile Wireframe

```
+----------------------------------+
| HD    [ Search... ]    [cart]    |
+----------------------------------+
| [ slim promo banner ]            |
+----------------------------------+
| +-------+ +----------+          |
| | prod  | | prod     |          |
| | img   | | img      |          |
| |       | | (taller) |          |
| | name  | | name     |          |
| | price | | price    |          |
| +-------+ +----------+          |
| +----------+ +-------+          |
| | DEAL     | | prod  |          |
| | BANNER   | | img   |          |  <- Mixed content masonry
| | -50%     | | name  |          |
| | [Shop]   | | price |          |
| +----------+ +-------+          |
| +-------+ +-------+             |
| | prod  | | prod  |             |
| | img   | | img   |             |
| +-------+ +-------+             |
|                          [FAB]  |  <- Floating filter button
+----------------------------------+
```

### Benefits
- Maximum product visibility
- Visual, browsing-friendly layout
- Feels modern and engaging
- Variable card heights create visual interest
- Floating filter avoids cluttering the feed
- No wasted space on non-product content

---

## Comparison Matrix

| Criteria | A: Compact Feed | B: Story-Style | C: Tab-Based | D: Discovery Feed |
|----------|:-:|:-:|:-:|:-:|
| Products visible on first screen | 2-4 | 0-1 | 4-6 | 4-6 |
| Scroll depth to products | Low | Medium | Very Low | Very Low |
| Category discoverability | High (pills) | Medium (grid) | High (own tab) | Medium (FAB) |
| Deals visibility | High (strip) | High (stories) | High (own tab) | Medium (inline) |
| Implementation complexity | Medium | High | High | High |
| Familiarity for users | High | Medium | High | Medium |
| Personalization potential | Low | High | Medium | Medium |
| Content density | High | Medium | Medium | High |
| Visual appeal | Good | Great | Good | Great |
| Performance impact | Low | Medium | Medium | Medium |

---

## Recommendation

**Proposal A (Compact Feed)** is recommended because:

1. **Lowest implementation effort** - reuses existing components, mainly restructuring layout
2. **Fastest time-to-product** - users see products within 1 scroll
3. **Proven pattern** - used by Jumia, AliExpress, Temu, all successful in African markets
4. **No routing changes** - stays as a single page, just reorganized
5. **Horizontal scroll strips** dramatically reduce vertical space while keeping all content accessible
6. **Progressive disclosure** - secondary content appears between product rows, not before them

### Implementation Approach for Proposal A

1. Remove Hero section, replace with sticky search bar
2. Convert categories to horizontal scrollable pills
3. Make promo banner more compact (aspect-[2/1])
4. Merge Bonnes Affaires + Promotions into a single horizontal "Flash Deals" strip
5. Move product grid up as the primary content
6. Convert Verified Shops, City Products, Best Sellers into horizontal strips interspersed in the product feed
7. Remove Trust Indicators, Delivery Promise, Cities Navigation, and Top Products lists from home
8. Add compact filter chips above the product grid
9. Keep infinite scroll for the main product grid

---

## Shared Design Tokens (All Proposals)

### Spacing
- Section gap: `12px` (reduced from current `24px`)
- Card padding: `8px-12px`
- Horizontal strip item gap: `8px`

### Typography
- Section title: `text-sm font-bold` (reduced from `text-xl`)
- Product title: `text-xs font-medium line-clamp-2`
- Price: `text-sm font-black`

### Cards
- Border radius: `rounded-xl` (12px)
- Shadow: `shadow-sm` (minimal on mobile for performance)
- Image aspect: `aspect-square` for products

### Colors
- Primary actions: `bg-indigo-600`
- Deals/Flash: `bg-red-500`
- Verified/Trust: `bg-emerald-500`
- Background: `bg-gray-50 dark:bg-gray-950`

### Touch Targets
- Minimum tap target: `44px` height
- Button padding: `py-2.5 px-4` minimum
- Category pills: `py-2 px-4` with `rounded-full`
