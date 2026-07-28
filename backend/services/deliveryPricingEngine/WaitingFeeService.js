/**
 * Waiting Fee — charged per minute the courier waits at pickup/dropoff
 * beyond the free allowance. At initial price-estimate time no waiting has
 * happened yet (waitingMinutes defaults to 0, contributing nothing); this
 * is invoked again once the courier logs actual waiting time.
 */
import { getManyRuntimeConfigs } from '../configService.js';

export const computeWaitingFee = async (waitingMinutes = 0) => {
  const settings = await getManyRuntimeConfigs([
    'parcel_pricing_waiting_fee_per_minute',
    'parcel_pricing_free_waiting_minutes'
  ]);
  const freeMinutes = Math.max(0, Number(settings.parcel_pricing_free_waiting_minutes || 0));
  const perMinute = Math.max(0, Number(settings.parcel_pricing_waiting_fee_per_minute || 0));
  const billableMinutes = Math.max(0, Number(waitingMinutes || 0) - freeMinutes);
  return { amount: Math.round(billableMinutes * perMinute), billableMinutes };
};
