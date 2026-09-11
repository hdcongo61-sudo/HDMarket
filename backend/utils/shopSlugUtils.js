import { ensureDocumentSlug, generateUniqueSlug } from './slugUtils.js';

export const ensureShopSlug = async (shop) => {
  const previousSlug = String(shop.slug || '');
  const source = shop.shopName || shop.name;
  if (!previousSlug || !/^(?:\d+(?:-\d+)?|[a-f0-9]{24})$/i.test(previousSlug)) {
    return ensureDocumentSlug({ document: shop, sourceValue: source });
  }
  if (!source) return previousSlug;
  const slug = await generateUniqueSlug(shop.constructor, source, shop._id);
  if (slug === previousSlug) return slug;
  // Retain the previous URL so links already sent to customers still resolve.
  const result = await shop.constructor.updateOne(
    { _id: shop._id, slug: previousSlug },
    { $set: { slug }, $addToSet: { shopSlugAliases: previousSlug } }
  );
  if (result.modifiedCount) shop.slug = slug;
  return shop.slug;
};
