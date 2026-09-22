# Acheter pour moi — release and recovery

Changes prepared locally on 21 September 2026. This guide describes operational steps still needed when deploying; none were performed on production during development.

The subsequent [service-area redesign](buy-for-me-redesign.md) adds saved lists, fresh-draft reordering and dedicated navigation. Its updated checks and routes are documented separately; the historical recovery steps here remain applicable.

## Financial behavior

- Before shopping starts, customer cancellation reserves the full paid amount for refund. Once shopping starts, customers use a dispute; staff review the purchases before cancelling. Staff cancellation is an explicit **full refund**, requires a reason, and resolves open disputes. Do not use it to record a partial settlement with a courier.
- Customer confirmation atomically records actual shopping costs, courier fees, service commission and the disposition of any surplus. The courier is reimbursed for purchases they advanced, plus delivery/advance fees and an optional tip.
- `ORIGINAL_PAYMENT` is the default surplus choice. Old `WALLET_REFUND` preferences are treated as return-to-original-payment for newly settled requests. Donation and tip remain explicit alternatives.
- `shopping_transfers` holds durable refund/payout obligations. Only a matching provider success marks money transferred. Unknown outcomes are checked before resubmission; repeated requests use the same provider ID. An explicit admin retry after a confirmed provider failure can use a new ID.
- The reconciliation worker checks pending transfers every five minutes. `WAITING_REFERENCE` needs the confirmed deposit reference; `WAITING_ACCOUNT` needs a verified eligible courier Mobile Money account (currently Congo-Brazzaville MTN/Airtel) and a supported amount. `NEEDS_ATTENTION` needs provider reconciliation; `FAILED` needs review before retry.
- Admin transfers and customer details distinguish owed, processing and actually refunded amounts. Couriers see payout status and can configure their account using their verified profile number.

PawaPay's [refund status endpoint](https://docs.pawapay.io/v2/api-reference/refunds/check-refund-status) provides the provider state, amount and currency used for reconciliation. Provider calls and callbacks were simulated in automated tests; a successful database test is not evidence of a live transfer.

## Deployment order

1. Back up the database and receipt storage. Use a MongoDB replica set or transaction-capable cluster; paid creation, cancellation and settlement require transactions.
2. Deploy the backend and frontend together. Verify the unique indexes on `shopping_transfers.operationKey` and `shopping_transfers.providerId`, the receipt's order index, and the existing checkout ID index. Keep the commerce operation records: their unique `_id` serializes recovery. Do not add a unique shopping checkout index before inspecting historical duplicates.
3. Verify the existing PawaPay credentials, refund/payout permissions, callback configuration and reconciliation worker in the target environment. Configure verified courier payout accounts. Exercise payment, delivery, surplus refund, cancellation and payout in the provider sandbox before enabling new paid work.
4. Run the read-only history report below, review its findings and fill only countries supported by the original confirmed checkout. A country-scoped courier or administrator cannot operate an unassigned-country legacy request; founders can inspect it for recovery.
5. Copy historical receipts to private storage and verify authorized reads. Revoke their original Cloudinary assets after validating the copies. Then monitor unresolved transfers, payment completion failures and open disputes.

Commands below run from `backend/` using that environment's configured `MONGO_URI` and storage credentials. They are operator commands, not application startup hooks.

## Historical money and country records

```sh
node scripts/reviewShoppingHistory.js
node scripts/reviewShoppingHistory.js --apply-country
```

The default command is read-only and reports record IDs, never account numbers or receipt URLs. The second fills a missing order/dispute country only when the order belongs to the same customer as a confirmed checkout, with a matching currency and existing country. It cannot issue payments or rewrite an existing country.

Review every reported duplicate checkout, funding mismatch, historical cancellation without a refund, or old completed settlement. Previous `COMPLETED` wallet/earning rows do not prove money was sent. Match them to provider statements and any manual transfers first; do not bulk replay or automatically refund them. Old completed settlements deliberately require staff reconciliation instead of generating another payout.

Previously paid checkouts without a saved quote need reconciliation of the accepted amount/items and any existing order before recovery. The new callback handler will not manufacture a historical quote from today's prices. Persist a reviewed recovery record only after verifying those facts and prior transfers.

## Historical receipt privacy

```sh
node scripts/migrateShoppingReceipts.js
node scripts/migrateShoppingReceipts.js --apply
# After checking the private copies and authorized access:
node scripts/migrateShoppingReceipts.js --apply --revoke-public
```

The default reports counts only. `--apply` copies each receipt and product photo to private storage, records its old URL and conditionally switches that receipt reference. New receipt APIs authorize the customer, assigned courier or permitted country staff and return `private, no-store` bytes. Signed cloud URLs are not returned to the browser.

Old local receipt paths are denied before static serving, including after migration. `--revoke-public` removes and invalidates the exact original Cloudinary image only after no shopping receipt references it. Unrecognized/transformed source URLs and missing files increment `review` and require operator investigation. Old public cloud URLs remain accessible until revoked; previously downloaded or browser-cached copies cannot be recalled.

Private local storage is `backend/private-uploads/shopping`. Persist and back up this directory in deployments without Cloudinary. Do not expose it through a static server or reverse proxy.

## Verification

- Backend unit/controller suite: 441 passing tests; database suites require explicit opt-in.
- Existing isolated database suites: 59 passing tests for ordinary/sponsored order payments, refunds and publication-payment reporting.
- Shopping database regression suite: 40 passing tests covering both authorization modes, prepayment validation, changing fees, duplicate callbacks, concurrent claims/confirmations, overage reservation, cancellation, late payments, rollback/retry, surplus refund/tip/donation, disputes, country isolation, private reads and historical country recovery.
- Browser regression suite: seven checks using real React pages and intercepted APIs, including stale quotes, disputes, private receipt rendering, admin recovery, courier deep links and history with creation disabled.
- Frontend unit suite: 260 passing tests. Lint and production build passed with existing warnings.

For the shopping database tests, start a disposable local MongoDB replica set and supply a database name matching `hdmarket_shopping_test_*`. The suite drops that database on completion:

```sh
SHOPPING_TEST_MONGO_URI=mongodb://127.0.0.1:28763/hdmarket_shopping_test_flow npx vitest run services/buyForMe.integration.test.js
```

From `frontend/`, run `npx playwright test e2e/buy-for-me.spec.js --workers=1`. If Playwright's bundled browser is not installed, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to an installed Chrome executable. These tests do not contact payment providers or send customer notifications.
