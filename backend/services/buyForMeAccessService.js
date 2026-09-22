import mongoose from 'mongoose';
import Country from '../models/countryModel.js';
import DeliveryGuy from '../models/deliveryGuyModel.js';
import { canManageDeliveryRequests, getPlatformDeliveryRuntime } from './platformDeliveryService.js';

export const shoppingError = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode, status: statusCode });
export const shoppingId = value => String(value?._id || value || '');

export const shoppingAdminFilter = async (user, requestedCountry = '') => {
  if (!canManageDeliveryRequests(user, await getPlatformDeliveryRuntime())) throw shoppingError('Accès refusé.', 403);
  const selected = shoppingId(requestedCountry);
  if (selected && !mongoose.isValidObjectId(selected)) throw shoppingError('Pays invalide.');
  if (user.role === 'founder') return selected ? { countryId: new mongoose.Types.ObjectId(selected) } : {};
  const allowed = (user.adminCountryIds || []).map(shoppingId);
  if (user.role !== 'admin' && user.countryId) allowed.push(shoppingId(user.countryId));
  if (!allowed.length || (selected && !allowed.includes(selected))) throw shoppingError('Accès pays refusé.', 403);
  return { countryId: { $in: (selected ? [selected] : [...new Set(allowed)]).map(id => new mongoose.Types.ObjectId(id)) } };
};

export const shoppingConfigCountry = async (user, requestedCountry) => {
  const filter = await shoppingAdminFilter(user, requestedCountry);
  if (filter.countryId?.$in) {
    if (filter.countryId.$in.length !== 1) throw shoppingError('Sélectionnez le pays à configurer.');
    return filter.countryId.$in[0];
  }
  return filter.countryId || null; // Only the founder can change the global default.
};

export const eligibleShoppingDriver = async driverId => {
  const driver = await DeliveryGuy.findById(driverId).lean();
  if (!driver || driver.isActive === false || driver.buyForMeOptIn !== true || !driver.countryId) {
    throw shoppingError('Profil livreur actif, pays et accord pour les achats requis.', 403);
  }
  return driver;
};

export const assertShoppingCountry = async countryId => {
  const country = await Country.findById(countryId).lean();
  if (!country || country.currency?.code !== 'XAF') throw shoppingError('Ce service nécessite un pays configuré en FCFA XAF.', 409);
  return country;
};
