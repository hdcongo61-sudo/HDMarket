// HDMARKET_PUBLIC_URL must be set in backend/.env of every environment that
// generates outbound share links — falls back to a relative path
// (no host) rather than throwing, so a misconfigured env doesn't crash a
// webhook reply, it just produces a link that needs the app's own origin.
const getPublicUrl = () => String(process.env.HDMARKET_PUBLIC_URL || '').replace(/\/+$/, '');

/**
 * Builds the trackable smart link for a product's social code, e.g.
 * https://hdmarket.cg/s/HD-8F42K?source=tiktok&campaign=TK-AUG-01
 */
export const buildSmartUrl = (socialCode, { source, campaign, shop, post, creator } = {}) => {
  const base = `${getPublicUrl()}/s/${encodeURIComponent(socialCode)}`;
  const params = new URLSearchParams();
  if (source) params.set('source', source);
  if (campaign) params.set('campaign', campaign);
  if (shop) params.set('shop', shop);
  if (post) params.set('post', post);
  if (creator) params.set('creator', creator);
  const query = params.toString();
  return query ? `${base}?${query}` : base;
};

// Mirrors frontend/src/utils/links.js buildProductPath's `/product/:slug`
// convention — falls back to the Mongo _id only if no slug exists yet
// (should be rare; every product gets a slug on creation).
export const buildCanonicalProductPath = (product) => {
  const identifier = product?.slug || (product?._id ? String(product._id) : '');
  return identifier ? `/product/${identifier}` : '/products';
};

export const buildCanonicalProductUrl = (product) => `${getPublicUrl()}${buildCanonicalProductPath(product)}`;
