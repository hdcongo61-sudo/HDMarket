import { afterEach, describe, expect, it, vi } from 'vitest';
import City from '../models/cityModel.js';
import Commune from '../models/communeModel.js';
import { resolveCanonicalLocation } from './locationSelectionService.js';
import { schemas } from '../middlewares/validate.js';
afterEach(() => vi.restoreAllMocks());
describe('optional personal profile location', () => {
  it('clears the city and dependent commune IDs and accepts the profile payload', async () => {
    const payload = { city: '', cityId: '', commune: '', communeId: '' };
    expect(schemas.profileUpdate.validate(payload).error).toBeUndefined();
    expect(await resolveCanonicalLocation({ cityName: '', communeName: 'Old commune', allowEmptyCity: true })).toEqual({ cityId: null, cityName: '', communeId: null, communeName: '' });
  });
  it('still requires a city for shops and checkout', async () => {
    await expect(resolveCanonicalLocation({ cityName: '' })).rejects.toMatchObject({ code: 'CITY_NOT_AVAILABLE' });
  });
  it('still validates a supplied city and commune', async () => {
    vi.spyOn(City, 'findOne').mockReturnValue({ lean: async () => ({ _id: 'city', name: 'Brazzaville' }) });
    vi.spyOn(Commune, 'findOne').mockReturnValue({ lean: async () => null });
    await expect(resolveCanonicalLocation({ cityName: 'Brazzaville', communeName: 'Foreign commune', allowEmptyCity: true })).rejects.toMatchObject({ code: 'COMMUNE_NOT_AVAILABLE' });
  });
});
