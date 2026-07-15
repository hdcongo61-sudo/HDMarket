import { describe, expect, it } from 'vitest';
import {
  normalizeProductAttributes,
  resolveSelectedAttributesImage,
  resolveSelectedAttributesPrice,
  validateSelectedAttributesForProduct
} from './productAttributes.js';

// This module decides what a buyer actually gets charged and which photo they
// see for a chosen variant (size/color) — regressions here are silent wrong
// prices, not crashes, so it's covered first.

describe('normalizeProductAttributes', () => {
  it('drops optionPrices/optionImages for options that were not declared', () => {
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

  it('rejects non-positive or non-finite prices', () => {
    const [attr] = normalizeProductAttributes([
      { name: 'Taille', type: 'select', options: ['S'], optionPrices: { s: -5 } }
    ]);
    expect(attr.optionPrices).toBeUndefined();
  });

  it('rejects out-of-range image indexes', () => {
    const [attr] = normalizeProductAttributes([
      { name: 'Couleur', type: 'select', options: ['Rouge'], optionImages: { rouge: 999 } }
    ]);
    expect(attr.optionImages).toBeUndefined();
  });

  it('only supports optionPrices/optionImages on select attributes', () => {
    const [attr] = normalizeProductAttributes([
      { name: 'Poids', type: 'number', options: [], optionPrices: { a: 100 } }
    ]);
    expect(attr.optionPrices).toBeUndefined();
  });
});

describe('resolveSelectedAttributesPrice', () => {
  const attrs = [
    {
      name: 'Taille',
      type: 'select',
      options: ['S', 'M', 'XL'],
      required: true,
      optionPrices: { s: 10000, xl: 15000 }
    }
  ];

  it('replaces the base price for a priced option (case-insensitive)', () => {
    expect(
      resolveSelectedAttributesPrice({
        productAttributes: attrs,
        selectedAttributes: [{ name: 'taille', value: 'S' }],
        basePrice: 12000
      })
    ).toEqual({ unitPrice: 10000, applied: true });

    expect(
      resolveSelectedAttributesPrice({
        productAttributes: attrs,
        selectedAttributes: [{ name: 'Taille', value: 'xl' }],
        basePrice: 12000
      })
    ).toEqual({ unitPrice: 15000, applied: true });
  });

  it('falls back to the base price for an option without a price', () => {
    expect(
      resolveSelectedAttributesPrice({
        productAttributes: attrs,
        selectedAttributes: [{ name: 'Taille', value: 'M' }],
        basePrice: 12000
      })
    ).toEqual({ unitPrice: 12000, applied: false });
  });

  it('falls back to the base price when nothing is selected', () => {
    expect(
      resolveSelectedAttributesPrice({ productAttributes: attrs, selectedAttributes: [], basePrice: 12000 })
    ).toEqual({ unitPrice: 12000, applied: false });
  });

  it('ignores prices on non-select attribute types entirely', () => {
    const numericAttrs = [{ name: 'Poids', type: 'number', options: [] }];
    expect(
      resolveSelectedAttributesPrice({
        productAttributes: numericAttrs,
        selectedAttributes: [{ name: 'Poids', value: '5' }],
        basePrice: 12000
      }).applied
    ).toBe(false);
  });
});

describe('resolveSelectedAttributesImage', () => {
  const attrs = [
    {
      name: 'Couleur',
      type: 'select',
      options: ['Rouge', 'Noir'],
      optionImages: { rouge: 1, noir: 0 }
    }
  ];
  const images = ['https://x/black.jpg', 'https://x/red.jpg'];

  it('resolves the linked image for the selected option', () => {
    expect(
      resolveSelectedAttributesImage({ productAttributes: attrs, selectedAttributes: [{ name: 'Couleur', value: 'Rouge' }], images })
    ).toEqual({ applied: true, imageIndex: 1, image: 'https://x/red.jpg' });
  });

  it('reports not-applied when no image is linked', () => {
    const result = resolveSelectedAttributesImage({ productAttributes: attrs, selectedAttributes: [], images });
    expect(result.applied).toBe(false);
    expect(result.image).toBeNull();
  });

  it('ignores an index that is now out of range (e.g. image was removed)', () => {
    const staleAttrs = [{ name: 'Couleur', type: 'select', options: ['Rouge'], optionImages: { rouge: 9 } }];
    expect(
      resolveSelectedAttributesImage({ productAttributes: staleAttrs, selectedAttributes: [{ name: 'Couleur', value: 'Rouge' }], images })
        .applied
    ).toBe(false);
  });
});

describe('validateSelectedAttributesForProduct', () => {
  it('rejects a missing required attribute', () => {
    const result = validateSelectedAttributesForProduct({
      productAttributes: [{ name: 'Taille', type: 'select', options: ['S', 'M'], required: true }],
      selectedAttributes: []
    });
    expect(result.valid).toBe(false);
  });

  it('rejects a value that is not a declared option', () => {
    const result = validateSelectedAttributesForProduct({
      productAttributes: [{ name: 'Taille', type: 'select', options: ['S', 'M'], required: true }],
      selectedAttributes: [{ name: 'Taille', value: 'XXL' }]
    });
    expect(result.valid).toBe(false);
  });

  it('accepts a valid selection and normalizes casing to the declared option', () => {
    const result = validateSelectedAttributesForProduct({
      productAttributes: [{ name: 'Taille', type: 'select', options: ['S', 'M'], required: true }],
      selectedAttributes: [{ name: 'taille', value: 's' }]
    });
    expect(result.valid).toBe(true);
    expect(result.selectedAttributes).toEqual([{ name: 'Taille', value: 'S' }]);
  });

  it('rejects an omitted selectable group even without a required flag', () => {
    const result = validateSelectedAttributesForProduct({
      productAttributes: [{ name: 'Couleur', type: 'select', options: ['Noir', 'Blanc'] }],
      selectedAttributes: []
    });
    expect(result.valid).toBe(false);
    expect(result.message).toContain('Couleur');
  });

  it('allows an omitted optional free-form attribute', () => {
    const result = validateSelectedAttributesForProduct({
      productAttributes: [{ name: 'Gravure', type: 'text', required: false }],
      selectedAttributes: []
    });
    expect(result.valid).toBe(true);
  });
});
