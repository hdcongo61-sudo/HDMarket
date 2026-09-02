import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  userFind: vi.fn(),
  createNotification: vi.fn()
}));

vi.mock('../models/userModel.js', () => ({ default: { find: mocks.userFind } }));
vi.mock('../utils/notificationService.js', () => ({
  createNotification: mocks.createNotification
}));

import {
  buildFavoriteProductSnapshot,
  notifyFavoritersOfProductUpdate
} from './favoriteProductUpdateService.js';
import { buildNotificationDisplay } from './notificationTemplateService.js';

const queryResult = (value) => ({
  select: () => ({ lean: () => Promise.resolve(value) })
});

const product = {
  _id: 'product-1',
  user: 'owner-1',
  title: 'Table basse',
  slug: 'table-basse',
  price: 25000,
  images: ['image-1.jpg'],
  updatedAt: new Date('2026-09-02T10:00:00.000Z')
};

describe('favoriteProductUpdateService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createNotification.mockResolvedValue({ _id: 'notification-1' });
  });

  it('notifies every favoriter except the owner after a buyer-visible change', async () => {
    mocks.userFind.mockReturnValue(queryResult([{ _id: 'buyer-1' }, { _id: 'buyer-2' }]));
    const previousSnapshot = buildFavoriteProductSnapshot({ ...product, title: 'Ancien titre' });

    const result = await notifyFavoritersOfProductUpdate({
      product,
      actorId: 'owner-1',
      previousSnapshot
    });

    expect(mocks.userFind).toHaveBeenCalledWith({
      favorites: 'product-1',
      _id: { $ne: 'owner-1' }
    });
    expect(mocks.createNotification).toHaveBeenCalledTimes(2);
    expect(mocks.createNotification).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'buyer-1',
      actorId: 'owner-1',
      productId: 'product-1',
      type: 'favorite_product_updated',
      deepLink: '/product/table-basse'
    }));
    expect(result).toEqual({ recipients: 2, notifications: 2 });
  });

  it('does nothing when the submitted update did not change buyer-visible data', async () => {
    const previousSnapshot = buildFavoriteProductSnapshot(product);

    await expect(notifyFavoritersOfProductUpdate({
      product,
      actorId: 'owner-1',
      previousSnapshot
    })).resolves.toEqual({ recipients: 0, notifications: 0 });

    expect(mocks.userFind).not.toHaveBeenCalled();
    expect(mocks.createNotification).not.toHaveBeenCalled();
  });

  it('treats a photo description edit as a buyer-visible change', () => {
    const before = buildFavoriteProductSnapshot({
      ...product,
      imageDescriptions: ['Vue de face']
    });
    const after = buildFavoriteProductSnapshot({
      ...product,
      imageDescriptions: ['Vue de face avec emballage']
    });

    expect(after).not.toBe(before);
  });

  it('can suppress the generic alert when a specific promotion alert is sent', async () => {
    await notifyFavoritersOfProductUpdate({
      product,
      actorId: 'owner-1',
      previousSnapshot: buildFavoriteProductSnapshot({ ...product, discount: 0 }),
      suppress: true
    });

    expect(mocks.userFind).not.toHaveBeenCalled();
  });

  it('builds buyer-facing copy for the notification', () => {
    expect(buildNotificationDisplay({
      type: 'favorite_product_updated',
      snapshot: { actorName: 'Maison HD', productTitle: 'Table basse' }
    })).toEqual({
      title: 'Un favori a été modifié',
      message: 'Maison HD a mis à jour le produit "Table basse" enregistré dans vos favoris. Consultez les nouvelles informations.',
      actionLabel: 'Voir le produit'
    });
  });
});
