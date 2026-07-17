import { describe, expect, it } from 'vitest';
import { resolveNotificationLink, resolvePushPayloadLink } from './notificationLinks';

const ORDER_ID = '507f1f77bcf86cd799439011';

describe('order notification links', () => {
  it('repairs legacy buyer links that look like order status routes', () => {
    expect(resolveNotificationLink({
      type: 'payment_validated',
      actionLink: `/orders/${ORDER_ID}`,
      metadata: { orderId: ORDER_ID }
    })).toBe(`/orders/detail/${ORDER_ID}`);
  });

  it('routes the same legacy notification to the seller detail page', () => {
    expect(resolveNotificationLink({
      type: 'payment_validated',
      actionLink: `/orders/${ORDER_ID}`,
      metadata: { orderId: ORDER_ID }
    }, { role: 'seller', accountType: 'shop' })).toBe(`/seller/orders/detail/${ORDER_ID}`);
  });

  it('repairs native push payloads before navigation', () => {
    expect(resolvePushPayloadLink({
      data: {
        type: 'payment_validated',
        orderId: ORDER_ID,
        url: `/orders/${ORDER_ID}`
      }
    })).toBe(`/orders/detail/${ORDER_ID}`);
  });
});
