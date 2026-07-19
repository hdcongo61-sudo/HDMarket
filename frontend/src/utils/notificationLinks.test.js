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

describe('global broadcast links', () => {
  it('opens the shop selected by the admin from in-app and push notifications', () => {
    const shopPath = '/shop/ma-boutique';
    expect(resolveNotificationLink({
      type: 'admin_broadcast',
      actionLink: shopPath,
      metadata: { shopSlug: 'ma-boutique' }
    })).toBe(shopPath);
    expect(resolvePushPayloadLink({
      data: { type: 'admin_broadcast', actionLink: shopPath, shopSlug: 'ma-boutique' }
    })).toBe(shopPath);
  });
});
