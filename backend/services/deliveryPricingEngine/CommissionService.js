/**
 * Splits a finalized delivery price between the platform and the courier.
 * This runs AFTER the customer-facing price is computed (DeliveryPricingEngine) —
 * it doesn't change what the customer pays, only how that amount is divided.
 */
import { getRuntimeConfig } from '../configService.js';

export const splitDeliveryCommission = async (deliveryPrice) => {
  const commissionPercent = Math.max(
    0,
    Math.min(100, Number(await getRuntimeConfig('parcel_delivery_platform_commission_percent', { fallback: 15 })))
  );
  const price = Math.max(0, Number(deliveryPrice || 0));
  const platformCommission = Math.round((price * commissionPercent) / 100);
  const courierEarning = Math.max(0, price - platformCommission);
  return { platformCommission, courierEarning, commissionPercent };
};
