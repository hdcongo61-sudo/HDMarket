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

export const buildProductPath = (product) => {
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
