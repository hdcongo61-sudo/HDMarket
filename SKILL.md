# SKILL: HDMarket Taobao-Inspired E-commerce Logic & Design System

## Goal
Redesign and improve HDMarket using Taobao-inspired e-commerce logic: fast discovery, rich product browsing, seller-first marketplace, category-driven navigation, promotional sections, trust signals, and mobile-first buying experience.

The app must not look like a copied Taobao clone. It should keep HDMarket’s identity for Central Africa, Brazzaville/Congo users, Mobile Money reality, COD/payment-on-delivery, shop sellers, individual sellers, boosts, local products, and simple navigation.

## Product Philosophy
HDMarket should feel like:
- A fast mobile marketplace.
- A product discovery app, not only a product list.
- A seller/shop ecosystem.
- A local commerce platform adapted to Congo and Central Africa.
- A professional app, not an AI-generated template.

## Core Design Direction
Use a Taobao-inspired layout:
- Dense but organized home page.
- Strong visual categories.
- Product cards everywhere.
- Personalized recommendations.
- Promotional blocks.
- Seller/shop visibility.
- Sticky search and navigation.
- Mobile-first product discovery.

Avoid:
- Empty white pages.
- Generic dashboard look.
- Too much black and white only.
- Overly flat AI-style UI.
- Desktop-first layouts.
- Complicated checkout.

## Visual Style
Use a warm commerce design system:
- Background: soft neutral, light gray, off-white.
- Cards: rounded, elevated, clean shadows.
- Accent colors: orange/red for promotion, green for delivery/trust, blue for info.
- Use colors carefully, not childish.
- Keep HDMarket premium and local.

Recommended style:
- Apple-like spacing and smoothness.
- Threads-like simplicity.
- Taobao-like product discovery.
- Mobile app feel.

## Home Page Logic
The homepage must be redesigned around discovery sections:

1. Sticky Header
- Location selector: city + commune.
- Search bar always visible.
- Notification bell.
- User/profile icon.
- Search placeholder examples:
  - “Rechercher meubles, téléphone, voiture…”
  - “Que cherchez-vous aujourd’hui ?”

2. Hero / Promo Area
- Carousel banners:
  - Local promotions.
  - Featured shops.
  - Boosted products.
  - Free delivery shops.
  - Payment by installment products.
- Banners must be admin-manageable.

3. Quick Category Grid
Show colorful icon-based categories:
- Téléphones & Accessoires
- Mode
- Maison & Décoration
- Électronique
- Beauté
- Auto & Accessoires
- Bébé & Enfants
- Immobilier
- Services
- Vente en gros

Use 8–10 visible categories with “Voir plus”.

4. Local First Section
Title:
“Autour de vous”
Logic:
- Show products from the user’s selected city/commune first.
- Boosted local products appear higher.
- Then recent approved products.

5. Flash Deals / Promotions
Title:
“Bonnes affaires”
Logic:
- Products with discount.
- Shop promo products.
- Product promo products.
- Admin campaign products.

6. Shops Section
Title:
“Boutiques populaires”
Logic:
- Shops with many products.
- Shops with good ratings.
- Shops with free delivery.
- Boosted shops.

7. Installment Products
Title:
“Paiement par tranche”
Logic:
- Show products where seller enabled installment payment.
- Card must show:
  - “Paiement en plusieurs fois”
  - Start/end period if available.
  - Minimum payment if configured.

8. Wholesale Section
Title:
“Vente en gros”
Logic:
- Show products with quantity-based prices.
- Card must show:
  - “Prix dégressif”
  - “À partir de X pièces”

9. Recommended For You
Title:
“Recommandé pour vous”
Logic:
- Based on visited products.
- Based on favorite categories.
- Based on city.
- Based on similar products.
- If no history, show trending products.

10. Infinite Product Feed
Title:
“Découvrir”
Logic:
- Pinterest/Taobao-style discovery feed.
- Two-column mobile grid.
- Lazy loading.
- Skeleton loader.
- Product cards must be fast and visual.

## Product Card Design
Every product card should include:
- Product image.
- Product name, max 2 lines.
- Price in CFA.
- City/commune.
- Seller/shop badge.
- Discount badge if available.
- Boosted badge only if subtle.
- Favorite button.
- View count if available.
- Rating if available.

Card rules:
- Image first.
- Price must be visually strong.
- Keep CTA simple.
- Do not overcrowd.

Example card badges:
- “Promo”
- “Local”
- “Boutique”
- “Livraison gratuite”
- “Paiement tranche”
- “Vente en gros”

## Product Detail Page
Use a Taobao-style detail page:

Sections:
1. Image gallery
2. Product title
3. Price
4. Discount / promo info
5. Location
6. Seller/shop card
7. Delivery options
8. Payment options
9. Product description
10. Similar products
11. More from this shop
12. Recently viewed

Sticky bottom bar:
- Favorite
- Contact seller
- Order / Acheter
- Share

For HDMarket, checkout must respect:
- Payment on delivery.
- Mobile Money proof when needed.
- Installment option when enabled.
- Platform delivery if available.
- Pick-up option if seller allows.

## Search Experience
Search must feel like a marketplace app:
- Sticky search bar.
- Recent searches.
- Popular searches.
- Category suggestions.
- Product suggestions.
- Shop suggestions.
- City-aware results.

Search ranking:
1. Exact match
2. Local city products
3. Boosted products
4. Popular products
5. Recent products

Filters:
- Category
- Price range
- City
- Commune
- Condition
- Shop / individual seller
- Free delivery
- Installment payment
- Wholesale
- Discount

## Shop Profile Page
Shop page should feel like a mini-store:
- Shop banner
- Logo/avatar
- Shop name
- Location
- Rating
- Number of products
- Opening hours
- Delivery info
- Contact button
- Product tabs:
  - Tous
  - Promotions
  - Nouveautés
  - Vente en gros
  - Paiement tranche

Add seller trust signals:
- Verified shop badge
- Joined date
- Response rate if available
- Number of completed orders if available

## Category Page
Each category page should include:
- Category banner
- Subcategories
- Top products
- Best sellers
- Filters
- Infinite product grid

For Auto & Accessories:
- Cars
- Motorcycles
- Spare parts
- Tires
- Car electronics
- Cleaning accessories

## Navigation Pattern
Mobile bottom navigation:
- Accueil
- Catégories
- Publier
- Commandes
- Profil

For sellers:
- Accueil
- Produits
- Commandes
- Boutique
- Profil

For admin:
Keep admin separate. Do not overload buyer navigation.

## Notifications
Notifications should be grouped like a real e-commerce app:
- Orders
- Payments
- Delivery
- Promotions
- Seller updates
- Admin messages

Use badges and unread states.

## Admin Logic
Admin should be able to manage:
- Home banners
- Featured categories
- Boosted products
- Boosted shops
- Promo campaigns
- Delivery visibility
- Products pending approval
- Shops pending approval
- Payment proofs
- Ads sections

## Performance Requirements
The Taobao-style layout must stay fast:
- Lazy load images.
- Use skeleton loaders.
- Paginate product feeds.
- Compress images.
- Cache homepage sections.
- Avoid loading all products at once.
- Use mobile-first responsive design.
- Optimize API queries by section.

## API / Backend Recommendations
Create endpoints like:

GET /api/home
Returns:
- banners
- categories
- localProducts
- promotedProducts
- popularShops
- installmentProducts
- wholesaleProducts
- recommendedProducts
- discoveryFeed

GET /api/products/discovery
Supports:
- page
- limit
- city
- commune
- category
- sort
- filters

GET /api/search
Supports:
- query
- city
- category
- filters

GET /api/shops/popular
GET /api/products/recommended
GET /api/products/recently-viewed

## UX Rules
- Always show price clearly.
- Always show location.
- Always make search accessible.
- Always allow fast scrolling.
- Avoid long forms.
- Use bottom sheets on mobile.
- Use sticky CTAs.
- Use empty states with suggestions.
- Make product publishing simple for sellers.

## Design Quality Checklist
Before finishing, verify:
- Home page looks like a real marketplace.
- Product cards are visually rich.
- Mobile layout is excellent.
- Search is prominent.
- Categories are easy to scan.
- Local products are prioritized.
- Boosted products are visible but not annoying.
- Promotions feel natural.
- The app does not look like a generic admin template.
- The design feels human-made and professional.

## Final Instruction
Apply this design and logic globally across HDMarket. Refactor components where needed, but preserve existing business logic: Mobile Money proof, COD, product approval, seller/shop system, boosts, city/commune ranking, delivery modes, installments, wholesale pricing, notifications, and admin validation.

---
name: hdmarket-ecommerce
description: Complete e-commerce development skill for HDMarket-style apps: premium UI, mobile-first UX, security, performance, product model, checkout, marketplace logic, notifications, and founder review.
---

# HDMarket E-commerce Skill

Use this skill for every e-commerce feature, page, component, backend route, model, controller, service, and UI redesign.

The goal is to build a real production-quality marketplace, not a generic AI-generated CRUD app.

---

## 1. Design Direction

Always design like a premium mobile e-commerce app inspired by:

- Apple Human Interface Guidelines
- Instagram Threads simplicity
- Clean mobile-first interfaces
- Modern African marketplace needs
- Fast, lightweight, trust-focused shopping experience

The UI must feel handcrafted, premium, simple, and human-made.

Avoid:
- Generic dashboards
- Overcrowded layouts
- Random gradients
- Too many colors
- AI-generated looking cards
- Poor spacing
- Desktop-first design

---

## 2. Mobile-First Rules

Every screen must work perfectly on mobile first.

Requirements:

- One-hand usability
- Large touch targets
- Bottom-friendly actions
- Sticky checkout or CTA buttons when useful
- Responsive cards
- Mobile-friendly modals
- Smooth transitions
- Skeleton loaders
- Empty states
- Error states
- Slow internet support

Always test mentally on:
- iPhone screen
- Android screen
- Small mobile screen
- Desktop screen

---

## 3. Frontend UI Standards

Use:

- React
- Tailwind CSS
- Reusable components
- Clean component structure
- Dark/light mode support
- Responsive layouts
- Accessible buttons and forms

Every component must include:

- Loading state
- Error state
- Empty state where needed
- Mobile layout
- Desktop layout
- Clean spacing
- Consistent typography

Product cards must show:

- Product image
- Name
- Price
- City/location
- Seller/shop info if available
- Promotion/boost badge if active
- Delivery info if useful
- Clear action button

---

## 4. Backend Architecture

Always separate logic clearly:

- models/
- controllers/
- services/
- routes/
- middleware/
- utils/
- validators/

Do not put business logic directly inside routes.

Use service files for:

- Payments
- Checkout
- Orders
- Notifications
- Delivery logic
- Product ranking
- Boosting
- Promotions

---

## 5. Product Model Standards

Products should support rich e-commerce data.

Include when needed:

- name
- description
- price
- images
- videos
- category
- subcategory
- brand
- color
- size
- weight
- dimensions
- shape
- material
- condition
- city
- commune
- seller
- shop
- delivery options
- pickup option
- boost status
- promotion data
- reviews
- ratings
- view count

Important:

If the app does not manage stock, do not add stock logic unless requested.

---

## 6. Checkout Rules

Checkout must be simple, trustworthy, and mobile-first.

Support:

- Pay on delivery
- Full payment option
- Partial payment / installment option if enabled
- Delivery address
- Commune/city delivery rules
- Seller delivery settings
- Admin delivery settings
- Clear order summary
- Clear total price
- Clear buyer notification

If the buyer chooses full payment:

- Notify them clearly
- Seller/admin should not add unexpected delivery fees later
- Show a small banner explaining the rule

---

## 7. Marketplace Logic

When building marketplace features, consider:

- Products from user city first
- Boosted local products should rank higher
- Approved products only
- Admin moderation
- Seller/shop verification
- Product visibility rules
- 3% listing fee if enabled
- Payment proof validation if enabled
- City and commune-based delivery

Ranking priority idea:

1. Local boosted products
2. Local normal products
3. Other boosted products
4. Other approved products
5. Newest approved products

---

## 8. Security Standards

Always protect the app.

Backend must use:

- JWT authentication
- Role-based authorization
- Input validation
- Request sanitization
- Helmet
- Rate limiting
- CORS configuration
- MongoDB injection protection
- XSS protection
- Secure error handling

Protect routes for:

- admin
- seller
- buyer
- delivery guy
- founder

Never expose sensitive data in API responses.

---

## 9. Roles and Permissions

Support clear permissions.

Common roles:

- founder
- admin
- seller
- buyer
- delivery
- sales manager
- vendor

Founder can:

- Manage admins
- See global analytics
- Access sensitive platform settings

Admin can:

- Moderate products
- Manage users
- Validate payments
- Manage categories
- Manage delivery rules

Seller can:

- Create products
- Manage orders
- View own analytics

Buyer can:

- Order products
- Track orders
- Review purchases

Delivery user can:

- See assigned deliveries only
- Update delivery status

---

## 10. Notifications

For notifications, design like a serious commerce app.

Support:

- Order placed
- Order accepted
- Order rejected
- Payment proof submitted
- Payment validated
- Delivery assigned
- Delivery in progress
- Delivery completed
- Review reminder after 24h
- Product approved
- Product rejected
- Boost expired
- Promo expired

Notifications should have:

- title
- message
- type
- user
- read/unread status
- priority
- createdAt
- action link

Use real-time updates when possible with Socket.io.

---

## 11. Performance Rules

Optimize for African mobile users and slow networks.

Always consider:

- Image compression
- Lazy loading
- Pagination
- Infinite scroll where useful
- API caching
- Avoid unnecessary database calls
- Avoid heavy frontend bundles
- Use skeleton loaders
- Use optimistic UI where safe
- Minimize re-renders

Product images must be optimized.

Never load all products at once.

---

## 12. Analytics

Dashboards should include useful business metrics.

Examples:

- Daily revenue
- Weekly revenue
- Monthly revenue
- Orders count
- Pending orders
- Completed orders
- Cancelled orders
- Top products
- Top cities
- Boost revenue
- Delivery revenue
- Seller performance
- Product views
- Conversion rate

Charts must be responsive and theme-aware.

---

## 13. Testing Rules

For important features, generate tests.

Test:

- Authentication
- Authorization
- Product creation
- Checkout
- Orders
- Payments
- Notifications
- Delivery updates
- Admin moderation
- Security validation

Prefer clean, practical tests over excessive test files.

---

## 14. Code Quality

Always write code that is:

- Clean
- Reusable
- Scalable
- Easy to understand
- Production-ready
- Consistent with existing project structure

Before creating new files, check if existing files should be updated.

Avoid duplicate logic.

Avoid breaking existing logic.

---

## 15. Founder Review

Before finalizing any solution, review:

- Does it look premium?
- Is it mobile-first?
- Is it secure?
- Is it scalable?
- Is it fast on slow internet?
- Is it reusable?
- Does it protect marketplace trust?
- Does it feel like a real production app?
- Does it avoid the AI-generated look?

If not, improve it before giving the final code.

follow the Taobao colors configuration