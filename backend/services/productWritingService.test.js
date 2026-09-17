import { afterEach, describe, expect, it, vi } from 'vitest';
import { validateProductFacts, parseProductSuggestion, generateProductSuggestion } from './productWritingService.js';
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe('product writing assistant', () => {
  it('rejects missing, oversized and non-text facts', () => {
    for (const body of [{}, { title: {} }, { facts: 'x'.repeat(2001) }]) expect(() => validateProductFacts(body)).toThrow();
    expect(validateProductFacts({ facts: ' Sac noir ', userId: 'private' }).facts).toBe('Sac noir');
    expect(validateProductFacts({ title: 'Sac', userId: 'private' })).not.toHaveProperty('userId');
  });
  it('rejects malformed or empty model output', () => {
    for (const text of ['invalid', '{}', '{"title":"","description":"ok"}']) expect(() => parseProductSuggestion(text)).toThrow();
  });
  it('does not call OpenAI without configuration', async () => {
    vi.stubEnv('OPENAI_API_KEY', ''); const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    await expect(generateProductSuggestion({})).rejects.toThrow('NOT_CONFIGURED'); expect(fetch).not.toHaveBeenCalled();
  });
  it('sends a bounded structured request without stored responses', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test'); vi.stubEnv('PRODUCT_WRITING_AI_ENABLED', 'true');
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: '{"title":"Sac noir","description":"Sac avec deux poches."}' }] }] }) });
    vi.stubGlobal('fetch', fetch);
    expect((await generateProductSuggestion({ facts: 'Sac noir, deux poches' })).title).toBe('Sac noir');
    const body = JSON.parse(fetch.mock.calls[0][1].body); expect(body.store).toBe(false); expect(body.text.format.strict).toBe(true); expect(body.max_output_tokens).toBe(1800);
  });
  it('handles provider throttling without leaking the provider response', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test'); vi.stubEnv('PRODUCT_WRITING_AI_ENABLED', 'true');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 429 }));
    await expect(generateProductSuggestion({})).rejects.toThrow('PROVIDER_LIMIT');
  });
});
