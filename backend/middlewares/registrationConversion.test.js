import { describe, expect, it } from 'vitest';
import { schemas } from './validate.js';
import { LEGAL_VERSION } from '../config/legalPolicy.js';
const profile = { name: 'Test Buyer', phone: '+242060000001', acceptedLegalTerms: true, legalVersion: LEGAL_VERSION };
describe('short registration', () => {
  it.each(['register', 'googleProviderRegister', 'appleProviderRegister'])('allows %s without delivery or demographic fields', (name) => {
    const credential = name === 'register' ? { password: 'GoodPassword9' } : { idToken: 'x'.repeat(120) };
    expect(schemas[name].validate({ ...profile, ...credential }).error).toBeUndefined();
    expect(schemas[name].validate({ ...profile, ...credential, acceptedLegalTerms: false }).error).toBeDefined();
    expect(schemas[name].validate({ ...profile, ...credential, phone: '' }).error).toBeDefined();
  });
});
