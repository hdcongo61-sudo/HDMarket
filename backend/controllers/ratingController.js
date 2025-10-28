import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import Rating from '../models/ratingModel.js';
import Product from '../models/productModel.js';
import { createNotification } from '../utils/notificationService.js';

const ensureProductVisible = async (productId) => {
  if (!mongoose.isValidObjectId(productId)) {
    throw Object.assign(new Error('Identifiant de produit invalide.'), { status: 400 });
  }
  const product = await Product.findById(productId).select('status user title');
  if (!product || product.status !== 'approved') {
    throw Object.assign(new Error('Produit introuvable ou non publié.'), { status: 404 });
  }
  return product;
};

export const getRatingSummary = asyncHandler(async (req, res) => {
  const product = await ensureProductVisible(req.params.id);
  const productId = product._id;

  const [summary] = await Rating.aggregate([
    { $match: { product: productId } },
    { $group: { _id: null, average: { $avg: '$value' }, count: { $sum: 1 } } }
  ]);

  const distributionRaw = await Rating.aggregate([
    { $match: { product: productId } },
    { $group: { _id: '$value', count: { $sum: 1 } } }
  ]);

  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  distributionRaw.forEach((item) => {
    distribution[item._id] = item.count;
  });

  res.json({
    average: summary ? Number(summary.average.toFixed(2)) : 0,
    count: summary ? summary.count : 0,
    distribution
  });
});

export const getUserRating = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: 'Identifiant de produit invalide.' });
  }
  const product = await Product.findById(req.params.id).select('status user');
  if (!product) {
    return res.status(404).json({ message: 'Produit introuvable.' });
  }
  if (
    product.status !== 'approved' &&
    product.user.toString() !== req.user.id &&
    req.user.role !== 'admin'
  ) {
    return res.status(403).json({ message: 'Accès refusé.' });
  }

  const rating = await Rating.findOne({ product: product._id, user: req.user.id });
  res.json({ value: rating ? rating.value : null });
});

export const upsertRating = asyncHandler(async (req, res) => {
  const product = await ensureProductVisible(req.params.id);

  const { value } = req.body;

  const rating = await Rating.findOneAndUpdate(
    { product: product._id, user: req.user.id },
    { value },
    { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
  );

  if (String(product.user) !== req.user.id) {
    await createNotification({
      userId: product.user,
      actorId: req.user.id,
      productId: product._id,
      type: 'rating',
      metadata: {
        value
      }
    });
  }

  res.status(201).json({ value: rating.value });
});

export const deleteRating = asyncHandler(async (req, res) => {
  const product = await ensureProductVisible(req.params.id);

  await Rating.findOneAndDelete({ product: product._id, user: req.user.id });
  res.status(204).end();
});
