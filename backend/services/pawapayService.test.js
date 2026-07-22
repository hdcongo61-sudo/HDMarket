import { afterEach, describe, expect, it } from 'vitest';
import { getPawaPayConfig } from './pawapayService.js';

const originalEnvironment = process.env.PAWAPAY_ENVIRONMENT;
const originalBaseUrl = process.env.PAWAPAY_BASE_URL;

afterEach(() => {
  if (originalEnvironment === undefined) delete process.env.PAWAPAY_ENVIRONMENT;
  else process.env.PAWAPAY_ENVIRONMENT = originalEnvironment;
  if (originalBaseUrl === undefined) delete process.env.PAWAPAY_BASE_URL;
  else process.env.PAWAPAY_BASE_URL = originalBaseUrl;
});

describe('PawaPay environment selection', () => {
  it('uses the sandbox v2 API by default', () => {
    delete process.env.PAWAPAY_ENVIRONMENT;
    delete process.env.PAWAPAY_BASE_URL;
    expect(getPawaPayConfig().baseUrl).toBe('https://api.sandbox.pawapay.io/v2');
  });

  it('uses the production v2 API only when explicitly selected', () => {
    process.env.PAWAPAY_ENVIRONMENT = 'production';
    delete process.env.PAWAPAY_BASE_URL;
    expect(getPawaPayConfig().baseUrl).toBe('https://api.pawapay.io/v2');
  });
});
