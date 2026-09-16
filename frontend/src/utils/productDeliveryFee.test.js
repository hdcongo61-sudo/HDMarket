import { describe, expect, it } from 'vitest';
import { getProductDeliveryFee } from './productDeliveryFee';

describe('product delivery fee', () => {
  it.each([undefined, null, '', ' ', 'invalid', -1])('does not advertise unknown or invalid fee %s as free', (deliveryFee) => {
    expect(getProductDeliveryFee({ deliveryFee })).toEqual({ fee: null, free: false });
  });
  it.each([0, '0'])('recognizes explicit zero fee %s', (deliveryFee) => {
    expect(getProductDeliveryFee({ deliveryFee })).toEqual({ fee: 0, free: true });
  });
  it('keeps a positive seller fee', () => {
    expect(getProductDeliveryFee({ deliveryFee: 1500 })).toEqual({ fee: 1500, free: false });
  });
  it('honors explicit shop free delivery and disabled fees', () => {
    expect(getProductDeliveryFee({ user: { freeDeliveryEnabled: true } }).free).toBe(true);
    expect(getProductDeliveryFee({ deliveryFeeEnabled: false }).free).toBe(true);
  });
  it('does not promise delivery for pickup-only products', () => {
    expect(getProductDeliveryFee({ deliveryAvailable: false, deliveryFee: 0 }).free).toBe(false);
  });
});
