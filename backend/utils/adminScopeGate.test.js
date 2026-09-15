import { describe, expect, it } from 'vitest';
import { isScopedCountryAdminPathAllowed } from './adminScopeGate.js';

describe('adminScopeGate — scoped country admin allowlist', () => {
  it('allows country management paths', () => {
    expect(isScopedCountryAdminPathAllowed('GET', '/countries')).toBe(true);
    expect(isScopedCountryAdminPathAllowed('PATCH', '/countries/abc')).toBe(true);
    expect(isScopedCountryAdminPathAllowed('GET', '/countries/abc/commerce')).toBe(true);
  });

  it('allows city/commune GET+POST only', () => {
    expect(isScopedCountryAdminPathAllowed('GET', '/cities')).toBe(true);
    expect(isScopedCountryAdminPathAllowed('POST', '/cities')).toBe(true);
    expect(isScopedCountryAdminPathAllowed('PATCH', '/cities')).toBe(false);
    expect(isScopedCountryAdminPathAllowed('GET', '/communes')).toBe(true);
    expect(isScopedCountryAdminPathAllowed('DELETE', '/communes')).toBe(false);
  });

  it('allows country-scoped runtime settings', () => {
    expect(isScopedCountryAdminPathAllowed('GET', '/config/runtime')).toBe(true);
    expect(isScopedCountryAdminPathAllowed('PATCH', '/config/runtime/foo')).toBe(true);
    expect(isScopedCountryAdminPathAllowed('DELETE', '/config/runtime/foo')).toBe(true);
    expect(isScopedCountryAdminPathAllowed('GET', '/config/feature-flags')).toBe(true);
    expect(isScopedCountryAdminPathAllowed('PATCH', '/config/feature-flags/x')).toBe(false);
    expect(isScopedCountryAdminPathAllowed('GET', '/settings')).toBe(true);
    expect(isScopedCountryAdminPathAllowed('PATCH', '/settings/key')).toBe(false);
  });

  it('allows country-owned promo codes and notification campaigns', () => {
    expect(isScopedCountryAdminPathAllowed('GET', '/promo-codes')).toBe(true);
    expect(isScopedCountryAdminPathAllowed('POST', '/promo-codes')).toBe(true);
    expect(isScopedCountryAdminPathAllowed('GET', '/promo-codes/analytics')).toBe(true);
    expect(isScopedCountryAdminPathAllowed('PATCH', '/promo-codes/abc')).toBe(true);
    expect(isScopedCountryAdminPathAllowed('GET', '/notification-campaigns')).toBe(true);
    expect(isScopedCountryAdminPathAllowed('POST', '/notification-campaigns')).toBe(true);
    expect(isScopedCountryAdminPathAllowed('POST', '/notification-campaigns/abc/send')).toBe(true);
  });

  it('allows read-only user listing for country admins', () => {
    expect(isScopedCountryAdminPathAllowed('GET', '/users')).toBe(true);
    expect(isScopedCountryAdminPathAllowed('PATCH', '/users')).toBe(false);
    expect(isScopedCountryAdminPathAllowed('GET', '/users/export-phones')).toBe(false);
    expect(isScopedCountryAdminPathAllowed('GET', '/users/abc/stats')).toBe(false);
  });

  it('blocks everything else for scoped admins', () => {
    expect(isScopedCountryAdminPathAllowed('GET', '/orders')).toBe(false);
    expect(isScopedCountryAdminPathAllowed('GET', '/stats')).toBe(false);
    expect(isScopedCountryAdminPathAllowed('POST', '/delivery-requests')).toBe(false);
    expect(isScopedCountryAdminPathAllowed('GET', '/complaints')).toBe(false);
    expect(isScopedCountryAdminPathAllowed('GET', '/categories/tree')).toBe(false);
    expect(isScopedCountryAdminPathAllowed('PATCH', '/settings/key')).toBe(false);
  });
});
