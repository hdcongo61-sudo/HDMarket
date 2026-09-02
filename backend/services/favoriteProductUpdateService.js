import User from '../models/userModel.js';
import { createNotification } from '../utils/notificationService.js';

const BUYER_VISIBLE_PRODUCT_FIELDS = Object.freeze([
  'title',
  'description',
  'brand',
  'price',
  'discount',
  'priceBeforeDiscount',
  'images',
  'imageDescriptions',
  'video',
  'socialVideoUrl',
  'pdf',
  'category',
  'tags',
  'categoryId',
  'subcategoryId',
  'legacyCategoryName',
  'legacySubcategoryName',
  'condition',
  'installmentEnabled',
  'installmentMinAmount',
  'installmentDuration',
  'installmentStartDate',
  'installmentEndDate',
  'installmentLatePenaltyRate',
  'installmentMaxMissedPayments',
  'installmentRequireGuarantor',
  'wholesaleEnabled',
  'wholesaleTiers',
  'quotationEnabled',
  'warrantyEnabled',
  'warrantyPeriodValue',
  'warrantyPeriodUnit',
  'deliveryAvailable',
  'pickupAvailable',
  'deliveryFee',
  'deliveryFeeEnabled',
  'attributes',
  'physical'
]);

const normalizeSnapshotValue = (value) => {
  if (value && typeof value.toObject === 'function') {
    return value.toObject({ depopulate: true, virtuals: false });
  }
  return value;
};

// The edit form always resends a few structured fields. Comparing a buyer-visible
// snapshot prevents those idempotent writes from generating false notifications.
export const buildFavoriteProductSnapshot = (product) => {
  if (!product) return '';
  const snapshot = {};
  BUYER_VISIBLE_PRODUCT_FIELDS.forEach((field) => {
    snapshot[field] = normalizeSnapshotValue(product[field]);
  });
  return JSON.stringify(snapshot);
};

export const notifyFavoritersOfProductUpdate = async ({
  product,
  actorId,
  previousSnapshot,
  suppress = false
} = {}) => {
  const productId = product?._id;
  const normalizedActorId = String(actorId || '').trim();
  if (!productId || !normalizedActorId || suppress) {
    return { recipients: 0, notifications: 0 };
  }

  const currentSnapshot = buildFavoriteProductSnapshot(product);
  if (!previousSnapshot || previousSnapshot === currentSnapshot) {
    return { recipients: 0, notifications: 0 };
  }

  const recipients = await User.find({
    favorites: productId,
    _id: { $ne: actorId }
  })
    .select('_id')
    .lean();

  if (!recipients.length) return { recipients: 0, notifications: 0 };

  const productIdentifier = String(product.slug || productId);
  const updateToken = product.updatedAt
    ? new Date(product.updatedAt).toISOString()
    : currentSnapshot;
  const results = await Promise.all(
    recipients.map((recipient) =>
      createNotification({
        userId: recipient._id,
        actorId,
        productId,
        type: 'favorite_product_updated',
        priority: 'NORMAL',
        metadata: {
          productTitle: product.title || '',
          productSlug: product.slug || ''
        },
        entityType: 'product',
        entityId: String(productId),
        deepLink: `/product/${productIdentifier}`,
        dedupeKey: `favorite-product-update:${String(productId)}:${updateToken}`
      })
    )
  );

  return {
    recipients: recipients.length,
    notifications: results.filter(Boolean).length
  };
};
