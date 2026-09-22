import { describe, expect, it } from 'vitest';
import { LEGAL_VERSION, LEGAL_JURISDICTION } from './legalPolicy.js';
import { LEGAL_VERSION as FRONTEND_VERSION, LEGAL_JURISDICTION as FRONTEND_JURISDICTION } from '../../frontend/src/config/legalPolicy.js';
import { schemas } from '../middlewares/validate.js';

describe('current legal acknowledgement', () => {
  it('uses the same version and Congo-Brazzaville jurisdiction on both sides', () => {
    expect(LEGAL_VERSION).toBe(FRONTEND_VERSION);
    expect(LEGAL_JURISDICTION).toBe('CG');
    expect(LEGAL_JURISDICTION).toBe(FRONTEND_JURISDICTION);
  });
  it.each(['register', 'googleProviderRegister', 'appleProviderRegister'])('rejects missing or obsolete acknowledgements for %s', name => {
    const profile = { name: 'Test Buyer', phone: '+242060000001', acceptedLegalTerms: true, ...(name === 'register' ? { password: 'GoodPassword9' } : { idToken: 'x'.repeat(120) }) };
    expect(schemas[name].validate({ ...profile, legalVersion: LEGAL_VERSION }).error).toBeUndefined();
    expect(schemas[name].validate(profile).error).toBeDefined();
    expect(schemas[name].validate({ ...profile, legalVersion: '2026-07-18' }).error).toBeDefined();
  });
  it('allows profile changes without demographic or delivery data', () => {
    expect(schemas.profileUpdate.validate({ name: 'Test Buyer', address: '' }).error).toBeUndefined();
  });
});
