import asyncHandler from 'express-async-handler';
import DeliveryGuy from '../models/deliveryGuyModel.js';
import Order from '../models/orderModel.js';
import DeliveryRequest from '../models/deliveryRequestModel.js';
import {
  assertPlatformDeliveryEnabled,
  canManageDeliveryRequests
} from '../services/platformDeliveryService.js';

const normalizeText = (value = '') => String(value || '').trim();
const toObjectId = (value = '') => {
  const normalized = normalizeText(value);
  if (!normalized || !/^[a-f\d]{24}$/i.test(normalized)) return null;
  return normalized;
};
const resolveDeliveryGuyProfileImage = (deliveryGuy = {}) =>
  normalizeText(
    deliveryGuy?.photoUrl ||
      deliveryGuy?.profileImage ||
      deliveryGuy?.userId?.shopLogo
  );

const serializeDeliveryGuy = (item = {}) => {
  const raw = item?.toObject ? item.toObject() : item;
  const fullName = normalizeText(raw.fullName || raw.name || '');
  const rawUser = raw?.userId && typeof raw.userId === 'object' ? raw.userId : null;
  const isActive =
    typeof raw.isActive === 'boolean'
      ? raw.isActive
      : typeof raw.active === 'boolean'
      ? raw.active
      : true;
  const profileImage = resolveDeliveryGuyProfileImage(raw);

  return {
    ...raw,
    userId: rawUser?._id || raw?.userId || null,
    fullName,
    name: fullName,
    photoUrl: profileImage || '',
    profileImage: profileImage || '',
    isActive,
    active: isActive
  };
};

export const listDeliveryGuysAdmin = asyncHandler(async (req, res) => {
  const runtime = await assertPlatformDeliveryEnabled();
  if (!canManageDeliveryRequests(req.user, runtime)) {
    return res.status(403).json({ message: 'Accès refusé à la gestion des livreurs.' });
  }

  const { search = '', page = 1, limit = 20, cityId = '', communeId = '', active = '' } = req.query;
  const filter = {};
  const normalizedSearch = normalizeText(search);
  if (normalizedSearch) {
    const regex = new RegExp(normalizedSearch, 'i');
    filter.$or = [{ fullName: regex }, { name: regex }, { phone: regex }];
  }
  const cityObjectId = toObjectId(cityId);
  if (cityObjectId) {
    filter.cityId = cityObjectId;
  }
  const communeObjectId = toObjectId(communeId);
  if (communeObjectId) {
    filter.communes = communeObjectId;
  }
  if (normalizeText(active)) {
    const flag = ['1', 'true', 'yes', 'oui', 'on'].includes(String(active).trim().toLowerCase());
    filter.$and = filter.$and || [];
    filter.$and.push({
      $or: [{ isActive: flag }, { active: flag }]
    });
  }
  const pageNumber = Math.max(1, Number(page) || 1);
  const pageSize = Math.max(1, Math.min(Number(limit) || 20, 100));
  const skip = (pageNumber - 1) * pageSize;

  const [items, total] = await Promise.all([
    DeliveryGuy.find(filter)
      .sort({ fullName: 1, name: 1 })
      .skip(skip)
      .limit(pageSize)
      .populate('userId', '_id name shopLogo')
      .populate('cityId', 'name')
      .populate('communes', 'name cityId')
      .lean(),
    DeliveryGuy.countDocuments(filter)
  ]);

  const deliveryGuyIds = items.map((item) => item._id);
  const [orderStats, requestStats] = await Promise.all([
    deliveryGuyIds.length
      ? Order.aggregate([
          { $match: { deliveryGuy: { $in: deliveryGuyIds } } },
          {
            $group: {
              _id: { deliveryGuy: '$deliveryGuy', status: '$status' },
              count: { $sum: 1 }
            }
          }
        ])
      : [],
    deliveryGuyIds.length
      ? DeliveryRequest.aggregate([
          { $match: { assignedDeliveryGuyId: { $in: deliveryGuyIds } } },
          {
            $group: {
              _id: { deliveryGuy: '$assignedDeliveryGuyId', status: '$status' },
              count: { $sum: 1 }
            }
          }
        ])
      : []
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const statsMap = new Map();
  const ensureStatsEntry = (deliveryGuyId) => {
    if (!statsMap.has(deliveryGuyId)) {
      statsMap.set(deliveryGuyId, {
        totalAssigned: 0,
        delivering: 0,
        delivered: 0,
        confirmed: 0,
        pending: 0,
        requestsAssigned: 0,
        requestsPending: 0,
        requestsAccepted: 0,
        requestsInProgress: 0,
        requestsDelivered: 0
      });
    }
    return statsMap.get(deliveryGuyId);
  };

  orderStats.forEach((entry) => {
    const deliveryGuyId = entry?._id?.deliveryGuy?.toString?.();
    if (!deliveryGuyId) return;
    const current = ensureStatsEntry(deliveryGuyId);
    const status = entry._id?.status;
    current.totalAssigned += entry.count;
    if (status === 'delivering') current.delivering += entry.count;
    if (status === 'delivered') current.delivered += entry.count;
    if (status === 'confirmed') current.confirmed += entry.count;
    if (status === 'pending') current.pending += entry.count;
  });

  requestStats.forEach((entry) => {
    const deliveryGuyId = entry?._id?.deliveryGuy?.toString?.();
    if (!deliveryGuyId) return;
    const current = ensureStatsEntry(deliveryGuyId);
    const status = String(entry?._id?.status || '').toUpperCase();
    current.requestsAssigned += Number(entry.count || 0);
    if (status === 'PENDING') current.requestsPending += Number(entry.count || 0);
    if (status === 'ACCEPTED') current.requestsAccepted += Number(entry.count || 0);
    if (status === 'IN_PROGRESS') current.requestsInProgress += Number(entry.count || 0);
    if (status === 'DELIVERED') current.requestsDelivered += Number(entry.count || 0);
  });

  const enriched = items.map((item) => {
    const statsEntry = statsMap.get(item._id.toString()) || {
      totalAssigned: 0,
      delivering: 0,
      delivered: 0,
      confirmed: 0,
      pending: 0,
      requestsAssigned: 0,
      requestsPending: 0,
      requestsAccepted: 0,
      requestsInProgress: 0,
      requestsDelivered: 0
    };
    return { ...serializeDeliveryGuy(item), stats: statsEntry };
  });
  res.json({
    items: enriched,
    total,
    page: pageNumber,
    pageSize,
    totalPages
  });
});

export const createDeliveryGuyAdmin = asyncHandler(async (req, res) => {
  const runtime = await assertPlatformDeliveryEnabled();
  if (!canManageDeliveryRequests(req.user, runtime)) {
    return res.status(403).json({ message: 'Accès refusé à la gestion des livreurs.' });
  }

  const fullName = normalizeText(req.body?.fullName || req.body?.name || '');
  if (!fullName) {
    return res.status(400).json({ message: 'Nom complet requis.' });
  }
  const communeIds = Array.isArray(req.body?.communes)
    ? req.body.communes.map((item) => toObjectId(item)).filter(Boolean)
    : [];
  const isActive =
    typeof req.body?.isActive === 'boolean'
      ? req.body.isActive
      : typeof req.body?.active === 'boolean'
      ? req.body.active
      : true;
  const deliveryGuy = await DeliveryGuy.create({
    userId: toObjectId(req.body?.userId) || null,
    fullName,
    name: fullName,
    photoUrl: normalizeText(req.body?.photoUrl || ''),
    phone: normalizeText(req.body?.phone || ''),
    cityId: toObjectId(req.body?.cityId) || null,
    communes: communeIds,
    isActive: Boolean(isActive),
    active: Boolean(isActive),
    vehicleType: normalizeText(req.body?.vehicleType || ''),
    notes: normalizeText(req.body?.notes || '')
  });
  const populated = await DeliveryGuy.findById(deliveryGuy._id)
    .populate('userId', '_id name shopLogo')
    .populate('cityId', 'name')
    .populate('communes', 'name cityId');
  res.status(201).json(serializeDeliveryGuy(populated));
});

export const updateDeliveryGuyAdmin = asyncHandler(async (req, res) => {
  const runtime = await assertPlatformDeliveryEnabled();
  if (!canManageDeliveryRequests(req.user, runtime)) {
    return res.status(403).json({ message: 'Accès refusé à la gestion des livreurs.' });
  }

  const { id } = req.params;
  const deliveryGuy = await DeliveryGuy.findById(id);
  if (!deliveryGuy) {
    return res.status(404).json({ message: 'Livreur introuvable.' });
  }
  const fullName = normalizeText(req.body?.fullName || req.body?.name || '');
  if (fullName) {
    deliveryGuy.fullName = fullName;
    deliveryGuy.name = fullName;
  }
  if (typeof req.body?.phone === 'string') {
    deliveryGuy.phone = normalizeText(req.body.phone);
  }
  if (typeof req.body?.photoUrl !== 'undefined') {
    deliveryGuy.photoUrl = normalizeText(req.body.photoUrl || '');
  }
  if (typeof req.body?.userId !== 'undefined') {
    deliveryGuy.userId = toObjectId(req.body.userId) || null;
  }
  if (typeof req.body?.cityId !== 'undefined') {
    deliveryGuy.cityId = toObjectId(req.body.cityId) || null;
  }
  if (Array.isArray(req.body?.communes)) {
    deliveryGuy.communes = req.body.communes.map((item) => toObjectId(item)).filter(Boolean);
  }
  if (typeof req.body?.isActive !== 'undefined' || typeof req.body?.active !== 'undefined') {
    const nextFlag =
      typeof req.body?.isActive === 'boolean' ? req.body.isActive : Boolean(req.body.active);
    deliveryGuy.isActive = Boolean(nextFlag);
    deliveryGuy.active = Boolean(nextFlag);
  }
  if (typeof req.body?.vehicleType !== 'undefined') {
    deliveryGuy.vehicleType = normalizeText(req.body.vehicleType);
  }
  if (typeof req.body?.notes !== 'undefined') {
    deliveryGuy.notes = normalizeText(req.body.notes);
  }
  await deliveryGuy.save();
  const populated = await DeliveryGuy.findById(deliveryGuy._id)
    .populate('userId', '_id name shopLogo')
    .populate('cityId', 'name')
    .populate('communes', 'name cityId');
  res.json(serializeDeliveryGuy(populated));
});

export const deleteDeliveryGuyAdmin = asyncHandler(async (req, res) => {
  const runtime = await assertPlatformDeliveryEnabled();
  if (!canManageDeliveryRequests(req.user, runtime)) {
    return res.status(403).json({ message: 'Accès refusé à la gestion des livreurs.' });
  }

  const { id } = req.params;
  const deliveryGuy = await DeliveryGuy.findById(id);
  if (!deliveryGuy) {
    return res.status(404).json({ message: 'Livreur introuvable.' });
  }
  await deliveryGuy.deleteOne();
  res.json({ success: true });
});
