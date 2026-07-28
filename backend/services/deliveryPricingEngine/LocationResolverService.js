/**
 * Resolves pickup/dropoff GPS coordinates in priority order so every parcel
 * request gets a price, even without GPS:
 *   1) GPS coordinates already captured on the location
 *   2) A landmark — either explicitly picked from the form's autocomplete
 *      (looked up by ID server-side, never trusting client-supplied
 *      coordinates for it) or matched from the free-text address
 *      ("Near Total Station")
 *   3) The commune's center coordinates
 *   4) The city's center coordinates
 * Returns { coordinates: {lng,lat} | null, resolvedFrom, landmarkId }.
 */
import City from '../../models/cityModel.js';
import { extractLngLatFromGeoPoint } from '../../controllers/courierDeliveryController.js';
import { matchLandmark, getLandmarkById } from './LandmarkResolver.js';
import { resolveCommuneCenter } from './CommuneResolver.js';

export const resolveLocationCoordinates = async (location = {}, { enableLandmark = true, enableCommune = true } = {}) => {
  const gps = extractLngLatFromGeoPoint(location?.coordinates);
  if (gps) {
    return { coordinates: gps, resolvedFrom: 'GPS', landmarkId: null };
  }

  if (enableLandmark) {
    const pickedLandmark = location?.landmarkId ? await getLandmarkById(location.landmarkId) : null;
    const landmarkMatch =
      pickedLandmark || (location?.address && location?.cityId
        ? await matchLandmark({ text: location.address, cityId: location.cityId })
        : null);
    if (landmarkMatch) {
      return {
        coordinates: { lng: landmarkMatch.longitude, lat: landmarkMatch.latitude },
        resolvedFrom: 'LANDMARK',
        landmarkId: landmarkMatch._id
      };
    }
  }

  if (enableCommune && location?.communeId) {
    const communeCenter = await resolveCommuneCenter(location.communeId);
    if (communeCenter) {
      return { coordinates: communeCenter, resolvedFrom: 'COMMUNE', landmarkId: null };
    }
  }

  if (location?.cityId) {
    const city = await City.findById(location.cityId).select('latitude longitude').lean();
    if (Number.isFinite(city?.latitude) && Number.isFinite(city?.longitude)) {
      return { coordinates: { lng: city.longitude, lat: city.latitude }, resolvedFrom: 'CITY', landmarkId: null };
    }
  }

  return { coordinates: null, resolvedFrom: 'UNRESOLVED', landmarkId: null };
};

// Re-exported so callers that only need the commune fallback (no full
// cascade) don't need to know about this module's internal wiring.
export { resolveCommuneCenter } from './CommuneResolver.js';
export { matchLandmark } from './LandmarkResolver.js';
