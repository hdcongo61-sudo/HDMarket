# Acheter pour moi — next features

Assessment: 21 September 2026. Saved lists and reordering (priority 1 below) are now implemented locally as part of the [dedicated service redesign](buy-for-me-redesign.md). The remaining priorities are proposals. Release and monitor the payment, refund and privacy corrections in [the release guide](buy-for-me-release.md).

HDMarket already has referrals, reward points, group buying, product search by image/voice and delivery tracking components. Build on those foundations rather than introducing overlapping modules. The priorities below are product hypotheses based on the current code; no conversion uplift has been measured or promised.

| Priority | Addition | First useful version | Measure |
| --- | --- | --- | --- |
| 1 | **Mes listes + Commander à nouveau** | Save named shopping templates (for example household staples); copy a past list into an editable draft. Recalculate all prices and fees, show the current total, require confirmation before a new payment. Never reuse a paid checkout or an old price. | Time to a valid quote; repeat purchase rate; draft-to-payment completion. |
| 2 | **Replacement choices and a clear spending limit** | Per item: ask me, skip/refund, or choose an approved alternative. Show the remaining allowance to both customer and courier. Keep the existing explicit top-up approval whenever the total exceeds the funded allowance. | Unavailable-item resolution time; abandoned shopping requests; replacement disputes. |
| 3 | **Delivery PIN and arrival estimate** | Adapt the existing delivery PIN infrastructure to shopping requests, with expiring codes, limited attempts and a logged support fallback. Add an honest arrival window and a stale/offline indicator using existing tracking foundations. A PIN confirms handover; it does not automatically approve all purchases or release disputed settlement. | “Not received” disputes; delivery support contacts; delivery completion time. |
| 4 | **Shared household lists** | Invite another account to suggest items in a list; explicit owner/editor roles. Only the payer can approve payment or extra spending. Keep receipt/account access separate from list sharing. | Shared-list use and repeat purchases. |

Priority 1 is ready for review: it reduces repeated typing without adding dispatch complexity. Test it with real customers before adding scheduled shopping or a subscription, which need reliable courier capacity and a defined refund policy.

Relevant patterns: Instacart exposes [buy-it-again and order history](https://docs.instacart.com/storefront/learn_about_your_storefront/customers/overview/) for returning customers; Uber describes [PIN-based delivery confirmation](https://help.uber.com/nb-NO/ubereats/restaurants/article/pin-code-authentication?nodeId=0bddc2bc-be45-4032-b17e-aa7e55a3d2a4). These examples support the interaction patterns, not an assumption that their business results transfer to HDMarket.

For Congo-Brazzaville, keep FCFA totals, Mobile Money payment, French wording and useful address landmarks. Treat poor connectivity explicitly: preserve drafts, show the time of the last update and require server confirmation for payment and delivery actions. Use existing analytics only when the user's privacy preferences permit it; never put phone numbers, addresses, receipt contents or PINs in analytics events.
