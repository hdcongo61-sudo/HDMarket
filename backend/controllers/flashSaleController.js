import {
  createFlashSale,
  cancelFlashSale,
  getActiveFlashSales,
  getAllFlashSales
} from '../services/flashSaleService.js';
import FlashSale from '../models/flashSaleModel.js';
import asyncHandler from 'express-async-handler';

// ─── PUBLIC ─────────────────────────────────────────────────

export const listActiveFlashSales = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));

  const result = await getActiveFlashSales({ page, limit });
  res.json(result);
});

export const getFlashSaleById = asyncHandler(async (req, res) => {
  const flashSale = await FlashSale.findById(req.params.id)
    .populate('product', 'title slug price images description category')
    .populate('seller', 'shopName name profileImage')
    .lean();

  if (!flashSale) {
    return res.status(404).json({ message: 'Vente flash introuvable' });
  }

  res.json(flashSale);
});

// ─── ADMIN ──────────────────────────────────────────────────

export const adminListFlashSales = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const { status, sellerId } = req.query;

  const result = await getAllFlashSales({ page, limit, status, sellerId });
  res.json(result);
});

export const adminCreateFlashSale = asyncHandler(async (req, res) => {
  const { productId, flashPrice, startDate, endDate } = req.body;

  if (!productId || !flashPrice || !startDate || !endDate) {
    return res.status(400).json({ message: 'Tous les champs sont requis (productId, flashPrice, startDate, endDate)' });
  }

  const flashSale = await createFlashSale({
    productId,
    flashPrice: Number(flashPrice),
    startDate: new Date(startDate),
    endDate: new Date(endDate),
    createdBy: req.user.id
  });

  res.status(201).json(flashSale);
});

export const adminCancelFlashSale = asyncHandler(async (req, res) => {
  const { reason } = req.body;

  const flashSale = await cancelFlashSale(
    req.params.id,
    req.user.id,
    reason || ''
  );

  res.json(flashSale);
});

export const adminUpdateFlashSale = asyncHandler(async (req, res) => {
  const flashSale = await FlashSale.findById(req.params.id);
  if (!flashSale) {
    return res.status(404).json({ message: 'Vente flash introuvable' });
  }

  if (!['scheduled'].includes(flashSale.status)) {
    return res.status(400).json({ message: 'Seules les ventes programmées peuvent être modifiées' });
  }

  const allowed = ['flashPrice', 'startDate', 'endDate', 'isVisible'];
  for (const field of allowed) {
    if (req.body[field] !== undefined) {
      flashSale[field] = req.body[field];
    }
  }

  // Recalculate discount
  if (req.body.flashPrice) {
    const original = flashSale.originalPrice;
    flashSale.discountPercent = Math.round(((original - req.body.flashPrice) / original) * 100);
  }

  await flashSale.save();

  const updated = await FlashSale.findById(flashSale._id)
    .populate('product', 'title slug price images')
    .populate('seller', 'shopName name')
    .lean();

  res.json(updated);
});
