# HDMarket Mobile Money and Visa Card Product Plan

## Current product direction

HDMarket is planned as a multi-country African payments app with these priorities:

1. Mobile-money-to-mobile-money transfers.
2. Congo-Brazzaville domestic transfers between MTN MoMo and Airtel Money.
3. Congo-Brazzaville to Mali as the first proposed international route.
4. Bank-account-to-mobile-money transfers later.
5. A virtual prepaid Visa card as a later product module.

The pawaPay integration is intended to support the mobile-money collection and payout side where the account is enabled. It does not, by itself, issue Visa cards.

## Visa card proposal

The first card product should be a virtual prepaid Visa card. Customers can load money and spend only the available balance. It should not initially be a credit card because credit introduces lending, affordability checks, collections and additional risk.

Possible uses include online shopping, subscriptions, digital services, travel bookings and other approved online purchases. ATM withdrawals and physical cards should be treated as later capabilities.

## Required card partners

A card program normally requires:

- HDMarket as the customer-facing application and program operator.
- A Visa-licensed issuing bank or BIN sponsor.
- An issuer processor that creates cards, authorizes transactions and maintains card records.
- A program manager, where the sponsor or processor does not provide that function.
- Fraud, KYC, dispute and customer-support operations.

The BIN sponsor owns the Visa BIN, holds or safeguards cardholder funds and takes responsibility for applicable network and regulatory obligations. The issuer processor manages issuance, authorization, card status, balances and transaction events.

Visa describes these roles in its partner documentation: [Visa partner types](https://partner.visa.com/site/partner-types.html).

## Proposed customer flow

1. The user opens **Cards**.
2. The user selects **Create virtual Visa card**.
3. The app displays the card type, fees, restrictions and supported countries.
4. The user completes the required identity checks.
5. The issuer or processor approves the customer.
6. The virtual card is issued.
7. The user adds money through a supported funding method.
8. The user unfreezes the card and uses it.

The application must never collect or store a mobile-money PIN or bank password. Sensitive card details should be protected by the issuer’s card-display mechanism and strong customer authentication.

## Mobile-money card top-up

The future top-up flow may be:

```text
HDMarket creates a top-up order
        ↓
pawaPay collects money from MTN or Airtel
        ↓
pawaPay confirms the collection
        ↓
HDMarket reconciles the amount
        ↓
The issuer processor loads the card balance
        ↓
The user can spend the balance
```

A confirmed pawaPay collection is not the same as a confirmed card load. If collection succeeds and the card load fails, the system must retry the existing load safely, keep the amount pending, or refund it through an approved route. It must not create a second collection because a card-load response is delayed.

## Card states

```text
REQUESTED → KYC_PENDING → APPROVED → ISSUING → ISSUED
ISSUED → FROZEN → ACTIVE → SUSPENDED → CLOSED
```

Top-ups should use separate states:

```text
CREATED
WAITING_FOR_MOBILE_AUTHORIZATION
COLLECTION_PROCESSING
COLLECTION_COMPLETED
CARD_LOAD_PROCESSING
CARD_LOAD_COMPLETED
FAILED
REFUND_PENDING
REFUNDED
MANUAL_REVIEW
```

Card purchases need their own states, including `AUTHORIZED`, `DECLINED`, `PENDING`, `SETTLED`, `REVERSED`, `REFUNDED` and `DISPUTED`.

## Card controls

Users should be able to:

- freeze and unfreeze the card;
- set spending limits;
- block online or international transactions;
- receive transaction notifications;
- report a stolen card;
- replace or close a card;
- view pending and completed transactions;
- dispute an unrecognized transaction.

Risk controls should include customer limits, merchant-category restrictions, country restrictions, velocity checks, unusual-device detection, failed-transaction monitoring and account-takeover protection.

## Ledger and reconciliation

The card system needs an internal ledger separate from the customer-facing transfer record. It should record:

- requested top-up;
- pawaPay collection;
- confirmed collection;
- card load request;
- confirmed card load;
- card authorization;
- card settlement;
- reversal;
- refund;
- dispute or chargeback;
- fees.

The internal ledger must be reconciled against pawaPay and the issuer processor. Financial history must not be deleted or changed manually; corrections should be recorded as adjustments with an operator, reason and timestamp.

## Multi-country considerations

The card program must be configured by country. A card issued under one country’s program is not automatically available to every customer in every country. The system should store:

```text
country
currency
issuer
cardProgram
customerEligibility
limits
fundingMethods
supportedUsageCountries
```

Each country may have different onboarding, identity, limits, funding, settlement and licensing requirements. The app should show the card only where the approved issuer program is available.

## Compliance and partnership validation

For Congo-Brazzaville, the card program must fit the applicable CEMAC payment-services framework. COBAC publishes the CEMAC payment-services regulation, and BEAC materials describe regulated payment and electronic-money activities: [COBAC regulations](https://www.beac.int/supervision-bancaire/reglements-de-cobac/) and [BEAC payment-services overview](https://www.beac.int/wp-content/uploads/2021/10/Services-de-paiement-par-la-monnaie-%C3%A9lectronique-dans-la-CEMAC-EN-2020.pdf).

Before implementation, ask BGFIBank and Crédit du Congo:

- Can the bank sponsor a Visa prepaid program for a fintech?
- Can it issue virtual cards instantly through an application?
- Can users fund the card from MTN MoMo and Airtel Money?
- Can the card be used for international online purchases?
- Can the card be issued to non-bank customers?
- Does the bank provide an issuer processor or require one?
- Can the card be issued in XAF and support other transaction currencies?
- Can the card be added to Apple Pay or Google Pay?
- Who handles KYC, fraud, disputes, refunds and chargebacks?
- Which countries can the program serve?
- Is there a sandbox API and webhook system?

## Recommended implementation order

1. Validate the domestic mobile-money transfer routes.
2. Validate the Congo-to-Mali route and settlement model.
3. Contact both banks about BIN sponsorship and Visa issuing.
4. Contact Visa or a Visa-approved issuing partner for CEMAC coverage.
5. Confirm whether mobile-money funding is allowed.
6. Choose virtual prepaid Visa for the first card version.
7. Build the card module behind a feature flag.
8. Launch only for verified customers and approved countries.
9. Add physical cards, ATM access and digital-wallet tokenization later.

The card module is therefore a future product line connected to HDMarket’s payments ecosystem, not a direct extension of the pawaPay API.
