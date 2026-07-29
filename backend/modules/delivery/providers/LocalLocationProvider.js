import City from '../../../models/cityModel.js';
import { getLandmarkById, matchLandmark } from '../../../services/deliveryPricingEngine/LandmarkResolver.js';
import { resolveCommuneCenter } from '../../../services/deliveryPricingEngine/CommuneResolver.js';
import LocationProvider from './LocationProvider.js';

const extractCoordinates = (geoPoint = null) => {
  const coordinates = Array.isArray(geoPoint?.coordinates) ? geoPoint.coordinates : null;
  if (!coordinates || coordinates.length !== 2) return null;
  const lng = Number(coordinates[0]);
  const lat = Number(coordinates[1]);
  return Number.isFinite(lng) && Number.isFinite(lat) ? { lng, lat } : null;
};

export default class LocalLocationProvider extends LocationProvider {
  async resolve(
    location = {},
    { enableLandmark = true, enableCommune = true, pricingContext = null } = {}
  ) {
    const gps = extractCoordinates(location?.coordinates);
    if (gps) {
      return { coordinates: gps, resolvedFrom: 'GPS', landmarkId: null, provider: 'LOCAL' };
    }

    if (enableLandmark) {
      const pickedLandmark = location?.landmarkId
        ? await getLandmarkById(location.landmarkId, pricingContext)
        : null;
      const landmarkMatch =
        pickedLandmark ||
        (location?.address && location?.cityId
          ? await matchLandmark({
              text: location.address,
              cityId: location.cityId,
              pricingContext
            })
          : null);

      if (landmarkMatch) {
        return {
          coordinates: {
            lng: Number(landmarkMatch.longitude),
            lat: Number(landmarkMatch.latitude)
          },
          resolvedFrom: 'LANDMARK',
          landmarkId: landmarkMatch._id,
          provider: 'LOCAL'
        };
      }
    }

    if (enableCommune && location?.communeId) {
      const communeCenter = await resolveCommuneCenter(location.communeId, pricingContext);
      if (communeCenter) {
        return {
          coordinates: communeCenter,
          resolvedFrom: 'COMMUNE',
          landmarkId: null,
          provider: 'LOCAL'
        };
      }
    }

    if (location?.cityId) {
      const city = pricingContext
        ? pricingContext.cities.find((entry) => String(entry._id) === String(location.cityId))
        : await City.findById(location.cityId).select('latitude longitude').lean();
      if (Number.isFinite(city?.latitude) && Number.isFinite(city?.longitude)) {
        return {
          coordinates: { lng: city.longitude, lat: city.latitude },
          resolvedFrom: 'CITY',
          landmarkId: null,
          provider: 'LOCAL'
        };
      }
    }

    return {
      coordinates: null,
      resolvedFrom: 'UNRESOLVED',
      landmarkId: null,
      provider: 'LOCAL'
    };
  }
}
