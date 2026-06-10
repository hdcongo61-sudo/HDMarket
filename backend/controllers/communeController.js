import asyncHandler from 'express-async-handler';
import Commune from '../models/communeModel.js';
import City from '../models/cityModel.js';

export const listCommunesAdmin = asyncHandler(async (req, res) => {
  const communes = await Commune.find()
    .sort({ order: 1, name: 1 })
    .lean();
  const cityIds = [...new Set(communes.map((c) => String(c.cityId)))];
  const cities = await City.find({ _id: { $in: cityIds } }).select('name').lean();
  const cityMap = new Map(cities.map((c) => [String(c._id), c.name]));

  const enriched = communes.map((c) => ({
    ...c,
    cityName: cityMap.get(String(c.cityId)) || ''
  }));

  res.json(enriched);
});

export const createCommuneAdmin = asyncHandler(async (req, res) => {
  const { name, cityId, deliveryPolicy, fixedFee, isActive, order } = req.body || {};

  const trimmedName = String(name || '').trim();
  if (!trimmedName) {
    return res.status(400).json({ message: 'Le nom de la commune est requis.' });
  }
  if (!cityId) {
    return res.status(400).json({ message: 'La ville est requise.' });
  }

  const city = await City.findById(cityId).lean();
  if (!city) {
    return res.status(400).json({ message: 'Ville introuvable.' });
  }

  const existing = await Commune.findOne({ cityId, name: { $regex: new RegExp(`^${trimmedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } });
  if (existing) {
    return res.status(409).json({ message: 'Cette commune existe déjà pour cette ville.' });
  }

  const commune = await Commune.create({
    name: trimmedName,
    cityId,
    deliveryPolicy: deliveryPolicy || 'DEFAULT_RULE',
    fixedFee: Math.max(0, Number(fixedFee || 0)),
    isActive: isActive !== false,
    order: Number.isFinite(Number(order)) ? Number(order) : 0,
    updatedBy: req.user?._id || null
  });

  res.status(201).json({ ...commune.toObject(), cityName: city.name });
});

export const updateCommuneAdmin = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const commune = await Commune.findById(id);
  if (!commune) {
    return res.status(404).json({ message: 'Commune introuvable.' });
  }

  const { name, cityId, deliveryPolicy, fixedFee, isActive, order } = req.body || {};

  if (name !== undefined) {
    const trimmed = String(name || '').trim();
    if (!trimmed) {
      return res.status(400).json({ message: 'Le nom de la commune est requis.' });
    }
    commune.name = trimmed;
  }
  if (cityId !== undefined) {
    const city = await City.findById(cityId).lean();
    if (!city) {
      return res.status(400).json({ message: 'Ville introuvable.' });
    }
    commune.cityId = cityId;
  }
  if (deliveryPolicy !== undefined) {
    commune.deliveryPolicy = deliveryPolicy;
  }
  if (fixedFee !== undefined) {
    commune.fixedFee = Math.max(0, Number(fixedFee || 0));
  }
  if (isActive !== undefined) {
    commune.isActive = Boolean(isActive);
  }
  if (order !== undefined) {
    commune.order = Number.isFinite(Number(order)) ? Number(order) : 0;
  }
  commune.updatedBy = req.user?._id || null;

  await commune.save();

  const city = await City.findById(commune.cityId).select('name').lean();
  res.json({ ...commune.toObject(), cityName: city?.name || '' });
});

export const deleteCommuneAdmin = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const commune = await Commune.findById(id);
  if (!commune) {
    return res.status(404).json({ message: 'Commune introuvable.' });
  }
  await commune.deleteOne();
  res.json({ success: true });
});
