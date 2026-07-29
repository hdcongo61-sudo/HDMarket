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
import { getLocationProvider } from '../../modules/delivery/providers/index.js';

export const resolveLocationCoordinates = async (
  location = {},
  { enableLandmark = true, enableCommune = true } = {},
  pricingContext = null
) => {
  const provider = getLocationProvider();
  return provider.resolve(location, {
    enableLandmark,
    enableCommune,
    pricingContext
  });
};

// Re-exported so callers that only need the commune fallback (no full
// cascade) don't need to know about this module's internal wiring.
export { resolveCommuneCenter } from './CommuneResolver.js';
export { matchLandmark } from './LandmarkResolver.js';
