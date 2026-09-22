# Order checkout and sponsored-payment audit

Updated locally on 21 September 2026. All seven findings from the initial audit have been addressed in the working tree. No live payment, customer notification, production data repair or deployment was performed.

## Changes

1. **Sponsored deposits now finalize.** Both the designated payer and “Payer moi-même” can pay the offered 25% merchandise deposit or the full total. The server calculates the quote before opening PawaPay and uses the same allocation on confirmation. Delivery remains in the balance for a deposit. The paid amount, remaining balance, provider reference and escrow amount are persisted together. The sponsorship page and order-detail banner distinguish an accepted deposit from a fully paid order, and the sponsorship page refreshes when the payment popup confirms.

2. **Multiple variants of one product now complete.** Product availability compares unique product IDs. Each cart line still validates its own selected options and resolves its variant price independently.

3. **Order completion is durable and idempotent.** A database operation record serializes each checkout across workers. All shop orders, promo consumption and the operation receipt commit in one MongoDB transaction. A failed transaction leaves no partial set of orders; repeated completion returns the existing orders. Buyer/seller effects run after commit, and staff-notification failure no longer marks a paid checkout's completion failed. Staff-notification failures are logged; this change does not add a durable notification-delivery queue.

4. **Sponsored payments are validated and reserved before provider initiation.** The server checks the group, payer/requester, account restrictions, state, expiry, country, currency, feature configuration, payment option and exact amount. The checkout and all group reservations are saved atomically with a server-generated pricing snapshot. Concurrent initiation attempts reuse the same checkout. Cancellation, refusal, expiry and retry share the reservation lock. Generic buyer order cancellation directs pending sponsored requests to their group-management page. An in-progress payment remains valid past the request's original expiry. A definite provider failure releases the reservation; an uncertain response stays pending verification rather than inviting another charge.

5. **Late callbacks cannot regress confirmed payment.** Atomic reconciliation protects completed/confirmed checkout state from delayed processing or failure callbacks. The initiation response uses the same protection, including a callback that arrives before initiation returns. Provider return references are still saved. A late genuine success can recover an earlier failed status.

6. **Country-scoped sponsorship settings are consistent.** Payer lookup uses the active country; retry, expiry policy and payment initiation use the order's country. Congo can be enabled independently of the global default.

7. **Shop allocations conserve the actual payment.** Stable largest-remainder allocation distributes the captured whole-FCFA amount. Two shops of 10,001 FCFA at 50% now record a combined 10,001 FCFA paid, split 5,001/5,000. The checkout preview and backend use equivalent allocation logic with parity coverage. Sponsored deposits use the same conservation rule.

## Verification

- Backend: 500 distinct tests passed across the full-suite run and targeted follow-up runs. This includes 33 real-database checkout/concurrency cases, 24 refund integration cases and 2 listing-report integration cases. All database suites were enabled against disposable local databases.
- Frontend suite: 260 passing tests, including allocation conservation and frontend/backend parity across 25/50/70/100% and 1–20 shops.
- Browser suite: 14 passing tests across `conversion.spec.js`, `consistency.spec.js`, and `sponsored-payment.spec.js`. These cover cart variants, delivery estimates, checkout recovery, blocked-popup fallback, return navigation, service visibility, and both sponsor payment paths with deposit/full payment and refreshed status.
- Frontend and backend ESLint checks passed. The production frontend build passed with existing dependency/chunk-size warnings.

The database tests use real MongoDB transactions and Order hooks. Provider calls and notification delivery are simulated. They cover concurrent completion, rollback halfway through shop creation, staff-notification failure, exact escrow amounts, pre-charge rejection, reservation/cancellation races, payment after expiry and out-of-order callbacks.

Run from `backend/`, with a local disposable MongoDB replica set already running:

```sh
ORDER_TEST_MONGO_URI=mongodb://127.0.0.1:28761/hdmarket_order_test_checkout npm test
```

The new suite accepts only a loopback URI with database name `hdmarket_order_test_*` and drops that disposable database on teardown. Without the explicit variable, that suite is skipped. Existing refund/report integration suites similarly require `REFUND_TEST_MONGO_URI` and `LISTING_TEST_MONGO_URI` with their own restricted database names.

Run browser coverage from `frontend/`:

```sh
npx playwright test e2e/conversion.spec.js e2e/consistency.spec.js e2e/sponsored-payment.spec.js --workers=1
```

On this machine the browser run used the installed Chrome executable through `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.

## Release and recovery notes

- MongoDB must support transactions (replica set or sharded deployment). There is deliberately no non-transactional fallback for paid-order creation. The new `CommerceOperation` collection uses its unique `_id` as the serialization key; preserve these records with the checkout/order history.
- Deploy the backend and frontend changes together so displayed deposits, allocation and persisted payments agree.
- Existing complete order sets can be reused by checkout reference. Existing partial or inconsistent paid order sets stop for manual reconciliation instead of creating duplicates. These changes do not repair old customer data automatically.
- A confirmed sponsored payment from before reservations were introduced can still complete against an unchanged eligible group. A cancelled, reassigned, missing or otherwise inconsistent historical group needs payment review.
- An unknown provider outcome remains reserved until provider reconciliation establishes a result. Do not remove its reservation or initiate another charge solely because a browser timed out.
- Before release, exercise the deployed callback URL with PawaPay sandbox credentials. Local simulations establish application behavior, not provider credentials, signature delivery or production infrastructure.
