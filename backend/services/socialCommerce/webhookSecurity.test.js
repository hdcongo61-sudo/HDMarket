import crypto from 'crypto';
import { describe, expect, it } from 'vitest';
import { verifyMetaSignature, verifyMetaWebhookChallenge } from './webhookSecurity.js';

const sign = (body, secret) => `sha256=${crypto.createHmac('sha256', secret).update(body).digest('hex')}`;

describe('webhookSecurity', () => {
  describe('verifyMetaSignature', () => {
    const secret = 'test-app-secret';
    const rawBody = Buffer.from(JSON.stringify({ hello: 'world' }));

    it('accepts a correctly signed payload', () => {
      expect(verifyMetaSignature({ rawBody, signatureHeader: sign(rawBody, secret), appSecret: secret })).toBe(true);
    });

    it('rejects a tampered signature', () => {
      expect(verifyMetaSignature({ rawBody, signatureHeader: 'sha256=deadbeef', appSecret: secret })).toBe(false);
    });

    it('rejects a signature computed with the wrong secret', () => {
      expect(verifyMetaSignature({ rawBody, signatureHeader: sign(rawBody, 'wrong-secret'), appSecret: secret })).toBe(false);
    });

    it('rejects when the body was modified after signing (replay/tamper protection)', () => {
      const signature = sign(rawBody, secret);
      const tamperedBody = Buffer.from(JSON.stringify({ hello: 'world!' }));
      expect(verifyMetaSignature({ rawBody: tamperedBody, signatureHeader: signature, appSecret: secret })).toBe(false);
    });

    it('rejects a missing signature header', () => {
      expect(verifyMetaSignature({ rawBody, signatureHeader: '', appSecret: secret })).toBe(false);
    });

    it('rejects a header without the sha256= prefix', () => {
      const raw = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
      expect(verifyMetaSignature({ rawBody, signatureHeader: raw, appSecret: secret })).toBe(false);
    });

    it('rejects when the app secret is not configured', () => {
      expect(verifyMetaSignature({ rawBody, signatureHeader: sign(rawBody, secret), appSecret: '' })).toBe(false);
    });

    it('rejects when the raw body is missing', () => {
      expect(verifyMetaSignature({ rawBody: null, signatureHeader: sign(rawBody, secret), appSecret: secret })).toBe(false);
    });
  });

  describe('verifyMetaWebhookChallenge', () => {
    it('verifies a correct subscribe handshake', () => {
      const result = verifyMetaWebhookChallenge({
        query: { 'hub.mode': 'subscribe', 'hub.verify_token': 'abc', 'hub.challenge': 'xyz' },
        expectedVerifyToken: 'abc'
      });
      expect(result).toEqual({ verified: true, challenge: 'xyz' });
    });

    it('rejects a wrong verify token', () => {
      const result = verifyMetaWebhookChallenge({
        query: { 'hub.mode': 'subscribe', 'hub.verify_token': 'wrong', 'hub.challenge': 'xyz' },
        expectedVerifyToken: 'abc'
      });
      expect(result.verified).toBe(false);
    });

    it('rejects a non-subscribe mode', () => {
      const result = verifyMetaWebhookChallenge({
        query: { 'hub.mode': 'unsubscribe', 'hub.verify_token': 'abc', 'hub.challenge': 'xyz' },
        expectedVerifyToken: 'abc'
      });
      expect(result.verified).toBe(false);
    });
  });
});
