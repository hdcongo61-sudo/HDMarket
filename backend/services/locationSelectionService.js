import mongoose from 'mongoose';
import City from '../models/cityModel.js';
import Commune from '../models/communeModel.js';

const clean = (value = '') => String(value || '').trim();
const escapeRegex = (value = '') => clean(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const exactName = (value = '') => new RegExp(`^${escapeRegex(value)}$`, 'i');

const locationError = (message, code) => {
  const error = new Error(message);
  error.statusCode = 400;
  error.code = code;
  return error;
};

/**
 * Resolves a city/commune against the single admin-managed location catalogue.
 * Names remain accepted for older clients, while new clients should send IDs.
 */
export const resolveCanonicalLocation = async ({
  cityId = '',
  communeId = '',
  cityName = '',
  communeName = '',
  countryId = null,
  allowLegacyCountryFallback = false,
  requireCommuneWhenConfigured = true
} = {}) => {
  const normalizedCityId = clean(cityId);
  const normalizedCommuneId = clean(communeId);
  const normalizedCityName = clean(cityName);
  const normalizedCommuneName = clean(communeName);

  const countryFilter = countryId
    ? allowLegacyCountryFallback
      ? { $or: [{ countryId }, { countryId: null }, { countryId: { $exists: false } }] }
      : { countryId }
    : {};
  const city =
    normalizedCityId && mongoose.isValidObjectId(normalizedCityId)
      ? await City.findOne({ _id: normalizedCityId, isActive: true, ...countryFilter }).lean()
      : normalizedCityName
        ? await City.findOne({ name: exactName(normalizedCityName), isActive: true, ...countryFilter }).lean()
        : null;

  if (!city) {
    throw locationError('Sélectionnez une ville disponible.', 'CITY_NOT_AVAILABLE');
  }

  const commune =
    normalizedCommuneId && mongoose.isValidObjectId(normalizedCommuneId)
      ? await Commune.findOne({ _id: normalizedCommuneId, cityId: city._id, isActive: true }).lean()
      : normalizedCommuneName
        ? await Commune.findOne({
            cityId: city._id,
            name: exactName(normalizedCommuneName),
            isActive: true
          }).lean()
        : null;

  if ((normalizedCommuneId || normalizedCommuneName) && !commune) {
    throw locationError(
      'La commune sélectionnée ne correspond pas à la ville.',
      'COMMUNE_NOT_AVAILABLE'
    );
  }

  if (!commune && requireCommuneWhenConfigured) {
    const hasConfiguredCommunes = await Commune.exists({ cityId: city._id, isActive: true });
    if (hasConfiguredCommunes) {
      throw locationError('Sélectionnez une commune disponible.', 'COMMUNE_REQUIRED');
    }
  }

  return {
    cityId: city._id,
    cityName: city.name,
    communeId: commune?._id || null,
    communeName: commune?.name || ''
  };
};
