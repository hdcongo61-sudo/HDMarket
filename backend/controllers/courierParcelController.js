/**
 * Courier-side endpoints for standalone parcel-pickup requests (see
 * services/parcelRequestService.js). Mirrors the accept/reject/stage/proof
 * lifecycle in courierDeliveryController.js closely — same field names,
 * same stage machine — but works on ParcelRequest (no Order/seller to sync)
 * and is kept in its own file so the existing, battle-tested order-delivery
 * courier flow is never touched.
 */
import asyncHandler from 'express-async-handler';
import ParcelRequest from '../models/parcelRequestModel.js';
import { createAuditLogEntry } from '../services/auditLogService.js';
import { invalidateAdminCache, invalidateUserCache } from '../utils/cache.js';
import {
  resolveCourierContext,
  ensureAssignedToCourier,
  appendTimeline,
  emitNotificationBatch,
  normalizeStage,
  ALLOWED_STAGE_TRANSITIONS,
  hashPinCode,
  hasProofContent
} from './courierDeliveryController.js';

const OBJECT_ID_REGEX = /^[a-f\d]{24}$/i;
const normalizeText = (value = '') => String(value || '').trim();
const isObjectId = (value = '') => OBJECT_ID_REGEX.test(normalizeText(value));

const loadParcelAssignmentById = async (id) =>
  ParcelRequest.findById(id).populate('assignedDeliveryGuyId', '_id userId fullName name phone photoUrl');

const toParcelAssignment = (raw) => ({
  ...raw,
  kind: 'PARCEL',
  courier: raw.assignedDeliveryGuyId || null
});

export const listCourierParcelAssignments = asyncHandler(async (req, res) => {
  const { deliveryGuy, previewMode } = await resolveCourierContext(req, { allowAdminPreview: false });
  if (previewMode) {
    return res.json({ items: [], total: 0, page: 1, totalPages: 1 });
  }

  const { status = '', page = 1, limit = 20 } = req.query || {};
  const filter = { assignedDeliveryGuyId: deliveryGuy._id };
  const normalizedStatus = normalizeText(status).toUpperCase();
  if (normalizedStatus && normalizedStatus !== 'ALL') {
    if (['PENDING', 'ACCEPTED', 'REJECTED'].includes(normalizedStatus)) {
      filter.assignmentStatus = normalizedStatus;
    } else {
      filter.status = normalizedStatus;
    }
  }

  const pageNumber = Math.max(1, Number(page) || 1);
  const pageSize = Math.max(1, Math.min(50, Number(limit) || 20));
  const [items, total] = await Promise.all([
    ParcelRequest.find(filter)
      .sort({ updatedAt: -1, createdAt: -1 })
      .skip((pageNumber - 1) * pageSize)
      .limit(pageSize)
      .populate('requesterId', 'name phone')
      .populate('assignedDeliveryGuyId', '_id userId fullName name phone photoUrl')
      .lean(),
    ParcelRequest.countDocuments(filter)
  ]);

  return res.json({
    items: items.map(toParcelAssignment),
    total,
    page: pageNumber,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize))
  });
});

export const getCourierParcelAssignmentById = asyncHandler(async (req, res) => {
  const { deliveryGuy } = await resolveCourierContext(req, { allowAdminPreview: false });
  const requestId = normalizeText(req.params?.id || '');
  if (!isObjectId(requestId)) {
    return res.status(400).json({ message: 'Course invalide.' });
  }
  const assignment = await loadParcelAssignmentById(requestId);
  if (!assignment) {
    return res.status(404).json({ message: 'Course introuvable.' });
  }
  if (!ensureAssignedToCourier(assignment, deliveryGuy._id)) {
    return res.status(403).json({ message: 'Accès refusé à cette course.' });
  }
  return res.json({ item: toParcelAssignment(assignment.toObject()) });
});

export const acceptCourierParcelAssignment = asyncHandler(async (req, res) => {
  const { deliveryGuy } = await resolveCourierContext(req, { allowAdminPreview: false });
  const requestId = normalizeText(req.params?.id || '');
  if (!isObjectId(requestId)) {
    return res.status(400).json({ message: 'Course invalide.' });
  }

  const assignment = await loadParcelAssignmentById(requestId);
  if (!assignment) {
    return res.status(404).json({ message: 'Course introuvable.' });
  }
  if (!ensureAssignedToCourier(assignment, deliveryGuy._id)) {
    return res.status(403).json({ message: 'Accès refusé à cette course.' });
  }
  if (['REJECTED', 'CANCELED', 'DELIVERED', 'FAILED'].includes(String(assignment.status || '').toUpperCase())) {
    return res.status(409).json({ message: 'Cette course est déjà clôturée.' });
  }
  if (String(assignment.assignmentStatus || '').toUpperCase() === 'ACCEPTED') {
    return res.json({ message: 'Affectation déjà acceptée.', idempotent: true, item: toParcelAssignment(assignment.toObject()) });
  }

  assignment.assignmentStatus = 'ACCEPTED';
  assignment.assignmentAcceptedAt = new Date();
  assignment.assignmentRejectedAt = null;
  assignment.assignmentRejectReason = '';
  assignment.status = 'ACCEPTED';
  assignment.currentStage = 'ACCEPTED';
  appendTimeline(assignment, {
    type: 'COURIER_ACCEPTED',
    by: req.user.id,
    meta: { courierId: String(deliveryGuy._id), courierName: deliveryGuy.fullName || deliveryGuy.name || '' }
  });
  await assignment.save();

  await emitNotificationBatch({
    actorId: req.user.id,
    recipients: [String(assignment.requesterId)],
    type: 'parcel_pickup_started',
    metadata: {
      title: 'Livreur en route',
      message: `${deliveryGuy.fullName || deliveryGuy.name || 'Le livreur'} a accepté votre course colis.`,
      parcelRequestId: assignment._id
    },
    priority: 'HIGH'
  });

  await createAuditLogEntry({
    performedBy: req.user.id,
    targetUser: assignment.requesterId,
    actionType: 'PARCEL_COURIER_ACCEPTED',
    newValue: { parcelRequestId: String(assignment._id), courierId: String(deliveryGuy._id) },
    req
  });

  await Promise.all([
    invalidateUserCache(assignment.requesterId, ['notifications']),
    invalidateAdminCache(['admin', 'dashboard', 'delivery'])
  ]);

  const hydrated = await loadParcelAssignmentById(requestId);
  return res.json({ message: 'Affectation acceptée.', item: toParcelAssignment(hydrated.toObject()) });
});

export const rejectCourierParcelAssignment = asyncHandler(async (req, res) => {
  const { deliveryGuy } = await resolveCourierContext(req, { allowAdminPreview: false });
  const requestId = normalizeText(req.params?.id || '');
  const reason = normalizeText(req.body?.reason || '');
  if (!isObjectId(requestId)) {
    return res.status(400).json({ message: 'Course invalide.' });
  }

  const assignment = await loadParcelAssignmentById(requestId);
  if (!assignment) {
    return res.status(404).json({ message: 'Course introuvable.' });
  }
  if (!ensureAssignedToCourier(assignment, deliveryGuy._id)) {
    return res.status(403).json({ message: 'Accès refusé à cette course.' });
  }

  assignment.assignmentStatus = 'REJECTED';
  assignment.assignmentRejectedAt = new Date();
  assignment.assignmentRejectReason = reason;
  assignment.assignedDeliveryGuyId = null;
  assignment.status = 'PENDING';
  assignment.currentStage = 'ASSIGNED';
  appendTimeline(assignment, {
    type: 'COURIER_REJECTED',
    by: req.user.id,
    meta: { courierId: String(deliveryGuy._id), reason }
  });
  await assignment.save();

  await emitNotificationBatch({
    actorId: req.user.id,
    recipients: [String(assignment.requesterId)],
    type: 'parcel_request_cancelled',
    metadata: {
      title: 'Livreur indisponible',
      message: 'Le livreur assigné a décliné cette course. Un autre livreur va être assigné.',
      parcelRequestId: assignment._id
    },
    priority: 'HIGH'
  });

  await createAuditLogEntry({
    performedBy: req.user.id,
    targetUser: assignment.requesterId,
    actionType: 'PARCEL_COURIER_REJECTED',
    newValue: { parcelRequestId: String(assignment._id), reason },
    req
  });

  await Promise.all([
    invalidateUserCache(assignment.requesterId, ['notifications']),
    invalidateAdminCache(['admin', 'dashboard', 'delivery'])
  ]);

  return res.json({ message: 'Course refusée.', item: toParcelAssignment(assignment.toObject()) });
});

export const updateCourierParcelStage = asyncHandler(async (req, res) => {
  const { deliveryGuy } = await resolveCourierContext(req, { allowAdminPreview: false });
  const requestId = normalizeText(req.params?.id || '');
  const nextStage = normalizeStage(req.body?.stage || req.body?.nextStage || '');
  const note = normalizeText(req.body?.note || req.body?.reason || '');
  const deliveryPinCode = normalizeText(req.body?.deliveryPinCode || '');

  if (!isObjectId(requestId)) {
    return res.status(400).json({ message: 'Course invalide.' });
  }
  if (!nextStage) {
    return res.status(400).json({ message: 'Étape invalide.' });
  }

  const assignment = await loadParcelAssignmentById(requestId);
  if (!assignment) {
    return res.status(404).json({ message: 'Course introuvable.' });
  }
  if (!ensureAssignedToCourier(assignment, deliveryGuy._id)) {
    return res.status(403).json({ message: 'Accès refusé à cette course.' });
  }

  const currentStage = normalizeStage(assignment.currentStage || 'ASSIGNED') || 'ASSIGNED';
  if (currentStage === nextStage) {
    return res.json({ message: 'Étape déjà à jour.', idempotent: true, item: toParcelAssignment(assignment.toObject()) });
  }

  const allowed = ALLOWED_STAGE_TRANSITIONS[currentStage] || [];
  if (!allowed.includes(nextStage)) {
    return res.status(409).json({ message: `Transition non autorisée: ${currentStage} -> ${nextStage}.` });
  }

  if (nextStage === 'DELIVERED') {
    const expectedHash = normalizeText(assignment.deliveryPinCodeHash || '');
    if (expectedHash) {
      if (!deliveryPinCode) {
        return res.status(400).json({ message: 'Code de livraison requis pour valider.' });
      }
      if (hashPinCode(deliveryPinCode) !== expectedHash) {
        return res.status(400).json({ message: 'Code de livraison invalide.' });
      }
      appendTimeline(assignment, { type: 'DELIVERY_PIN_VERIFIED', by: req.user.id, meta: { verified: true } });
    }
  }

  assignment.currentStage = nextStage;
  if (nextStage === 'ACCEPTED') {
    assignment.assignmentStatus = 'ACCEPTED';
    assignment.assignmentAcceptedAt = assignment.assignmentAcceptedAt || new Date();
    assignment.status = 'ACCEPTED';
  } else if (nextStage === 'FAILED') {
    assignment.status = 'FAILED';
    assignment.rejectionReason = note || assignment.rejectionReason || '';
  } else if (nextStage === 'DELIVERED') {
    assignment.status = 'DELIVERED';
  } else {
    assignment.status = 'IN_PROGRESS';
  }

  appendTimeline(assignment, {
    type: 'COURIER_STAGE_UPDATED',
    by: req.user.id,
    meta: { previousStage: currentStage, newStage: nextStage, note: note || undefined, courierId: String(deliveryGuy._id) }
  });
  await assignment.save();

  let type = 'parcel_pickup_started';
  if (nextStage === 'DELIVERED') type = 'parcel_request_delivered';
  if (nextStage === 'FAILED') type = 'parcel_request_cancelled';

  await emitNotificationBatch({
    actorId: req.user.id,
    recipients: [String(assignment.requesterId)],
    type,
    metadata: {
      title:
        nextStage === 'DELIVERED'
          ? 'Colis livré'
          : nextStage === 'FAILED'
          ? 'Course en échec'
          : 'Suivi mis à jour',
      message:
        nextStage === 'DELIVERED'
          ? 'Votre colis a été livré.'
          : nextStage === 'FAILED'
          ? note || 'La course n’a pas pu être complétée.'
          : `Étape: ${nextStage}`,
      parcelRequestId: assignment._id,
      stage: nextStage
    },
    priority: 'HIGH'
  });

  await createAuditLogEntry({
    performedBy: req.user.id,
    targetUser: assignment.requesterId,
    actionType: 'PARCEL_STAGE_UPDATED',
    previousValue: { stage: currentStage },
    newValue: { stage: nextStage, status: assignment.status },
    req
  });

  await Promise.all([
    invalidateUserCache(assignment.requesterId, ['notifications']),
    invalidateAdminCache(['admin', 'dashboard', 'delivery'])
  ]);

  const hydrated = await loadParcelAssignmentById(requestId);
  return res.json({ message: 'Étape mise à jour.', item: toParcelAssignment(hydrated.toObject()) });
});

export const uploadCourierParcelProof = asyncHandler(async (req, res) => {
  const { runtime, deliveryGuy } = await resolveCourierContext(req, { allowAdminPreview: false });
  if (!runtime.enableProofUpload) {
    return res.status(403).json({ message: 'Le dépôt de preuve est désactivé.' });
  }

  const requestId = normalizeText(req.params?.id || '');
  const proofType = String(req.body?.proofType || req.query?.proofType || '').trim().toLowerCase();
  if (!isObjectId(requestId)) {
    return res.status(400).json({ message: 'Course invalide.' });
  }
  if (!['pickup', 'delivery'].includes(proofType)) {
    return res.status(400).json({ message: 'Type de preuve invalide (pickup/delivery).' });
  }

  const assignment = await loadParcelAssignmentById(requestId);
  if (!assignment) {
    return res.status(404).json({ message: 'Course introuvable.' });
  }
  if (!ensureAssignedToCourier(assignment, deliveryGuy._id)) {
    return res.status(403).json({ message: 'Accès refusé à cette course.' });
  }
  if (proofType === 'delivery' && !hasProofContent(assignment.pickupProof || {})) {
    return res.status(409).json({ message: 'Soumettez d’abord la preuve de retrait avant la preuve de livraison.' });
  }

  const files = req.files || {};
  const photoFile = Array.isArray(files.photos) ? files.photos[0] : null;
  const signatureFile = Array.isArray(files.signatureFile) ? files.signatureFile[0] : null;
  const photoUrl = photoFile?.filename ? `uploads/delivery-proofs/${photoFile.filename}` : '';
  const signatureUrl = signatureFile?.filename
    ? `uploads/delivery-proofs/${signatureFile.filename}`
    : normalizeText(req.body?.signatureUrl || '');
  const note = normalizeText(req.body?.note || '');

  if (!photoUrl && !signatureUrl && !note) {
    return res.status(400).json({ message: 'Ajoutez au moins une photo, une signature ou une note.' });
  }

  const targetField = proofType === 'delivery' ? 'deliveryProof' : 'pickupProof';
  const previous = assignment[targetField] || {};
  assignment[targetField] = {
    photoUrl: photoUrl || previous.photoUrl || '',
    signatureUrl: signatureUrl || previous.signatureUrl || '',
    note: note || previous.note || '',
    submittedBy: req.user.id,
    submittedAt: new Date()
  };

  if (proofType === 'pickup') {
    assignment.status = 'IN_PROGRESS';
    if (['ASSIGNED', 'ACCEPTED', 'PICKUP_STARTED'].includes(normalizeStage(assignment.currentStage || 'ASSIGNED'))) {
      assignment.currentStage = 'PICKED_UP';
    }
  }
  if (proofType === 'delivery') {
    assignment.status = 'DELIVERED';
    assignment.currentStage = 'DELIVERED';
  }

  appendTimeline(assignment, {
    type: 'COURIER_PROOF_UPLOADED',
    by: req.user.id,
    meta: { proofType, hasPhoto: Boolean(photoUrl), hasSignature: Boolean(signatureUrl) }
  });
  await assignment.save();

  await emitNotificationBatch({
    actorId: req.user.id,
    recipients: [String(assignment.requesterId)],
    type: proofType === 'delivery' ? 'parcel_request_delivered' : 'parcel_pickup_started',
    metadata: {
      title: proofType === 'delivery' ? 'Colis livré' : 'Colis récupéré',
      message:
        proofType === 'delivery'
          ? 'Votre colis a été livré.'
          : 'Le livreur a récupéré votre colis et est en route.',
      parcelRequestId: assignment._id,
      proofType
    },
    priority: 'HIGH'
  });

  await createAuditLogEntry({
    performedBy: req.user.id,
    targetUser: assignment.requesterId,
    actionType: 'PARCEL_PROOF_UPLOADED',
    newValue: { parcelRequestId: String(assignment._id), proofType, stage: assignment.currentStage },
    req
  });

  await Promise.all([
    invalidateUserCache(assignment.requesterId, ['notifications']),
    invalidateAdminCache(['admin', 'dashboard', 'delivery'])
  ]);

  const hydrated = await loadParcelAssignmentById(requestId);
  return res.json({
    message: proofType === 'delivery' ? 'Preuve de livraison enregistrée.' : 'Preuve de retrait enregistrée.',
    item: toParcelAssignment(hydrated.toObject())
  });
});

export const pingParcelAgentLocation = asyncHandler(async (req, res) => {
  const { deliveryGuy } = await resolveCourierContext(req, { allowAdminPreview: false, requireAgentFlag: true });
  const requestId = normalizeText(req.body?.jobId || req.body?.parcelRequestId || '');
  if (!isObjectId(requestId)) {
    return res.status(400).json({ message: 'Course invalide.' });
  }
  const lat = Number(req.body?.lat);
  const lng = Number(req.body?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ message: 'Coordonnées invalides.' });
  }

  const assignment = await ParcelRequest.findById(requestId);
  if (!assignment) {
    return res.status(404).json({ message: 'Course introuvable.' });
  }
  if (!ensureAssignedToCourier(assignment, deliveryGuy._id)) {
    return res.status(403).json({ message: 'Accès refusé à cette course.' });
  }

  assignment.currentLocation = { type: 'Point', coordinates: [lng, lat] };
  assignment.currentLocationUpdatedAt = new Date();
  await assignment.save();

  return res.json({ success: true });
});
