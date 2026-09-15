import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../models/userModel.js', () => ({ default: { findOne: vi.fn() } }));
vi.mock('./countryService.js', () => ({
  resolveCountryContext: vi.fn(), findCountry: vi.fn(), ensureDefaultCountry: vi.fn()
}));
import User from '../models/userModel.js';
import { resolveCountryContext, findCountry, ensureDefaultCountry } from './countryService.js';
import { findPhoneLoginUser } from './loginUserService.js';

beforeEach(() => {
  vi.resetAllMocks();
  findCountry.mockResolvedValue(null);
  ensureDefaultCountry.mockResolvedValue({ phoneCode: '+242', status: 'DISABLED' });
});
describe('phone login with unavailable markets', () => {
  it.each(['COUNTRY_DISABLED', 'COUNTRY_ACCESS_DENIED'])('finds a founder without a selection for %s', async (code) => {
    resolveCountryContext.mockRejectedValue(Object.assign(new Error('Unavailable'), { code }));
    const founder = { role: 'founder' };
    User.findOne.mockResolvedValue(founder);
    expect(await findPhoneLoginUser('+242064151569')).toBe(founder);
    expect(User.findOne).toHaveBeenCalledWith({ role: 'founder', phone: { $in: expect.arrayContaining(['+242064151569']) } });
  });
  it('does not bypass unavailable markets for other accounts', async () => {
    const error = Object.assign(new Error('Unavailable'), { code: 'COUNTRY_DISABLED' });
    resolveCountryContext.mockRejectedValue(error);
    User.findOne.mockResolvedValue(null);
    await expect(findPhoneLoginUser('064151569')).rejects.toBe(error);
  });
  it('preserves ordinary lookup for available countries', async () => {
    resolveCountryContext.mockResolvedValue({ country: { phoneCode: '+242' } });
    await findPhoneLoginUser('064151569');
    expect(User.findOne.mock.calls[0][0]).not.toHaveProperty('role');
  });
  it('does not mask database errors', async () => {
    const error = new Error('Connection failed');
    resolveCountryContext.mockRejectedValue(error);
    await expect(findPhoneLoginUser('064151569')).rejects.toBe(error);
    expect(User.findOne).not.toHaveBeenCalled();
  });
  it('tries the requested country code as well as the default one for founders', async () => {
    const error = Object.assign(new Error('Unavailable'), { code: 'COUNTRY_DISABLED' });
    resolveCountryContext.mockRejectedValue(error);
    findCountry.mockResolvedValue({ phoneCode: '+225' });
    ensureDefaultCountry.mockResolvedValue({ phoneCode: '+242', status: 'DISABLED' });
    const founder = { role: 'founder' };
    User.findOne.mockResolvedValue(founder);

    expect(await findPhoneLoginUser('064151569', 'CI')).toBe(founder);
    const query = User.findOne.mock.calls[0][0];
    expect(query.role).toBe('founder');
    // Candidates for both country codes, deduplicated.
    expect(query.phone.$in).toEqual(expect.arrayContaining(['+24264151569', '+225064151569']));
  });
  it('still rejects non-founders when both country lookups come up empty', async () => {
    const error = Object.assign(new Error('Unavailable'), { code: 'COUNTRY_ACCESS_DENIED' });
    resolveCountryContext.mockRejectedValue(error);
    findCountry.mockResolvedValue(null);
    ensureDefaultCountry.mockResolvedValue(null);
    User.findOne.mockResolvedValue(null);
    await expect(findPhoneLoginUser('064151569', 'CG')).rejects.toBe(error);
    expect(User.findOne).not.toHaveBeenCalled();
  });
  it('tolerates a failing requested-country lookup during founder fallback', async () => {
    const error = Object.assign(new Error('Unavailable'), { code: 'COUNTRY_DISABLED' });
    resolveCountryContext.mockRejectedValue(error);
    findCountry.mockRejectedValue(new Error('Country lookup failed'));
    ensureDefaultCountry.mockResolvedValue({ phoneCode: '+242' });
    const founder = { role: 'founder' };
    User.findOne.mockResolvedValue(founder);
    expect(await findPhoneLoginUser('064151569', 'CI')).toBe(founder);
  });
});
