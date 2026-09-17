# HDMarket commerce AI

This release adds six guarded assistants:

1. **Seller coach** (`POST /api/commerce-ai/coach`) uses only the authenticated seller's listing counters. It returns reviewable actions with links to the source listing.
2. **Marketing pack** uses the paid image-edit job with operation `marketing`. The configured price includes one generated product image, copy for WhatsApp/Facebook and two local browser-exported banners. A failed copy request can reuse the saved generated image without another image payment.
3. **Shopping assistant** (`POST /api/commerce-ai/shopping`) extracts an explicit product, budget, condition and city, then searches published, fee-settled listings in the resolved market. It records only result counts, never the search text.
4. **Complement suggestions** (`POST /api/commerce-ai/complements`) select at most three candidates from the same seller and currency. They never apply an automatic discount or assert unverified compatibility.
5. **Seller reply drafts** (`POST /api/commerce-ai/conversations/:id/reply`) are available only to the seller or authorized shop assistant for that conversation. The seller must explicitly consent and paste the question; personal email addresses and phone-like text are masked. The generated text is inserted as a draft and is never sent automatically.
6. **Founder brief** (`POST /api/commerce-ai/founder/brief`) is cached per UTC day and links each action to finance, usage or processing data.

## Activation and cost controls

Put the OpenAI key only in `backend/.env`, then restart the backend:

```dotenv
OPENAI_API_KEY=
COMMERCE_AI_MODEL=gpt-4.1-mini
```

In Runtime Settings, configure `commerce_ai_enabled`, `commerce_ai_daily_budget_xaf`, `commerce_ai_user_daily_calls`, `commerce_ai_text_reserve_xaf`, `commerce_ai_image_reserve_xaf`, `commerce_ai_input_usd_million`, `commerce_ai_output_usd_million`, and `image_edit_price_marketing`. A zero token rate is intentional when the provider price has not been entered; the founder report labels those calls as unpriced rather than pretending to know the cost.

Reservations are stored in MongoDB and apply across backend processes. They are conservative: an interrupted request can keep its daily reservation because the provider may still have billed it. Existing image and search assistants retain their feature-specific settings; they are also recorded in the shared usage ledger when called through their controllers.

## Finance correctness

The founder finance panel separates completed merchandise volume from HDMarket platform receipts. It reports listing validations, listing adjustments, boosts, shop conversion, notification campaigns and completed paid AI checkouts separately, grouped by currency. It does not count ordinary order payments as HDMarket revenue and it does not add PawaPay funding rows again when their parent business record is already the authoritative receipt.

Enter actual invoices and payment costs in the finance panel with one unique reference per invoice. The displayed balance is **after recorded costs**, not a guaranteed net profit: provider costs without a recorded invoice, taxes, chargebacks, unpaid liabilities and old-currency records remain outside it. Unknown legacy currencies stay separate until reconciled.

## Safety and fallback

The AI result is always a proposal. Product availability, price, condition, compatibility, order status and payment state come from HDMarket records and must be checked on the corresponding page. If the key, quota, budget or provider is unavailable, the classic search, manual product editor, normal messaging and existing image studio remain available.
