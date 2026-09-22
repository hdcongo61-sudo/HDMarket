import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPawaPayCheckout } from './pawapayController.js';
import { getPawaPayRequestIdentity } from '../utils/pawapayIdempotency.js';
import PawaPayCheckout from '../models/pawapayCheckoutModel.js';
import * as provider from '../services/pawapayService.js';
import * as payments from '../services/paymentService.js';
import * as config from '../services/configService.js';
afterEach(() => vi.restoreAllMocks());
const request = () => ({ user: { _id: 'buyer' }, headers: { 'idempotency-key': 'unique-test-request' }, body: { amount: 12000, purpose: 'CHECKOUT_FUNDING', returnPath: '/cart' } });
const response = () => ({ status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() });

describe('durable PawaPay checkout recovery', () => {
  it('snapshots server delivery settings and ignores a client-provided waiver', async () => {
    const req = { user: { _id: 'buyer' }, body: { amount: 12000, actionContext: { kind: 'ORDER_CHECKOUT', paymentPercent: 100, fullPaymentFreeDelivery: true } } };
    vi.spyOn(config, 'getRuntimeConfig').mockImplementation(async (key, { fallback } = {}) => key === 'enable_full_payment_free_delivery' ? false : fallback);
    vi.spyOn(payments, 'resolvePaymentProvider').mockResolvedValue({ currency: 'XAF', countryContext: { iso3: 'COG', countryId: 'country' } });
    const create = vi.spyOn(PawaPayCheckout, 'create').mockImplementation(async value => ({ ...value, save: vi.fn() }));
    vi.spyOn(PawaPayCheckout, 'findOneAndUpdate').mockImplementation(async (_query, update) => ({ ...await create.mock.results.at(-1).value, ...update.$set }));
    vi.spyOn(provider, 'initiatePawaPayCheckout').mockResolvedValue({ status: 'ACCEPTED', redirectUrl: 'https://provider.test' });
    const res = response(), next = vi.fn();
    await createPawaPayCheckout(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ actionContext: expect.objectContaining({ fullPaymentFreeDelivery: false }) }));
    expect(config.getRuntimeConfig).toHaveBeenCalledWith('enable_full_payment_free_delivery', { countryId: 'country', fallback: true });
  });
  it('scopes deterministic IDs to users and detects changed payloads', () => {
    const req = request();
    const first = getPawaPayRequestIdentity(req);
    expect(first.checkoutId).toMatch(/^[a-f0-9-]{14}4[a-f0-9]{3}-[89ab]/);
    expect(getPawaPayRequestIdentity({ ...req, user: { _id: 'other' } }).checkoutId).not.toBe(first.checkoutId);
    expect(getPawaPayRequestIdentity({ ...req, body: { ...req.body, amount: 13000 } })).toMatchObject({ checkoutId: first.checkoutId });
    expect(getPawaPayRequestIdentity({ ...req, body: { ...req.body, amount: 13000 } }).requestFingerprint).not.toBe(first.requestFingerprint);
  });
  it('resumes a persisted checkout after the in-memory response cache has gone', async () => {
    const req = request();
    const existing = { ...getPawaPayRequestIdentity(req), status: 'WAITING_PAYMENT', redirectUrl: 'https://provider.test/checkout' };
    vi.spyOn(PawaPayCheckout, 'findOne').mockReturnValue({ select: async () => existing });
    const create = vi.spyOn(PawaPayCheckout, 'create');
    const initiate = vi.spyOn(provider, 'initiatePawaPayCheckout');
    const res = response();
    await createPawaPayCheckout(req, res, vi.fn());
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ checkoutId: existing.checkoutId, redirectUrl: existing.redirectUrl }));
    expect(create).not.toHaveBeenCalled();
    expect(initiate).not.toHaveBeenCalled();
  });
  it('routes confirmed money with failed finalization to verification without another charge', async () => {
    const req = request();
    vi.spyOn(PawaPayCheckout, 'findOne').mockReturnValue({ select: async () => ({ ...getPawaPayRequestIdentity(req), status: 'COMPLETED', paymentState: 'CONFIRMED', autoValidationState: 'FAILED' }) });
    const initiate = vi.spyOn(provider, 'initiatePawaPayCheckout');
    const res = response();
    await createPawaPayCheckout(req, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(202);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ pending: true, verificationUrl: expect.stringContaining('/payment/pawapay/return?') }));
    expect(initiate).not.toHaveBeenCalled();
  });
  it('rejects reuse of an idempotency key for a different payment', async () => {
    const req = request();
    vi.spyOn(PawaPayCheckout, 'findOne').mockReturnValue({ select: async () => ({ ...getPawaPayRequestIdentity(req), requestFingerprint: 'different' }) });
    const res = response();
    await createPawaPayCheckout(req, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(409);
  });
  it('recovers a concurrent reservation using the unique checkout ID', async () => {
    const req = request();
    const existing = { ...getPawaPayRequestIdentity(req), status: 'CREATED' };
    vi.spyOn(PawaPayCheckout, 'findOne').mockReturnValueOnce({ select: async () => null }).mockReturnValueOnce({ select: async () => existing });
    vi.spyOn(payments, 'resolvePaymentProvider').mockResolvedValue({ currency: 'XAF', countryContext: { iso3: 'COG', countryId: 'country' } });
    vi.spyOn(PawaPayCheckout, 'create').mockRejectedValue(Object.assign(new Error('duplicate'), { code: 11000 }));
    const initiate = vi.spyOn(provider, 'initiatePawaPayCheckout');
    const res = response();
    const next = vi.fn();
    await createPawaPayCheckout(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(202);
    expect(initiate).not.toHaveBeenCalled();
  });
});
