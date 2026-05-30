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