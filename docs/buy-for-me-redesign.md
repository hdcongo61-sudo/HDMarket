# Acheter pour moi — dedicated service area

Implemented locally on 21 September 2026. The customer journey is a dedicated area inside HDMarket, sharing the existing account, country selection, payments, courier service and administration. It is not a separately deployed app.

## Customer experience

| Route | Purpose |
| --- | --- |
| `/buy-for-me` | Service home: start a request, choose a shopping category, find ongoing purchases and saved lists. Guests can understand the service before signing in. |
| `/buy-for-me/new` | Three steps: list/budget, delivery, final review. New requests still require feature access and server availability. |
| `/buy-for-me/orders` | Active purchases and history, with server-side filtering, counts, pagination and explicit retry on a load failure. |
| `/buy-for-me/lists` | Private saved lists for the signed-in account and selected country. |
| `/buy-for-me/:id` | Progress, decisions, receipt, refund information and disputes; completed or cancelled requests can seed a fresh draft. |

The area has its own header and navigation: Accueil, Mes achats, Mes listes. On phones, navigation is at the bottom. During creation, step actions occupy that space. The marketplace header, footer and chat are omitted on these routes; a visible return control leads back to HDMarket. The payment button uses the app's orange accent.

Budget authorization is the default. Customers who know individual prices can choose item estimates. Item notes and photos are optional and collapsed to keep the list compact. Every row must be valid before advancing; the service supports at most 30 articles.

The final review shows the list, destination, surplus preference and current fee breakdown before opening Mobile Money payment. Editing an item, address, budget or country invalidates the old quote. The existing server quote snapshot, payment idempotency, overage reservation, refunds and dispute holds remain in force.

## Saved lists and reordering

The customer explicitly saves a named list during preparation. Lists are stored in `shopping_lists`, scoped by account and country, with a maximum of 20 lists per country. Creation is serialized per account so concurrent submissions cannot exceed the limit. Read/delete endpoints check ownership and country access and use private, noncached reads.

Saved fields: list name, store type/preference, authorization mode, shopping budget and article names, quantities, estimated unit prices and notes. Payment records, receipts, photos, contact numbers and delivery addresses are not copied. An order reused from history excludes cancelled items and also copies only those editable list fields.

Using a list or choosing **Commander à nouveau** opens a new draft and displays a reminder to check estimates. It does not place an order, reuse a checkout, or charge the customer. The destination must be entered or deliberately selected from existing address history, and fees are recalculated before payment. Saving a template is not automatic draft persistence; unsaved edits are not restored after a reload.

## Release and verification

Deploy the backend and frontend together: the redesign introduces authenticated list endpoints and the optional `scope=active|history` filter on customer order history. Existing detail URLs and payment return links continue to work. Disabling new requests preserves authenticated history and recovery access.

Verification completed:

- 43 shopping database integration tests, including list ownership, country selection, concurrent list limits and order pagination.
- 13 browser checks across the shopping suites, including both payment modes, stale quotes, saved-list reuse, reorder without inherited payment/address data, disabled creation/history access, disputes, private receipts, and mobile/dark layouts.
- 441 backend and 265 frontend unit/controller tests.
- Backend/frontend lint, frontend production build and whitespace checks passed. Existing build/dependency warnings remain.

Browser tests use real React screens and intercepted APIs; database tests use a disposable local replica set. No live payment or deployment was performed. The historical settlement/receipt steps in [the release guide](buy-for-me-release.md) still apply.
