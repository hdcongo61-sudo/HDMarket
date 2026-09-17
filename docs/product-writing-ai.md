# Product writing assistant

In the product form, open **Assistant IA · Nom et description**. Enter known facts, generate a proposal, edit it, then apply the name, description or both. Existing fields change only when you apply. Generation does not publish a listing. Review all claims; AI can make mistakes. Photos are not analyzed.

## Activate OpenAI

In `backend/.env` (and the backend host environment):

```dotenv
OPENAI_API_KEY=
PRODUCT_WRITING_AI_ENABLED=true
PRODUCT_WRITING_AI_MODEL=gpt-4.1-mini
```

Create a project API key at https://platform.openai.com/api-keys and fill the empty value locally, not in chat. Restart the backend. API usage requires API billing/credits; it is not included in a ChatGPT subscription. Review project usage and spending controls in OpenAI. Never put this key in a VITE variable.

The authenticated endpoint `POST /api/products/writing-assistant` accepts only bounded text fields, limits each account to 20 requests/hour per server process, and times out after 45 seconds. Multiple instances have independent limits; this is not a global spending cap. Client cancellation aborts the upstream request where possible; already processed tokens can still be billed.

Only product facts are sent, not user identity or photos. The Responses API request sets `store: false`; this does not guarantee zero provider retention. No provider error payloads or credentials are returned to clients. Set `PRODUCT_WRITING_AI_ENABLED=false` to disable generation.

Implementation references: https://developers.openai.com/api/docs/guides/structured-outputs and https://developers.openai.com/api/docs/models/gpt-4.1-mini .
