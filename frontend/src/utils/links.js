const extractIdentifier = (value, slugKey = 'slug') => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    if (value[slugKey]) return value[slugKey];
    if (value._id) return value._id;
    if (value.id) return value.id;
    if (value.slug) return value.slug;
  }
  return null;
};

const extractSlug = (value, slugKey = 'slug') => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    if (value[slugKey]) return value[slugKey];
    if (value.slug) return value.slug;
  }
  return null;
};

export const buildProductPath = (product) => {
  const slug = extractSlug(product, 'slug');
  if (slug) return `/product/${slug}`;
  // Fallback to ID when slug is missing
  const id = product?._id || product?.id;
  if (id) return `/product/${id}`;
  return '/product';
};

export const buildShopPath = (shop) => {
  const identifier = extractIdentifier(shop, 'slug');
  return identifier ? `/shop/${identifier}` : '/shop';
};

export const buildProductShareUrl = (product, origin = '') => {
  const urlOrigin = origin || (typeof window !== 'undefined' ? window.location.origin : '');
  const slug = extractSlug(product, 'slug');
  return slug ? `${urlOrigin}/product/${slug}` : urlOrigin;
};
