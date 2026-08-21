import Product from '../../models/productModel.js';
import { extractSocialCodeCandidates } from './socialCodeService.js';

// Anything not 'approved' is not purchasable/publicly visible right now —
// resolver must say PRODUCT_UNAVAILABLE, not fall through to a normal
// price/availability reply (spec §35).
const UNAVAILABLE_REASON = 'PRODUCT_UNAVAILABLE';
const NOT_FOUND_REASON = 'PRODUCT_NOT_FOUND';

const PRODUCT_PROJECTION =
  'title description price discount priceBeforeDiscount images status user socialCode ' +
  'wholesaleEnabled wholesaleTiers installmentEnabled installmentMinAmount installmentDuration ' +
  'deliveryAvailable pickupAvailable city countryId currency slug condition';

const SHOP_PROJECTION = 'shopName name phone city shopVerified accountType slug';

/**
 * Resolves a HDMarket product from free-form social message text (see
 * socialCodeService.extractSocialCodeCandidates for the "HD-8F42K" matching).
 * Only ever exposes the product/shop documents server-side — callers building
 * a reply must go through responseBuilderService, which never leaks the
 * Mongo _id into outbound text.
 *
 * @returns {Promise<{found:true, product, shop, socialCode}|{found:false, reason:string, socialCode?:string}>}
 */
export const resolveProductFromMessage = async (message) => {
  const candidates = extractSocialCodeCandidates(message);
  if (!candidates.length) {
    return { found: false, reason: NOT_FOUND_REASON };
  }

  for (const socialCode of candidates) {
    const product = await Product.findOne({ socialCode })
      .select(PRODUCT_PROJECTION)
      .populate('user', SHOP_PROJECTION)
      .lean();

    if (!product) continue;

    if (product.status !== 'approved') {
      return { found: false, reason: UNAVAILABLE_REASON, socialCode, product };
    }

    return { found: true, product, shop: product.user || null, socialCode };
  }

  return { found: false, reason: NOT_FOUND_REASON, socialCode: candidates[0] };
};

export const resolveProductBySocialCode = async (socialCode) =>
  resolveProductFromMessage(String(socialCode || ''));

// Used by the conversation-context follow-up path (spec §33) — "vous livrez
// à Bacongo ?" after a product was already discussed re-resolves by the
// remembered product id rather than requiring the code again. Same
// approved-only guard and shape as the code-based resolvers.
export const resolveProductById = async (productId) => {
  if (!productId) return { found: false, reason: NOT_FOUND_REASON };
  const product = await Product.findById(productId)
    .select(PRODUCT_PROJECTION)
    .populate('user', SHOP_PROJECTION)
    .lean();
  if (!product) return { found: false, reason: NOT_FOUND_REASON };
  if (product.status !== 'approved') {
    return { found: false, reason: UNAVAILABLE_REASON, socialCode: product.socialCode, product };
  }
  return { found: true, product, shop: product.user || null, socialCode: product.socialCode };
};

export { NOT_FOUND_REASON, UNAVAILABLE_REASON };
