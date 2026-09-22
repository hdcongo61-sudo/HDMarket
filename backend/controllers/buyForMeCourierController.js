import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import User from '../models/userModel.js';
import Order from '../models/buyForMeOrderModel.js';
import Transfer from '../models/buyForMeTransferModel.js';
import { persistShoppingMedia } from './buyForMeMediaController.js';
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
  if (error?.name === 'VersionError') return res.status(409).json({ message: 'La mission a changé. Actualisez avant de réessayer.' });
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
  return res.json(await listDriverBuyForMeJobs({ driverId: deliveryGuy._id, scope: req.query?.scope, page: req.query?.page, limit: req.query?.limit, orderId: req.query?.orderId }));
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
    const order = await Order.findOne({ _id: req.params.id, driverId: deliveryGuy._id, countryId: deliveryGuy.countryId, status: 'SHOPPING', disputeOpen: { $ne: true } });
    if (!order) return res.status(409).json({ message: 'Cette mission ne peut pas recevoir de reçu.' });
    const store = file => persistShoppingMedia({ file, orderId: order._id, uploadedBy: req.user.id || req.user._id });
    const receiptImageUrl = await store(receiptFile);
    const photos = Array.isArray(req.files?.productPhotos) ? req.files.productPhotos : [];
    const productPhotoUrls = await Promise.all(photos.map(store));
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

export const getCourierShoppingTransfers = asyncHandler(async (req, res) => {
  const { deliveryGuy } = await resolveBuyForMeCourierContext(req);
  const items = await Transfer.find({ userId: deliveryGuy.userId, countryId: deliveryGuy.countryId, type: 'PAYOUT' }).select('orderId amount currency status failureReason completedAt').sort({ createdAt: -1 }).limit(100).lean();
  const user = await User.findById(deliveryGuy.userId).select('payoutAccount phone phoneVerified').lean();
  return res.json({ items, payoutAccount: user?.payoutAccount || {}, phone: user?.phone, phoneVerified: user?.phoneVerified });
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
