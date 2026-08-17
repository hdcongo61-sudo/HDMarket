import asyncHandler from 'express-async-handler';
import City from '../models/cityModel.js';
import { invalidatePricingContext } from '../modules/delivery/cache/PricingContextCache.js';
import { canAdminCountry, ensureDefaultCountry, findCountry } from '../services/countryService.js';

export const listCitiesAdmin = asyncHandler(async (req, res) => {
  const country = req.query?.countryId ? await findCountry(req.query.countryId) : null;
  if (country && !canAdminCountry(country, req.user)) return res.status(403).json({ message: 'Accès pays refusé.' });
  const cities = await City.find(country ? { countryId: country._id } : {})
    .sort({ order: 1, name: 1 })
    .lean();
  res.json(cities);
});

export const createCityAdmin = asyncHandler(async (req, res) => {
  const { name, countryId, regionName, isActive, isDefault, order, deliveryAvailable, boostMultiplier, latitude, longitude } = req.body || {};
  const country = countryId ? await findCountry(countryId) : await ensureDefaultCountry();
  if (!country) return res.status(400).json({ message: 'Pays introuvable.' });
  if (!canAdminCountry(country, req.user)) return res.status(403).json({ message: 'Accès pays refusé.' });

  const trimmedName = String(name || '').trim();
  if (!trimmedName) {
    return res.status(400).json({ message: 'Le nom de la ville est requis.' });
  }

  const existing = await City.findOne({ countryId: country._id, name: { $regex: new RegExp(`^${trimmedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } });
  if (existing) {
    return res.status(409).json({ message: 'Cette ville existe déjà.' });
  }

  // If setting this as default, unset other defaults
  if (isDefault) {
    await City.updateMany({ countryId: country._id, isDefault: true }, { isDefault: false });
  }

  const city = await City.create({
    name: trimmedName,
    countryId: country._id,
    regionName: String(regionName || '').trim(),
    isActive: isActive !== false,
    isDefault: Boolean(isDefault),
    order: Number.isFinite(Number(order)) ? Number(order) : 0,
    deliveryAvailable: deliveryAvailable !== false,
    boostMultiplier: Math.max(0, Number(boostMultiplier || 1)),
    latitude: Number.isFinite(Number(latitude)) ? Number(latitude) : null,
    longitude: Number.isFinite(Number(longitude)) ? Number(longitude) : null,
    updatedBy: req.user?._id || null
  });

  await invalidatePricingContext();
  res.status(201).json(city);
});

export const updateCityAdmin = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const city = await City.findById(id);
  if (!city) {
    return res.status(404).json({ message: 'Ville introuvable.' });
  }

  const { name, regionName, isActive, isDefault, order, deliveryAvailable, boostMultiplier, latitude, longitude } = req.body || {};

  if (order !== undefined && (!Number.isFinite(Number(order)) || Number(order) < 0)) {
    return res.status(400).json({ message: 'L’ordre doit être positif ou égal à zéro.' });
  }
  if (
    boostMultiplier !== undefined &&
    (!Number.isFinite(Number(boostMultiplier)) || Number(boostMultiplier) < 0)
  ) {
    return res.status(400).json({
      message: 'Le multiplicateur boost doit être positif ou égal à zéro.'
    });
  }

  if (name !== undefined) {
    const trimmed = String(name || '').trim();
    if (!trimmed) {
      return res.status(400).json({ message: 'Le nom de la ville est requis.' });
    }
    const existing = await City.findOne({
      _id: { $ne: id },
      countryId: city.countryId,
      name: { $regex: new RegExp(`^${trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
    });
    if (existing) {
      return res.status(409).json({ message: 'Cette ville existe déjà.' });
    }
    city.name = trimmed;
  }
  if (isActive !== undefined) city.isActive = Boolean(isActive);
  if (isDefault !== undefined) {
    if (isDefault) {
      await City.updateMany({ _id: { $ne: id }, countryId: city.countryId, isDefault: true }, { isDefault: false });
    }
    city.isDefault = Boolean(isDefault);
  }
  if (order !== undefined) city.order = Number(order);
  if (deliveryAvailable !== undefined) city.deliveryAvailable = Boolean(deliveryAvailable);
  if (boostMultiplier !== undefined) city.boostMultiplier = Number(boostMultiplier);
  if (latitude !== undefined) city.latitude = latitude === null || latitude === '' ? null : Number(latitude);
  if (longitude !== undefined) city.longitude = longitude === null || longitude === '' ? null : Number(longitude);
  if (regionName !== undefined) city.regionName = String(regionName || '').trim();
  city.updatedBy = req.user?._id || null;

  await city.save();
  await invalidatePricingContext();
  res.json(city);
});

export const deleteCityAdmin = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const city = await City.findById(id);
  if (!city) {
    return res.status(404).json({ message: 'Ville introuvable.' });
  }
  await city.deleteOne();
  await invalidatePricingContext();
  res.json({ success: true });
});
