import { describe, it, expect } from 'vitest';
import { getSellerDeliveryPreview } from './checkoutDeliveryPreview';
const group = (...products) => ({ items: products.map(product => ({ product })) });
describe('checkout delivery estimates', () => {
  it('keeps unknown fees pending', () => {
    expect(getSellerDeliveryPreview(group({}))).toMatchObject({ fee: null, pending: true });
  });
  it('does not hide unknown fees behind another product fee', () => {
    expect(getSellerDeliveryPreview(group({ deliveryFee: 1000 }, {})).pending).toBe(true);
  });
  it('uses the largest known product fee per seller', () => {
    expect(getSellerDeliveryPreview(group({ deliveryFee: 1000 }, { deliveryFee: 500 }))).toMatchObject({ fee: 1000, pending: false });
  });
  it('honors commune free delivery over unknown product fees', () => {
    expect(getSellerDeliveryPreview(group({}), { deliveryPolicy: 'FREE' })).toMatchObject({ fee: 0, pending: false });
  });
  it('honors a fixed commune fee over product fees', () => {
    expect(getSellerDeliveryPreview(group({ deliveryFee: 5000 }), { deliveryPolicy: 'FIXED_FEE', fixedFee: 750 })).toMatchObject({ fee: 750, pending: false });
  });
  it('does not treat a missing fixed commune fee as free', () => {
    expect(getSellerDeliveryPreview(group({}), { deliveryPolicy: 'FIXED_FEE' }).pending).toBe(true);
  });
  it('honors explicit shop free delivery', () => {
    expect(getSellerDeliveryPreview(group({ user: { freeDeliveryEnabled: true } }))).toMatchObject({ fee: 0, pending: false });
  });
});
