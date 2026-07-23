import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getPawaPayCheckoutStatus,
  getPawaPayRefundStatus,
  getPawaPayPayoutStatus,
  getPawaPayConfig,
  initiatePawaPayDeposit,
  predictPawaPayProvider
} from './pawapayService.js';

const originalEnvironment = process.env.PAWAPAY_ENVIRONMENT;
const originalBaseUrl = process.env.PAWAPAY_BASE_URL;
const originalEnabled = process.env.PAWAPAY_ENABLED;
const originalToken = process.env.PAWAPAY_API_TOKEN;
const originalExclusiveMode = process.env.PAWAPAY_EXCLUSIVE_MODE;
const originalFetch = global.fetch;

afterEach(() => {
  if (originalEnvironment === undefined) delete process.env.PAWAPAY_ENVIRONMENT;
  else process.env.PAWAPAY_ENVIRONMENT = originalEnvironment;
  if (originalBaseUrl === undefined) delete process.env.PAWAPAY_BASE_URL;
  else process.env.PAWAPAY_BASE_URL = originalBaseUrl;
  if (originalEnabled === undefined) delete process.env.PAWAPAY_ENABLED;
  else process.env.PAWAPAY_ENABLED = originalEnabled;
  if (originalToken === undefined) delete process.env.PAWAPAY_API_TOKEN;
  else process.env.PAWAPAY_API_TOKEN = originalToken;
  if (originalExclusiveMode === undefined) delete process.env.PAWAPAY_EXCLUSIVE_MODE;
  else process.env.PAWAPAY_EXCLUSIVE_MODE = originalExclusiveMode;
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('PawaPay request errors', () => {
  const enablePawaPay = () => {
    process.env.PAWAPAY_ENABLED = 'true';
    process.env.PAWAPAY_API_TOKEN = 'test-token';
  };

  it('translates a rejected provider response without exposing its technical message', async () => {
    enablePawaPay();
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'REJECTED',
          failureReason: {
            failureCode: 'INVALID_PHONE_NUMBER',
            failureMessage: 'Internal provider detail containing a phone number'
          }
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    await expect(initiatePawaPayDeposit({ depositId: 'test' })).rejects.toMatchObject({
      status: 400,
      code: 'PAWAPAY_INVALID_PHONE_NUMBER',
      message: 'Le numéro Mobile Money est invalide. Vérifiez le pays et le numéro.',
      details: { providerCode: 'INVALID_PHONE_NUMBER', retryable: false, action: 'CHANGE_PHONE' }
    });
  });

  it('marks a network failure as retryable', async () => {
    enablePawaPay();
    global.fetch = vi.fn().mockRejectedValue(new Error('socket disconnected'));

    await expect(initiatePawaPayDeposit({ depositId: 'test' })).rejects.toMatchObject({
      status: 502,
      code: 'PAWAPAY_NETWORK_ERROR',
      details: { retryable: true, action: 'CHECK_STATUS' }
    });
  });
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

  it('keeps PawaPay-only mode enabled even when a legacy environment override exists', () => {
    delete process.env.PAWAPAY_EXCLUSIVE_MODE;
    expect(getPawaPayConfig().exclusiveMode).toBe(true);
    process.env.PAWAPAY_EXCLUSIVE_MODE = 'true';
    expect(getPawaPayConfig().exclusiveMode).toBe(true);
    process.env.PAWAPAY_EXCLUSIVE_MODE = 'false';
    expect(getPawaPayConfig().exclusiveMode).toBe(true);
  });
});

describe('PawaPay recipient validation', () => {
  it('asks PawaPay to predict the provider for the sanitized payout number', async () => {
    process.env.PAWAPAY_ENABLED = 'true';
    process.env.PAWAPAY_API_TOKEN = 'test-token';
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ provider: 'MTN_MOMO_COG', phoneNumber: '242060000000' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    );

    await predictPawaPayProvider('+242 06 000 00 00');

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.sandbox.pawapay.io/v2/predict-provider',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ phoneNumber: '+242 06 000 00 00' })
      })
    );
  });
});

describe('PawaPay checkout reconciliation', () => {
  it('checks the provider checkout status using the stored checkout id', async () => {
    process.env.PAWAPAY_ENABLED = 'true';
    process.env.PAWAPAY_API_TOKEN = 'test-token';
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: 'FOUND', data: { status: 'COMPLETED' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    );

    await getPawaPayCheckoutStatus('checkout-123');

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.sandbox.pawapay.io/v2/checkouts/checkout-123',
      expect.objectContaining({ method: 'GET' })
    );
  });
});

describe('PawaPay refund reconciliation', () => {
  it('checks a refund using its merchant-generated refund id', async () => {
    process.env.PAWAPAY_ENABLED = 'true';
    process.env.PAWAPAY_API_TOKEN = 'test-token';
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: 'FOUND', data: { status: 'COMPLETED' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    );

    await getPawaPayRefundStatus('refund-123');

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.sandbox.pawapay.io/v2/refunds/refund-123',
      expect.objectContaining({ method: 'GET' })
    );
  });
});

describe('PawaPay seller payout reconciliation', () => {
  it('checks a payout using its stored merchant payout id', async () => {
    process.env.PAWAPAY_ENABLED = 'true';
    process.env.PAWAPAY_API_TOKEN = 'test-token';
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: 'FOUND', data: { status: 'COMPLETED' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    );

    await getPawaPayPayoutStatus('payout-123');

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.sandbox.pawapay.io/v2/payouts/payout-123',
      expect.objectContaining({ method: 'GET' })
    );
  });
});
