import crypto from 'crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  normalizePawaPayCheckoutStatus,
  refreshPawaPayCheckoutAdmin,
  verifyPawaPayContentDigest
} from './pawapayController.js';
import PawaPayCheckout from '../models/pawapayCheckoutModel.js';

const originalDigestRequirement = process.env.PAWAPAY_CONTENT_DIGEST_REQUIRED;
const originalPawaPayEnabled = process.env.PAWAPAY_ENABLED;

afterEach(() => {
  if (originalDigestRequirement === undefined) delete process.env.PAWAPAY_CONTENT_DIGEST_REQUIRED;
  else process.env.PAWAPAY_CONTENT_DIGEST_REQUIRED = originalDigestRequirement;
  if (originalPawaPayEnabled === undefined) delete process.env.PAWAPAY_ENABLED;
  else process.env.PAWAPAY_ENABLED = originalPawaPayEnabled;
  vi.restoreAllMocks();
});

const makeResponse = () => {
  const response = {
    status: vi.fn(() => response),
    json: vi.fn(() => response)
  };
  return response;
};

describe('PawaPay callback content integrity', () => {
  it('accepts a callback whose digest matches the exact raw request body', () => {
    const rawBody = Buffer.from('{"depositId":"9fe7b612-32ac-4ce1-a295-2f5e7ab21a91","status":"COMPLETED"}');
    const digest = crypto.createHash('sha512').update(rawBody).digest('base64');
    const req = {
      body: JSON.parse(rawBody.toString()),
      rawBody,
      get: (name) => (name === 'content-digest' ? `sha-512=:${digest}:` : undefined)
    };
    const res = makeResponse();
    const next = vi.fn();

    verifyPawaPayContentDigest(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('rejects a callback when its raw body does not match the digest', () => {
    const req = {
      body: { status: 'COMPLETED' },
      rawBody: Buffer.from('{"status":"COMPLETED"}'),
      get: (name) => (name === 'content-digest' ? 'sha-256=:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=:' : undefined)
    };
    const res = makeResponse();
    const next = vi.fn();

    verifyPawaPayContentDigest(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('requires Content-Digest when strict callback validation is enabled', () => {
    process.env.PAWAPAY_CONTENT_DIGEST_REQUIRED = 'true';
    const req = { body: {}, get: () => undefined };
    const res = makeResponse();
    const next = vi.fn();

    verifyPawaPayContentDigest(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'PAWAPAY_CALLBACK_DIGEST_MISSING', success: false })
    );
    expect(next).not.toHaveBeenCalled();
  });
});

describe('PawaPay checkout status normalization', () => {
  it('persists a rejected provider checkout as FAILED', () => {
    expect(normalizePawaPayCheckoutStatus('REJECTED')).toBe('FAILED');
  });

  it('normalizes successful provider aliases and preserves pending fallbacks', () => {
    expect(normalizePawaPayCheckoutStatus('SUCCESSFUL')).toBe('COMPLETED');
    expect(normalizePawaPayCheckoutStatus('UNKNOWN', 'PROCESSING')).toBe('PROCESSING');
  });
});

describe('PawaPay admin checkout refresh', () => {
  it('forces an atomic provider check without saving the entire legacy document first', async () => {
    process.env.PAWAPAY_ENABLED = 'false';
    const checkout = {
      _id: 'checkout-document-id',
      checkoutId: '85728e2a-89b3-4b51-a94b-795270bd589a',
      status: 'WAITING_PAYMENT'
    };
    vi.spyOn(PawaPayCheckout, 'findOne').mockResolvedValue(checkout);
    const claim = vi.spyOn(PawaPayCheckout, 'findOneAndUpdate').mockResolvedValue(checkout);
    vi.spyOn(PawaPayCheckout, 'findById').mockResolvedValue(checkout);
    const req = {
      user: { role: 'admin' },
      params: { checkoutId: checkout.checkoutId }
    };
    const res = makeResponse();
    const next = vi.fn();

    await refreshPawaPayCheckoutAdmin(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(claim).toHaveBeenCalledWith(
      expect.not.objectContaining({ $or: expect.anything() }),
      expect.anything(),
      expect.anything()
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Statut synchronisé avec PawaPay.' })
    );
  });
});
