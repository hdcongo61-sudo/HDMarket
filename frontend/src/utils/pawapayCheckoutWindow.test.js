import { describe, expect, it } from 'vitest';
import {
  createPawaPayRouteState,
  createPawaPayResultMessage,
  isPawaPayResultMessage,
  PAWAPAY_RESULT_MESSAGE_TYPE
} from './pawapayCheckoutWindow';

describe('PawaPay checkout window messages', () => {
  it('creates a valid terminal payment result for the original app', () => {
    const result = createPawaPayResultMessage({
      status: 'completed',
      checkoutId: 'checkout-123',
      path: '/order/detail/order-456'
    });

    expect(result).toMatchObject({
      type: PAWAPAY_RESULT_MESSAGE_TYPE,
      status: 'completed',
      checkoutId: 'checkout-123',
      path: '/order/detail/order-456'
    });
    expect(isPawaPayResultMessage(result)).toBe(true);
  });

  it('replaces an external destination with the safe orders page', () => {
    const result = createPawaPayResultMessage({
      status: 'failed',
      checkoutId: 'checkout-123',
      path: 'https://example.com/phishing'
    });

    expect(result.path).toBe('/orders');
    expect(isPawaPayResultMessage(result)).toBe(true);
  });

  it('rejects non-terminal or incomplete messages', () => {
    expect(
      isPawaPayResultMessage({
        type: PAWAPAY_RESULT_MESSAGE_TYPE,
        messageId: 'message-1',
        status: 'pending',
        checkoutId: 'checkout-123',
        path: '/orders'
      })
    ).toBe(false);
  });

  it('creates a route refresh state for successful payments', () => {
    const state = createPawaPayRouteState({
      messageId: 'payment-result-1',
      status: 'completed',
      checkoutId: 'checkout-123',
      message: 'Paiement confirmé.'
    });

    expect(state).toEqual({
      pawaPayRefreshKey: 'payment-result-1',
      pawaPayNotice: {
        status: 'completed',
        checkoutId: 'checkout-123',
        message: 'Paiement confirmé.'
      }
    });
  });

  it('also refreshes the destination after a failed terminal state', () => {
    const state = createPawaPayRouteState({
      messageId: 'payment-result-2',
      status: 'failed',
      checkoutId: 'checkout-456'
    });

    expect(state.pawaPayRefreshKey).toBe('payment-result-2');
    expect(state.pawaPayNotice.status).toBe('failed');
  });
});
