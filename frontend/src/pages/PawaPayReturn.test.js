import { describe, expect, it } from 'vitest';
import {
  getPawaPayErrorPath,
  getPawaPaySuccessPath
} from './PawaPayReturn';

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
