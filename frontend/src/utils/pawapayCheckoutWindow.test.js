import { describe, expect, it } from 'vitest';
import {
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
});
