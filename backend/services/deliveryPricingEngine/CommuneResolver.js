/**
 * Commune Center fallback — used by LocationResolverService when neither GPS
 * nor a landmark match was available for a location.
 */
import Commune from '../../models/communeModel.js';

export const resolveCommuneCenter = async (communeId, pricingContext = null) => {
  if (!communeId) return null;
  const commune = pricingContext
    ? pricingContext.communes.find((entry) => String(entry._id) === String(communeId))
    : await Commune.findById(communeId).select('latitude longitude').lean();
  if (!commune || !Number.isFinite(commune.latitude) || !Number.isFinite(commune.longitude)) return null;
  return { lng: commune.longitude, lat: commune.latitude };
};

/** Resolves the DeliveryZone a commune belongs to, or null if unassigned. */
export const resolveCommuneZone = async (communeId, pricingContext = null) => {
  if (!communeId) return null;
  const commune = pricingContext
    ? pricingContext.communes.find((entry) => String(entry._id) === String(communeId))
    : await Commune.findById(communeId).select('zoneId').lean();
  return commune?.zoneId || null;
};
