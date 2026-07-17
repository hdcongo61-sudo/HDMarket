import { describe, expect, it } from 'vitest';
import {
  getHighestProductPrice,
  getLowestProductPrice,
  normalizeProductAttributes,
  resolveProductImagePrice,
  resolveSelectedAttributesImage,
  resolveSelectedAttributesPrice,
  validateSelectedAttributes
} from './productAttributes';

// Mirrors backend/utils/productAttributes.test.js for the rules the two
// implementations must agree on (see CLAUDE.md — these files are hand-kept in
// sync, not shared code, so a drift here won't be caught by the backend suite).

describe('normalizeProductAttributes', () => {
  it('drops optionPrices/optionImages for undeclared options', () => {
    const [attr] = normalizeProductAttributes([
      {
        name: 'Taille',
        type: 'select',
        options: ['S', 'M'],
        optionPrices: { s: 10000, ghost: 999 },
        optionImages: { m: 1, ghost: 5 }
      }
    ]);
    expect(attr.optionPrices).toEqual({ s: 10000 });
    expect(attr.optionImages).toEqual({ m: 1 });
  });

  it('rejects out-of-range image indexes', () => {
    const [attr] = normalizeProductAttributes([
      { name: 'Couleur', type: 'select', options: ['Rouge'], optionImages: { rouge: 999 } }
    ]);
    expect(attr.optionImages).toBeUndefined();
  });

  it('keeps only declared options explicitly marked out of stock', () => {
    const [attr] = normalizeProductAttributes([
      {
        name: 'Couleur',
        type: 'select',
        options: ['Rouge', 'Noir'],
        optionOutOfStock: { rouge: true, noir: false, ghost: true }
      }
    ]);
    expect(attr.optionOutOfStock).toEqual({ rouge: true });
  });
});

describe('resolveSelectedAttributesPrice', () => {
  const attrs = [
    { name: 'Taille', type: 'select', options: ['S', 'M', 'XL'], optionPrices: { s: 10000, xl: 15000 } }
  ];

  it('replaces the base price for a priced option (case-insensitive)', () => {
    expect(
      resolveSelectedAttributesPrice({
        productAttributes: attrs,
        selectedAttributes: [{ name: 'taille', value: 'XL' }],
        basePrice: 12000
      })
    ).toEqual({ unitPrice: 15000, applied: true });
  });

  it('falls back to the base price for an unpriced option', () => {
    expect(
      resolveSelectedAttributesPrice({
        productAttributes: attrs,
        selectedAttributes: [{ name: 'Taille', value: 'M' }],
        basePrice: 12000
      })
    ).toEqual({ unitPrice: 12000, applied: false });
  });
});

describe('resolveSelectedAttributesImage', () => {
  const attrs = [{ name: 'Couleur', type: 'select', options: ['Rouge', 'Noir'], optionImages: { rouge: 1, noir: 0 } }];
  const images = ['https://x/black.jpg', 'https://x/red.jpg'];

  it('resolves the linked image for the selected option', () => {
    expect(
      resolveSelectedAttributesImage({ productAttributes: attrs, selectedAttributes: [{ name: 'Couleur', value: 'Rouge' }], images })
    ).toEqual({ applied: true, imageIndex: 1, image: 'https://x/red.jpg' });
  });
});

describe('resolveProductImagePrice', () => {
  const attrs = [
    {
      name: 'Couleur',
      type: 'select',
      options: ['Rouge', 'Noir'],
      optionImages: { rouge: 1, noir: 0 },
      optionPrices: { rouge: 15000 }
    }
  ];

  it('resolves the price attached to the photo at a given index', () => {
    expect(resolveProductImagePrice({ productAttributes: attrs, imageIndex: 1 })).toEqual({
      unitPrice: 15000,
      applied: true
    });
  });

  it('reports not-applied for a photo with no linked price', () => {
    expect(resolveProductImagePrice({ productAttributes: attrs, imageIndex: 0 }).applied).toBe(false);
  });

  it('reports not-applied for a negative/invalid index', () => {
    expect(resolveProductImagePrice({ productAttributes: attrs, imageIndex: -1 }).applied).toBe(false);
  });
});

describe('getHighestProductPrice / getLowestProductPrice', () => {
  const attrs = [
    { name: 'Taille', type: 'select', options: ['S', 'M', 'XL'], optionPrices: { s: 8000, xl: 15000 } }
  ];

  it('getHighestProductPrice returns the max of base price and all option prices', () => {
    expect(getHighestProductPrice({ productAttributes: attrs, basePrice: 10000 })).toBe(15000);
    expect(getHighestProductPrice({ productAttributes: [], basePrice: 10000 })).toBe(10000);
  });

  it('getLowestProductPrice only considers photo-linked option prices, else falls back to base', () => {
    // No optionImages on this attribute => not eligible as a card price, falls back to base.
    expect(getLowestProductPrice({ productAttributes: attrs, basePrice: 10000 })).toBe(10000);

    const photoLinked = [
      {
        name: 'Couleur',
        type: 'select',
        options: ['Rouge', 'Noir'],
        optionImages: { rouge: 0, noir: 1 },
        optionPrices: { rouge: 12000, noir: 9000 }
      }
    ];
    expect(getLowestProductPrice({ productAttributes: photoLinked, basePrice: 10000 })).toBe(9000);
  });
});

describe('validateSelectedAttributes', () => {
  it('flags a missing required attribute', () => {
    const result = validateSelectedAttributes({
      productAttributes: [{ name: 'Taille', type: 'select', options: ['S', 'M'], required: true }],
      selectedAttributes: []
    });
    expect(result.valid).toBe(false);
    expect(result.missing).toContain('Taille');
  });

  it('normalizes a valid selection to the declared option casing', () => {
    const result = validateSelectedAttributes({
      productAttributes: [{ name: 'Taille', type: 'select', options: ['S', 'M'], required: true }],
      selectedAttributes: [{ name: 'taille', value: 's' }]
    });
    expect(result.valid).toBe(true);
    expect(result.selectedAttributes).toEqual([{ name: 'Taille', value: 'S' }]);
  });

  it('requires every selectable option group even without a required flag', () => {
    const result = validateSelectedAttributes({
      productAttributes: [{ name: 'Couleur', type: 'select', options: ['Noir', 'Blanc'] }],
      selectedAttributes: []
    });
    expect(result.valid).toBe(false);
    expect(result.missing).toContain('Couleur');
  });

  it('keeps optional free-form information optional', () => {
    const result = validateSelectedAttributes({
      productAttributes: [{ name: 'Gravure', type: 'text', required: false }],
      selectedAttributes: []
    });
    expect(result.valid).toBe(true);
  });
});
