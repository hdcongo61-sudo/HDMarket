vi.mock('../services/commerceAiProvider.js', () => ({ aiActor: () => 'test', meteredAiCall: async (_context, call) => call(() => {}) }));
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runSearchAi } from './searchAiController.js';
import { searchAiCapabilities, interpretSearch } from '../services/searchAiService.js';
vi.mock('../services/searchAiService.js', async importOriginal => ({ ...(await importOriginal()), searchAiCapabilities: vi.fn(), interpretSearch: vi.fn() }));
afterEach(() => vi.clearAllMocks());
const response = () => { const res = { status: vi.fn(() => res), json: vi.fn(), on: vi.fn(), off: vi.fn() }; return res; };
describe('AI search request boundaries', () => {
  it('does not contact OpenAI when disabled', async () => {
    searchAiCapabilities.mockResolvedValue({ voice: false });
    const res = response(); await runSearchAi('voice')({ body: { text: 'sac' } }, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(503); expect(interpretSearch).not.toHaveBeenCalled();
  });
  it('rejects unbounded input before contacting the provider', async () => {
    searchAiCapabilities.mockResolvedValue({ voice: true });
    const res = response(); await runSearchAi('voice')({ body: { text: 'x'.repeat(501) } }, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(400); expect(interpretSearch).not.toHaveBeenCalled();
  });
  it('preserves country resolution failures', async () => {
    const error = new Error('COUNTRY_DISABLED'); const next = vi.fn();
    await runSearchAi('image')({ countryContextError: error }, response(), next);
    expect(next).toHaveBeenCalledWith(error); expect(interpretSearch).not.toHaveBeenCalled();
  });
  it('returns a sanitized fallback message on provider failures', async () => {
    searchAiCapabilities.mockResolvedValue({ voice: true }); interpretSearch.mockRejectedValue(new Error('private-provider-payload'));
    const res = response(); await runSearchAi('voice')({ body: { text: 'sac' } }, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(503); expect(JSON.stringify(res.json.mock.calls)).not.toContain('private-provider-payload');
  });
});
