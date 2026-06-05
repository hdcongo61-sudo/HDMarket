/**
 * Flash Sale Service — Auto start/end & business logic
 * Proposal 2 of HDMarket Taobao-Inspired Improvements
 *
 * No stock tracking (app doesn't manage stock).
 * Pure time-based: scheduled → active → ended.
 */

import FlashSale from '../models/flashSaleModel.js';
import Product from '../models/productModel.js';
import User from '../models/userModel.js';
import { createNotification } from '../utils/notificationService.js';

// ─── HELPERS ────────────────────────────────────────────────

const calculateDiscount = (original, flash) => {
  if (!original || original <= 0) return 0;
  return Math.round(((original - flash) / original) * 100);
};

// ─── CRUD ───────────────────────────────────────────────────

export const createFlashSale = async ({
  productId,
  flashPrice,
  startDate,
  endDate,
  createdBy
}) => {
  const product = await Product.findById(productId)
    .select('title slug price discount user')
    .lean();
  if (!product) throw new Error('Produit introuvable');

  const originalPrice = product.priceBeforeDiscount || product.price;
  const discountPercent = calculateDiscount(originalPrice, flashPrice);

  if (flashPrice >= originalPrice) {
    throw new Error('Le prix flash doit être inférieur au prix normal');
  }

  if (new Date(endDate) <= new Date(startDate)) {
    throw new Error('La date de fin doit être après la date de début');
  }

  // Check for overlapping active/scheduled flash sale for this product
  const existing = await FlashSale.findOne({
    product: productId,
    status: { $in: ['scheduled', 'active'] }
  }).lean();
  if (existing) {
    throw new Error('Ce produit a déjà une vente flash programmée ou active');
  }

  const flashSale = await FlashSale.create({
    product: productId,
    seller: product.user,
    flashPrice,
    originalPrice,
    discountPercent,
    startDate,
    endDate,
    status: new Date(startDate) <= new Date() ? 'active' : 'scheduled',
    createdBy,
    isVisible: true
  });

  // If active immediately, update product price
  if (flashSale.status === 'active') {
    await applyFlashPrice(flashSale);
  }

  return FlashSale.findById(flashSale._id)
    .populate('product', 'title slug price images')
    .populate('seller', 'shopName name')
    .lean();
};

export const cancelFlashSale = async (flashSaleId, cancelledBy, reason = '') => {
  const flashSale = await FlashSale.findById(flashSaleId);
  if (!flashSale) throw new Error('Vente flash introuvable');
  if (!['scheduled', 'active'].includes(flashSale.status)) {
    throw new Error('Cette vente flash ne peut plus être annulée');
  }

  // Restore original product price if active
  if (flashSale.status === 'active') {
    await restoreOriginalPrice(flashSale);
  }

  flashSale.status = 'cancelled';
  flashSale.cancelledBy = cancelledBy;
  flashSale.cancelledAt = new Date();
  flashSale.cancelReason = reason;
  await flashSale.save();

  return flashSale;
};

export const getActiveFlashSales = async ({ page = 1, limit = 20 } = {}) => {
  const now = new Date();
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    FlashSale.find({
      status: 'active',
      isVisible: true,
      startDate: { $lte: now },
      endDate: { $gt: now }
    })
      .sort({ endDate: 1 }) // ending soonest first
      .skip(skip)
      .limit(limit)
      .populate('product', 'title slug price images category')
      .populate('seller', 'shopName name')
      .lean(),
    FlashSale.countDocuments({
      status: 'active',
      isVisible: true,
      startDate: { $lte: now },
      endDate: { $gt: now }
    })
  ]);

  return { items, total, page, pages: Math.ceil(total / limit) };
};

export const getAllFlashSales = async ({ page = 1, limit = 20, status = '', sellerId = '' } = {}) => {
  const skip = (page - 1) * limit;
  const query = {};
  if (status && ['scheduled', 'active', 'ended', 'cancelled'].includes(status)) {
    query.status = status;
  }
  if (sellerId) query.seller = sellerId;

  const [items, total] = await Promise.all([
    FlashSale.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('product', 'title slug price images')
      .populate('seller', 'shopName name')
      .populate('createdBy', 'name')
      .lean(),
    FlashSale.countDocuments(query)
  ]);

  return { items, total, page, pages: Math.ceil(total / limit) };
};

// ─── AUTOMATION ─────────────────────────────────────────────

export const applyFlashPrice = async (flashSale) => {
  const product = await Product.findById(flashSale.product);
  if (!product) return;

  // Save original price if not already saved
  if (!product.priceBeforeDiscount || product.priceBeforeDiscount <= product.price) {
    product.priceBeforeDiscount = product.price;
  }
  product.price = flashSale.flashPrice;
  product.discount = flashSale.discountPercent;
  await product.save();
};

export const restoreOriginalPrice = async (flashSale) => {
  const product = await Product.findById(flashSale.product);
  if (!product) return;

  // Restore from our snapshot
  if (flashSale.originalPrice > 0) {
    product.price = flashSale.originalPrice;
  }
  product.discount = 0;
  product.priceBeforeDiscount = undefined;
  await product.save();
};

// ─── SCHEDULED SWEEPS ───────────────────────────────────────

export const sweepStartScheduled = async ({ limit = 200 } = {}) => {
  const now = new Date();

  const readyToStart = await FlashSale.find({
    status: 'scheduled',
    isVisible: true,
    startDate: { $lte: now },
    endDate: { $gt: now }
  })
    .limit(limit)
    .lean();

  let started = 0;
  for (const fs of readyToStart) {
    try {
      await applyFlashPrice(fs);
      await FlashSale.updateOne({ _id: fs._id }, { $set: { status: 'active' } });
      started += 1;
    } catch (err) {
      console.error('[flash-sale] Error starting flash sale', fs._id, err.message);
    }
  }

  return { started, checked: readyToStart.length };
};

export const sweepEndExpired = async ({ limit = 200 } = {}) => {
  const now = new Date();

  const expired = await FlashSale.find({
    status: 'active',
    endDate: { $lte: now }
  })
    .limit(limit)
    .lean();

  let ended = 0;
  for (const fs of expired) {
    try {
      await restoreOriginalPrice(fs);
      await FlashSale.updateOne({ _id: fs._id }, { $set: { status: 'ended' } });
      ended += 1;
    } catch (err) {
      console.error('[flash-sale] Error ending flash sale', fs._id, err.message);
    }
  }

  return { ended, checked: expired.length };
};
