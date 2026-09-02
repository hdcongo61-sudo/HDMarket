import { describe, expect, it } from 'vitest';
import {
  resolveNotificationLink,
  resolvePushPayloadLink,
  selectVisibleNotificationActions
} from './notificationLinks';

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

describe('favorite product update links', () => {
  it('opens the modified product directly', () => {
    expect(resolveNotificationLink({
      type: 'favorite_product_updated',
      product: { _id: ORDER_ID, slug: 'table-basse-led' }
    })).toBe('/product/table-basse-led');
  });
});

describe('notification actions after reading', () => {
  const actions = [
    { to: `/orders/detail/${ORDER_ID}`, label: 'Voir commande' },
    { to: '/products', label: 'Voir produit' }
  ];

  it('keeps the primary destination visible on a collapsed notification', () => {
    expect(selectVisibleNotificationActions(actions)).toEqual([actions[0]]);
  });

  it('reveals a secondary destination when details are expanded', () => {
    expect(selectVisibleNotificationActions(actions, true)).toEqual(actions);
  });
});

describe('quotation notification links', () => {
  it('keeps the buyer quote deep link actionable after the notification is read', () => {
    expect(resolveNotificationLink({
      type: 'quotation_countered',
      entityType: 'quotation',
      entityId: ORDER_ID,
      actionLink: `/my-quotations/${ORDER_ID}`
    })).toBe(`/my-quotations/${ORDER_ID}`);
  });

  it('opens the seller quotation workspace from a new request', () => {
    expect(resolveNotificationLink({
      type: 'quotation_request_received',
      deepLink: `/seller/quotations/${ORDER_ID}`
    }, { role: 'seller', accountType: 'shop' })).toBe(`/seller/quotations/${ORDER_ID}`);
  });
});
