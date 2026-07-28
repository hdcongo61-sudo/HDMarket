/**
 * Base Zone Price — the pricing engine's starting point when both pickup
 * and dropoff communes are assigned to a delivery zone and an admin has
 * configured a price for that zone pair (see deliveryZonePriceModel.js).
 * Falls back to null when zones aren't configured, letting the caller use
 * the legacy same-commune/cross-commune flat rate instead.
 */
import DeliveryZonePrice from '../../models/deliveryZonePriceModel.js';
import { resolveCommuneZone } from './CommuneResolver.js';

export const resolveZoneBasePrice = async ({ pickupCommuneId, dropoffCommuneId }) => {
  const [fromZoneId, toZoneId] = await Promise.all([
    resolveCommuneZone(pickupCommuneId),
    resolveCommuneZone(dropoffCommuneId)
  ]);
  if (!fromZoneId || !toZoneId) return null;

  const exact = await DeliveryZonePrice.findOne({ fromZoneId, toZoneId, isActive: true }).lean();
  if (exact) return { price: Number(exact.price || 0), fromZoneId, toZoneId };

  // Zone pricing is usually symmetric — don't force admins to double-enter
  // both directions unless they actually want asymmetric pricing.
  const reversed = await DeliveryZonePrice.findOne({
    fromZoneId: toZoneId,
    toZoneId: fromZoneId,
    isActive: true
  }).lean();
  if (reversed) return { price: Number(reversed.price || 0), fromZoneId, toZoneId };

  return null;
};
