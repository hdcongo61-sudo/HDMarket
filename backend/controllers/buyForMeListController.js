import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import List from '../models/buyForMeListModel.js';
import { resolveCountryContext } from '../services/countryService.js';
import { withCommerceOperation } from '../services/commerceOperationService.js';
import { STORE_TYPES } from '../services/buyForMeService.js';
import { shoppingError } from '../services/buyForMeAccessService.js';

const owner = req => req.user._id || req.user.id;
const text = (value, length) => String(value || '').trim().slice(0, length);
export const normalizeShoppingList = body => {
  const items = Array.isArray(body.items) ? body.items : [];
  if (!text(body.name, 80)) throw shoppingError('Donnez un nom à cette liste.');
  if (!STORE_TYPES.includes(body.storeType)) throw shoppingError('Choisissez un type de magasin.');
  if (!items.length || items.length > 30) throw shoppingError('Une liste contient entre 1 et 30 articles.');
  const normalized = items.map(item => ({ name: text(item?.name, 140), quantity: Number(item?.quantity),
    estimatedUnitPrice: Math.round(Number(item?.estimatedUnitPrice || 0)), note: text(item?.note, 300) }));
  if (normalized.some(item => !item.name || !Number.isFinite(item.quantity) || item.quantity < 0.001 || item.quantity > 10000 ||
    !Number.isFinite(item.estimatedUnitPrice) || item.estimatedUnitPrice < 0 || item.estimatedUnitPrice > 100000000)) throw shoppingError('Vérifiez le nom et la quantité de chaque article.');
  const shoppingBudget = Math.round(Number(body.shoppingBudget || 0));
  if (!Number.isFinite(shoppingBudget) || shoppingBudget < 0 || shoppingBudget > 100000000) throw shoppingError('Budget invalide.');
  return { name: text(body.name, 80), storeType: body.storeType, preferredStore: text(body.preferredStore, 140), items: normalized,
    authorizationMode: body.authorizationMode === 'ITEM_ESTIMATES' ? 'ITEM_ESTIMATES' : 'SHOPPING_BUDGET', shoppingBudget };
};

const scope = async req => {
  const context = await resolveCountryContext({ requestedCountry: req.headers?.['x-country-id'] || req.user.selectedCountryId || req.user.countryId, user: req.user });
  if (!context.countryId) throw shoppingError('Sélectionnez votre pays.');
  return { userId: owner(req), countryId: context.countryId };
};
const handle = work => asyncHandler(async (req, res) => {
  try { return await work(req, res); }
  catch (error) { const status = error.statusCode || error.status; if (status >= 400 && status < 500) return res.status(status).json({ message: error.message }); throw error; }
});

export const getShoppingLists = handle(async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  return res.json({ items: await List.find(await scope(req)).sort({ updatedAt: -1 }).limit(20).lean() });
});
export const getShoppingList = handle(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw shoppingError('Liste introuvable.', 404);
  const item = await List.findOne({ _id: req.params.id, ...await scope(req) }).lean();
  if (!item) throw shoppingError('Liste introuvable.', 404);
  res.set('Cache-Control', 'private, no-store');
  return res.json(item);
});
export const saveShoppingList = handle(async (req, res) => {
  const filter = await scope(req), data = normalizeShoppingList(req.body || {});
  const item = await withCommerceOperation(`shopping-lists:${owner(req)}`, async session => {
    if (await List.countDocuments(filter).session(session) >= 20) throw shoppingError('Vous avez déjà 20 listes. Supprimez une liste avant d’en ajouter une.', 409);
    const [saved] = await List.create([{ ...data, ...filter }], { session });
    return saved;
  });
  return res.status(201).json(item);
});
export const deleteShoppingList = handle(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw shoppingError('Liste introuvable.', 404);
  const item = await List.findOneAndDelete({ _id: req.params.id, ...await scope(req) });
  if (!item) throw shoppingError('Liste introuvable.', 404);
  return res.status(204).end();
});
