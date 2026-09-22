import { describe, expect, it } from 'vitest';
import { getProductCardPricing, getSelectedProductPricing } from './productPricing';

describe('product pricing summaries', () => {
  const discountedProduct = {
    price: 90000,
    priceBeforeDiscount: 100000,
    discount: 10,
    attributes: [{
      name: 'Modèle',
      type: 'select',
      options: ['Base', 'Miroir'],
      optionImages: { base: 0, miroir: 1 },
      optionPrices: { miroir: 45000 }
    }]
  };

  it('does not apply the base discount to a photo-priced variant', () => {
    const pricing = getSelectedProductPricing({
      product: discountedProduct,
      productAttributes: discountedProduct.attributes,
      selectedAttributes: [{ name: 'Modèle', value: 'Miroir' }],
      imageIndex: 1
    });

    expect(pricing.currentPrice).toBe(45000);
    expect(pricing.originalPrice).toBeNull();
    expect(pricing.hasDiscount).toBe(false);
  });

  it('keeps the base discount when no priced variant is selected', () => {
    const pricing = getSelectedProductPricing({
      product: discountedProduct,
      productAttributes: discountedProduct.attributes,
      selectedAttributes: [{ name: 'Modèle', value: 'Base' }],
      imageIndex: 0
    });

    expect(pricing.currentPrice).toBe(90000);
    expect(pricing.originalPrice).toBe(100000);
    expect(pricing.hasDiscount).toBe(true);
  });

  it('shows the lowest photo price on cards without a misleading original price', () => {
    const pricing = getProductCardPricing(discountedProduct);
    expect(pricing.currentPrice).toBe(45000);
    expect(pricing.originalPrice).toBeNull();
  });
});

