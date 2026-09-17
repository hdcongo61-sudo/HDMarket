import { afterEach, describe, expect, it, vi } from 'vitest';
import { interpretSearch, validateSearchIntent, validateSearchImage, validateVoiceText, transcribeSearch } from './searchAiService.js';
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const intent = { query: 'téléphone', label: 'Téléphone d’occasion', minPrice: null, maxPrice: 50000, condition: 'used' };
describe('AI search', () => {
  it('rejects URLs, malformed and oversized images rather than fetching them', () => {
    for (const value of ['http://localhost/private', 'data:image/jpeg;base64,YWJj', 'x'.repeat(750001), {}]) expect(() => validateSearchImage(value)).toThrow();
    expect(validateSearchImage('data:image/jpeg;base64,/9j/AA==')).toBeTruthy();
  });
  it('bounds dictated text and accepts literal search syntax', () => {
    expect(validateVoiceText(' (téléphone) ')).toBe('(téléphone)');
    for (const value of ['', {}, 'x'.repeat(501)]) expect(() => validateVoiceText(value)).toThrow();
  });
  it('rejects unsafe or impossible price filters', () => {
    expect(validateSearchIntent(intent)).toEqual(intent);
    for (const fields of [{ query: {} }, { condition: 'damaged' }, { minPrice: -1 }, { minPrice: 60000 }, { maxPrice: '500' }]) expect(() => validateSearchIntent({ ...intent, ...fields })).toThrow();
  });
  it('uses structured output and strips hallucinated photo price/condition', async () => {
    const fetch = vi.fn(async () => ({ ok: true, json: async () => ({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(intent) }] }] }) }));
    vi.stubGlobal('fetch', fetch);
    expect(await interpretSearch({ image: 'data:image/jpeg;base64,/9j/AA==' })).toEqual({ ...intent, minPrice: null, maxPrice: null, condition: '' });
    const payload = JSON.parse(fetch.mock.calls[0][1].body);
    expect(payload.store).toBe(false); expect(payload.text.format.strict).toBe(true);
    expect(payload.input[0].content[1].type).toBe('input_image');
  });
  it('transcribes audio without returning unbounded transcripts', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ text: 'Je cherche un téléphone' }) })));
    expect(await transcribeSearch({ buffer: Buffer.from('audio'), mimetype: 'audio/webm', originalname: 'search.webm' })).toBe('Je cherche un téléphone');
  });
  it('does not expose provider failures or process incomplete output', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 429 })));
    await expect(interpretSearch({ text: 'sac' })).rejects.toThrow('PROVIDER_ERROR');
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ status: 'incomplete' }) })));
    await expect(interpretSearch({ text: 'sac' })).rejects.toThrow('INVALID_OUTPUT');
  });
});
