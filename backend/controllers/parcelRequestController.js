import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import {
  estimateParcelPrice,
  createParcelRequest,
  listMyParcelRequests,
  getParcelRequestForRequester,
  cancelParcelRequest,
  adminListParcelRequests,
  assignCourierToParcelRequest,
  getAdminParcelStats,
  adminCancelParcelRequest
} from '../services/parcelRequestService.js';
import { getRuntimeConfig } from '../services/configService.js';
import { canManageDeliveryRequests, getPlatformDeliveryRuntime } from '../services/platformDeliveryService.js';

const isValidObjectId = (value) => mongoose.isValidObjectId(value);

const handleServiceError = (res, error) => {
  const statusCode = Number(error?.statusCode) || 500;
  if (statusCode < 500) {
    return res.status(statusCode).json({ message: error.message });
  }
  throw error;
};

const parseLocation = (raw) => {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

export const getParcelDeliveryCapabilities = asyncHandler(async (req, res) => {
  const enabled = await getRuntimeConfig('enable_parcel_delivery', { fallback: true });
  return res.json({ enabled: Boolean(enabled) });
});

export const postEstimateParcelPrice = asyncHandler(async (req, res) => {
  const pickup = parseLocation(req.body?.pickup);
  const dropoff = parseLocation(req.body?.dropoff);
  try {
    const estimate = await estimateParcelPrice({ pickup, dropoff });
    return res.json(estimate);
  } catch (error) {
    return handleServiceError(res, error);
  }
});

export const postCreateParcelRequest = asyncHandler(async (req, res) => {
  const pickup = parseLocation(req.body?.pickup);
  const dropoff = parseLocation(req.body?.dropoff);
  const proofFile = req.file || null;
  const proofImageUrl = proofFile?.filename ? `uploads/delivery-proofs/${proofFile.filename}` : '';

  try {
    const parcelRequest = await createParcelRequest({
      requesterId: req.user.id || req.user._id,
      pickup,
      dropoff,
      parcelDescription: req.body?.parcelDescription,
      authorization: {
        proofImageUrl,
        referenceCode: req.body?.referenceCode,
        notes: req.body?.notes
      }
    });
    return res.status(201).json(parcelRequest);
  } catch (error) {
    return handleServiceError(res, error);
  }
});

export const getMyParcelRequests = asyncHandler(async (req, res) => {
  const result = await listMyParcelRequests({
    requesterId: req.user.id || req.user._id,
    status: req.query?.status,
    page: req.query?.page,
    limit: req.query?.limit
  });
  return res.json(result);
});

export const getMyParcelRequestById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    return res.status(400).json({ message: 'Demande invalide.' });
  }
  try {
    const parcelRequest = await getParcelRequestForRequester({
      id,
      requesterId: req.user.id || req.user._id
    });
    return res.json(parcelRequest);
  } catch (error) {
    return handleServiceError(res, error);
  }
});

export const postCancelParcelRequest = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    return res.status(400).json({ message: 'Demande invalide.' });
  }
  try {
    const parcelRequest = await cancelParcelRequest({
      id,
      requesterId: req.user.id || req.user._id
    });
    return res.json(parcelRequest);
  } catch (error) {
    return handleServiceError(res, error);
  }
});

// ─── ADMIN ──────────────────────────────────────────────────

export const getAdminParcelRequests = asyncHandler(async (req, res) => {
  const runtime = await getPlatformDeliveryRuntime();
  if (!canManageDeliveryRequests(req.user, runtime)) {
    return res.status(403).json({ message: 'Accès refusé.' });
  }
  const result = await adminListParcelRequests({
    status: req.query?.status,
    search: req.query?.search,
    page: req.query?.page,
    limit: req.query?.limit
  });
  return res.json(result);
});

export const getAdminParcelRequestStats = asyncHandler(async (req, res) => {
  const runtime = await getPlatformDeliveryRuntime();
  if (!canManageDeliveryRequests(req.user, runtime)) {
    return res.status(403).json({ message: 'Accès refusé.' });
  }
  const stats = await getAdminParcelStats();
  return res.json(stats);
});

export const postAdminCancelParcelRequest = asyncHandler(async (req, res) => {
  const runtime = await getPlatformDeliveryRuntime();
  if (!canManageDeliveryRequests(req.user, runtime)) {
    return res.status(403).json({ message: 'Accès refusé.' });
  }
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    return res.status(400).json({ message: 'Demande invalide.' });
  }
  try {
    const parcelRequest = await adminCancelParcelRequest({
      id,
      actorId: req.user.id || req.user._id,
      reason: req.body?.reason
    });
    return res.json(parcelRequest);
  } catch (error) {
    return handleServiceError(res, error);
  }
});

export const postAdminAssignParcelCourier = asyncHandler(async (req, res) => {
  const runtime = await getPlatformDeliveryRuntime();
  if (!canManageDeliveryRequests(req.user, runtime)) {
    return res.status(403).json({ message: 'Accès refusé.' });
  }
  const { id } = req.params;
  const deliveryGuyId = String(req.body?.deliveryGuyId || '').trim();
  if (!isValidObjectId(id) || !isValidObjectId(deliveryGuyId)) {
    return res.status(400).json({ message: 'Demande ou livreur invalide.' });
  }
  const courierMustAcceptAssignment = await getRuntimeConfig('courier_must_accept_assignment', {
    fallback: true
  });
  try {
    const parcelRequest = await assignCourierToParcelRequest({
      requestId: id,
      deliveryGuyId,
      actorId: req.user.id || req.user._id,
      courierMustAcceptAssignment: Boolean(courierMustAcceptAssignment)
    });
    return res.json(parcelRequest);
  } catch (error) {
    return handleServiceError(res, error);
  }
});
