import { describe, expect, it } from 'vitest';
import { getLowestProductPrice } from './productDisplayPrice.js';

describe('getLowestProductPrice', () => {
  it('uses the lowest price among photo-linked options', () => {
    expect(getLowestProductPrice({
      basePrice: 90000,
      productAttributes: [{
        name: 'Modèle',
        type: 'select',
        options: ['Base', 'Miroir'],
        optionImages: { base: 0, miroir: 1 },
        optionPrices: { miroir: 45000 }
      }]
    })).toBe(45000);
  });

  it('falls back to the product price when options have no linked price', () => {
    expect(getLowestProductPrice({
      basePrice: 90000,
      productAttributes: [{
        name: 'Couleur',
        type: 'select',
        options: ['Noir'],
        optionImages: { noir: 0 }
      }]
    })).toBe(90000);
  });
});

