# Acheter pour moi — audit

Audited and corrected locally on 21 September 2026. The eleven findings below describe the original defects; their original line references are historical. The changes cover shopping requests, PawaPay initiation/completion, courier actions, confirmation, cancellation, disputes, country access and receipt storage.

All eleven have code fixes and regression coverage. Deployment, provider configuration and historical data reconciliation remain release steps: see [Buy-for-me release guide](buy-for-me-release.md). No live payment, production repair or deployment was performed.

## Implemented changes

| Finding | Result |
| --- | --- |
| 1 | Cancellation and the full refund obligation commit together. Refunds are sent to the original PawaPay deposit and shown as pending until provider confirmation. |
| 2 | Unspent funds return to Mobile Money; courier purchase costs, fees and optional tips have real, retryable payout obligations. No new fake wallet credit is promised. |
| 3 | Validate items, availability, eligibility, country and exact price before payment. Persist the accepted server quote; disable stale browser estimates. |
| 4 | Serialize completion by checkout and commit the paid order and funding atomically. Callback retries reuse the result. |
| 5 | Reserve one active overage checkout, block conflicting actions, and refund obsolete payments without reviving cancelled orders. |
| 6 | Make receipt and settlement writes transactional. Confirmation retries cannot duplicate refunds or courier earnings. |
| 7 | Persist country and enforce courier/admin scope. Provide a historical report and narrowly scoped missing-country backfill. |
| 8 | Disabling creation preserves paid history, delivery, additional-payment recovery, disputes and administration. Add a persistent customer history link. |
| 9 | Add customer disputes, country-scoped staff review, explained decisions and a hold on shopping/settlement while disputed. |
| 10 | Store new receipts privately, authorize every read, block old local URLs and provide migration/revocation for old public assets. |
| 11 | Route courier notifications to the courier screen and load the requested assigned job even outside the first page. |

## Findings

### 1. High — Cancellation leaves the payment reserved without a refund

Both customer and admin cancellation change the request to `CANCELED` but leave its payment `PAID` and funding transaction `RESERVED`. Neither path creates a refund or invokes payment reconciliation.

Reproduced: create a paid request for 12,000 FCFA, then cancel as either the customer or admin. The request is cancelled, with no refund record and the original funds still reserved.

Sources: `backend/services/buyForMeService.js:366` and `:809`.

Fix: define refundable amounts by stage, atomically record the cancellation and refund obligation, and process the refund with retryable provider reconciliation. Cancellation must not claim money was returned before confirmation.

### 2. High — Wallet refunds and courier earnings are marked completed without a money-transfer integration

Customer confirmation creates a `COMPLETED` wallet-refund record and completed transaction rows for refunds, driver earnings or tips. There is no usable wallet credit, withdrawal or provider payout path consuming these records in the audited codebase. The form nevertheless promises reimbursement to the HDMarket wallet by default.

Reproduced: a 10,000 FCFA shopping allowance with 8,000 FCFA spent produces a completed 2,000 FCFA wallet refund, without updating the customer account. Repository tracing found no wallet/payout consumer beyond this service's reporting queries. This does not establish whether staff make transfers manually outside the app.

Sources: `backend/services/buyForMeService.js:710` and `frontend/src/pages/BuyForMe.jsx:345`.

Fix: connect refunds and courier entitlements to an actual supported settlement mechanism. Distinguish money owed, processing and money transferred; expose a customer balance only if it can actually be used or withdrawn.

### 3. High — Invalid or stale requests can reach payment before validation

PawaPay initiation applies generic amount checks but does not validate the shopping request, exact quote or buy-for-me availability. Shopping validation happens after a successful payment callback. Completion also recalculates prices using current configuration rather than an accepted quote snapshot.

Reproduced with simulated provider success: missing items, an incorrect amount and a disabled service all open checkout, then leave the payment `CONFIRMED` with automatic completion `FAILED`. Changing the service commission from 5% to 10% during payment also prevents creation of an already-paid request.

A browser reproduction confirms a user-facing trigger: after changing an item from 10,000 to 20,000 FCFA while the new estimate is pending, the pay button submits the old 12,000 FCFA total with the new 20,000 FCFA item. `canPay` does not exclude a pending or stale quote.

Sources: `backend/controllers/pawapayController.js:168`, `backend/services/buyForMeService.js:271`, and `frontend/src/pages/BuyForMe.jsx:168` / `:229`.

Fix: validate availability, eligibility, country, items and exact amount before provider initiation; save an immutable server-generated quote for completion. Invalidate the displayed quote when inputs change and disable payment until a matching estimate is ready.

### 4. High — Retrying completion can create duplicate paid requests

Order creation precedes the funding record and other writes. There is no unique checkout-to-shopping-order constraint or durable operation record to recover a partially completed attempt.

Reproduced through the payment controller: fail funding-row creation after the order is saved, then retry the callback. Two paid shopping orders exist for the same checkout, and checkout completion succeeds on the second attempt.

Source: `backend/services/buyForMeService.js:293`.

Fix: serialize completion by checkout ID and commit the order, funding record and completion receipt atomically. Retrying must return the original result.

### 5. High — Additional payments are not reserved against order transitions

Multiple checkouts can open for the same overage. Declining an overage remains possible while payment is in progress. Completion checks the additional-payment status but not the request's terminal state.

Reproduced: two 3,000 FCFA checkouts open for one overage; the first completes and the second successful provider callback is rejected. Declining an in-flight payment likewise causes its successful callback to fail. An admin cancellation leaves the overage required, so a later successful callback changes the cancelled request back to `RECEIPT_UPLOADED`.

Sources: `backend/services/buyForMeService.js:640`, `:659`, and `:809`; initiation is in `backend/controllers/pawapayController.js:168`.

Fix: reserve one payment attempt for a specific overage version. Coordinate cancellation, decline, shopping adjustments and completion with that reservation. Reconcile late payments without reviving cancelled requests or inviting duplicate charges.

### 6. High — A settlement write failure leaves an unrecoverable completed request

Customer confirmation saves `COMPLETED` before creating refund and transaction records. A failure afterward is not rolled back, and a retry is rejected because confirmation requires `DELIVERED`.

Reproduced: fail transaction insertion during confirmation. The order remains completed, no driver-earning row is created, and retry returns 409.

Source: `backend/services/buyForMeService.js:699`.

Fix: make internal settlement atomic and idempotent, with a recoverable operation state. Keep external transfers in a separately retryable process rather than treating a database write as a completed transfer.

### 7. High — Country restrictions are missing from shopping operations

Creation does not persist the checkout's country, leaving `countryId` null. Courier pool/acceptance and admin listing/statistics do not filter by authorized country. Admin mutation calls likewise pass no country scope.

Reproduced: a courier with another country sees and accepts a Congo request; a country-scoped administrator receives an order assigned to another country. Basic customer ownership checks do work.

Sources: `backend/models/buyForMeOrderModel.js:66`, `backend/services/buyForMeService.js:293`, `:406`, `:437`, `:743`, and `backend/controllers/buyForMeController.js:227`.

Fix: persist validated country/currency context and enforce it on courier eligibility, admin reads/mutations, configuration and reporting. Historical null-country records need explicit reconciliation.

### 8. Medium — Disabling the feature blocks existing paid requests

The runtime feature guard wraps every buy-for-me route, including history, order details, cancellation, courier delivery, confirmation and admin configuration. Disabling new purchases therefore also blocks access to ongoing paid work. This is separate from the service's own `config.enabled` setting.

Reproduced: the disabled runtime guard rejects an existing customer-order read with 404. The general PawaPay initiation route is outside this guard, creating the opposite gap described in finding 3.

Source: `backend/routes/buyForMeRoutes.js:40`.

Fix: block new requests while preserving authenticated access and permitted operations for existing requests, financial recovery and administration.

### 9. Medium — Disputes have no complete review or settlement-hold workflow

Opening a dispute creates a record and invalidates an admin cache. The audited module has no corresponding admin review/resolution route or UI, and confirmation does not check for an open dispute.

Reproduced: open a dispute on a delivered request, then confirm reception. The request completes and settlement rows are created while the dispute stays open.

Sources: `backend/services/buyForMeService.js:735`, `:699`, and `backend/routes/buyForMeRoutes.js:52`.

Fix: provide eligibility rules, customer/admin visibility, notification, resolution and a settlement hold for disputed amounts. Make confirmation and dispute resolution explicit, consistent transitions.

### 10. Medium — Receipt images use public storage URLs

Receipt uploads use the delivery-proof storage helper. Local files are served through public `/uploads` static middleware with a 30-day public cache; the existing private-file guard covers complaints and disputes only. Cloudinary storage also returns a public asset URL rather than an authorized attachment endpoint.

Confirmed by source tracing and a guard probe: an unauthenticated delivery-proof receipt path passes the static-file guard. No real customer receipt was accessed. Anyone who obtains such a URL can retrieve the file without an ownership check; this is not a claim that filenames are easily guessable.

Sources: `backend/controllers/buyForMeCourierController.js:99`, `backend/utils/deliveryProofStorage.js:15`, `backend/utils/privateAttachments.js:8`, and `backend/server.js:380`.

Fix: store receipts privately and authorize retrieval for the customer, assigned courier and permitted staff. Address existing public assets and cache exposure during migration.

### 11. Medium — Courier notifications open a customer-only page

The shared notification helper always links to `/buy-for-me/:id`. Courier assignment and update notifications therefore open a page backed by the customer's `/mine/:id` endpoint.

Reproduced: assign a courier, inspect its notification link, then request the linked detail as that courier. The customer-scoped lookup returns 404.

Source: `backend/services/buyForMeService.js:242`.

Fix: select notification destinations by recipient role and direct couriers to their authorized job view.

## Original audit verification

- 23 backend probes passed against a disposable local MongoDB database: four healthy-path/ownership checks and 19 defect reproductions. Passing defect probes means the faulty behavior was reproduced, not that the feature is safe.
- Healthy cases cover both item-estimate and shopping-budget modes through delivery/confirmation, a single winner for concurrent courier claims, and rejection of another customer's read/cancel attempt.
- One Chrome/Playwright test reproduced payment with a stale quote using the real React page and intercepted API calls.
- Payment providers, notifications and delivery-price estimation were simulated. There were no live payments, customer messages, production data changes or deployment. These checks do not verify deployed callback delivery or provider configuration.
- No application code was changed by this audit. Diagnostic fixtures are local temporary files in `/tmp/hdmarket-buyforme-audit.InJlPP`; they assert current defects and are not committed regression tests. The isolated test database was dropped after testing.

Backend diagnostics run from `backend/` with a disposable MongoDB listening at `127.0.0.1:28762`:

```sh
npx vitest run --config /tmp/hdmarket-buyforme-audit.InJlPP/vitest.config.mjs
```

Browser reproduction runs from `frontend/`:

```sh
npx playwright test --config /tmp/hdmarket-buyforme-audit.InJlPP/playwright.config.mjs
```

These paths are machine-local and temporary. Before rerunning, inspect the fixtures: the backend diagnostic suite exclusively uses and drops `hdmarket_buyforme_audit_local` on the loopback test server.
