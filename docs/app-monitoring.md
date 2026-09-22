# HDMarket product monitoring (PostHog)

## Activate

The SDK is installed, but does not send data without configuration AND the existing HDMarket analytics consent. It is disabled in development unless explicitly enabled.

1. Create a free PostHog Cloud project at https://posthog.com (EU recommended; use the region you chose).
2. Copy the **public project token**, not a personal API key, from Project settings.
3. Add these frontend deployment/build environment variables:

```dotenv
VITE_POSTHOG_KEY=phc_your_public_project_token
VITE_POSTHOG_HOST=https://eu.i.posthog.com
# For a US project: https://us.i.posthog.com
# Local verification only:
# VITE_POSTHOG_DEBUG=true
```

4. Rebuild/redeploy the frontend. If hosting enforces CSP, allow the chosen ingestion host in connect-src.
5. Enable “Statistiques d’utilisation” at `/cookies`. In PostHog Activity, verify a pageview, guest navigation, login, cart addition and checkout navigation. After logout, the browser gets a fresh anonymous identity. Refusing statistics stops optional analytics; “Diagnostic des erreurs” is a separate choice. Receipts expire after 180 days and are renewed when the policy version changes.
6. Keep billing capped to the free allowance in PostHog billing; inspect usage regularly. Current pricing: https://posthog.com/pricing. No paid subscription or billing settings have been configured by this integration.

## Create dashboard: “HDMarket — Usage quotidien”

Use daily intervals, last 30 days, exclude staff with `role` not in admin/founder/manager, and set the project timezone to Africa/Brazzaville.

| Tile | Configuration |
| --- | --- |
| Daily visitors | `$pageview`, unique users, daily |
| Signed-in vs guest activity | `$pageview`, unique users, breakdown `auth_state` |
| Most visited pages | `$pageview`, total events, breakdown `page` |
| Visitors per page | `$pageview`, unique users, breakdown `page` |
| Devices | `$pageview`, unique users, breakdown `$device_type` |
| Time on pages | `page_engagement`, average `active_seconds`, breakdown `page` (visible intervals, not whole sessions) |
| Scrolling | `page_engagement`, average `scroll_percent`, breakdown `page` |
| Shopping funnel | `product_viewed` → `cart_item_added` → `checkout_viewed` → `order_checkout_completed`; conversion window 1 day |
| Return to payment | `checkout_viewed` → `payment_return_viewed` (NOT a successful payment) |
| Verified payment | `payment_confirmed_in_browser`: the authenticated status API confirms funds received; order creation may still be pending |
| Retention | First `$pageview`, returning `$pageview`, daily/weekly |
| Exit points | Web Analytics exit pages and Paths using `$pageview` with `page`; inspect the last page and funnel drop-offs |

Create a daily dashboard subscription in PostHog to receive a report. The integration does not create an account, dashboards or email subscriptions automatically. Reports start accumulating after activation; no historic data is imported.

The two payment events are emitted only after reading confirmed status from the server, never from URL parameters or a payment-button click. `order_checkout_completed` additionally requires successful order finalization. Events contain no checkout IDs, amounts, addresses or transaction references, and are deduplicated per checkout in the tab. They remain consent-dependent browser measurements: closing the browser before returning can omit an event. Use backend order records for payment reconciliation, not PostHog counts.

Seller Analytics V2 reads ownership from `items.snapshot.shopId` and prices from order lines. It excludes drafts, cancelled orders and unreviewed manual transaction declarations; it includes confirmed PawaPay checkouts and paid fulfilled legacy orders. Revenue is merchandise value after discounts, excluding delivery, and is not the amount settled to the seller. Daily product-view counters start with this release; cumulative historical view records cannot be reconstructed into daily views. The dashboard labels incomplete periods and shows unavailable ratios as “—”. Its ratio is paid orders divided by deduplicated product views over the same measured period, not visitor conversion or a causal attribution model.

Guests can save cart selections per country and sign in at checkout. The backend reprices selections and merges them transactionally; `GuestCartMerge` receipts prevent retries from adding quantities twice. Deployment requires the model's unique `{ user, countryId, mergeId }` index and MongoDB transaction support (the same replica-set requirement as existing checkout transactions). Checkout recovery uses session storage scoped to user and country with a two-hour expiry. It preserves delivery details and payment choices, without guarantor identity or payment proof. Blocked popups use the same PawaPay checkout in the current tab; unresolved attempts reuse their idempotency key. A confirmed payment with failed order finalization must be reconciled, never treated as permission to charge again.

PawaPay request keys now resolve to a durable, user-scoped checkout ID under the existing unique index. The stored payload fingerprint rejects changed-payload reuse; a retry resumes or verifies that checkout across server restarts and cache expiry. Browser payment attempts last for the tab session until a terminal result, separately from the two-hour delivery-form draft. Restart the backend and rebuild/release the frontend together for these endpoints and recovery behavior.

## Interpretation and privacy

“Signed in” means authenticated when the event happened, not online right now. Anonymous browsers are approximate visitors, not verified people. One person can use multiple devices; an anonymous visitor who logs in can appear in both breakdown groups. Unique-user breakdown totals may not add up. Consent rejection, blockers, offline use and closed tabs mean counts are incomplete. Exit pages suggest where to investigate; they do not prove why somebody left.

PostHog route groups remove IDs/slugs and all query strings, tokens, hashes and search terms. Names, email, address, messages, form values and payment data are not collected by the allowlisted events. Internal account IDs associate signed-in activity; no IP capture, automatic click capture, session replay, remote flags, surveys or error-text capture are enabled. Firebase and optional internal realtime analytics now use the same consent gate and grouped routes. Disable Firebase/Google Enhanced Measurement and advertising collection in the provider console; see [Congo privacy implementation](congo-privacy-and-consumer-protection.md).

This integration is product analytics. Existing error tracking and infrastructure monitoring remain separate. Reliable revenue or completed-order reporting must use server-confirmed business events, not payment-return pageviews.

The browser SDK is lazy-loaded only after consent and configuration. Page engagement is best effort on route change, tab hiding or exit. Multiple pages in the same route group (e.g. two products) still count as separate pageviews. Staff pages are grouped, not exposed by their full URL.

## Founder tools and reminders

Open **Administration → Mes outils & rappels** (`/admin/founder-tools`). Only founders can access this route. A reminder appears throughout the administration area. Daily checks: Sentry, UptimeRobot, PostHog. Weekly checks: Playwright, Dependabot, Lighthouse, Search Console. Each card contains activation instructions, an external link and a “J’ai vérifié” button. Checks expire after 24 hours or 7 days. They are saved per account in this browser, not synchronized across devices. No email or push reminders are sent. Marking a check never verifies service health automatically.

### Sentry

Browser diagnostics now require the user's separate “Diagnostic des erreurs” consent, in addition to the DSN. Without it, browser Sentry is not initialized; withdrawing it also blocks pending envelopes at transport time. Reports omit account identity, breadcrumbs, request bodies and original exception messages, while retaining exception types and stack frames. Backend operational error tracking remains separate. Consent-based reports are incomplete and must not replace server monitoring.

The frontend and backend SDKs already exist. Create projects at https://sentry.io/, configure `VITE_SENTRY_DSN` for the frontend build and `SENTRY_DSN` on the backend, and redeploy. Confirm a controlled test event in each project. Source-map upload additionally uses CI-only `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`; never expose the auth token through a VITE variable. Configure notifications in Sentry. Account activation and delivery are not verified by this setup.

### UptimeRobot

Create HTTPS monitors at https://dashboard.uptimerobot.com/ for your deployed homepage and backend `/api/health`. Configure and test alert contacts in the service. The free plan has periodic checks, not continuous monitoring. `/api/health` checks process availability, not database, checkout or PawaPay readiness. Do not expose authenticated `/api/health/details` for monitoring. No credentials are needed in the repository.

### Playwright and Lighthouse

From `frontend`:

```sh
npm ci
npx playwright install chromium
npm run test:e2e
npm run test:e2e:report
npm run build
npm run audit:lighthouse
```

Playwright runs an isolated local Vite server and mocks API responses. Conversion regressions cover guest-cart persistence and login merge, destination pricing, shorter signup, direct links without a launch delay, blocked payment popups, and checkout recovery. These tests do not make real payments. Optional `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` points to an existing Chrome binary. Lighthouse requires Chrome and audits the built login page locally; reports are saved under `frontend/lighthouse-reports`. It does not measure authenticated pages or production API performance. The initial score thresholds warn rather than block releases.

The **Quality tools** GitHub Actions workflow runs on pull requests and main-branch pushes, with downloadable reports retained for 14 days. It uses no production secrets and does not publish reports to a third-party report host. GitHub Actions usage is subject to your repository/account allowance.

### Dependabot

`.github/dependabot.yml` requests weekly dependency updates for frontend, backend, root npm and GitHub Actions. Push this configuration to the repository default branch. Enable Dependency graph, Dependabot alerts and Dependabot security updates in GitHub Settings → Code security. Review and test each PR; no automatic merge is configured. Existing dependency audit findings are not automatically repaired by installation.

### Google Search Console

Visit https://search.google.com/search-console and add a **Domain property** for your deployed domain. Publish Google's verification TXT record through your DNS provider, then verify ownership. This method requires no application SDK or public verification file. Submit a sitemap only after confirming that its deployed URL returns valid XML with canonical public URLs; this integration does not create a sitemap. Inspect a product URL and review indexing, search performance and Core Web Vitals weekly. Account access and DNS verification must be completed by the domain owner.

All external services need their own account/configuration. Check current free allowances before enabling paid features. Repository configuration alone does not activate external monitoring.
