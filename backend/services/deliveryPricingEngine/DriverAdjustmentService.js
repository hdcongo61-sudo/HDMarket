/**
 * Validates a courier's requested price adjustment against the admin's
 * configured cap (e.g. "bad road, +500 CFA"). Pure validation — persisting
 * the request/approval onto the ParcelRequest document is handled by
 * parcelRequestService.js, which owns that document's lifecycle.
 */
import { getRuntimeConfig } from '../configService.js';

export const validatePriceAdjustment = async ({ estimatedPrice, amount }) => {
  const maxPercent = Math.max(0, Number(
    await getRuntimeConfig('parcel_pricing_max_driver_adjustment_percent', { fallback: 20 })
  ));
  const maxAllowedAmount = Math.round((Number(estimatedPrice || 0) * maxPercent) / 100);
  const requestedAmount = Number(amount || 0);

  if (requestedAmount === 0) {
    return { allowed: false, reason: 'Le montant de l’ajustement ne peut pas être nul.', maxAllowedAmount };
  }
  if (Math.abs(requestedAmount) > maxAllowedAmount) {
    return {
      allowed: false,
      reason: `L’ajustement ne peut pas dépasser ${maxPercent}% du prix estimé (${maxAllowedAmount} CFA).`,
      maxAllowedAmount
    };
  }
  return { allowed: true, reason: '', maxAllowedAmount, finalPrice: Math.max(0, Number(estimatedPrice || 0) + requestedAmount) };
};
