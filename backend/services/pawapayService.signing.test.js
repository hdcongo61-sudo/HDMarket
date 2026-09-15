import crypto from 'crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildPawaPaySignatureHeaders,
  getPawaPaySigningConfig,
  initiatePawaPayDeposit
} from './pawapayService.js';

const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
  namedCurve: 'prime256v1'
});
const publicPem = publicKey.export({ type: 'spki', format: 'pem' });
const privatePem = privateKey.export({ type: 'sec1', format: 'pem' });

const signingEnvKeys = [
  'PAWAPAY_SIGNING_KEY_ID',
  'PAWAPAY_SIGNING_PRIVATE_KEY',
  'PAWAPAY_SIGNING_ALGORITHM'
];
const originalSigningEnv = {};
for (const key of signingEnvKeys) originalSigningEnv[key] = process.env[key];

const originalPawaPayEnv = {
  PAWAPAY_ENABLED: process.env.PAWAPAY_ENABLED,
  PAWAPAY_API_TOKEN: process.env.PAWAPAY_API_TOKEN
};
const originalFetch = global.fetch;

afterEach(() => {
  for (const key of signingEnvKeys) {
    if (originalSigningEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalSigningEnv[key];
  }
  for (const [key, value] of Object.entries(originalPawaPayEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  vi.restoreAllMocks();
  global.fetch = originalFetch;
});

const signing = {
  active: true,
  keyId: 'CUSTOMER_TEST_KEY',
  privateKey: privatePem,
  algorithm: { name: 'ecdsa-p256-sha256', digest: 'sha256', namedCurve: 'prime256v1' }
};

describe('PawaPay RFC 9421 request signing', () => {
  it('returns null when signing is not configured', () => {
    expect(getPawaPaySigningConfig().active).toBe(false);
    expect(
      buildPawaPaySignatureHeaders({
        method: 'POST',
        url: 'https://api.pawapay.io/v2/checkouts',
        body: '{}',
        signing: { active: false }
      })
    ).toBeNull();
  });

  it('activates only when both key id and private key are present', () => {
    process.env.PAWAPAY_SIGNING_KEY_ID = 'key-1';
    expect(getPawaPaySigningConfig().active).toBe(false);
    process.env.PAWAPAY_SIGNING_PRIVATE_KEY = privatePem;
    expect(getPawaPaySigningConfig().active).toBe(true);
  });

  it('produces a signature that verifies against the public key', () => {
    const body = JSON.stringify({ amount: '50', currency: 'XAF' });
    const built = buildPawaPaySignatureHeaders({
      method: 'POST',
      url: 'https://api.pawapay.io/v2/checkouts',
      body,
      signing
    });
    expect(built).not.toBeNull();

    const { headers, signatureBase } = built;
    expect(headers['Content-Digest']).toMatch(/^sha-256=:[A-Za-z0-9+/=]+:$/);
    expect(headers['Signature']).toMatch(/^sig-pp=:[A-Za-z0-9+/=]+:$/);
    expect(headers['Signature-Input']).toContain('sig-pp=');
    expect(headers['Signature-Input']).toContain('"@method" "@authority" "@path"');
    expect(headers['Signature-Input']).toContain('"content-digest"');
    expect(headers['Signature-Input']).toContain('keyid="CUSTOMER_TEST_KEY"');
    expect(headers['Signature-Input']).toContain('alg="ecdsa-p256-sha256"');
    expect(headers['Signature-Input']).toContain('created=');
    expect(headers['Signature-Input']).toContain('expires=');
    expect(headers['Signature-Input']).toMatch(/\);alg="ecdsa-p256-sha256";/);
    expect(headers['Signature-Date']).toBeTruthy();

    // Content-Digest must be the sha-256 of the exact request body.
    const expectedDigest = `sha-256=:${crypto.createHash('sha256').update(body).digest('base64')}:`;
    expect(headers['Content-Digest']).toBe(expectedDigest);

    // The signature must verify over the reconstructed base.
    const signatureB64 = headers['Signature'].match(/^sig-pp=:([^:]+):$/)[1];
    const verified = crypto.verify(
      'sha256',
      Buffer.from(signatureBase, 'utf8'),
      { key: publicPem, dsaEncoding: 'der' },
      Buffer.from(signatureB64, 'base64')
    );
    expect(verified).toBe(true);
  });

  it('derives @authority and @path from the request URL', () => {
    const built = buildPawaPaySignatureHeaders({
      method: 'GET',
      url: 'https://api.sandbox.pawapay.io/v2/checkouts/abc?x=1',
      body: null,
      signing
    });
    expect(built).not.toBeNull();
    expect(built.signatureBase).toContain('"@authority": api.sandbox.pawapay.io');
    expect(built.signatureBase.split('\n')).toContain('"@path": /v2/checkouts/abc');
    expect(built.headers['Content-Digest']).toBeUndefined();
  });

  it('signs outgoing requests when signing env vars are set', async () => {
    process.env.PAWAPAY_ENABLED = 'true';
    process.env.PAWAPAY_API_TOKEN = 'test-token';
    process.env.PAWAPAY_SIGNING_KEY_ID = 'CUSTOMER_TEST_KEY';
    process.env.PAWAPAY_SIGNING_PRIVATE_KEY = privatePem;

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: 'ACCEPTED' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    );
    global.fetch = fetchMock;

    await initiatePawaPayDeposit({ depositId: 'signing-test' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.sandbox.pawapay.io/v2/deposits');
    expect(options.headers).toMatchObject({
      Authorization: 'Bearer test-token',
      Signature: expect.stringMatching(/^sig-pp=:[^:]+:$/),
      'Signature-Input': expect.stringContaining('sig-pp=("@method"'),
      'Content-Digest': expect.stringMatching(/^sha-256=:/)
    });
  });

  it('leaves requests unsigned when signing env vars are absent', async () => {
    process.env.PAWAPAY_ENABLED = 'true';
    process.env.PAWAPAY_API_TOKEN = 'test-token';

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: 'ACCEPTED' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    );
    global.fetch = fetchMock;

    await initiatePawaPayDeposit({ depositId: 'unsigned-test' });

    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers['Signature']).toBeUndefined();
    expect(options.headers['Signature-Input']).toBeUndefined();
    expect(options.headers['Content-Digest']).toBeUndefined();
  });
});
