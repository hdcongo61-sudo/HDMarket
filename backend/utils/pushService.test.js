import { describe, expect, it } from 'vitest';
import { resolveNotificationClickUrl } from './pushService.js';

const ORDER_ID = '507f1f77bcf86cd799439011';

describe('push order notification links', () => {
  it('repairs a legacy buyer order URL', () => {
    expect(resolveNotificationClickUrl({
      notification: {
        type: 'payment_validated',
        deepLink: `/orders/${ORDER_ID}`,
        metadata: { orderId: ORDER_ID }
      },
      orderId: ORDER_ID,
      productId: '',
      shopId: '',
      recipientUser: { role: 'user', accountType: 'individual' }
    })).toBe(`/orders/detail/${ORDER_ID}`);
  });

  it('repairs a legacy seller order URL using the seller route', () => {
    expect(resolveNotificationClickUrl({
      notification: {
        type: 'payment_validated',
        deepLink: `/orders/${ORDER_ID}`,
        metadata: { orderId: ORDER_ID }
      },
      orderId: ORDER_ID,
      productId: '',
      shopId: '',
      recipientUser: { role: 'seller', accountType: 'shop' }
    })).toBe(`/seller/orders/detail/${ORDER_ID}`);
  });
});
