import { describe, expect, it } from 'vitest';
import {
  buildBroadcastRecipientFilter,
  buildBroadcastShopLink
} from './broadcastNotification.js';

describe('broadcast notification targeting', () => {
  it('combines account type, gender and city while excluding unavailable recipients', () => {
    const filter = buildBroadcastRecipientFilter({
      target: 'shop',
      gender: 'femme',
      city: 'Pointe-Noire'
    });

    expect(filter).toMatchObject({
      accountType: 'shop',
      gender: 'femme',
      isActive: { $ne: false },
      isBlocked: { $ne: true },
      'notificationPreferences.admin_broadcast': { $ne: false }
    });
    expect(filter.$or).toHaveLength(2);
    expect(filter.$or[0].city.test('pointe-noire')).toBe(true);
    expect(filter.$or[0].city.test('Pointe Noire')).toBe(false);
  });

  it('builds a shop destination with the slug and falls back to the id', () => {
    expect(buildBroadcastShopLink({ _id: 'abc123', slug: 'ma-boutique' })).toBe('/shop/ma-boutique');
    expect(buildBroadcastShopLink({ _id: 'abc123' })).toBe('/shop/abc123');
    expect(buildBroadcastShopLink(null)).toBe('');
  });
});
