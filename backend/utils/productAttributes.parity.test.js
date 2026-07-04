import { describe, expect, it } from 'vitest';
import * as backendAttrs from './productAttributes.js';
import * as frontendAttrs from '../../frontend/src/utils/productAttributes.js';

// backend/utils/productAttributes.js and frontend/src/utils/productAttributes.js
// are two hand-maintained implementations of the same pricing/variant rules —
// there is no shared package, so nothing stops them from silently disagreeing
// on what a buyer sees vs. what the server charges (see CLAUDE.md). This test
// runs both against identical fixtures and fails the moment they diverge,
// which is cheaper and safer right now than merging the two modules (the
// frontend file already has browser-only helpers the backend doesn't need,
// and importing a shared file into Vite's dev server requires opening its
// fs.allow beyond the frontend/ root).
//
// If this test fails: someone added/changed a rule on one side only. Fix the
// other side to match, don't loosen this test.

const productAttributes = [
  {
    name: 'Taille',
    type: 'select',
    options: ['S', 'M', 'XL'],
    required: true,
    optionPrices: { s: 10000, xl: 15000 }
  },
  {
    name: 'Couleur',
    type: 'select',
    options: ['Rouge', 'Noir'],
    optionImages: { rouge: 1, noir: 0 }
  }
];
const images = ['https://x/black.jpg', 'https://x/red.jpg'];

describe('backend/frontend productAttributes parity', () => {
  it('normalizeProductAttributes agrees on option prices/images', () => {
    const backendResult = backendAttrs.normalizeProductAttributes(productAttributes);
    const frontendResult = frontendAttrs.normalizeProductAttributes(productAttributes);
    expect(frontendResult.map((a) => a.optionPrices)).toEqual(backendResult.map((a) => a.optionPrices));
    expect(frontendResult.map((a) => a.optionImages)).toEqual(backendResult.map((a) => a.optionImages));
  });

  it.each([
    [{ name: 'Taille', value: 'S' }],
    [{ name: 'taille', value: 'xl' }], // case-insensitive
    [{ name: 'Taille', value: 'M' }], // no price on this option => base price
    []
  ])('resolveSelectedAttributesPrice agrees for selection %j', (selectedAttribute) => {
    const selectedAttributes = Array.isArray(selectedAttribute) ? selectedAttribute : [selectedAttribute];
    const args = { productAttributes, selectedAttributes, basePrice: 12000 };
    expect(frontendAttrs.resolveSelectedAttributesPrice(args)).toEqual(
      backendAttrs.resolveSelectedAttributesPrice(args)
    );
  });

  it.each([
    [{ name: 'Couleur', value: 'Rouge' }],
    [{ name: 'Couleur', value: 'Noir' }],
    []
  ])('resolveSelectedAttributesImage agrees for selection %j', (selectedAttribute) => {
    const selectedAttributes = Array.isArray(selectedAttribute) ? selectedAttribute : [selectedAttribute];
    const args = { productAttributes, selectedAttributes, images };
    expect(frontendAttrs.resolveSelectedAttributesImage(args)).toEqual(
      backendAttrs.resolveSelectedAttributesImage(args)
    );
  });

  it('buildSelectedAttributesSelectionKey agrees on cart-line identity', () => {
    const selected = [{ name: 'Couleur', value: 'Rouge' }, { name: 'Taille', value: 'XL' }];
    expect(frontendAttrs.buildSelectedAttributesSelectionKey(selected)).toBe(
      backendAttrs.buildSelectedAttributesSelectionKey(selected)
    );
  });
});
