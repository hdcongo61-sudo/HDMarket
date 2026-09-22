import { afterEach, describe, expect, it, vi } from 'vitest';
import { rejectLegacyPaymentWhenPawaPayOnly as pawaPayOnlyGuard } from './pawaPayOnlyMiddleware.js';
import { getPawaPayConfig } from '../services/pawapayService.js';
vi.mock('../services/pawapayService.js', () => ({ getPawaPayConfig: vi.fn(() => ({ exclusiveMode: true })) }));
afterEach(() => vi.clearAllMocks());
describe('PawaPay-only publication guard', () => {
  it.each([{}, { amountPaid: 500 }, { amount: 500 }, { amount: 0 }, { paymentMethod: 'promo', amount: 0, amountPaid: 500 }])('rejects manual payment payload %j', body => {
    const next = vi.fn();
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    pawaPayOnlyGuard({ body }, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
  it('allows zero-fee submission to reach server-side commission validation', () => {
    const next = vi.fn();
    pawaPayOnlyGuard({ body: { paymentMethod: 'promo', amount: 0 } }, {}, next);
    expect(next).toHaveBeenCalledOnce();
    expect(getPawaPayConfig).toHaveBeenCalled();
  });
});
