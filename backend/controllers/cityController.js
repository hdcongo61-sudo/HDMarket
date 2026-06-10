import asyncHandler from 'express-async-handler';
import City from '../models/cityModel.js';

export const listCitiesAdmin = asyncHandler(async (req, res) => {
  const cities = await City.find()
    .sort({ order: 1, name: 1 })
    .lean();
  res.json(cities);
});

export const createCityAdmin = asyncHandler(async (req, res) => {
  const { name, isActive, isDefault, order, deliveryAvailable, boostMultiplier } = req.body || {};

  const trimmedName = String(name || '').trim();
  if (!trimmedName) {
    return res.status(400).json({ message: 'Le nom de la ville est requis.' });
  }

  const existing = await City.findOne({ name: { $regex: new RegExp(`^${trimmedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } });
  if (existing) {
    return res.status(409).json({ message: 'Cette ville existe déjà.' });
  }

  // If setting this as default, unset other defaults
  if (isDefault) {
    await City.updateMany({ isDefault: true }, { isDefault: false });
  }

  const city = await City.create({
    name: trimmedName,
    isActive: isActive !== false,
    isDefault: Boolean(isDefault),
    order: Number.isFinite(Number(order)) ? Number(order) : 0,
    deliveryAvailable: deliveryAvailable !== false,
    boostMultiplier: Math.max(0, Number(boostMultiplier || 1)),
    updatedBy: req.user?._id || null
  });

  res.status(201).json(city);
});

export const updateCityAdmin = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const city = await City.findById(id);
  if (!city) {
    return res.status(404).json({ message: 'Ville introuvable.' });
  }

  const { name, isActive, isDefault, order, deliveryAvailable, boostMultiplier } = req.body || {};

  if (name !== undefined) {
    const trimmed = String(name || '').trim();
    if (!trimmed) {
      return res.status(400).json({ message: 'Le nom de la ville est requis.' });
    }
    const existing = await City.findOne({
      _id: { $ne: id },
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
      await City.updateMany({ _id: { $ne: id }, isDefault: true }, { isDefault: false });
    }
    city.isDefault = Boolean(isDefault);
  }
  if (order !== undefined) city.order = Number.isFinite(Number(order)) ? Number(order) : 0;
  if (deliveryAvailable !== undefined) city.deliveryAvailable = Boolean(deliveryAvailable);
  if (boostMultiplier !== undefined) city.boostMultiplier = Math.max(0, Number(boostMultiplier || 1));
  city.updatedBy = req.user?._id || null;

  await city.save();
  res.json(city);
});

export const deleteCityAdmin = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const city = await City.findById(id);
  if (!city) {
    return res.status(404).json({ message: 'Ville introuvable.' });
  }
  await city.deleteOne();
  res.json({ success: true });
});
