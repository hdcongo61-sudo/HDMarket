# HDMarket — CLAUDE.md

Mobile-first e-commerce marketplace for Brazzaville/Congo (Taobao-inspired: fast discovery, seller-first, COD/Mobile Money). Full tech-stack breakdown lives in `APP_ANALYSIS.md`; this file is the practical "how do I work in here" reference.

## Layout

- `backend/` — Node + Express (ESM, `"type": "module"`), MongoDB/Mongoose, Socket.io, BullMQ. Independent `package.json`, own `node_modules`.
- `frontend/` — React 18 + Vite 7 + Tailwind. Independent `package.json`, own `node_modules`.
- These are **not** an npm workspace — no root `package.json`. Always `cd backend` or `cd frontend` before running npm commands.

## Running locally

```bash
# backend (needs backend/.env — MONGO_URI, JWT_SECRET, CLOUDINARY_*, etc. — not committed, ask for a copy)
cd backend && npm run dev        # nodemon, http://localhost:5001

# frontend (needs frontend/.env.local — copy frontend/.env.example as a starting point)
cd frontend && npm run dev       # vite, http://localhost:5173
```

If port 5001 is taken, the backend auto-retries on 5002+ and logs a warning — update `VITE_API_URL` if that happens instead of killing the stale process blind.

## Before committing — every PR should pass all four

```bash
cd backend  && npm run lint && npm test
cd frontend && npm run lint && npm test && npm run build
```

CI (`.github/workflows/ci.yml`) runs exactly this, plus `npm audit --audit-level=critical` as a hard gate (see below) and a `node --check` sweep of every backend file (catches load-time syntax/reference errors that unit tests don't reach).

- **Lint** (`eslint.config.js` in both dirs) is intentionally lenient right now — no prior lint history, so only real-bug classes (`no-undef`, broken conditional hooks, duplicate keys) are errors; unused vars and `console.*` are warnings so CI stays green without a mass cleanup PR. Tighten a rule to `error` once its warnings are cleared, not before.
- **Tests** (Vitest, `*.test.js`, colocated next to source) currently cover the pure pricing/attribute logic only — the highest-value, lowest-effort target (silent wrong-price bugs vs. crashes). Expand coverage opportunistically when touching a file, not as a standalone sprint.

## Sharp edges (read before touching these)

**`backend/utils/productAttributes.js` and `frontend/src/utils/productAttributes.js` are hand-duplicated, not shared.** Both implement the same variant pricing/image rules (a selected size/color option can override the base price and the displayed photo) because the repo isn't a workspace and Vite's dev-server `fs.allow` would need opening to import a file outside `frontend/`. **`backend/utils/productAttributes.parity.test.js`** runs both against identical fixtures and fails if they disagree — if you change a rule on one side, the parity test will tell you to change the other, and you must, not loosen the test.

**Large files, edit surgically, not wholesale.** `backend/controllers/orderController.js` (~5,700 lines) holds order creation, sponsorship/pay-for-other, installments, and admin stats together. `frontend/src/pages/ProductDetails.jsx` (~5,100 lines) has both a canonical mobile render and an intentionally-kept-as-reference legacy desktop render (do not restyle the desktop one to match the flat mobile design system — that's a past decision, not an oversight). With no test coverage on most of these, prefer the smallest correct diff; don't refactor-while-fixing.

**`backend/scripts/`** has one-off data-repair and migration scripts (`repairTimestampSlugs.js`, `normalizePhones.js`, `migrateCategories.js`, …). Check for an existing script before writing a new one-off DB fix.

**Dependency vulnerabilities**: `npm audit` is clean of criticals on both sides. Remaining **high**-severity findings need major version bumps of packages on critical paths — `cloudinary`/`multer-storage-cloudinary` (all image/video uploads), `nodemailer` (password reset email), `firebase-admin` (push notifications) on the backend; `xlsx` (admin exports, no upstream fix yet) on the frontend. These need a scoped upgrade + manual smoke test of that specific flow, not a blind `npm audit fix --force` — there's no test coverage on any of them yet.

**Error tracking is opt-in and off by default.** Set `SENTRY_DSN` (backend) / `VITE_SENTRY_DSN` (frontend) to activate; unset, both are true no-ops. Backend hooks into the existing `middlewares/globalErrorHandler.js` (which already persists 500s to the `ErrorLog` Mongo collection with field redaction — Sentry is a real-time layer on top of that, not a replacement). Frontend hooks into the `hdmarket:ui-error` event `GlobalErrorBoundary` already dispatches.

## Runtime feature flags

Most product behavior (wallet, installments, wholesale, pay-for-other, home banners, long-press image preview, …) is gated through `backend/config/runtimeSettingsCatalog.js` + `services/configService.js`, read on the frontend via `useAppSettings().getRuntimeValue()`. Check there before assuming a feature needs a code change vs. a config flip.

## Memory

Session-persistent notes from prior work (design patterns, past incidents, feature maps) live in `/Users/pro/.claude/projects/-Users-pro-Desktop-HDMarket/memory/` — check `MEMORY.md` there for the index before re-deriving context a past session already worked out.
