/**
 * Distance Adjustment — price per kilometer beyond the base price, once
 * both ends have resolved coordinates (from any tier of the location
 * resolution cascade, not necessarily raw GPS from the requester).
 */
import { haversineMeters } from '../../controllers/courierDeliveryController.js';

export const computeDistanceAdjustment = ({ pickupCoordinates, dropoffCoordinates, pricePerKm }) => {
  if (!pickupCoordinates || !dropoffCoordinates) {
    return { distanceMeters: null, amount: 0 };
  }
  const distanceMeters = haversineMeters(pickupCoordinates, dropoffCoordinates);
  if (!Number.isFinite(distanceMeters)) {
    return { distanceMeters: null, amount: 0 };
  }
  const amount = Math.max(0, Number(pricePerKm || 0)) * (distanceMeters / 1000);
  return { distanceMeters, amount };
};
