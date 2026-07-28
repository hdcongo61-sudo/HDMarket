import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import {
  estimateParcelPrice,
  createParcelRequest,
  listMyParcelRequests,
  getParcelRequestForRequester,
  replaceParcelAuthorizationProof,
  cancelParcelRequest,
  adminListParcelRequests,
  assignCourierToParcelRequest,
  getAdminParcelStats,
  adminCancelParcelRequest,
  respondToParcelPriceAdjustment
} from '../services/parcelRequestService.js';
import { getRuntimeConfig } from '../services/configService.js';
import { canManageDeliveryRequests, getPlatformDeliveryRuntime } from '../services/platformDeliveryService.js';
import { persistDeliveryProofFile } from '../utils/deliveryProofStorage.js';

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

const pickPricingOptions = (body = {}) => ({
  packageTypeId: body?.packageTypeId || null,
  weightKg: body?.weightKg !== undefined && body?.weightKg !== '' ? Number(body.weightKg) : null,
  deliverySpeed: body?.deliverySpeed || 'STANDARD',
  promoCode: body?.promoCode || ''
});

export const getParcelDeliveryCapabilities = asyncHandler(async (req, res) => {
  const enabled = await getRuntimeConfig('enable_parcel_delivery', { fallback: true });
  return res.json({ enabled: Boolean(enabled) });
});

export const postEstimateParcelPrice = asyncHandler(async (req, res) => {
  const pickup = parseLocation(req.body?.pickup);
  const dropoff = parseLocation(req.body?.dropoff);
  try {
    const estimate = await estimateParcelPrice({ pickup, dropoff, ...pickPricingOptions(req.body) });
    return res.json(estimate);
  } catch (error) {
    return handleServiceError(res, error);
  }
});

export const postCreateParcelRequest = asyncHandler(async (req, res) => {
  const pickup = parseLocation(req.body?.pickup);
  const dropoff = parseLocation(req.body?.dropoff);
  const proofFile = req.file || null;

  try {
    const proofImageUrl = await persistDeliveryProofFile(proofFile, {
      category: 'parcel-authorization'
    });
    const parcelRequest = await createParcelRequest({
      requesterId: req.user.id || req.user._id,
      pickup,
      dropoff,
      parcelDescription: req.body?.parcelDescription,
      authorization: {
        proofImageUrl,
        referenceCode: req.body?.referenceCode,
        notes: req.body?.notes
      },
      ...pickPricingOptions(req.body)
    });
    return res.status(201).json(parcelRequest);
  } catch (error) {
    return handleServiceError(res, error);
  }
});

// Proof photos can't travel through a PawaPay checkout's JSON actionContext,
// so the PawaPay-funded creation flow uploads the proof first (getting back a
// URL) and only passes that URL through the checkout — this endpoint is that
// upload step.
export const postUploadParcelProofStandalone = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Sélectionnez une photo de justificatif.' });
  }
  try {
    const proofImageUrl = await persistDeliveryProofFile(req.file, {
      category: 'parcel-authorization'
    });
    return res.json({ proofImageUrl });
  } catch (error) {
    return handleServiceError(res, error);
  }
});

// Invoked internally by pawapayController.js's autoCompleteCheckoutAction once
// a PARCEL_REQUEST_CHECKOUT payment is confirmed — never mounted as a public
// route. Re-derives the price server-side so a stale/tampered client estimate
// can't under-charge the requester, mirroring pawaPayCheckoutOrder's pattern.
export const pawaPayCreateParcelRequest = asyncHandler(async (req, res) => {
  if (!req.pawaPayCheckout || req.pawaPayCheckout.status !== 'COMPLETED') {
    return res.status(403).json({ message: 'Confirmation PawaPay requise.' });
  }
  const pickup = parseLocation(req.body?.pickup);
  const dropoff = parseLocation(req.body?.dropoff);

  try {
    const pricingOptions = pickPricingOptions(req.body);
    const { price } = await estimateParcelPrice({ pickup, dropoff, ...pricingOptions });
    if (Math.abs(Number(req.pawaPayCheckout.amount || 0) - price) > 0.01) {
      return res.status(409).json({
        message: 'Le montant payé ne correspond plus au tarif de cette course. Réessayez.'
      });
    }
    const parcelRequest = await createParcelRequest({
      requesterId: req.user.id || req.user._id,
      pickup,
      dropoff,
      parcelDescription: req.body?.parcelDescription,
      authorization: {
        proofImageUrl: req.body?.proofImageUrl,
        referenceCode: req.body?.referenceCode,
        notes: req.body?.notes
      },
      paymentMethod: 'PAWAPAY',
      paymentStatus: 'PAID',
      pawaPayCheckoutId: req.pawaPayCheckout.checkoutId,
      ...pricingOptions
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

export const postRespondParcelPriceAdjustment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    return res.status(400).json({ message: 'Demande invalide.' });
  }
  try {
    const parcelRequest = await respondToParcelPriceAdjustment({
      requestId: id,
      requesterId: req.user.id || req.user._id,
      approve: Boolean(req.body?.approve)
    });
    return res.json(parcelRequest);
  } catch (error) {
    return handleServiceError(res, error);
  }
});

export const postReplaceMyParcelProof = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    return res.status(400).json({ message: 'Demande invalide.' });
  }
  if (!req.file) {
    return res.status(400).json({ message: 'Sélectionnez une nouvelle photo de justificatif.' });
  }

  try {
    const proofImageUrl = await persistDeliveryProofFile(req.file, {
      category: 'parcel-authorization'
    });
    const parcelRequest = await replaceParcelAuthorizationProof({
      id,
      requesterId: req.user.id || req.user._id,
      proofImageUrl
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
