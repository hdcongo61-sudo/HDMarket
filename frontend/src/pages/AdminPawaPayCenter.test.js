import { describe, expect, it } from 'vitest';
import { getCheckoutAdminPath } from './AdminPawaPayCenter';

describe('PawaPay admin checkout destinations', () => {
  it('opens the public product detail for a listing payment', () => {
    expect(
      getCheckoutAdminPath({
        purpose: 'LISTING_FEE_FUNDING',
        product: { _id: 'product-id', slug: 'chaise-moderne' },
        completionResult: { successPath: '/my/annonce/chaise-moderne' }
      })
    ).toBe('/product/chaise-moderne');
  });

  it('uses the completed product id for older listing payments', () => {
    expect(
      getCheckoutAdminPath({
        purpose: 'LISTING_FEE_FUNDING',
        completionResult: {
          entityId: 'legacy-product-id',
          successPath: '/my/annonce/legacy-product-id'
        }
      })
    ).toBe('/product/legacy-product-id');
  });

  it('keeps completed orders inside the admin order view', () => {
    expect(
      getCheckoutAdminPath({
        completionResult: { orderIds: ['order-id'], successPath: '/order/detail/order-id' }
      })
    ).toBe('/admin/orders?orderId=order-id');
  });
});
