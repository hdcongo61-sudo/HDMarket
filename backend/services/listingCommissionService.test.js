import { afterEach, describe, expect, it, vi } from 'vitest';
import { getRuntimeConfig } from './configService.js';
import { getListingCommissionRate } from './listingCommissionService.js';

vi.mock('./configService.js', () => ({ getRuntimeConfig: vi.fn() }));
afterEach(() => vi.resetAllMocks());

describe('publication commission settings', () => {
  it('reads the current country rate on every new quote, including a change to zero', async () => {
    getRuntimeConfig.mockResolvedValueOnce(0.1).mockResolvedValueOnce(0);
    expect(await getListingCommissionRate('country-id')).toBe(0.1);
    expect(await getListingCommissionRate('country-id')).toBe(0);
    expect(getRuntimeConfig).toHaveBeenLastCalledWith('commission_rate', {
      countryId: 'country-id', fallback: 3, fresh: true
    });
  });
});
