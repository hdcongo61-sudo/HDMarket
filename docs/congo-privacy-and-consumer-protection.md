# Congo-Brazzaville: privacy and consumer protection

Implementation reviewed against the Republic of the Congo (CG), confirmed by the owner, on 20 September 2026. This is an implementation record, not a legal opinion or a compliance certification. The French checklist in the reference image does not establish French jurisdiction. Cross-border mandatory consumer rules remain reserved.

## Sources and legal review

- [Law 29-2019 of 10 October 2019, personal-data protection](https://www.sgg.cg/JO/2019/congo-jo-2019-45.pdf): article 5 bases for processing; articles 7–11 necessity, transparency, accuracy and processor contracts; articles 33 onward formalities; articles 46–49 notices and terminal storage; articles 50–60 access, portability, objection, rectification and deletion. Article 60 sets a one-month justification requirement for covered rectification/deletion requests. This is not represented as a universal GDPR response deadline.
- [Law 37-2019 of 12 December 2019, electronic transactions](https://www.sgg.cg/textes-officiels/lois/2019/congo-loi-2019-37.pdf), articles 69–75: precontractual information, confirmation and distance-contract withdrawal.
- [Law 36-2024 of 11 October 2024, consumer protection](https://www.sgg.cg/JO/2024/congo-jo-2024-51.pdf), official printed pages 1541–1552: articles 23–30 distance selling, 115–116 relationship with other legislation.

The two distance-sale statutes differ: the 2019 law uses 14 calendar days for withdrawal and return, while the newer consumer law uses 14 working days for withdrawal and 7 days for return after notice. Article 28 of the 2024 law sets refund timing at 14 days after return receipt (goods) or withdrawal (services), and article 30 provides a 15-working-day nonconformity return window. The app uses the newer consumer baseline, preserves mandatory rights, and does not automatically reject a request using a calendar-day calculation. Have Congolese counsel confirm the interaction with the electronic-commerce provisions, applicable exceptions, return costs and service/publication fees. Internal dispute or payout windows must not be used to deny statutory consumer rights.

Also review article 46 of the 2024 law concerning sales conditioned on advance payment against the app's deposits, full prepayment and PawaPay flows. This change does not rewrite payment contracts or move funds.

## Implemented behavior

- Public terms, sale conditions, privacy, cookies, legal notices, refunds and accessibility routes. Footer and settings provide access; checkout links to sale and return conditions before payment.
- Registration records the current version, server timestamp, source and `CG` legal jurisdiction. Privacy acknowledgement does not grant analytics or diagnostics. Existing acceptance records are not rewritten. Frontend and backend must be released together; an old registration tab must reload the current policy.
- Statistics and diagnostics have separate, initially unchecked choices. Accept and refuse use equivalent buttons. Versioned browser receipts contain only date and choices; renewal occurs after 180 days (a product decision, not a statutory duration). Legacy unversioned grants are not reused. Expired/malformed grants default off; blocked storage has a page-session fallback.
- Firebase, PostHog and first-party optional realtime events check analytics permission at their service boundary. URL parameters and private route identifiers are removed. Browser Sentry requires independent diagnostic consent and checks permission again at transport time. Withdrawal updates other tabs and suspended pages. No replay is configured. Withdrawal stops future optional collection; it is not retroactive erasure.
- Profile saves no longer require gender or a personal delivery address. Registration already defers delivery information to checkout. Shop location requirements remain. Existing records are not mass-deleted.
- Rights and return links open reviewable email drafts to the configured legal contact. They do not submit requests automatically. Requests are processed by support; there is no new automatic erasure or refund job.
- Keyboard skip link, visible focus, reduced-motion styles/transitions, product-gallery button labels and selection states, labelled notification switches, and darker orange legal/consent controls. These are targeted improvements, not an app-wide WCAG/RGAA audit.

## Owner configuration and operational work

1. Complete **Admin → App settings → Information**: company name, actual address, RCCM, NIU, publishing director, legal/support email and hosting provider identity/address. Defaults are not proof of registration. Verify the mailbox is monitored; this implementation does not send email or test its delivery.
2. Confirm controller declarations/authorizations, processor agreements and international transfers required under the Congolese framework. Identify actual hosting regions and subprocessors, including Cloudinary, PawaPay, Firebase/Google, PostHog, Sentry and any enabled AI provider. A cookie grant does not authorize an otherwise unlawful transfer.
3. Set and document real server/provider retention periods and deletion procedures, including backups, support messages, financial evidence and legal holds. This change enforces consent-receipt expiry; it does not pretend to have deployed a general data-retention job. Disable optional providers until their configuration and retention are approved.
4. In Google Analytics, disable Enhanced Measurement/automatic form, site-search and outbound-link collection; the app sends allowlisted events itself. Disable Google Signals/advertising and configure the retention period. Confirm PostHog/Sentry provider-side controls, data regions and retention. Browser code cannot audit provider-console settings.
5. Maintain a dated rights-request register for the legal mailbox. Verify identity proportionately, isolate third-party data in exports, document lawful retention exceptions, and meet the applicable article 60 deadline. Account deactivation is not deletion. No identity-document upload is required by these new pages.
6. Train support to accept withdrawal requests even after an in-app dispute window, notify the seller, preserve evidence and follow legal refund timing. Review professional/consumer versus private-sale coverage and publication-fee service exceptions before promising non-refundable fees.
7. Audit the remaining UI, seller-supplied media, videos/captions, zoom, screen readers and third-party payment pages. Contrast reference: [WCAG 2.2 contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html); alternative-text reference: [non-text content](https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html). No claim of full conformance is displayed.

## Verification

Unit coverage checks independent consent, stale receipts, blocked storage, cross-tab changes and expiry, analytics initialization races, URL/data minimization, diagnostic transport withdrawal, and frontend/backend legal-version parity. Browser coverage exercises mobile refusal/customization, persistence, cross-tab withdrawal, public legal pages, email draft links and keyboard navigation. All browser API calls are mocked; no payment or external message is sent.

The PostHog SDK also has a small dispatch adapter in `monitoringTransport.js`: capture-time consent alone does not cover its existing batch/retry queues. The adapter marks request generations and discards obsolete requests on withdrawal, including retries after a later grant. Its installed-SDK interfaces are checked before use and exercised in a browser with a local mocked ingestion endpoint. Re-run that integration check when upgrading PostHog.
