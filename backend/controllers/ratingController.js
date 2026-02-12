import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import Rating from '../models/ratingModel.js';
import Product from '../models/productModel.js';
import { createNotification } from '../utils/notificationService.js';
import { buildIdentifierQuery } from '../utils/idResolver.js';
import { ensureDocumentSlug } from '../utils/slugUtils.js';
import { invalidateProductCache } from '../utils/cache.js';

const ensureProductVisible = async (identifier, fallbackId = null) => {
  const query = buildIdentifierQuery(identifier);
  if (!Object.keys(query).length && !fallbackId) {
    throw Object.assign(new Error('Identifiant de produit invalide.'), { status: 400 });
  }
  let product = Object.keys(query).length ? await Product.findOne(query).select('status user title') : null;
  if (!product && fallbackId && mongoose.Types.ObjectId.isValid(fallbackId)) {
    product = await Product.findById(fallbackId).select('status user title');
  }
  if (!product || product.status !== 'approved') {
    throw Object.assign(new Error('Produit introuvable ou non publié.'), { status: 404 });
  }
  await ensureDocumentSlug({ document: product, sourceValue: product.title });
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
  const product = await ensureProductVisible(req.params.id, req.query.productId);
  const rating = await Rating.findOne({ product: product._id, user: req.user.id });
  res.json({ value: rating ? rating.value : null });
});

export const upsertRating = asyncHandler(async (req, res) => {
  const product = await ensureProductVisible(req.params.id, req.body.productId);

  const { value } = req.body;

  if (String(product.user) === req.user.id) {
    return res.status(403).json({ message: 'Vous ne pouvez pas noter votre propre produit.' });
  }

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

  invalidateProductCache();

  res.status(201).json({ value: rating.value });
});

export const deleteRating = asyncHandler(async (req, res) => {
  const product = await ensureProductVisible(req.params.id, req.query.productId);

  await Rating.findOneAndDelete({ product: product._id, user: req.user.id });

  invalidateProductCache();

  res.status(204).end();
});
