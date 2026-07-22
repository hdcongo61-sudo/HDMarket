import crypto from 'crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { verifyPawaPayContentDigest } from './pawapayController.js';

const originalDigestRequirement = process.env.PAWAPAY_CONTENT_DIGEST_REQUIRED;

afterEach(() => {
  if (originalDigestRequirement === undefined) delete process.env.PAWAPAY_CONTENT_DIGEST_REQUIRED;
  else process.env.PAWAPAY_CONTENT_DIGEST_REQUIRED = originalDigestRequirement;
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
    expect(next).not.toHaveBeenCalled();
  });
});
