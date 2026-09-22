# Refund and private-evidence release notes

## Runtime and deployment

- Release the backend and frontend together: attachment buttons now use authenticated downloads. Older frontend tabs need a reload.
- Use Node.js 20 or newer (required by the upgraded Nodemailer dependency). Install each package from its lockfile with `npm ci`.
- MongoDB must support transactions (replica set or sharded cluster). Refund reservation and dispute decisions use transactions. Keep the unique `Refund.refundId` index enabled; `RefundDepositLock` uses the unique MongoDB `_id` index to serialize reservations per deposit.
- Persist `backend/private-uploads/` across releases, with backend read/write access. Preserve existing `backend/uploads/complaints/` and `backend/uploads/disputes/` files: authorized downloads retain a legacy lookup. New uploads use the private directory.
- Do not expose either evidence directory through a reverse proxy, CDN, or static host. Express blocks historical public URLs, but cannot override an upstream file server. Purge any previously cached public evidence from those services. The updated service worker evicts its own cached evidence on activation; this cannot revoke files already downloaded by users.

## Refund recovery

Each attempt keeps its original provider ID. A new attempt is blocked while another refund on the same deposit is active or its terminal result still needs to be applied locally. Completed partial refunds count toward the remaining balance.

The existing refund worker checks pending transfers and retries local synchronization after a database failure. For reservations or uncertain requests at least one minute old, it checks PawaPay first; only a `NOT_FOUND` response permits resubmission using the same ID. Amount/currency mismatches stay on hold until a response supplies matching details. PawaPay documents duplicate-ID handling in [Initiate refund](https://docs.pawapay.io/v2/api-reference/refunds/initiate-refund) and the lookup envelope in [Check refund status](https://docs.pawapay.io/v2/api-reference/refunds/check-refund-status).

For a definitively failed refund on a closed dispute, correct the reported configuration/provider problem and use the admin refund retry action. The original decision and amount are retained; reputation changes are not repeated. Do not manually create a second provider transfer while a request is uncertain. Old callbacks cannot replace a newer attempt's order status or release its escrow.

Country admins need the record's country in `adminCountryIds`; their personal country is not an administrative grant. The founder retains global access. Buyers and sellers retain access to their own dispute evidence.

## Verification and remaining release checks

Automated coverage uses a disposable local MongoDB replica set and mocked provider/notification calls. It covers concurrency, delayed callbacks, retries, incomplete local synchronization, private-file authorization, and escrow guards. No real payment is submitted by these tests.

To include the refund integration suite, set `REFUND_TEST_MONGO_URI` to an explicitly disposable local database named `hdmarket_refund_test_<suffix>` and run `npm test` from `backend/`. The suite deletes that test database after completion; it rejects non-local URLs and other database names. Without that variable, these integration tests are skipped.

Before production release, verify authenticated uploads/downloads through the actual proxy, the configured PawaPay sandbox refund/callback flow, and email delivery with the upgraded mail dependency. Local tests do not validate production infrastructure or provider credentials.
