# Favoris (Favorites) Page - Improvement Proposal

## 📋 Current Implementation Summary

The Favoris page displays the user's saved favorite products in a responsive grid. Products are loaded from the FavoriteContext (API: `/users/favorites`) and paginated (12 per page on desktop, infinite scroll on mobile).

### Current Features
- ✅ List of favorite products with ProductCard
- ✅ Pagination (desktop) and infinite scroll (mobile)
- ✅ Empty state with CTA to discover products
- ✅ **Filters by Category** — only categories present in the user's favorites, with human-readable labels from app categories
- ✅ **Filters by Price** — predefined ranges: Tous les prix, 0–10k, 10k–50k, 50k–100k, 100k–500k, 500k+ FCFA
- ✅ Filter bar with “Réinitialiser” and result count (e.g. “5 articles sur 12” when filters are active)
- ✅ Empty filter state: “Aucun favori ne correspond aux filtres” with reset button

---

## 🎨 Filters Implemented

### Category Filter
- **Source**: Unique categories from the current favorites list (no API change).
- **Options**: “Toutes les catégories” + one option per category present in favorites.
- **Labels**: Uses `getCategoryMeta(category)` from `data/categories` for display names (e.g. “Téléphones & Accessoires”).

### Price Filter
- **Ranges** (FCFA):
  - Tous les prix
  - 0 - 10 000
  - 10 000 - 50 000
  - 50 000 - 100 000
  - 100 000 - 500 000
  - 500 000+
- **Logic**: Product `price` is compared to `min`/`max`; “500 000+” uses only `min`, others use both bounds.

### UX
- Filter bar: icon “Filtres”, two selects (Catégorie, Prix), “Réinitialiser” when any filter is active, and count line.
- Page resets to 1 when filters or favorites list change.
- When no product matches: dedicated empty state and “Réinitialiser les filtres” button.

---

## 🚀 Future Improvement Proposals

### Priority 1: High Impact, Low Effort

#### 1. **Sort Options**
**Description**: Allow sorting the filtered list without leaving the page.

**Options**:
- Plus récents (default) — by date added to favorites or product `createdAt`
- Prix croissant / décroissant
- Nom A–Z / Z–A
- Meilleures notes (if rating data is available on products)

**Implementation**: Local sort on `filteredFavorites` (or backend sort if favorites API supports `sort` query). Add a “Trier par” dropdown next to filters.

**Estimated Effort**: 0.5–1 day

---

#### 2. **Search Within Favorites**
**Description**: Text search limited to the current favorites (title, maybe category).

**Features**:
- Search input above or beside filters
- Filter by title (and optionally category) client-side
- Clear button and short hint (“Rechercher dans vos favoris”)

**Implementation**: Add `filterSearch` state; in `filteredFavorites` (or a separate step), filter by `product.title` (and optionally `product.category`) matching the query. Combine with existing category/price filters.

**Estimated Effort**: 0.5 day

---

### Priority 2: Medium Impact, Medium Effort

#### 3. **Bulk Actions**
**Description**: Select multiple favorites and remove them or add them to cart.

**Features**:
- Checkbox on each card (or “Select all on this page”)
- Toolbar: “X sélectionnés”, “Retirer des favoris”, “Ajouter au panier”
- Confirmation before bulk remove

**Implementation**: Selection state (Set or array of `_id`); bulk DELETE to `/users/favorites/:id` in loop or future bulk endpoint; cart API for “Add to cart” for selected products.

**Estimated Effort**: 1–2 days

---

#### 4. **Custom Price Range (Min–Max)**
**Description**: Optional custom price filter in addition to predefined ranges.

**Features**:
- “Personnalisé” in price dropdown; when selected, show two inputs (min FCFA, max FCFA)
- Validation: min ≤ max, non-negative
- Persist in URL (e.g. `?min=5000&max=100000`) for sharing or refresh

**Implementation**: Extend price filter state (e.g. `filterPrice: 'all' | '0-10000' | ... | 'custom'`, `customMin`, `customMax`). Apply in `filteredFavorites`. Optional: sync with search params.

**Estimated Effort**: 1 day

---

### Priority 3: Nice to Have

#### 5. **Export Favorites**
**Description**: Export the current (filtered) list as PDF or CSV for the user.

**Features**:
- Button “Exporter” (PDF or CSV)
- Columns: image link, title, category, price, product link
- Respects current filters so export matches what user sees

**Estimated Effort**: 1 day (reuse existing export patterns elsewhere in the app)

---

#### 6. **Favorites Folders / Tags**
**Description**: Let users group favorites into custom lists (e.g. “Pour Noël”, “À acheter ce mois”).

**Features**:
- Create / rename / delete folders
- Assign product to one folder (or “Non classé”)
- Filter view by folder
- Backend: store `folderId` or tags per user–product favorite

**Estimated Effort**: 2–3 days (backend + UI)

---

#### 7. **Price Drop Alerts**
**Description**: Notify the user when a favorite product’s price decreases.

**Features**:
- “Alerte si baisse de prix” toggle on card or in product detail
- Backend job comparing current price to stored “alert when below” or “notify on any drop”
- In-app or email notification when price drops

**Estimated Effort**: 2–3 days (backend job + notification pipeline)

---

## 📁 Files Touched (Current Implementation)

- `frontend/src/pages/Favorites.jsx` — filters (category + price), filter bar, empty filter state, pagination on `filteredFavorites`
- `frontend/src/data/categories.js` — used via `getCategoryMeta` for category labels (no change)

---

## ✅ Summary

- **Done**: Filters by **category** (from favorites) and **price** (predefined FCFA ranges), with reset and result count.
- **Proposed**: Sort, search within favorites, bulk remove/add to cart, custom price range, export, folders/tags, price drop alerts.
