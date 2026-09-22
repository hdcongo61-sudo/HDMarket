import {
  getLowestProductPrice,
  resolveProductImagePrice,
  resolveSelectedAttributesPrice
} from './productAttributes';

const toPrice = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const hasLinkedVariantPrice = (productAttributes = []) =>
  (Array.isArray(productAttributes) ? productAttributes : []).some((attribute) =>
    attribute?.optionImages &&
    attribute?.optionPrices &&
    Object.keys(attribute.optionImages).some((key) => toPrice(attribute.optionPrices?.[key]) > 0)
  );

/**
 * Canonical price summary for a product card. Photo-linked option prices are
 * already final selling prices, so the product-level strike-through price is
 * only shown when the card is using the base product price.
 */
export const getProductCardPricing = (product = {}) => {
  const attributes = Array.isArray(product?.attributes) ? product.attributes : [];
  const productHasDiscount = toPrice(product?.discount) > 0;
  const hasVariantPrice = hasLinkedVariantPrice(attributes);
  const basePrice = toPrice(product?.priceAfterDiscount) || toPrice(product?.price);
  const currentPrice = getLowestProductPrice({
    productAttributes: attributes,
    basePrice
  });
  const baseOriginalPrice = toPrice(product?.priceBeforeDiscount);
  const originalPrice =
    !hasVariantPrice && productHasDiscount && baseOriginalPrice > currentPrice
      ? baseOriginalPrice
      : null;

  return {
    currentPrice,
    originalPrice,
    productHasDiscount,
    hasVariantPrice,
    hasDiscount: Boolean(originalPrice && originalPrice > currentPrice)
  };
};

/**
 * Canonical price summary for the product detail page. A selected option or
 * image can replace the base price; it does not inherit the base product's
 * discount label because no original price exists for that variant.
 */
export const getSelectedProductPricing = ({
  product = {},
  productAttributes = [],
  selectedAttributes = [],
  imageIndex = -1
} = {}) => {
  const basePrice = toPrice(product?.price);
  const baseOriginalPrice = toPrice(product?.priceBeforeDiscount);
  const productHasDiscount = toPrice(product?.discount) > 0;
  const variantPricing = resolveSelectedAttributesPrice({
    productAttributes,
    selectedAttributes,
    basePrice
  });
  const imagePricing = resolveProductImagePrice({ productAttributes, imageIndex });
  const variantApplied = Boolean(variantPricing.applied || imagePricing.applied);
  const currentPrice = variantPricing.applied
    ? toPrice(variantPricing.unitPrice)
    : imagePricing.applied
      ? toPrice(imagePricing.unitPrice)
      : basePrice;
  const originalPrice =
    !variantApplied && productHasDiscount && baseOriginalPrice > currentPrice
      ? baseOriginalPrice
      : null;

  return {
    currentPrice,
    originalPrice,
    productHasDiscount,
    hasVariantPrice: variantApplied,
    hasDiscount: Boolean(originalPrice && originalPrice > currentPrice),
    variantPricing,
    imagePricing
  };
};

