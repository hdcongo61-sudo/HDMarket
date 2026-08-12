import { describe, expect, it } from 'vitest';
import { getListingFeeChangePreview, getMissingProductFormFields } from './productFormUx';

describe('ProductForm UX helpers', () => {
  it('returns the required fields in visual form order', () => {
    expect(getMissingProductFormFields({ title: 'Téléphone', price: 20000 })).toEqual([
      { name: 'description', label: 'Description détaillée', missing: true },
      { name: 'category', label: 'Catégorie', missing: true }
    ]);
  });

  it('shows no additional fee when the seller returns to the approved price', () => {
    expect(getListingFeeChangePreview({
      isEditing: true,
      approvedPrice: 100000,
      currentReferencePrice: 100000,
      currentRequiredFee: 3000,
      previouslyPaidFee: 3000,
      ratePercent: 3
    })).toMatchObject({ returnsToApprovedPrice: true, additionalFee: 0 });
  });

  it('shows only the commission difference for a price increase', () => {
    expect(getListingFeeChangePreview({
      isEditing: true,
      approvedPrice: 100000,
      currentReferencePrice: 150000,
      currentRequiredFee: 4500,
      previouslyPaidFee: 3000,
      ratePercent: 3
    })).toMatchObject({ returnsToApprovedPrice: false, additionalFee: 1500 });
  });
});
