import { describe, expect, it } from 'vitest';
import {
  buildCountryDataFilter,
  getAdminCountryFilter,
  getScopedAdminCountryIds,
  isGlobalCountryAdmin
} from './countryService.js';

const FOUNDER = { role: 'founder', id: 'f1' };
const ADMIN_ONE = { role: 'admin', id: 'a1', adminCountryIds: ['aaa'] };
const ADMIN_MANY = { role: 'admin', id: 'a2', adminCountryIds: ['aaa', 'bbb'] };
const ADMIN_NONE = { role: 'admin', id: 'a3', adminCountryIds: [] };
const MANAGER = { role: 'manager', id: 'm1' };

describe('countryService — global/scope helpers', () => {
  it('treats only the founder as global', () => {
    expect(isGlobalCountryAdmin(FOUNDER)).toBe(true);
    expect(isGlobalCountryAdmin(ADMIN_ONE)).toBe(false);
    expect(isGlobalCountryAdmin(ADMIN_NONE)).toBe(false);
    expect(isGlobalCountryAdmin(MANAGER)).toBe(false);
  });

  it('returns null scoped ids for the founder and the list for admins', () => {
    expect(getScopedAdminCountryIds(FOUNDER)).toBeNull();
    expect(getScopedAdminCountryIds(ADMIN_ONE)).toEqual(['aaa']);
    expect(getScopedAdminCountryIds(ADMIN_MANY)).toEqual(['aaa', 'bbb']);
    expect(getScopedAdminCountryIds(ADMIN_NONE)).toEqual([]);
  });

  it('filters admin lists by country', () => {
    expect(getAdminCountryFilter(FOUNDER)).toBeNull();
    expect(getAdminCountryFilter(FOUNDER, { countryId: '6a7eed58777ddfef03dc0d9d' })).toEqual({
      countryId: '6a7eed58777ddfef03dc0d9d'
    });
    expect(getAdminCountryFilter(FOUNDER, { countryId: 'not-an-id' })).toBeNull();
    expect(getAdminCountryFilter(ADMIN_ONE)).toEqual({ countryId: 'aaa' });
    expect(getAdminCountryFilter(ADMIN_MANY)).toEqual({ countryId: { $in: ['aaa', 'bbb'] } });
    expect(getAdminCountryFilter(ADMIN_MANY, { countryId: 'aaa' })).toEqual({ countryId: 'aaa' });
    expect(getAdminCountryFilter(MANAGER)).toBeNull();
  });

  it('denies admins without any assigned country', () => {
    expect(() => getAdminCountryFilter(ADMIN_NONE)).toThrowError(/pays assigné/);
  });

  it('supports a custom field name', () => {
    expect(getAdminCountryFilter(ADMIN_ONE, { field: 'marketCountry' })).toEqual({ marketCountry: 'aaa' });
  });
});

describe('countryService — buildCountryDataFilter', () => {
  it('includes legacy null-country records for the Congo market', () => {
    const filter = buildCountryDataFilter({ countryId: 'cg1', code: 'CG' });
    expect(filter).toEqual({
      $and: [
        {
          $or: [{ countryId: 'cg1' }, { countryId: null }, { countryId: { $exists: false } }]
        }
      ]
    });
  });

  it('accepts a country document shape as well as a resolved context', () => {
    expect(buildCountryDataFilter({ _id: 'cg1', code: 'CG' })).toEqual({
      $and: [
        {
          $or: [{ countryId: 'cg1' }, { countryId: null }, { countryId: { $exists: false } }]
        }
      ]
    });
  });

  it('is strict for non-Congo markets', () => {
    expect(buildCountryDataFilter({ countryId: 'dr1', code: 'DRC' })).toEqual({ countryId: 'dr1' });
  });
});
