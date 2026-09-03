import { describe, expect, it } from 'vitest';
import { computeBuyerCredibilityScore } from './buyerCredibilityService.js';

describe('computeBuyerCredibilityScore', () => {
  it('starts at a neutral baseline with no history', () => {
    expect(computeBuyerCredibilityScore({})).toBe(80);
  });

  it('rewards delivered orders up to a cap', () => {
    expect(computeBuyerCredibilityScore({ deliveredOrders: 3 })).toBe(86);
    expect(computeBuyerCredibilityScore({ deliveredOrders: 50 })).toBe(100);
  });

  it('penalizes cancellations and disputes', () => {
    expect(computeBuyerCredibilityScore({ cancelledOrders: 2 })).toBe(70);
    expect(computeBuyerCredibilityScore({ disputesLost: 1 })).toBe(60);
  });

  it('clamps between 0 and 100', () => {
    expect(computeBuyerCredibilityScore({ disputesLost: 9, cancelledOrders: 50 })).toBe(0);
    expect(computeBuyerCredibilityScore({ deliveredOrders: 999, phoneVerified: true })).toBe(100);
  });

  it('adds a small phone-verification bonus', () => {
    expect(computeBuyerCredibilityScore({ phoneVerified: true })).toBe(85);
    expect(computeBuyerCredibilityScore({ deliveredOrders: 5, phoneVerified: true })).toBe(95);
  });
});
