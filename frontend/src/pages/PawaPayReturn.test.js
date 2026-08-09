import { describe, expect, it } from 'vitest';
import {
  getPawaPayCheckoutStatusPath,
  getPawaPayErrorPath,
  getPawaPaySuccessPath
} from './PawaPayReturn';

describe('PawaPay return references', () => {
  it('resolves checkoutCode through the corresponding local checkout', () => {
    expect(
      getPawaPayCheckoutStatusPath({
        checkoutCode: 'abc123XY',
        checkoutId: 'merchant-generated-uuid'
      })
    ).toBe('/payments/pawapay/checkouts/by-code/abc123XY');
  });

  it('keeps checkoutId support for returns created before the PawaPay change', () => {
    expect(
      getPawaPayCheckoutStatusPath({ checkoutId: 'merchant-generated-uuid' })
    ).toBe('/payments/pawapay/checkouts/merchant-generated-uuid');
  });
});

describe('PawaPay success destinations', () => {
  it('opens the created order after a successful checkout', () => {
    expect(
      getPawaPaySuccessPath({
        actionKind: 'ORDER_CHECKOUT',
        completionResult: { orderIds: ['order-123'] },
        returnPath: '/orders/checkout'
      })
    ).toBe('/order/detail/order-123');
  });

  it('returns listing payments to their /my page', () => {
    expect(
      getPawaPaySuccessPath({
        purpose: 'LISTING_FEE_FUNDING',
        returnPath: '/my/annonce/chaise',
        completionResult: {
          successPath: '/my/annonce/chaise'
        }
      })
    ).toBe('/my/annonce/chaise');
  });

  it('returns a paid shop conversion to its request page', () => {
    expect(
      getPawaPaySuccessPath({
        actionKind: 'SHOP_CONVERSION_REQUEST',
        returnPath: '/shop-conversion-request'
      })
    ).toBe('/shop-conversion-request');
  });

  it('does not accept an external redirect from stored checkout data', () => {
    expect(
      getPawaPaySuccessPath({
        completionResult: { successPath: 'https://example.com' }
      })
    ).toBe('/orders');
  });
});

describe('PawaPay error destinations', () => {
  it('returns a failed payment to the page that started it', () => {
    expect(
      getPawaPayErrorPath({
        returnPath: '/orders/checkout'
      })
    ).toBe('/orders/checkout');
  });

  it('does not accept an external error redirect', () => {
    expect(
      getPawaPayErrorPath({
        returnPath: 'https://example.com/phishing'
      })
    ).toBe('/orders');
  });
});
