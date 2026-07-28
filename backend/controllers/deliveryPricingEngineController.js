/**
 * Admin CRUD for the parcel pricing engine's configurable resources (zones,
 * zone-price matrix, landmarks, package types, weight rules, delivery speed
 * rules, peak hours, promotions) — plus the two shop-facing lookups the
 * request form needs (active options, landmark search). Kept thin: each
 * resource is simple config data with no cross-cutting business logic, so
 * — like communeController.js/cityController.js — the DB calls live here
 * directly rather than behind an extra service layer.
 */
import asyncHandler from 'express-async-handler';
import DeliveryZone from '../models/deliveryZoneModel.js';
import DeliveryZonePrice from '../models/deliveryZonePriceModel.js';
import Landmark from '../models/landmarkModel.js';
import PackageType from '../models/packageTypeModel.js';
import WeightRule from '../models/weightRuleModel.js';
import DeliverySpeedRule from '../models/deliverySpeedRuleModel.js';
import PeakHourRule from '../models/peakHourRuleModel.js';
import DeliveryPromotion from '../models/deliveryPromotionModel.js';
import { searchLandmarksByText } from '../services/deliveryPricingEngine/LandmarkResolver.js';

const notFound = (res, message) => res.status(404).json({ message });

// ─── Zones ──────────────────────────────────────────────────
export const listZonesAdmin = asyncHandler(async (_req, res) => {
  res.json(await DeliveryZone.find().sort({ order: 1, name: 1 }).lean());
});

export const createZoneAdmin = asyncHandler(async (req, res) => {
  const name = String(req.body?.name || '').trim();
  if (!name) return res.status(400).json({ message: 'Le nom de la zone est requis.' });
  const zone = await DeliveryZone.create({
    name,
    color: req.body?.color || '#e85d00',
    order: Number(req.body?.order) || 0,
    isActive: req.body?.isActive !== false,
    updatedBy: req.user?._id || null
  });
  res.status(201).json(zone);
});

export const updateZoneAdmin = asyncHandler(async (req, res) => {
  const zone = await DeliveryZone.findById(req.params.id);
  if (!zone) return notFound(res, 'Zone introuvable.');
  const { name, color, order, isActive } = req.body || {};
  if (name !== undefined) zone.name = String(name).trim();
  if (color !== undefined) zone.color = color;
  if (order !== undefined) zone.order = Number(order) || 0;
  if (isActive !== undefined) zone.isActive = Boolean(isActive);
  zone.updatedBy = req.user?._id || null;
  await zone.save();
  res.json(zone);
});

export const deleteZoneAdmin = asyncHandler(async (req, res) => {
  const zone = await DeliveryZone.findById(req.params.id);
  if (!zone) return notFound(res, 'Zone introuvable.');
  await zone.deleteOne();
  res.json({ success: true });
});

// ─── Zone Price Matrix ──────────────────────────────────────
export const listZonePricesAdmin = asyncHandler(async (_req, res) => {
  const items = await DeliveryZonePrice.find()
    .populate('fromZoneId', 'name')
    .populate('toZoneId', 'name')
    .sort({ createdAt: -1 })
    .lean();
  res.json(items);
});

export const upsertZonePriceAdmin = asyncHandler(async (req, res) => {
  const { fromZoneId, toZoneId, price } = req.body || {};
  if (!fromZoneId || !toZoneId) {
    return res.status(400).json({ message: 'Les deux zones sont requises.' });
  }
  if (!Number.isFinite(Number(price)) || Number(price) < 0) {
    return res.status(400).json({ message: 'Le prix doit être un nombre positif.' });
  }
  const entry = await DeliveryZonePrice.findOneAndUpdate(
    { fromZoneId, toZoneId },
    { $set: { price: Number(price), isActive: true, updatedBy: req.user?._id || null } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  res.json(entry);
});

export const deleteZonePriceAdmin = asyncHandler(async (req, res) => {
  const entry = await DeliveryZonePrice.findById(req.params.id);
  if (!entry) return notFound(res, 'Tarif introuvable.');
  await entry.deleteOne();
  res.json({ success: true });
});

// ─── Landmarks ──────────────────────────────────────────────
export const listLandmarksAdmin = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query?.cityId) filter.cityId = req.query.cityId;
  const items = await Landmark.find(filter)
    .populate('cityId', 'name')
    .populate('communeId', 'name')
    .sort({ name: 1 })
    .lean();
  res.json(items);
});

export const createLandmarkAdmin = asyncHandler(async (req, res) => {
  const { name, cityId, communeId, latitude, longitude, aliases, description, status } = req.body || {};
  if (!String(name || '').trim()) return res.status(400).json({ message: 'Le nom est requis.' });
  if (!cityId) return res.status(400).json({ message: 'La ville est requise.' });
  if (!Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) {
    return res.status(400).json({ message: 'Coordonnées GPS requises.' });
  }
  const landmark = await Landmark.create({
    name: String(name).trim(),
    cityId,
    communeId: communeId || null,
    latitude: Number(latitude),
    longitude: Number(longitude),
    aliases: Array.isArray(aliases) ? aliases : String(aliases || '').split(',').map((a) => a.trim()).filter(Boolean),
    description: description || '',
    status: status || 'ACTIVE',
    updatedBy: req.user?._id || null
  });
  res.status(201).json(landmark);
});

export const updateLandmarkAdmin = asyncHandler(async (req, res) => {
  const landmark = await Landmark.findById(req.params.id);
  if (!landmark) return notFound(res, 'Point de repère introuvable.');
  const { name, cityId, communeId, latitude, longitude, aliases, description, status } = req.body || {};
  if (name !== undefined) landmark.name = String(name).trim();
  if (cityId !== undefined) landmark.cityId = cityId;
  if (communeId !== undefined) landmark.communeId = communeId || null;
  if (latitude !== undefined) landmark.latitude = Number(latitude);
  if (longitude !== undefined) landmark.longitude = Number(longitude);
  if (aliases !== undefined) {
    landmark.aliases = Array.isArray(aliases) ? aliases : String(aliases || '').split(',').map((a) => a.trim()).filter(Boolean);
  }
  if (description !== undefined) landmark.description = description;
  if (status !== undefined) landmark.status = status;
  landmark.updatedBy = req.user?._id || null;
  await landmark.save();
  res.json(landmark);
});

export const deleteLandmarkAdmin = asyncHandler(async (req, res) => {
  const landmark = await Landmark.findById(req.params.id);
  if (!landmark) return notFound(res, 'Point de repère introuvable.');
  await landmark.deleteOne();
  res.json({ success: true });
});

// ─── Package Types ──────────────────────────────────────────
export const listPackageTypesAdmin = asyncHandler(async (_req, res) => {
  res.json(await PackageType.find().sort({ order: 1, name: 1 }).lean());
});

export const createPackageTypeAdmin = asyncHandler(async (req, res) => {
  const { name, extraPrice, priority, specialNotes, isActive, order } = req.body || {};
  if (!String(name || '').trim()) return res.status(400).json({ message: 'Le nom est requis.' });
  const packageType = await PackageType.create({
    name: String(name).trim(),
    extraPrice: Math.max(0, Number(extraPrice) || 0),
    priority: Math.max(0, Number(priority) || 0),
    specialNotes: specialNotes || '',
    isActive: isActive !== false,
    order: Number(order) || 0,
    updatedBy: req.user?._id || null
  });
  res.status(201).json(packageType);
});

export const updatePackageTypeAdmin = asyncHandler(async (req, res) => {
  const packageType = await PackageType.findById(req.params.id);
  if (!packageType) return notFound(res, 'Type de colis introuvable.');
  const { name, extraPrice, priority, specialNotes, isActive, order } = req.body || {};
  if (name !== undefined) packageType.name = String(name).trim();
  if (extraPrice !== undefined) packageType.extraPrice = Math.max(0, Number(extraPrice) || 0);
  if (priority !== undefined) packageType.priority = Math.max(0, Number(priority) || 0);
  if (specialNotes !== undefined) packageType.specialNotes = specialNotes;
  if (isActive !== undefined) packageType.isActive = Boolean(isActive);
  if (order !== undefined) packageType.order = Number(order) || 0;
  packageType.updatedBy = req.user?._id || null;
  await packageType.save();
  res.json(packageType);
});

export const deletePackageTypeAdmin = asyncHandler(async (req, res) => {
  const packageType = await PackageType.findById(req.params.id);
  if (!packageType) return notFound(res, 'Type de colis introuvable.');
  await packageType.deleteOne();
  res.json({ success: true });
});

// ─── Weight Rules ───────────────────────────────────────────
export const listWeightRulesAdmin = asyncHandler(async (_req, res) => {
  res.json(await WeightRule.find().sort({ minKg: 1 }).lean());
});

export const createWeightRuleAdmin = asyncHandler(async (req, res) => {
  const { minKg, maxKg, mode, multiplier, fixedExtra, isActive } = req.body || {};
  try {
    const rule = await WeightRule.create({
      minKg: Number(minKg),
      maxKg: Number(maxKg),
      mode: mode || 'FIXED_EXTRA',
      multiplier: Math.max(0, Number(multiplier) || 1),
      fixedExtra: Math.max(0, Number(fixedExtra) || 0),
      isActive: isActive !== false,
      updatedBy: req.user?._id || null
    });
    res.status(201).json(rule);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

export const updateWeightRuleAdmin = asyncHandler(async (req, res) => {
  const rule = await WeightRule.findById(req.params.id);
  if (!rule) return notFound(res, 'Règle de poids introuvable.');
  const { minKg, maxKg, mode, multiplier, fixedExtra, isActive } = req.body || {};
  if (minKg !== undefined) rule.minKg = Number(minKg);
  if (maxKg !== undefined) rule.maxKg = Number(maxKg);
  if (mode !== undefined) rule.mode = mode;
  if (multiplier !== undefined) rule.multiplier = Math.max(0, Number(multiplier) || 1);
  if (fixedExtra !== undefined) rule.fixedExtra = Math.max(0, Number(fixedExtra) || 0);
  if (isActive !== undefined) rule.isActive = Boolean(isActive);
  rule.updatedBy = req.user?._id || null;
  try {
    await rule.save();
    res.json(rule);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

export const deleteWeightRuleAdmin = asyncHandler(async (req, res) => {
  const rule = await WeightRule.findById(req.params.id);
  if (!rule) return notFound(res, 'Règle de poids introuvable.');
  await rule.deleteOne();
  res.json({ success: true });
});

// ─── Delivery Speed Rules ───────────────────────────────────
export const listSpeedRulesAdmin = asyncHandler(async (_req, res) => {
  res.json(await DeliverySpeedRule.find().sort({ order: 1 }).lean());
});

export const createSpeedRuleAdmin = asyncHandler(async (req, res) => {
  const { key, label, extraPrice, etaMinutes, isActive, order } = req.body || {};
  if (!String(key || '').trim() || !String(label || '').trim()) {
    return res.status(400).json({ message: 'Clé et libellé requis.' });
  }
  const rule = await DeliverySpeedRule.create({
    key: String(key).trim(),
    label: String(label).trim(),
    extraPrice: Math.max(0, Number(extraPrice) || 0),
    etaMinutes: Math.max(0, Number(etaMinutes) || 60),
    isActive: isActive !== false,
    order: Number(order) || 0,
    updatedBy: req.user?._id || null
  });
  res.status(201).json(rule);
});

export const updateSpeedRuleAdmin = asyncHandler(async (req, res) => {
  const rule = await DeliverySpeedRule.findById(req.params.id);
  if (!rule) return notFound(res, 'Règle de vitesse introuvable.');
  const { label, extraPrice, etaMinutes, isActive, order } = req.body || {};
  if (label !== undefined) rule.label = String(label).trim();
  if (extraPrice !== undefined) rule.extraPrice = Math.max(0, Number(extraPrice) || 0);
  if (etaMinutes !== undefined) rule.etaMinutes = Math.max(0, Number(etaMinutes) || 0);
  if (isActive !== undefined) rule.isActive = Boolean(isActive);
  if (order !== undefined) rule.order = Number(order) || 0;
  rule.updatedBy = req.user?._id || null;
  await rule.save();
  res.json(rule);
});

export const deleteSpeedRuleAdmin = asyncHandler(async (req, res) => {
  const rule = await DeliverySpeedRule.findById(req.params.id);
  if (!rule) return notFound(res, 'Règle de vitesse introuvable.');
  await rule.deleteOne();
  res.json({ success: true });
});

// ─── Peak Hour Rules ────────────────────────────────────────
export const listPeakHoursAdmin = asyncHandler(async (_req, res) => {
  res.json(await PeakHourRule.find().sort({ order: 1 }).lean());
});

export const createPeakHourAdmin = asyncHandler(async (req, res) => {
  const { name, daysOfWeek, startTime, endTime, surchargeType, surchargeValue, isActive, order } = req.body || {};
  if (!String(name || '').trim()) return res.status(400).json({ message: 'Le nom est requis.' });
  try {
    const rule = await PeakHourRule.create({
      name: String(name).trim(),
      daysOfWeek: Array.isArray(daysOfWeek) ? daysOfWeek : undefined,
      startTime: startTime || '',
      endTime: endTime || '',
      surchargeType: surchargeType || 'PERCENT',
      surchargeValue: Math.max(0, Number(surchargeValue) || 0),
      isActive: isActive !== false,
      order: Number(order) || 0,
      updatedBy: req.user?._id || null
    });
    res.status(201).json(rule);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

export const updatePeakHourAdmin = asyncHandler(async (req, res) => {
  const rule = await PeakHourRule.findById(req.params.id);
  if (!rule) return notFound(res, 'Règle d’heure de pointe introuvable.');
  const { name, daysOfWeek, startTime, endTime, surchargeType, surchargeValue, isActive, order } = req.body || {};
  if (name !== undefined) rule.name = String(name).trim();
  if (daysOfWeek !== undefined) rule.daysOfWeek = daysOfWeek;
  if (startTime !== undefined) rule.startTime = startTime;
  if (endTime !== undefined) rule.endTime = endTime;
  if (surchargeType !== undefined) rule.surchargeType = surchargeType;
  if (surchargeValue !== undefined) rule.surchargeValue = Math.max(0, Number(surchargeValue) || 0);
  if (isActive !== undefined) rule.isActive = Boolean(isActive);
  if (order !== undefined) rule.order = Number(order) || 0;
  rule.updatedBy = req.user?._id || null;
  try {
    await rule.save();
    res.json(rule);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

export const deletePeakHourAdmin = asyncHandler(async (req, res) => {
  const rule = await PeakHourRule.findById(req.params.id);
  if (!rule) return notFound(res, 'Règle d’heure de pointe introuvable.');
  await rule.deleteOne();
  res.json({ success: true });
});

// ─── Promotions ─────────────────────────────────────────────
export const listPromotionsAdmin = asyncHandler(async (_req, res) => {
  res.json(await DeliveryPromotion.find().sort({ createdAt: -1 }).lean());
});

export const createPromotionAdmin = asyncHandler(async (req, res) => {
  const { code, discountType, discountValue, zoneRestrictionId, maxUses, expiresAt, isActive } = req.body || {};
  if (!String(code || '').trim()) return res.status(400).json({ message: 'Le code est requis.' });
  const promotion = await DeliveryPromotion.create({
    code: String(code).trim().toUpperCase(),
    discountType: discountType || 'PERCENT',
    discountValue: Math.max(0, Number(discountValue) || 0),
    zoneRestrictionId: zoneRestrictionId || null,
    maxUses: Number.isFinite(Number(maxUses)) ? Number(maxUses) : null,
    expiresAt: expiresAt || null,
    isActive: isActive !== false,
    updatedBy: req.user?._id || null
  });
  res.status(201).json(promotion);
});

export const updatePromotionAdmin = asyncHandler(async (req, res) => {
  const promotion = await DeliveryPromotion.findById(req.params.id);
  if (!promotion) return notFound(res, 'Promotion introuvable.');
  const { discountType, discountValue, zoneRestrictionId, maxUses, expiresAt, isActive } = req.body || {};
  if (discountType !== undefined) promotion.discountType = discountType;
  if (discountValue !== undefined) promotion.discountValue = Math.max(0, Number(discountValue) || 0);
  if (zoneRestrictionId !== undefined) promotion.zoneRestrictionId = zoneRestrictionId || null;
  if (maxUses !== undefined) promotion.maxUses = Number.isFinite(Number(maxUses)) ? Number(maxUses) : null;
  if (expiresAt !== undefined) promotion.expiresAt = expiresAt || null;
  if (isActive !== undefined) promotion.isActive = Boolean(isActive);
  promotion.updatedBy = req.user?._id || null;
  await promotion.save();
  res.json(promotion);
});

export const deletePromotionAdmin = asyncHandler(async (req, res) => {
  const promotion = await DeliveryPromotion.findById(req.params.id);
  if (!promotion) return notFound(res, 'Promotion introuvable.');
  await promotion.deleteOne();
  res.json({ success: true });
});

// ─── Shop-facing lookups (used by the parcel request form) ──
export const getDeliveryPricingOptions = asyncHandler(async (_req, res) => {
  const [packageTypes, speedRules] = await Promise.all([
    PackageType.find({ isActive: true }).sort({ order: 1, name: 1 }).select('name extraPrice priority specialNotes').lean(),
    DeliverySpeedRule.find({ isActive: true }).sort({ order: 1 }).select('key label extraPrice etaMinutes').lean()
  ]);
  res.json({ packageTypes, speedRules });
});

export const searchLandmarksPublic = asyncHandler(async (req, res) => {
  const text = String(req.query?.text || '').trim();
  const cityId = req.query?.cityId;
  if (!text || !cityId) return res.json({ items: [] });

  const matches = await searchLandmarksByText({ text, cityId, limit: 5 });
  res.json({
    items: matches.map((match) => ({
      id: match._id,
      name: match.name,
      latitude: match.latitude,
      longitude: match.longitude,
      communeId: match.communeId || null
    }))
  });
});
