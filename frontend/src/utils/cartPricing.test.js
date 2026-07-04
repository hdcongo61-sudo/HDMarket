import { describe, expect, it } from 'vitest';
import {
  getOptimisticCartLinePricing,
  patchCartItemQuantity,
  recalculateCart,
  removeCartItem
} from './cartPricing';

const wholesaleProduct = {
  price: 1000,
  wholesaleEnabled: true,
  wholesaleTiers: [
    { minQty: 5, unitPrice: 900 },
    { minQty: 10, unitPrice: 800 }
  ]
};

const variantProduct = {
  price: 1000,
  wholesaleEnabled: true,
  wholesaleTiers: [{ minQty: 5, unitPrice: 900 }],
  attributes: [
    { name: 'Taille', type: 'select', options: ['S', 'XL'], optionPrices: { xl: 1500 } }
  ]
};

describe('getOptimisticCartLinePricing', () => {
  it('applies wholesale tiers when no variant price is selected', () => {
    const pricing = getOptimisticCartLinePricing(wholesaleProduct, 10);
    expect(pricing.unitPrice).toBe(800);
    expect(pricing.wholesale.applied).toBe(true);
  });

  it('a variant price overrides wholesale tiers entirely, even at a qualifying quantity', () => {
    // qty=10 would normally qualify for the wholesale tier, but XL has its own price.
    const pricing = getOptimisticCartLinePricing(variantProduct, 10, [{ name: 'Taille', value: 'XL' }]);
    expect(pricing.unitPrice).toBe(1500);
    expect(pricing.variantPriceApplied).toBe(true);
    expect(pricing.wholesale.applied).toBe(false);
  });

  it('falls back to wholesale/base pricing for a variant with no price of its own', () => {
    const pricing = getOptimisticCartLinePricing(variantProduct, 10, [{ name: 'Taille', value: 'S' }]);
    expect(pricing.unitPrice).toBe(900); // wholesale tier at qty 10 (only tier is minQty 5)
    expect(pricing.variantPriceApplied).toBeUndefined();
  });
});

describe('recalculateCart', () => {
  it('recomputes totals across all lines and drops items with no product', () => {
    const cart = {
      items: [
        { product: wholesaleProduct, quantity: 10, selectedAttributes: [] },
        { product: null, quantity: 1 }
      ]
    };
    const result = recalculateCart(cart);
    expect(result.items).toHaveLength(1);
    expect(result.totals).toEqual({ quantity: 10, subtotal: 8000 });
  });
});

describe('patchCartItemQuantity / removeCartItem', () => {
  const cart = {
    items: [{ product: { ...wholesaleProduct, _id: 'p1' }, quantity: 2, selectedAttributes: [] }]
  };

  it('updates the matching line and recalculates totals', () => {
    const result = patchCartItemQuantity(cart, { productId: 'p1', quantity: 6 });
    expect(result.items[0].quantity).toBe(6);
    expect(result.items[0].unitPrice).toBe(900); // now qualifies for the 5+ tier
  });

  it('removes the line entirely at quantity 0', () => {
    const result = patchCartItemQuantity(cart, { productId: 'p1', quantity: 0 });
    expect(result.items).toHaveLength(0);
    expect(result.totals).toEqual({ quantity: 0, subtotal: 0 });
  });

  it('removeCartItem is equivalent to patching quantity to 0 for that line', () => {
    const result = removeCartItem(cart, cart.items[0]);
    expect(result.items).toHaveLength(0);
  });
});
