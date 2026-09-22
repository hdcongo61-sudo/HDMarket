import { describe, expect, it } from 'vitest';
import { disputeEligibility } from './disputeEligibility.js';
const now = new Date('2026-09-20T12:00:00Z');
const config = { now, thresholds: { disputeWindowHours: 72 }, escrowSettings: { disputeEnabled: true, maximumDisputeTimeMinutes: 180 } };
const order = { paymentSource: 'pawapay', paidAmount: 5000, escrowStatus: 'HELD', createdAt: '2026-08-01', status: 'out_for_delivery' };
describe('dispute eligibility before and after delivery', () => {
  it.each(['paid', 'pending', 'confirmed', 'ready_for_pickup', 'ready_for_delivery', 'out_for_delivery', 'delivering'])('allows non-receipt for %s without starting the post-delivery deadline', status => {
    expect(disputeEligibility({ ...config, order: { ...order, status }, reason: 'not_received' })).toEqual({ allowed: true, disputeWindowEndsAt: null });
  });
  it.each(['wrong_item', 'damaged_item', 'missing_items', 'other'])('requires delivery for %s', reason => {
    expect(disputeEligibility({ ...config, order, reason }).allowed).toBe(false);
  });
  it.each(['pending_payment', 'cancelled', 'dispute_opened'])('rejects %s', status => {
    expect(disputeEligibility({ ...config, order: { ...order, status }, reason: 'not_received' }).allowed).toBe(false);
  });
  it('rejects unpaid unconfirmed orders', () => {
    expect(disputeEligibility({ ...config, order: { ...order, status: 'pending', paidAmount: 0 }, reason: 'not_received' }).allowed).toBe(false);
  });
  it('preserves disabled disputes, released funds and expired delivery windows', () => {
    expect(disputeEligibility({ ...config, escrowSettings: { disputeEnabled: false }, order, reason: 'not_received' }).allowed).toBe(false);
    for (const escrowStatus of ['RELEASED', 'REFUNDED']) expect(disputeEligibility({ ...config, order: { ...order, escrowStatus }, reason: 'not_received' }).allowed).toBe(false);
    expect(disputeEligibility({ ...config, order: { ...order, status: 'delivered', deliveredAt: '2026-09-19' }, reason: 'not_received' }).allowed).toBe(false);
    expect(disputeEligibility({ ...config, order: { ...order, status: 'delivered', deliveredAt: '2026-09-20T11:00:00Z' }, reason: 'damaged_item' }).allowed).toBe(true);
  });
});
