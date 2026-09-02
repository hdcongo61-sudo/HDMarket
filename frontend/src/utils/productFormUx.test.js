import { describe, expect, it } from 'vitest';
import {
  getInstallmentEndDate,
  getListingFeeChangePreview,
  getMissingProductFormFields
} from './productFormUx';

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

describe('installment end date', () => {
  it('adds the duration in days to the start date', () => {
    expect(getInstallmentEndDate('2026-09-01', 20)).toBe('2026-09-21');
  });

  it('rolls over month and year boundaries', () => {
    expect(getInstallmentEndDate('2026-09-28', 5)).toBe('2026-10-03');
    expect(getInstallmentEndDate('2026-12-30', 5)).toBe('2027-01-04');
  });

  it('spans a 30-day month exactly', () => {
    expect(getInstallmentEndDate('2026-09-01', 30)).toBe('2026-10-01');
  });

  it('returns empty when duration is missing or invalid', () => {
    expect(getInstallmentEndDate('2026-09-01', '')).toBe('');
    expect(getInstallmentEndDate('2026-09-01', 0)).toBe('');
    expect(getInstallmentEndDate('2026-09-01', -3)).toBe('');
  });

  it('returns empty when the start date is missing or unparseable', () => {
    expect(getInstallmentEndDate('', 20)).toBe('');
    expect(getInstallmentEndDate('not-a-date', 20)).toBe('');
  });
});
