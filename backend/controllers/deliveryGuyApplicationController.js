import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import DeliveryGuyApplication from '../models/deliveryGuyApplicationModel.js';
import DeliveryGuy from '../models/deliveryGuyModel.js';
import User from '../models/userModel.js';
import { uploadToCloudinary } from '../utils/cloudinaryUploader.js';
import {
  createNotification,
  resolveValidationTaskNotifications
} from '../utils/notificationService.js';
import { createAuditLogEntry } from '../services/auditLogService.js';
import { getRuntimeConfig } from '../services/configService.js';
import { buildPhoneCandidates } from '../utils/firebaseVerification.js';
import { resolveCanonicalLocation } from '../services/locationSelectionService.js';

const clean = (value) => String(value || '').trim();
const isTrue = (value) => ['true', '1', 'yes', 'oui', 'on'].includes(clean(value).toLowerCase());
const baseRequiredFiles = [
  ['identityFront', 'recto de la pièce d’identité'],
  ['identityBack', 'verso de la pièce d’identité'],
  ['vehiclePhoto', 'photo du véhicule'],
  ['platePhoto', 'photo de la plaque']
];
const driverLicenseFile = ['driverLicensePhoto', 'photo du permis de conduire'];

const uploadApplicationFiles = async (files, userId) => {
  const availableFiles = [...baseRequiredFiles, driverLicenseFile]
    .filter(([field]) => files?.[field]?.[0]);
  const entries = await Promise.all(
    availableFiles.map(async ([field]) => {
      const file = files?.[field]?.[0];
      const uploaded = await uploadToCloudinary({
        buffer: file.buffer,
        resourceType: 'image',
        folder: `delivery-applications/${userId}/${field}`,
        originalName: file.originalname
      });
      return [field, uploaded.secure_url || uploaded.url];
    })
  );
  return Object.fromEntries(entries);
};

const notifyReviewers = async ({ application, applicant }) => {
  const reviewers = await User.find({
    $or: [
      { role: { $in: ['admin', 'founder'] } },
      { canManageDelivery: true }
    ],
    isActive: { $ne: false }
  }).select('_id role').lean();

  await Promise.all(reviewers.map((reviewer) => createNotification({
    userId: reviewer._id,
    actorId: applicant._id,
    type: 'validation_required',
    audience: String(reviewer.role).toLowerCase() === 'founder' ? 'FOUNDER' : 'ADMIN',
    targetRole: [String(reviewer.role || 'ADMIN').toUpperCase()],
    actionRequired: true,
    actionType: 'REVIEW',
    actionStatus: 'PENDING',
    validationType: 'deliveryOps',
    deepLink: `/admin/delivery-guys?applicationId=${application._id}`,
    actionLink: `/admin/delivery-guys?applicationId=${application._id}`,
    entityType: 'user',
    entityId: String(application._id),
    title: 'Nouvelle candidature livreur',
    message: `${applicant.name || application.fullName} a envoyé ses justificatifs pour devenir livreur.`,
    actionLabel: 'Examiner le dossier',
    metadata: {
      applicationId: String(application._id),
      applicantName: application.fullName,
      phone: application.phone,
      plateNumber: application.plateNumber
    }
  })));
};

export const getMyDeliveryGuyApplication = asyncHandler(async (req, res) => {
  const [application, driverLicenseRequired] = await Promise.all([
    DeliveryGuyApplication.findOne({ user: req.user.id }).sort({ createdAt: -1 }).lean(),
    getRuntimeConfig('delivery_application_driver_license_required', { fallback: false })
  ]);
  res.json({
    application: application || null,
    requirements: { driverLicenseRequired: isTrue(driverLicenseRequired) }
  });
});

export const createDeliveryGuyApplication = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ message: 'Utilisateur introuvable.' });
  if (String(user.role).toLowerCase() === 'delivery_agent') {
    return res.status(409).json({ message: 'Votre compte possède déjà un accès livreur.' });
  }

  const pending = await DeliveryGuyApplication.findOne({ user: user._id, status: 'pending' }).lean();
  if (pending) {
    return res.status(409).json({ message: 'Vous avez déjà une candidature en cours de vérification.' });
  }

  const driverLicenseRequired = isTrue(
    await getRuntimeConfig('delivery_application_driver_license_required', { fallback: false })
  );
  const submittedIdentityType = clean(req.body.identityType) || 'national_id';
  const separateDriverLicenseRequired =
    driverLicenseRequired && submittedIdentityType !== 'driver_license';
  const requiredFiles = separateDriverLicenseRequired
    ? [...baseRequiredFiles, driverLicenseFile]
    : baseRequiredFiles;
  const missingFiles = requiredFiles
    .filter(([field]) => !req.files?.[field]?.[0])
    .map(([, label]) => label);
  if (missingFiles.length) {
    return res.status(400).json({ message: `Ajoutez les justificatifs manquants : ${missingFiles.join(', ')}.` });
  }
  const oversizedFile = [...baseRequiredFiles, driverLicenseFile]
    .find(([field]) => Number(req.files?.[field]?.[0]?.size || 0) > 10 * 1024 * 1024);
  if (oversizedFile) {
    return res.status(413).json({ message: `Le fichier « ${oversizedFile[1]} » dépasse 10 Mo.` });
  }

  const fields = {
    fullName: clean(req.body.fullName || user.name),
    phone: clean(req.body.phone || user.phone),
    identityType: submittedIdentityType,
    identityNumber: clean(req.body.identityNumber),
    vehicleType: clean(req.body.vehicleType) || 'motorcycle',
    vehicleBrand: clean(req.body.vehicleBrand),
    vehicleModel: clean(req.body.vehicleModel),
    vehicleColor: clean(req.body.vehicleColor),
    plateNumber: clean(req.body.plateNumber).toUpperCase(),
    vehicleOwnership: clean(req.body.vehicleOwnership) || 'self',
    vehicleOwnerName: clean(req.body.vehicleOwnerName),
    vehicleOwnerPhone: clean(req.body.vehicleOwnerPhone),
    driverLicenseNumber:
      clean(req.body.driverLicenseNumber) ||
      (submittedIdentityType === 'driver_license' ? clean(req.body.identityNumber) : ''),
    serviceCityId: clean(req.body.serviceCityId),
    serviceCommuneId: clean(req.body.serviceCommuneId),
    serviceCity: clean(req.body.serviceCity),
    serviceCommune: clean(req.body.serviceCommune),
    emergencyContactName: clean(req.body.emergencyContactName),
    emergencyContactPhone: clean(req.body.emergencyContactPhone),
    emergencyContactRelationship: clean(req.body.emergencyContactRelationship),
    applicantNote: clean(req.body.applicantNote)
  };
  const requiredTextFields = [
    ['fullName', 'nom complet'], ['phone', 'numéro de téléphone'],
    ['identityNumber', 'numéro de la pièce d’identité'], ['vehicleBrand', 'marque du véhicule'],
    ['vehicleColor', 'couleur du véhicule'], ['plateNumber', 'numéro de plaque'],
    ['serviceCity', 'ville de service'],
    ['emergencyContactName', 'nom du contact d’urgence'],
    ['emergencyContactPhone', 'téléphone du contact d’urgence'],
    ['emergencyContactRelationship', 'lien de parenté du contact d’urgence']
  ];
  if (separateDriverLicenseRequired) {
    requiredTextFields.push(['driverLicenseNumber', 'numéro du permis']);
  }
  const missingText = requiredTextFields.filter(([key]) => !fields[key]).map(([, label]) => label);
  if (missingText.length) {
    return res.status(400).json({ message: `Complétez les champs requis : ${missingText.join(', ')}.` });
  }
  if (!['national_id', 'passport', 'driver_license'].includes(fields.identityType)) {
    return res.status(400).json({ message: 'Type de pièce d’identité invalide.' });
  }
  if (!['motorcycle', 'bike', 'car', 'van', 'other'].includes(fields.vehicleType)) {
    return res.status(400).json({ message: 'Type de véhicule invalide.' });
  }
  if (!['self', 'family', 'borrowed', 'rented', 'employer', 'other'].includes(fields.vehicleOwnership)) {
    return res.status(400).json({ message: 'Statut de propriété du véhicule invalide.' });
  }
  const serviceLocation = await resolveCanonicalLocation({
    cityId: fields.serviceCityId,
    communeId: fields.serviceCommuneId,
    cityName: fields.serviceCity,
    communeName: fields.serviceCommune
  });
  const ownsVehicle = fields.vehicleOwnership === 'self';
  if (!ownsVehicle && (!fields.vehicleOwnerName || !fields.vehicleOwnerPhone)) {
    return res.status(400).json({
      message: 'Indiquez le nom et le téléphone du propriétaire du véhicule.'
    });
  }
  if (!ownsVehicle && !isTrue(req.body.vehicleUseAuthorized)) {
    return res.status(400).json({
      message: 'Confirmez que le propriétaire vous autorise à utiliser ce véhicule pour les livraisons.'
    });
  }
  if (!isTrue(req.body.phoneRegisteredInOwnName)) {
    return res.status(400).json({ message: 'Le numéro Mobile Money doit être enregistré au nom du candidat.' });
  }
  if (!isTrue(req.body.declarationsAccepted)) {
    return res.status(400).json({ message: 'Vous devez certifier l’exactitude des informations fournies.' });
  }

  const emergencyPhoneCandidates = buildPhoneCandidates(fields.emergencyContactPhone);
  const emergencyContactUser = emergencyPhoneCandidates.length
    ? await User.findOne({ phone: { $in: emergencyPhoneCandidates } }).select('_id').lean()
    : null;
  if (emergencyContactUser && String(emergencyContactUser._id) === String(user._id)) {
    return res.status(400).json({ message: 'Le contact d’urgence doit être une autre personne.' });
  }

  const urls = await uploadApplicationFiles(req.files, user._id);
  const application = await DeliveryGuyApplication.create({
    user: user._id,
    ...fields,
    serviceCityId: serviceLocation.cityId,
    serviceCommuneId: serviceLocation.communeId,
    serviceCity: serviceLocation.cityName,
    serviceCommune: serviceLocation.communeName,
    phoneRegisteredInOwnName: true,
    vehicleOwnerName: ownsVehicle ? fields.fullName : fields.vehicleOwnerName,
    vehicleOwnerPhone: ownsVehicle ? fields.phone : fields.vehicleOwnerPhone,
    vehicleUseAuthorized: ownsVehicle || isTrue(req.body.vehicleUseAuthorized),
    emergencyContactUser: emergencyContactUser?._id || null,
    declarationsAccepted: true,
    identityFrontUrl: urls.identityFront,
    identityBackUrl: urls.identityBack,
    vehiclePhotoUrl: urls.vehiclePhoto,
    platePhotoUrl: urls.platePhoto,
    driverLicensePhotoUrl:
      urls.driverLicensePhoto ||
      (submittedIdentityType === 'driver_license' ? urls.identityFront : '')
  });
  await notifyReviewers({ application, applicant: user });
  res.status(201).json({
    message: 'Votre candidature a été envoyée. Vous serez notifié après vérification.',
    application
  });
});

export const listDeliveryGuyApplicationsAdmin = asyncHandler(async (req, res) => {
  const status = ['pending', 'approved', 'rejected'].includes(clean(req.query.status))
    ? clean(req.query.status)
    : 'pending';
  const applications = await DeliveryGuyApplication.find({ status })
    .populate('user', 'name email phone profileImage role')
    .populate('emergencyContactUser', 'name email phone profileImage')
    .populate('reviewedBy', 'name')
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();
  res.json({ applications });
});

export const reviewDeliveryGuyApplicationAdmin = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Candidature invalide.' });
  }
  const decision = clean(req.body.decision).toLowerCase();
  const reviewNote = clean(req.body.reviewNote);
  if (!['approve', 'reject'].includes(decision)) {
    return res.status(400).json({ message: 'Décision invalide.' });
  }
  if (decision === 'reject' && !reviewNote) {
    return res.status(400).json({ message: 'Expliquez la raison du refus.' });
  }

  const application = await DeliveryGuyApplication.findById(id);
  if (!application) return res.status(404).json({ message: 'Candidature introuvable.' });
  if (application.status !== 'pending') {
    return res.status(409).json({ message: 'Cette candidature a déjà été traitée.' });
  }
  const applicant = await User.findById(application.user);
  if (!applicant) return res.status(404).json({ message: 'Candidat introuvable.' });

  let deliveryGuy = null;
  const previousRole = applicant.role;
  if (decision === 'approve') {
    deliveryGuy = await DeliveryGuy.findOne({ userId: applicant._id });
    if (!deliveryGuy) {
      deliveryGuy = new DeliveryGuy({ userId: applicant._id });
    }
    deliveryGuy.fullName = application.fullName;
    deliveryGuy.name = application.fullName;
    deliveryGuy.phone = application.phone;
    deliveryGuy.photoUrl = String(applicant.profileImage || '').trim() || application.vehiclePhotoUrl;
    deliveryGuy.vehicleType = application.vehicleType;
    deliveryGuy.vehicleBrand = application.vehicleBrand;
    deliveryGuy.vehicleModel = application.vehicleModel;
    deliveryGuy.vehicleColor = application.vehicleColor;
    deliveryGuy.plateNumber = application.plateNumber;
    deliveryGuy.vehiclePhotoUrl = application.vehiclePhotoUrl;
    deliveryGuy.platePhotoUrl = application.platePhotoUrl;
    deliveryGuy.vehicleOwnership = application.vehicleOwnership;
    deliveryGuy.vehicleOwnerName = application.vehicleOwnerName;
    deliveryGuy.vehicleOwnerPhone = application.vehicleOwnerPhone;
    deliveryGuy.phoneRegisteredInOwnName = true;
    deliveryGuy.emergencyContactUser = application.emergencyContactUser || null;
    deliveryGuy.emergencyContactName = application.emergencyContactName;
    deliveryGuy.emergencyContactPhone = application.emergencyContactPhone;
    deliveryGuy.emergencyContactRelationship = application.emergencyContactRelationship;
    deliveryGuy.cityId = application.serviceCityId;
    deliveryGuy.communes = application.serviceCommuneId ? [application.serviceCommuneId] : [];
    deliveryGuy.identityVerifiedAt = new Date();
    deliveryGuy.driverLicenseVerifiedAt =
      application.driverLicenseNumber && application.driverLicensePhotoUrl ? new Date() : null;
    deliveryGuy.isActive = true;
    deliveryGuy.active = true;
    deliveryGuy.notes = [
      `Plaque: ${application.plateNumber}`,
      `Véhicule: ${application.vehicleBrand} ${application.vehicleModel} ${application.vehicleColor}`,
      `Zone: ${application.serviceCommune ? `${application.serviceCommune}, ` : ''}${application.serviceCity}`
    ].filter(Boolean).join(' · ');
    await deliveryGuy.save();
    applicant.role = 'delivery_agent';
    applicant.phone = application.phone;
    applicant.sessionsInvalidatedAt = new Date();
    await applicant.save();
    application.deliveryGuy = deliveryGuy._id;
  }

  application.status = decision === 'approve' ? 'approved' : 'rejected';
  application.reviewedBy = req.user.id;
  application.reviewedAt = new Date();
  application.reviewNote = reviewNote;
  await application.save();
  await resolveValidationTaskNotifications({
    entityType: 'user',
    entityId: String(application._id),
    actionStatus: 'DONE',
    actorId: req.user.id,
    validationType: 'deliveryOps'
  }).catch(() => {});

  await createAuditLogEntry({
    performedBy: req.user.id,
    targetUser: applicant._id,
    actionType: decision === 'approve' ? 'delivery_application_approved' : 'delivery_application_rejected',
    previousValue: { role: previousRole, status: 'pending' },
    newValue: { role: applicant.role, status: application.status, applicationId: String(application._id) },
    req
  });
  await createNotification({
    userId: applicant._id,
    actorId: req.user.id,
    type: 'validation_required',
    allowSelf: true,
    deepLink: decision === 'approve' ? '/delivery/dashboard' : '/delivery/apply',
    entityType: 'user',
    entityId: String(application._id),
    title: decision === 'approve' ? 'Candidature livreur approuvée' : 'Candidature livreur refusée',
    message: decision === 'approve'
      ? 'Votre accès livreur est activé. Reconnectez-vous pour ouvrir votre espace de livraison.'
      : `Votre candidature n’a pas été acceptée.${reviewNote ? ` Motif : ${reviewNote}` : ''}`,
    actionLabel: decision === 'approve' ? 'Ouvrir l’espace livreur' : 'Voir ma candidature',
    metadata: { applicationId: String(application._id), decision }
  });

  res.json({
    message: decision === 'approve' ? 'Candidature approuvée et profil livreur activé.' : 'Candidature refusée.',
    application,
    deliveryGuy
  });
});
