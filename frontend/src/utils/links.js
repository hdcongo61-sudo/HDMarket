export const isGeneratedTimestampSlug = (value) => {
  const normalized = String(value || '').trim();
  return /^\d{10,}(?:-\d+)?$/.test(normalized);
};

const extractIdentifier = (value, slugKey = 'slug') => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    const slug = value[slugKey] || value.slug;
    if (slug && !isGeneratedTimestampSlug(slug)) return slug;
    if (value._id) return value._id;
    if (value.id) return value.id;
    if (slug) return slug;
  }
  return null;
};

export const buildProductPath = (product) => {
  // Prefer a real slug, but fall back to the _id when the slug is a generated
  // timestamp placeholder (e.g. "1782162322025") — the backend can't resolve
  // those slugs, which results in a 404.
  const identifier = extractIdentifier(product, 'slug');
  return identifier ? `/product/${identifier}` : '/product';
};

export const buildShopPath = (shop) => {
  const identifier = extractIdentifier(shop, 'slug');
  return identifier ? `/shop/${identifier}` : '/shop';
};

export const buildProductShareUrl = (product, origin = '') => {
  const urlOrigin = origin || (typeof window !== 'undefined' ? window.location.origin : '');
  const identifier = extractIdentifier(product, 'slug');
  return identifier ? `${urlOrigin}/product/${identifier}` : urlOrigin;
};
