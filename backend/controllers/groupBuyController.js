import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import {
  createGroupBuy,
  joinGroupBuy,
  getGroupBuyById,
  listActiveGroupBuysForProduct,
  listActiveGroupBuys
} from '../services/groupBuyService.js';

const isValidObjectId = (value) => mongoose.isValidObjectId(value);

const handleServiceError = (res, error) => {
  const statusCode = Number(error?.statusCode) || 500;
  if (statusCode < 500) {
    return res.status(statusCode).json({ message: error.message });
  }
  throw error;
};

export const postCreateGroupBuy = asyncHandler(async (req, res) => {
  const { productId, targetSize, durationHours } = req.body;
  if (!isValidObjectId(productId)) {
    return res.status(400).json({ message: 'Produit invalide.' });
  }
  try {
    const groupBuy = await createGroupBuy({
      productId,
      userId: req.user.id || req.user._id,
      targetSize,
      durationHours
    });
    return res.status(201).json(groupBuy);
  } catch (error) {
    return handleServiceError(res, error);
  }
});

export const postJoinGroupBuy = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    return res.status(400).json({ message: 'Achat groupé invalide.' });
  }
  try {
    const groupBuy = await joinGroupBuy({ groupBuyId: id, userId: req.user.id || req.user._id });
    return res.json(groupBuy);
  } catch (error) {
    return handleServiceError(res, error);
  }
});

export const getGroupBuy = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    return res.status(400).json({ message: 'Achat groupé invalide.' });
  }
  const groupBuy = await getGroupBuyById(id);
  if (!groupBuy) {
    return res.status(404).json({ message: 'Achat groupé introuvable.' });
  }
  return res.json(groupBuy);
});

export const getGroupBuysForProduct = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  if (!isValidObjectId(productId)) {
    return res.status(400).json({ message: 'Produit invalide.' });
  }
  const items = await listActiveGroupBuysForProduct(productId);
  return res.json({ items });
});

export const getActiveGroupBuys = asyncHandler(async (req, res) => {
  const limit = Math.min(50, Math.max(1, Number(req.query?.limit || 20)));
  const items = await listActiveGroupBuys({ limit });
  return res.json({ items });
});
