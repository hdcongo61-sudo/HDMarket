import asyncHandler from 'express-async-handler';
import DeliveryGuy from '../models/deliveryGuyModel.js';
import Order from '../models/orderModel.js';

export const listDeliveryGuysAdmin = asyncHandler(async (req, res) => {
  const { search = '', page = 1, limit = 20 } = req.query;
  const filter = {};
  if (search.trim()) {
    const regex = new RegExp(search.trim(), 'i');
    filter.$or = [{ name: regex }, { phone: regex }];
  }
  const pageNumber = Math.max(1, Number(page) || 1);
  const pageSize = Math.max(1, Math.min(Number(limit) || 20, 100));
  const skip = (pageNumber - 1) * pageSize;

  const [items, total] = await Promise.all([
    DeliveryGuy.find(filter).sort({ name: 1 }).skip(skip).limit(pageSize).lean(),
    DeliveryGuy.countDocuments(filter)
  ]);

  const deliveryGuyIds = items.map((item) => item._id);
  const stats = deliveryGuyIds.length
    ? await Order.aggregate([
        { $match: { deliveryGuy: { $in: deliveryGuyIds } } },
        {
          $group: {
            _id: { deliveryGuy: '$deliveryGuy', status: '$status' },
            count: { $sum: 1 }
          }
        }
      ])
    : [];
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const statsMap = new Map();
  stats.forEach((entry) => {
    const deliveryGuyId = entry?._id?.deliveryGuy?.toString?.();
    if (!deliveryGuyId) return;
    const current = statsMap.get(deliveryGuyId) || {
      totalAssigned: 0,
      delivering: 0,
      delivered: 0,
      confirmed: 0,
      pending: 0
    };
    const status = entry._id?.status;
    current.totalAssigned += entry.count;
    if (status === 'delivering') current.delivering += entry.count;
    if (status === 'delivered') current.delivered += entry.count;
    if (status === 'confirmed') current.confirmed += entry.count;
    if (status === 'pending') current.pending += entry.count;
    statsMap.set(deliveryGuyId, current);
  });

  const enriched = items.map((item) => {
    const statsEntry = statsMap.get(item._id.toString()) || {
      totalAssigned: 0,
      delivering: 0,
      delivered: 0,
      confirmed: 0,
      pending: 0
    };
    return { ...item, stats: statsEntry };
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
  const { name, phone, active } = req.body;
  const deliveryGuy = await DeliveryGuy.create({
    name: name?.trim(),
    phone: phone?.trim() || '',
    active: active !== undefined ? Boolean(active) : true
  });
  res.status(201).json(deliveryGuy);
});

export const updateDeliveryGuyAdmin = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const deliveryGuy = await DeliveryGuy.findById(id);
  if (!deliveryGuy) {
    return res.status(404).json({ message: 'Livreur introuvable.' });
  }
  const { name, phone, active } = req.body;
  if (typeof name === 'string') {
    deliveryGuy.name = name.trim();
  }
  if (typeof phone === 'string') {
    deliveryGuy.phone = phone.trim();
  }
  if (typeof active !== 'undefined') {
    deliveryGuy.active = Boolean(active);
  }
  await deliveryGuy.save();
  res.json(deliveryGuy);
});

export const deleteDeliveryGuyAdmin = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const deliveryGuy = await DeliveryGuy.findById(id);
  if (!deliveryGuy) {
    return res.status(404).json({ message: 'Livreur introuvable.' });
  }
  await deliveryGuy.deleteOne();
  res.json({ success: true });
});
