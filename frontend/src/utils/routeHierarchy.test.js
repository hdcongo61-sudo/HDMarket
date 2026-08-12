import { describe, expect, it } from 'vitest';
import { getRouteHierarchy } from './routeHierarchy';

describe('getRouteHierarchy', () => {
  it('keeps the marketplace chrome on normal commerce pages', () => {
    expect(getRouteHierarchy('/products')).toMatchObject({
      shell: 'commerce',
      showGlobalNav: true,
      showGlobalMobileNav: true,
      showFooter: true,
      showChat: true
    });
  });

  it('keeps the delivery application in the account-facing shell', () => {
    expect(getRouteHierarchy('/delivery/apply')).toMatchObject({
      shell: 'commerce',
      showGlobalNav: true,
      showGlobalMobileNav: true
    });
  });

  it.each(['/shop/store-id', '/buy-for-me', '/parcels/new', '/my/annonce/item-id']) (
    'reserves mobile actions for contextual page %s',
    (pathname) => {
      const hierarchy = getRouteHierarchy(pathname);
      expect(hierarchy.showGlobalNav).toBe(true);
      expect(hierarchy.showGlobalMobileNav).toBe(false);
    }
  );

  it.each([
    ['/login', 'auth'],
    ['/orders/checkout', 'checkout'],
    ['/admin/orders', 'admin'],
    ['/seller/orders', 'seller'],
    ['/delivery/dashboard', 'delivery']
  ])('gives %s an isolated %s shell', (pathname, shell) => {
    expect(getRouteHierarchy(pathname)).toMatchObject({
      shell,
      showGlobalNav: false,
      showGlobalMobileNav: false,
      showFooter: false,
      showChat: false
    });
  });
});
