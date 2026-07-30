import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import { persistDeliveryProofFile } from '../utils/deliveryProofStorage.js';
import { resolveCourierContext } from './courierDeliveryController.js';
import {
  acceptBuyForMeJob,
  listDriverBuyForMeJobs,
  markBuyForMeDelivered,
  rejectBuyForMeJob,
  startBuyForMeDelivery,
  startBuyForMeShopping,
  updateBuyForMeItemAvailability,
  uploadBuyForMeReceipt
} from '../services/buyForMeService.js';

const sendServiceError = (res, error) => {
  const statusCode = Number(error?.statusCode || 500);
  if (statusCode < 500) return res.status(statusCode).json({ message: error.message });
  throw error;
};
const isValidId = (value) => mongoose.isValidObjectId(value);
const resolveBuyForMeCourierContext = async (req) => {
  const context = await resolveCourierContext(req, { allowAdminPreview: false });
  if (context.previewMode || context.deliveryGuy?.buyForMeOptIn !== true) {
    const error = new Error('Vous n’avez pas accepté les missions « Acheter pour moi ».');
    error.statusCode = 403;
    throw error;
  }
  return context;
};

export const listCourierBuyForMeJobs = asyncHandler(async (req, res) => {
  const { deliveryGuy, previewMode } = await resolveBuyForMeCourierContext(req);
  if (previewMode) return res.json({ items: [], total: 0, page: 1, totalPages: 1 });
  return res.json(await listDriverBuyForMeJobs({ driverId: deliveryGuy._id, scope: req.query?.scope, page: req.query?.page, limit: req.query?.limit }));
});

export const acceptCourierBuyForMeJob = asyncHandler(async (req, res) => {
  const { deliveryGuy, previewMode } = await resolveBuyForMeCourierContext(req);
  if (previewMode) return res.status(403).json({ message: 'Aperçu lecture seule.' });
  if (!isValidId(req.params?.id)) return res.status(400).json({ message: 'Mission invalide.' });
  try {
    return res.json({ item: await acceptBuyForMeJob({ orderId: req.params.id, driverId: deliveryGuy._id, actorId: req.user.id || req.user._id }) });
  } catch (error) {
    return sendServiceError(res, error);
  }
});

export const rejectCourierBuyForMeJob = asyncHandler(async (req, res) => {
  const { deliveryGuy, previewMode } = await resolveBuyForMeCourierContext(req);
  if (previewMode) return res.status(403).json({ message: 'Aperçu lecture seule.' });
  if (!isValidId(req.params?.id)) return res.status(400).json({ message: 'Mission invalide.' });
  try {
    return res.json({ item: await rejectBuyForMeJob({
      orderId: req.params.id,
      driverId: deliveryGuy._id,
      actorId: req.user.id || req.user._id,
      reason: req.body?.reason
    }) });
  } catch (error) {
    return sendServiceError(res, error);
  }
});

export const startCourierBuyForMeShopping = asyncHandler(async (req, res) => {
  const { deliveryGuy, previewMode } = await resolveBuyForMeCourierContext(req);
  if (previewMode) return res.status(403).json({ message: 'Aperçu lecture seule.' });
  try {
    return res.json({ item: await startBuyForMeShopping({ orderId: req.params.id, driverId: deliveryGuy._id, actorId: req.user.id || req.user._id }) });
  } catch (error) {
    return sendServiceError(res, error);
  }
});

export const updateCourierBuyForMeItem = asyncHandler(async (req, res) => {
  const { deliveryGuy, previewMode } = await resolveBuyForMeCourierContext(req);
  if (previewMode) return res.status(403).json({ message: 'Aperçu lecture seule.' });
  if (!isValidId(req.params?.itemId)) return res.status(400).json({ message: 'Article invalide.' });
  try {
    return res.json({ item: await updateBuyForMeItemAvailability({
      orderId: req.params.id,
      driverId: deliveryGuy._id,
      actorId: req.user.id || req.user._id,
      itemId: req.params.itemId,
      status: req.body?.status,
      replacementNote: req.body?.replacementNote
    }) });
  } catch (error) {
    return sendServiceError(res, error);
  }
});

export const uploadCourierBuyForMeReceipt = asyncHandler(async (req, res) => {
  const { deliveryGuy, previewMode } = await resolveBuyForMeCourierContext(req);
  if (previewMode) return res.status(403).json({ message: 'Aperçu lecture seule.' });
  const receiptFile = Array.isArray(req.files?.receipt) ? req.files.receipt[0] : null;
  if (!receiptFile) return res.status(400).json({ message: 'Ajoutez la photo du reçu.' });
  try {
    const receiptImageUrl = await persistDeliveryProofFile(receiptFile, { category: 'buy-for-me-receipt' });
    const photos = Array.isArray(req.files?.productPhotos) ? req.files.productPhotos : [];
    const productPhotoUrls = await Promise.all(photos.map((file) => persistDeliveryProofFile(file, { category: 'buy-for-me-product' })));
    return res.json({ item: await uploadBuyForMeReceipt({
      orderId: req.params.id,
      driverId: deliveryGuy._id,
      actorId: req.user.id || req.user._id,
      storeName: req.body?.storeName,
      amountSpent: req.body?.amountSpent,
      receiptImageUrl,
      productPhotoUrls: productPhotoUrls.filter(Boolean),
      note: req.body?.note
    }) });
  } catch (error) {
    return sendServiceError(res, error);
  }
});

export const startCourierBuyForMeDelivery = asyncHandler(async (req, res) => {
  const { deliveryGuy, previewMode } = await resolveBuyForMeCourierContext(req);
  if (previewMode) return res.status(403).json({ message: 'Aperçu lecture seule.' });
  try {
    return res.json({ item: await startBuyForMeDelivery({ orderId: req.params.id, driverId: deliveryGuy._id, actorId: req.user.id || req.user._id }) });
  } catch (error) {
    return sendServiceError(res, error);
  }
});

export const deliverCourierBuyForMeOrder = asyncHandler(async (req, res) => {
  const { deliveryGuy, previewMode } = await resolveBuyForMeCourierContext(req);
  if (previewMode) return res.status(403).json({ message: 'Aperçu lecture seule.' });
  try {
    return res.json({ item: await markBuyForMeDelivered({ orderId: req.params.id, driverId: deliveryGuy._id, actorId: req.user.id || req.user._id }) });
  } catch (error) {
    return sendServiceError(res, error);
  }
});
