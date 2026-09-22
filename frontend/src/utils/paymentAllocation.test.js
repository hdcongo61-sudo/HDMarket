import { describe, it, expect } from 'vitest';
import { allocatePayment } from './paymentAllocation.js';
import { allocatePayment as allocateServerPayment } from '../../../backend/utils/paymentAllocation.js';

describe('whole-FCFA payment allocation', () => {
  it('keeps an odd captured amount across equal shops and is independent of row order', () => {
    const entries = [{ key: 'a', amount: 10001 }, { key: 'b', amount: 10001 }];
    expect(Object.fromEntries(allocatePayment(10001, entries))).toEqual({ a: 5001, b: 5000 });
    expect(Object.fromEntries(allocatePayment(10001, [...entries].reverse()))).toEqual({ a: 5001, b: 5000 });
  });
  it('preserves frontend/backend parity, amount conservation and shop limits across percentages', () => {
    for (let shops = 1; shops <= 20; shops++) {
      const entries = Array.from({ length: shops }, (_, index) => ({ key: String(index), amount: 1031 + index * 997 }));
      const total = entries.reduce((sum, entry) => sum + entry.amount, 0);
      for (const percent of [25, 50, 70, 100]) {
        const captured = Math.round(total * percent / 100);
        const allocation = allocatePayment(captured, entries);
        expect(allocation).toEqual(allocateServerPayment(captured, entries));
        expect([...allocation.values()].reduce((sum, value) => sum + value, 0)).toBe(captured);
        for (const entry of entries) {
          expect(Number.isInteger(allocation.get(entry.key))).toBe(true);
          expect(allocation.get(entry.key)).toBeLessThanOrEqual(entry.amount);
          expect(Math.abs(allocation.get(entry.key) - captured * entry.amount / total)).toBeLessThan(1);
        }
      }
    }
  });
  it('handles zero amounts and rejects impossible allocations', () => {
    expect([...allocatePayment(0, [{ key: 'free', amount: 0 }]).values()]).toEqual([0]);
    for (const amount of [-1, 11, 1.5, NaN]) expect(() => allocatePayment(amount, [{ key: 'a', amount: 10 }])).toThrow();
  });
});
