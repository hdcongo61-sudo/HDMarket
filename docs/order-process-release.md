# Order-process safety release

This release addresses the 13 findings in [`order-process-audit.md`](./order-process-audit.md) for the Republic of the Congo checkout and fulfilment rules.

1. Every ordinary cancellation records a durable PawaPay refund obligation. Provider failures are retried by reconciliation; cancellation is never undone by a failed refund request.
2. Seller transitions and delivery proof use an explicit sequence. Terminal, disputed, refunded, and refund-pending orders cannot be reopened or released by a stale escrow timer. Escrow release checks the current order and refund state atomically.
3. Ordinary PawaPay checkout validates products, country, currency, address, delivery mode, delivery availability, discounts, and fees before provider initiation. The immutable server quote is stored on the checkout and is used after confirmation.
4. An active ordinary checkout reservation is shared across idempotency keys for the same cart. A new checkout is allowed after the earlier attempt reaches a terminal state.
5. Reconciliation includes confirmed unfinished ordinary, negotiated, and sponsorship completions.
6. Negotiated-price payments reserve the order. A late success never reopens a cancelled order; it creates the same durable refund obligation.
7. Full-payment delivery waivers store `FULL_PAYMENT` and the fee source. The delivery-fee edit guard also recognises legacy waiver records.
8. Delivery proof requires the normal delivery state and the 30-minute buyer cancellation window to be over (or explicitly skipped).
9. Promotion discounts are allocated in integer FCFA with a largest-remainder allocation, preserving the exact checkout total across lines and retaining the applied promo snapshot.
10. Pickup and delivery availability are checked independently of delivery pricing and free-delivery waivers.
11. Delivery city and commune must be active, related, and in the product/payment country.
12. Address edits require structured city/commune/phone input, show a server recalculated delivery quote, update the canonical shipping snapshot, and synchronise an editable pending delivery request. Active/accepted delivery requests are protected from silent destination changes.
13. Cash collected at delivery is recorded separately from PawaPay (`cashCollections`, `cashCollectedAmount`, `totalPaidAmount`). The seller action is idempotent and cannot change the PawaPay escrow or seller settlement amount.

## Verification

- `backend/services/orderProcess.integration.test.js`: 32/32 disposable-replica-set regressions passed.
- Backend suite: 441 passed, 170 intentionally skipped.
- Frontend suite: 265 passed.
- Backend and frontend lint passed.
- Frontend production build passed to `/tmp/hdmarket-order-fixes-dist`.
- Backend `node --check` passed for every JavaScript file.

External PawaPay calls, production databases, notifications to real users, and deployment were not used during verification.
