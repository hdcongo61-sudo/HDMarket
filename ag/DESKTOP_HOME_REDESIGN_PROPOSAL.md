# HDMarket - Desktop Home Page Redesign Proposals

## Current State Analysis

### Layout Issues
- **Content width mismatch**: Home page uses `max-w-7xl` (1280px) but navbar is `1400px` (2xl: 1600px), creating visible misalignment
- **15 vertical sections** stacked sequentially with uniform 32px spacing - excessive scroll depth
- **Underused horizontal space**: Most sections use only 3-4 columns in a 1280px container
- **Repetitive product sections**: Deals, Promotions, Best Sellers, City Products, Top Lists, Certified, All Products = 7 product sections before reaching the main grid
- **Hero takes full width** but doesn't leverage the space effectively
- **No sidebar or multi-column layout** - everything is single-column stacked sections
- **Categories grid** takes a full section instead of being integrated into navigation
- **Filter/sort section** is disconnected from the product grid

### Current Desktop Grid Usage

| Section | Columns | Width Used |
|---------|---------|------------|
| Hero | 1 | Full |
| Trust Indicators | 4 | Full |
| Categories | 4 | Full |
| Top Deals | 3 | ~75% |
| Promotions | 4 | Full |
| Best Sellers | 3 | ~75% |
| City Products | Swiper (4) | Full |
| Top Products | 2 | Full |
| Filters | 1 | Full |
| Verified Shops | 3 | ~75% |
| Certified Products | 4 | Full |
| All Products | 3 | ~75% |

---

## Proposal A: Wide Multi-Zone Layout (Recommended)

**Concept:** Expand content to match navbar width (1400px), reorganize into a multi-zone layout with a featured area, sidebar-style sections, and a wider product grid. Inspired by Amazon, Cdiscount, and modern e-commerce platforms.

### Key Changes

| Aspect | Current | Proposed |
|--------|---------|----------|
| Content max-width | 1280px | 1400px (2xl: 1600px) |
| Layout model | Single-column stacked | Multi-zone with side panels |
| Hero | Full-width gradient banner | Compact hero + side deals panel |
| Categories | Full grid section | Integrated into hero zone or top bar |
| Product grid | 3 columns | 4-5 columns |
| Filters | Separate section | Sticky sidebar or inline bar above grid |
| Top lists | 4 separate list sections | Condensed into a tabbed widget |

### Desktop Wireframe

```
+================================================================+
|                         NAVBAR (1400px)                         |
+================================================================+
| [Category Pills: Tout | Electronique | Mode | Maison | ...]    |
+================================================================+
|                                                                  |
| +-------------------------------+  +---------------------------+ |
| |        HERO BANNER            |  |   FLASH DEALS PANEL      | |
| |   "Votre Marché Digital"      |  |  +-----+ +-----+         | |
| |                               |  |  | -30%| | -50%|         | |
| |   [Publier] [Explorer]        |  |  | img | | img |         | |
| |                               |  |  | 5kF | | 3kF |         | |
| +-------------------------------+  |  +-----+ +-----+         | |
|                                     |  +-----+ +-----+         | |
| +-------------------------------+  |  | -20%| | -40%|         | |
| |      PROMO BANNER (wide)      |  |  | img | | img |         | |
| +-------------------------------+  |  | 8kF | | 2kF |         | |
|                                     +---------------------------+ |
+------------------------------------------------------------------+
|                                                                  |
| Meilleures ventes                              Voir tout >      |
| +--------+ +--------+ +--------+ +--------+ +--------+         |
| |  #1    | |  #2    | |  #3    | |  #4    | |  #5    |         |
| |  img   | |  img   | |  img   | |  img   | |  img   |         |
| | title  | | title  | | title  | | title  | | title  |         |
| | price  | | price  | | price  | | price  | | price  |         |
| +--------+ +--------+ +--------+ +--------+ +--------+         |
|                                                                  |
+------------------------------------------------------------------+
|                                                                  |
| +---------------------+  +------------------------------------+ |
| |  VERIFIED SHOPS     |  |  TOP PRODUCTS (Tabbed)              | |
| |  [shop] [shop]      |  |  [Favoris | Notés | Neufs | Occ.]  | |
| |  [shop] [shop]      |  |  +------+ +------+ +------+        | |
| |  [shop] [shop]      |  |  | prod | | prod | | prod |        | |
| |                     |  |  +------+ +------+ +------+        | |
| |  Voir toutes >      |  |                                    | |
| +---------------------+  +------------------------------------+ |
|                                                                  |
+------------------------------------------------------------------+
|                                                                  |
| [Trier: Nouveautés v]  [Catégorie: Toutes v]  [Ville: Toutes v]|
|                                                                  |
| +------+ +------+ +------+ +------+ +------+                   |
| | prod | | prod | | prod | | prod | | prod |                   |
| | img  | | img  | | img  | | img  | | img  |                   |
| | name | | name | | name | | name | | name |                   |
| | price| | price| | price| | price| | price|                   |
| +------+ +------+ +------+ +------+ +------+                   |
| +------+ +------+ +------+ +------+ +------+                   |
| | prod | | prod | | prod | | prod | | prod |                   |
| +------+ +------+ +------+ +------+ +------+                   |
|                                                                  |
|              [ 1 ] [ 2 ] [ 3 ] ... [ 10 ] [ > ]                |
+------------------------------------------------------------------+
```

### Section Details

**1. Category Bar (below navbar)**
- Full-width bar with horizontal scrollable category pills
- Sticky on scroll (stays visible while browsing products)
- Replaces the large categories grid section

**2. Hero + Deals Split Zone**
- Left: Hero banner (65% width) - compact, 300px height
- Right: Flash Deals panel (35% width) - 2x2 grid of deal cards with discount badges
- Below hero: Promo banner (full width, slim)

**3. Best Sellers Row**
- 5-column horizontal row with ranking badges
- Single row, no pagination needed
- Clean cards with image, title, price

**4. Shops + Top Products Split**
- Left (35%): Verified Shops compact list (6 shops with logos)
- Right (65%): Tabbed widget with 4 tabs (Favoris, Notés, Neufs, Occasion)
- Each tab shows 3 products in a row

**5. Product Grid with Inline Filters**
- Sticky filter bar above grid: Sort dropdown, Category dropdown, City dropdown
- 5 columns on xl screens, 4 on lg
- Desktop pagination (numbered pages)

### Removed from Desktop
- Delivery Promise section (moved to footer or product detail)
- Trust Indicators section (integrated as small badges in hero)
- Separate deals + promotions sections (merged into deals panel)
- Cities Navigation section (integrated as filter)
- Certified Products section (merged into product grid with badge)

### Benefits
- Content width matches navbar (1400px)
- ~40% less vertical scrolling
- Multi-zone layout uses horizontal space efficiently
- Products visible faster (deals visible in hero zone)
- Tabbed widget condenses 4 sections into 1
- Professional e-commerce look

---

## Proposal B: Magazine-Style Layout

**Concept:** Editorial/magazine-style layout with large featured areas, asymmetric grids, and curated content blocks. Inspired by Etsy, Pinterest, and lifestyle e-commerce platforms.

### Key Changes

| Aspect | Current | Proposed |
|--------|---------|----------|
| Content max-width | 1280px | 1400px |
| Layout feel | Grid-heavy, uniform | Editorial, varied card sizes |
| Hero | Gradient banner | Full-width lifestyle image with search overlay |
| Featured products | Equal-sized cards | Mix of large hero cards and small supporting cards |
| Sections | All equal weight | Visual hierarchy with varying importance |

### Desktop Wireframe

```
+================================================================+
|                         NAVBAR                                  |
+================================================================+
|                                                                  |
| +--------------------------------------------------------------+|
| |                   HERO IMAGE (full-width)                     ||
| |              [    Search HDMarket...    ]                     ||
| |         Découvrez 5,000+ produits vérifiés                   ||
| +--------------------------------------------------------------+|
|                                                                  |
| +-------------------+ +-------------------+ +-----------------+ |
| |   FEATURED #1     | |   FEATURED #2     | |  DEALS COLUMN   | |
| |   (large card)    | |   (large card)    | |  +----------+   | |
| |   big image       | |   big image       | |  | deal 1   |   | |
| |                   | |                   | |  +----------+   | |
| |   title           | |   title           | |  | deal 2   |   | |
| |   price           | |   price           | |  +----------+   | |
| +-------------------+ +-------------------+ |  | deal 3   |   | |
|                                              |  +----------+   | |
| +----------+ +----------+ +----------+      |  | deal 4   |   | |
| | small 1  | | small 2  | | small 3  |      |  +----------+   | |
| | img+price| | img+price| | img+price|      +-----------------+ |
| +----------+ +----------+ +----------+                          |
|                                                                  |
+------------------------------------------------------------------+
| Categories                                                       |
| [Electronique] [Mode] [Maison] [Sports] [Auto] [Beauty] [...]  |
+------------------------------------------------------------------+
|                                                                  |
| Tendances                                        Voir tout >    |
| +--------+ +--------+ +--------+ +--------+ +--------+         |
| | trend1 | | trend2 | | trend3 | | trend4 | | trend5 |         |
| +--------+ +--------+ +--------+ +--------+ +--------+         |
|                                                                  |
| Boutiques populaires                                             |
| +----------------+ +----------------+ +----------------+        |
| |  Shop banner   | |  Shop banner   | |  Shop banner   |        |
| |  logo + info   | |  logo + info   | |  logo + info   |        |
| +----------------+ +----------------+ +----------------+        |
|                                                                  |
| Tous les produits                [Trier v] [Filtrer v]          |
| +------+ +------+ +------+ +------+ +------+                   |
| | prod | | prod | | prod | | prod | | prod |                   |
| +------+ +------+ +------+ +------+ +------+                   |
| (pagination)                                                     |
+------------------------------------------------------------------+
```

### Benefits
- Visually striking, editorial feel
- Large featured products create strong visual hierarchy
- Asymmetric layout creates visual interest
- Lifestyle-focused, appeals to browsing behavior
- Fewer, more impactful sections

### Drawbacks
- More complex implementation
- Featured product selection logic needed
- Less product density per viewport

---

## Proposal C: Dashboard-Style Layout with Sidebar

**Concept:** Persistent left sidebar with categories/filters and a main content area on the right. Classic e-commerce pattern used by Alibaba, eBay, and Walmart.

### Key Changes

| Aspect | Current | Proposed |
|--------|---------|----------|
| Content max-width | 1280px | 1600px |
| Layout | Single column | Sidebar (250px) + Main content |
| Navigation | Categories as section | Persistent sidebar categories |
| Filters | Separate section | Sidebar filters (always visible) |
| Product grid | 3 columns | 4 columns (in remaining space) |

### Desktop Wireframe

```
+================================================================+
|                         NAVBAR                                  |
+================================================================+
|          |                                                       |
| SIDEBAR  |  MAIN CONTENT AREA                                   |
| (250px)  |                                                       |
|          |  +--------------------------------------------------+ |
| Categories  |           HERO / PROMO CAROUSEL                  | |
| +--------+  +--------------------------------------------------+ |
| |Electro |                                                       |
| |Mode    |  Flash Deals                           Voir tout >   |
| |Maison  |  +--------+ +--------+ +--------+ +--------+        |
| |Sports  |  | deal 1 | | deal 2 | | deal 3 | | deal 4 |        |
| |Auto    |  +--------+ +--------+ +--------+ +--------+        |
| |Beauté  |                                                       |
| |Livres  |  Meilleures ventes                     Voir tout >   |
| |Autre   |  +--------+ +--------+ +--------+ +--------+        |
| +--------+  | sale 1 | | sale 2 | | sale 3 | | sale 4 |        |
|              +--------+ +--------+ +--------+ +--------+        |
| Filtres                                                          |
| +--------+  Tous les produits                                    |
| |Trier   |  +------+ +------+ +------+ +------+                |
| |[v]Nouv |  | prod | | prod | | prod | | prod |                |
| +--------+  | img  | | img  | | img  | | img  |                |
| |Prix    |  +------+ +------+ +------+ +------+                |
| |[___]min|  +------+ +------+ +------+ +------+                |
| |[___]max|  | prod | | prod | | prod | | prod |                |
| +--------+  +------+ +------+ +------+ +------+                |
| |Etat    |                                                       |
| |[x]Neuf |           [ 1 ] [ 2 ] [ 3 ] ... [ > ]               |
| |[x]Occ. |                                                       |
| +--------+                                                       |
| |Ville   |  Boutiques vérifiées                                  |
| |[v]Toute|  +------+ +------+ +------+ +------+                |
| +--------+  | shop | | shop | | shop | | shop |                |
|              +------+ +------+ +------+ +------+                |
+------------------------------------------------------------------+
```

### Benefits
- Categories and filters always visible (no scrolling to find them)
- Maximum product density in main area
- Very functional, utility-focused layout
- Familiar pattern for experienced shoppers
- Easy to add advanced filters (price range, condition, city)

### Drawbacks
- Less visually exciting
- Sidebar reduces main content width
- More rigid layout

---

## Proposal D: Hero Carousel + Compact Sections

**Concept:** Keep the current single-column approach but dramatically compress sections using carousels, tabs, and compact cards. Minimal structural change, maximum space savings. Inspired by Rakuten and Flipkart.

### Key Changes

| Aspect | Current | Proposed |
|--------|---------|----------|
| Content max-width | 1280px | 1400px |
| Hero | Static banner | Auto-rotating carousel (hero + deals + promo) |
| Product sections | 7 separate sections | 3 carousel strips + main grid |
| Top lists | 4 list sections | 1 tabbed component |
| Spacing | 32px between sections | 20px between sections |

### Desktop Wireframe

```
+================================================================+
|                         NAVBAR                                  |
+================================================================+
|                                                                  |
| +--------------------------------------------------------------+|
| |    ROTATING CAROUSEL                              [1][2][3]  ||
| |    Slide 1: Hero Banner                                      ||
| |    Slide 2: Flash Deals                                      ||
| |    Slide 3: Promo Banner                                     ||
| +--------------------------------------------------------------+|
|                                                                  |
| Categories                                                       |
| [icon] [icon] [icon] [icon] [icon] [icon] [icon] [icon]        |
| Electro  Mode  Maison Sports  Auto  Beauté Livres  Plus        |
|                                                                  |
| Meilleures ventes                     [<]  1/3  [>]  Tout >    |
| +--------+ +--------+ +--------+ +--------+ +--------+         |
| | sale 1 | | sale 2 | | sale 3 | | sale 4 | | sale 5 |         |
| +--------+ +--------+ +--------+ +--------+ +--------+         |
|                                                                  |
| +---------------------+  +------------------------------------+ |
| | Boutiques vérifiées |  | Tendances [Fav|Notés|Neufs|Occ.]   | |
| | [shop1] [shop2]     |  | +------+ +------+ +------+         | |
| | [shop3] [shop4]     |  | | prod | | prod | | prod |         | |
| | [shop5] [shop6]     |  | +------+ +------+ +------+         | |
| | Voir toutes >       |  +------------------------------------+ |
| +---------------------+                                         |
|                                                                  |
| Tous les produits       [Trier v] [Catégorie v] [Ville v]      |
| +------+ +------+ +------+ +------+ +------+                   |
| | prod | | prod | | prod | | prod | | prod |                   |
| +------+ +------+ +------+ +------+ +------+                   |
| +------+ +------+ +------+ +------+ +------+                   |
| | prod | | prod | | prod | | prod | | prod |                   |
| +------+ +------+ +------+ +------+ +------+                   |
|              [ 1 ] [ 2 ] [ 3 ] ... [ > ]                       |
+------------------------------------------------------------------+
```

### Benefits
- Minimal structural change from current design
- Hero carousel replaces 3 sections with 1
- Tabbed widget replaces 4 sections with 1
- Easy to implement incrementally
- Still single-column, familiar layout
- 5-column product grid uses space better

### Drawbacks
- Still fundamentally single-column
- Less innovative than multi-zone approach
- Auto-carousel can be ignored by users

---

## Comparison Matrix

| Criteria | A: Multi-Zone | B: Magazine | C: Sidebar | D: Carousel |
|----------|:-:|:-:|:-:|:-:|
| Scroll depth reduction | ~40% | ~30% | ~35% | ~25% |
| Product density | High | Medium | High | High |
| Visual impact | High | Very High | Medium | Medium |
| Implementation effort | Medium | High | Medium | Low |
| Horizontal space usage | Excellent | Good | Excellent | Good |
| Category discoverability | High (sticky bar) | Medium | Very High (sidebar) | Medium |
| Filter accessibility | Good (inline bar) | Medium | Excellent (sidebar) | Good (inline) |
| Familiar pattern | High (Amazon) | Medium (Etsy) | High (Alibaba) | High (Flipkart) |
| Mobile-desktop consistency | Good | Medium | Low | Good |
| Product grid columns | 5 | 5 | 4 | 5 |
| Content width match w/ navbar | Yes (1400px) | Yes (1400px) | Yes (1600px) | Yes (1400px) |

---

## Recommendation

**Proposal A (Wide Multi-Zone Layout)** is recommended because:

1. **Best horizontal space usage** - Split zones (hero+deals, shops+trends) use the full 1400px width effectively
2. **Biggest scroll reduction** (~40%) - Multi-zone layout condenses vertical space
3. **Medium implementation effort** - Restructures existing sections without new components
4. **Matches navbar width** - Content expands to 1400px, aligning with the navbar
5. **Proven pattern** - Amazon, Cdiscount, and major e-commerce platforms use this approach
6. **Sticky category bar** - Improves navigation without a full sidebar
7. **5-column product grid** - Better density on wide screens
8. **Tabbed top products widget** - Condenses 4 list sections into 1 elegant component

### Implementation Approach for Proposal A

1. Expand `<main>` max-width from `max-w-7xl` to match navbar (`max-w-[1400px] 2xl:max-w-[1600px]`)
2. Replace hero section with hero (65%) + deals panel (35%) split using `flex` or `grid grid-cols-[1fr_380px]`
3. Add sticky category pills bar below the hero zone
4. Merge deals + promotions sections into the deals panel
5. Replace Top Products 4-list section with a tabbed widget component
6. Add shops (35%) + tabbed trends (65%) split zone
7. Move filters inline above the product grid as dropdowns
8. Expand product grid to `lg:grid-cols-4 xl:grid-cols-5`
9. Remove Delivery Promise, Trust Indicators, Cities Navigation sections
10. Move certified products into the main grid with badge (already in ProductCard)

---

## Shared Design Tokens (All Proposals)

### Widths
- Content: `max-w-[1400px] 2xl:max-w-[1600px]`
- Sidebar (Proposal C): `w-[250px]`
- Side panel (Proposal A): `w-[380px]`

### Spacing
- Section gap: `20px` (reduced from 32px)
- Card gap in grid: `16px` (`gap-4`)
- Internal card padding: `16px` (`p-4`)

### Typography
- Section title: `text-xl font-bold`
- Product title: `text-sm font-medium line-clamp-2`
- Price: `text-base font-bold`
- "Voir tout" links: `text-sm font-semibold text-indigo-600`

### Cards
- Border radius: `rounded-xl` (12px)
- Shadow: `shadow-sm` (light, clean)
- Border: `border border-gray-100`
- Hover: `hover:shadow-md hover:border-indigo-200 transition-all`

### Grid
- 5 columns on xl+: `xl:grid-cols-5`
- 4 columns on lg: `lg:grid-cols-4`
- 3 columns on md: `md:grid-cols-3`
- 2 columns fallback: `grid-cols-2`

### Colors
- Primary: `indigo-600`
- Deals: `red-500`
- Trust/Verified: `emerald-500`
- Ratings: `amber-500`
- Background: `bg-gray-50` (page), `bg-white` (cards)
