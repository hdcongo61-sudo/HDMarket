import asyncHandler from 'express-async-handler';
import ShopConversionRequest from '../models/shopConversionRequestModel.js';
import User from '../models/userModel.js';
import Country from '../models/countryModel.js';
import { uploadToCloudinary, destroyCloudinaryAsset } from '../utils/cloudinaryUploader.js';
import {
  createNotification,
  resolveValidationTaskNotifications
} from '../utils/notificationService.js';
import { SETTING_KEYS } from '../utils/settingsResolver.js';
import {
  buildShopNameExactRegex,
  findShopNameConflict,
  normalizeShopName
} from '../utils/shopNameUtils.js';
import { getRuntimeConfig } from '../services/configService.js';
import { ensureDefaultCountry, getAdminCountryFilter, assertCountryRecordAccess } from '../services/countryService.js';
import { hasPermission } from '../services/rbacService.js';
import crypto from 'crypto';
import PawaPayCheckout from '../models/pawapayCheckoutModel.js';
import { initiatePawaPayRefund, getPawaPayRefundStatus } from '../services/pawapayService.js';
import { shouldHonorConversionRequestAmount } from '../utils/shopConversionPolicy.js';

const normalizeBoolean = (value, fallback = false) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'oui', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'non', 'off', ''].includes(normalized)) return false;
  }
  return fallback;
};

const normalizeLimitNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.floor(parsed));
};

const getShopCreationLimitState = async (countryId = '') => {
  const [limitRaw, periodRaw] = await Promise.all([
    getRuntimeConfig('shop_creation_limit_count', { countryId, fallback: 100 }),
    getRuntimeConfig('shop_creation_limit_period_days', { countryId, fallback: 30 })
  ]);
  const limit = normalizeLimitNumber(limitRaw, 100);
  const periodDays = Math.max(1, normalizeLimitNumber(periodRaw, 30));
  const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);
  const createdCount = await ShopConversionRequest.countDocuments({
    status: 'approved',
    processedAt: { $gte: since },
    ...(countryId ? { countryId } : {})
  });
  return {
    limit,
    periodDays,
    createdCount,
    reached: createdCount >= limit
  };
};

const assertShopConversionOpen = async (countryId = '') => {
  const enabled = normalizeBoolean(
    await getRuntimeConfig('enable_shop_conversion', { countryId, fallback: true }),
    true
  );
  if (!enabled) {
    return {
      ok: false,
      status: 403,
      message: 'Les demandes Devenir Boutique sont temporairement désactivées.'
    };
  }

  const limitState = await getShopCreationLimitState(countryId);
  if (limitState.reached) {
    return {
      ok: false,
      status: 429,
      message: `Limite atteinte: ${limitState.limit} boutique(s) peuvent être créées sur ${limitState.periodDays} jour(s).`
    };
  }

  return { ok: true, limitState };
};

const ensureConversionAdmin = (req) => {
  const role = String(req.user?.role || '').toLowerCase();
  if (['admin', 'founder'].includes(role) || hasPermission(req.user, 'manage_sellers')) return;
  const error = new Error('Vous n’êtes pas autorisé à gérer les conversions boutique.');
  error.status = 403;
  throw error;
};

const notifyShopConversionManagers = async ({ request, user }) => {
  const admins = await User.find({
    role: { $in: ['admin', 'founder', 'manager'] }
  })
    .select('_id role')
    .lean();
  const metadata = {
    requestId: request._id.toString(),
    shopName: request.shopName,
    userName: user.name,
    userEmail: user.email,
    userPhone: user.phone,
    paymentAmount: request.paymentAmount,
    paymentMethod: 'pawapay',
    paymentStatus: request.paymentStatus,
    operator: 'PawaPay',
    transactionNumber: request.pawaPayCheckoutId,
    requiredDocuments: ['shopPaper', 'shopInvoice', 'insidePhoto', 'outsidePhoto']
  };

  await Promise.all(
    admins
      .filter((admin) => String(admin._id) !== String(user._id))
      .map((admin) =>
        createNotification({
          userId: admin._id,
          actorId: user._id,
          type: 'shop_conversion_request',
          audience:
            String(admin.role || '').toLowerCase() === 'founder'
              ? 'FOUNDER'
              : String(admin.role || '').toLowerCase() === 'admin'
                ? 'ADMIN'
                : 'ROLE_GROUP',
          targetRole: [String(admin.role || 'ADMIN').toUpperCase()],
          actionRequired: true,
          actionType: 'APPROVE',
          actionStatus: 'PENDING',
          deepLink: `/admin/users?shopConversionRequestId=${request._id}`,
          actionLink: `/admin/users?shopConversionRequestId=${request._id}`,
          entityType: 'shopConversionRequest',
          entityId: String(request._id),
          validationType: 'shopConversion',
          metadata,
          allowSelf: false
        })
      )
  );
};

/**
 * Create a shop conversion request (for particulier users only)
 */
export const createShopConversionRequest = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) {
    return res.status(404).json({ message: 'Utilisateur introuvable.' });
  }

  // Only allow non-shop users to create requests
  if (user.accountType === 'shop') {
    return res.status(400).json({
      message: 'Les boutiques ne peuvent pas faire une demande de conversion.'
    });
  }

  // Becoming a shop is a trust-elevating action — require a verified phone
  // first (accounts can be unverified when SMS verification was optional at
  // registration, see registration_sms_verification_required).
  if (!user.phoneVerified) {
    return res.status(403).json({
      message: 'Vérifiez d’abord votre numéro de téléphone depuis votre profil avant de faire une demande Devenir Boutique.',
      code: 'PHONE_NOT_VERIFIED'
    });
  }

  const country = user.countryId
    ? (await Country.findById(user.countryId).lean()) || await ensureDefaultCountry()
    : await ensureDefaultCountry();
  const countryId = country?._id || user.countryId || null;
  const conversionState = await assertShopConversionOpen(countryId);
  if (!conversionState.ok) {
    return res.status(conversionState.status).json({ message: conversionState.message });
  }

  // Check if user already has a pending request
  const existingPending = await ShopConversionRequest.findOne({
    user: user._id,
    status: { $in: ['awaiting_payment', 'pending'] }
  });
  if (existingPending) {
    return res.status(400).json({
      message: 'Vous avez déjà une demande en attente de traitement.'
    });
  }

  const { shopName, shopAddress, shopDescription, paymentAmount } = req.body;
  const paymentMethod = 'pawapay';
  const normalizedShopName = normalizeShopName(shopName);

  // Validate required fields
  if (!normalizedShopName) {
    return res.status(400).json({ message: 'Le nom de la boutique est requis.' });
  }
  if (!shopAddress || !shopAddress.trim()) {
    return res.status(400).json({ message: "L'adresse de la boutique est requise." });
  }

  const existingShopConflict = await findShopNameConflict({
    shopName: normalizedShopName
  });
  if (existingShopConflict) {
    return res.status(409).json({ message: 'Ce nom de boutique est déjà utilisé.' });
  }

  const pendingNameMatcher = buildShopNameExactRegex(normalizedShopName);
  if (pendingNameMatcher) {
    const existingPendingName = await ShopConversionRequest.findOne({
      status: 'pending',
      user: { $ne: user._id },
      shopName: { $regex: pendingNameMatcher }
    })
      .select('_id')
      .lean();
    if (existingPendingName) {
      return res.status(409).json({
        message:
          'Une autre demande de conversion utilise déjà ce nom de boutique. Veuillez choisir un nom différent.'
      });
    }
  }

  const configuredAmount = Number(await getRuntimeConfig(SETTING_KEYS.SHOP_CONVERSION_AMOUNT, {
    countryId,
    fallback: 50000
  }));
  const requiredAmount = Number.isFinite(configuredAmount) && configuredAmount > 0 ? configuredAmount : 50000;

  // Validate payment amount based on admin setting
  const amount = Number(paymentAmount) || 0;
  if (amount !== requiredAmount) {
    return res.status(400).json({
      message: `Le montant du paiement doit être de ${requiredAmount.toLocaleString('fr-FR')} FCFA.`
    });
  }

  const verificationFileDefinitions = [
    ['shopPaper', 'papier officiel de la boutique'],
    ['shopInvoice', 'facture portant le nom de la boutique'],
    ['insidePhoto', 'photo intérieure de la boutique'],
    ['outsidePhoto', 'photo extérieure de la boutique']
  ];
  const missingVerificationFiles = verificationFileDefinitions
    .filter(([key]) => !req.files?.[key]?.[0])
    .map(([, label]) => label);
  if (missingVerificationFiles.length) {
    return res.status(400).json({
      message: `Informations incomplètes. Ajoutez les 4 justificatifs requis : ${missingVerificationFiles.join(', ')}.`
    });
  }

  const verificationDocuments = {};
  const verificationDocumentsPublicIds = {};
  try {
    const uploads = await Promise.all(
      verificationFileDefinitions.map(async ([key]) => {
        const uploaded = await uploadToCloudinary({
          buffer: req.files[key][0].buffer,
          resourceType: 'image',
          folder: `shop-conversions/verification/${key}`,
          options: { quality: 'auto', fetch_format: 'auto', flags: 'progressive' }
        });
        return [key, uploaded.secure_url || uploaded.url || '', uploaded.public_id || ''];
      })
    );
    uploads.forEach(([key, url, publicId]) => {
      verificationDocuments[key] = url;
      verificationDocumentsPublicIds[key] = publicId;
    });
  } catch (error) {
    console.error('Shop verification upload error:', error);
    return res.status(500).json({ message: 'Erreur lors de l’envoi des justificatifs de la boutique.' });
  }

  // Handle logo upload
  let shopLogoUrl = '';
  let shopLogoPublicId = '';
  const logoFile = req.files?.shopLogo?.[0] || req.file || null;
  if (logoFile) {
    try {
      const uploaded = await uploadToCloudinary({
        buffer: logoFile.buffer,
        resourceType: 'image',
        folder: 'shop-conversions/logos',
        options: {
          transformation: [
            { width: 500, height: 500, crop: 'fill', gravity: 'auto' },
            { quality: 'auto', fetch_format: 'auto', flags: 'progressive' }
          ]
        }
      });
      shopLogoUrl = uploaded.secure_url || uploaded.url;
      shopLogoPublicId = uploaded.public_id || '';
    } catch (error) {
      console.error('Logo upload error:', error);
      return res.status(500).json({ message: 'Erreur lors de l\'upload du logo.' });
    }
  }

  // Store the business documents first. The request becomes reviewable only
  // after PawaPay confirms the checkout.
  const request = await ShopConversionRequest.create({
    user: user._id,
    countryId,
    currency: String(user.preferredCurrency || country?.currency?.code || 'XAF').toUpperCase(),
    shopName: normalizedShopName,
    shopAddress: shopAddress.trim(),
    shopLogo: shopLogoUrl,
    shopDescription: (shopDescription || '').trim(),
    verificationDocuments,
    paymentProof: '',
    paymentAmount: amount,
    feeSnapshot: amount,
    paymentMethod,
    paymentStatus: 'awaiting_payment',
    operator: 'PawaPay',
    transactionName: 'PawaPay',
    transactionNumber: '',
    status: 'awaiting_payment',
    verificationDocumentsPublicIds,
    shopLogoPublicId
  });

  res.status(201).json({
    message: 'Dossier enregistré. Finalisez le paiement sécurisé avec PawaPay.',
    request: {
      _id: request._id,
      shopName: request.shopName,
      status: request.status,
      paymentStatus: request.paymentStatus,
      createdAt: request.createdAt
    }
  });
});

export const completeShopConversionPawaPay = async ({ checkout, requestId }) => {
  const request = await ShopConversionRequest.findOne({
    _id: requestId,
    user: checkout.user
  });
  if (!request) throw new Error('Demande de conversion en boutique introuvable.');
  if (request.paymentStatus === 'paid') {
    return {
      request,
      message: 'Demande boutique déjà payée avec PawaPay.'
    };
  }
  if (request.status !== 'awaiting_payment') {
    throw new Error('Cette demande boutique ne peut plus être payée.');
  }

  if (!shouldHonorConversionRequestAmount({
    requestAmount: request.paymentAmount,
    checkoutAmount: checkout.amount
  })) {
    throw new Error('Le montant confirmé par PawaPay ne correspond pas aux frais boutique.');
  }

  request.paymentStatus = 'paid';
  request.status = 'pending';
  request.operator = 'PawaPay';
  request.transactionName = 'PawaPay';
  request.transactionNumber = checkout.providerTransactionId || checkout.depositId || checkout.checkoutId;
  request.pawaPayCheckoutId = checkout.checkoutId;
  await request.save();

  const user = await User.findById(checkout.user).select('name email phone');
  if (user) {
    await notifyShopConversionManagers({ request, user }).catch((error) => {
      console.error('Failed to notify staff about paid shop conversion:', error);
    });
  }

  return {
    request,
    message: 'Paiement PawaPay confirmé. Votre demande boutique est en cours de vérification.'
  };
};

/**
 * Get user's shop conversion requests
 */
export const getUserShopConversionRequests = asyncHandler(async (req, res) => {
  const requests = await ShopConversionRequest.find({ user: req.user.id })
    .sort({ createdAt: -1 })
    .populate('processedBy', 'name email')
    .lean();

  res.json(requests);
});

/**
 * Get all shop conversion requests (admin only)
 */
export const getAllShopConversionRequests = asyncHandler(async (req, res) => {
  ensureConversionAdmin(req);
  const { status } = req.query;
  const countryFilter = getAdminCountryFilter(req.user, { countryId: req.query.countryId });
  const filter = { ...(countryFilter || {}) };
  if (status && ['pending', 'approved', 'rejected'].includes(status)) {
    filter.status = status;
  }

  const requests = await ShopConversionRequest.find(filter)
    .sort({ createdAt: -1 })
    .populate('user', 'name email phone accountType')
    .populate('processedBy', 'name email')
    .lean();

  res.json(requests);
});

/**
 * Get a single shop conversion request (admin only)
 */
export const getShopConversionRequest = asyncHandler(async (req, res) => {
  ensureConversionAdmin(req);
  const { id } = req.params;
  const request = await ShopConversionRequest.findById(id)
    .populate('user', 'name email phone accountType')
    .populate('processedBy', 'name email')
    .lean();

  if (!request) {
    return res.status(404).json({ message: 'Demande introuvable.' });
  }
  assertCountryRecordAccess(request, req);

  res.json(request);
});

/**
 * Approve a shop conversion request (admin only)
 */
export const approveShopConversionRequest = asyncHandler(async (req, res) => {
  ensureConversionAdmin(req);
  const { id } = req.params;
  const request = await ShopConversionRequest.findById(id).populate('user');

  if (!request) {
    return res.status(404).json({ message: 'Demande introuvable.' });
  }
  assertCountryRecordAccess(request, req);

  if (request.status !== 'pending') {
    return res.status(400).json({ message: 'Cette demande a déjà été traitée.' });
  }
  if (request.paymentMethod === 'pawapay' && request.paymentStatus !== 'paid') {
    return res.status(400).json({
      message: 'Le paiement PawaPay doit être confirmé avant l’approbation de cette demande.'
    });
  }
  const requiredDocumentKeys = ['shopPaper', 'shopInvoice', 'insidePhoto', 'outsidePhoto'];
  const missingDocuments = requiredDocumentKeys.filter(
    (key) => !String(request.verificationDocuments?.[key] || '').trim()
  );
  if (missingDocuments.length) {
    return res.status(400).json({
      message: 'Demande incomplète : les quatre justificatifs de la boutique sont obligatoires avant approbation.'
    });
  }

  const user = request.user;
  if (!user) {
    return res.status(404).json({ message: 'Utilisateur introuvable.' });
  }

  const normalizedShopName = normalizeShopName(request.shopName);
  if (!normalizedShopName) {
    return res.status(400).json({ message: 'Le nom de la boutique est invalide.' });
  }
  const existingShopConflict = await findShopNameConflict({
    shopName: normalizedShopName,
    excludeUserId: user._id
  });
  if (existingShopConflict) {
    return res.status(409).json({
      message:
        'Impossible d’approuver: ce nom de boutique est déjà utilisé. Modifiez la demande avant validation.'
    });
  }

  // Update user account type
  user.accountType = 'shop';
  user.shopName = normalizedShopName;
  user.shopAddress = request.shopAddress;
  user.shopLogo = request.shopLogo || '';
  user.shopDescription = request.shopDescription || '';
  // A conversion is tied to the market whose fee and review rules were used.
  // Persist that market on the account so later product creation, payments,
  // and public visibility checks cannot drift back to a legacy/default country.
  if (request.countryId) {
    user.countryId = request.countryId;
    user.selectedCountryId = request.countryId;
    user.preferredCurrency = String(request.currency || user.preferredCurrency || 'XAF').toUpperCase();
  }
  user.shopVerified = false; // Will need separate verification
  user.shopVerificationSnapshot = { verified: false, verifiedBy: null, verifiedAt: null };
  user.accountTypeChangedBy = req.user.id;
  user.accountTypeChangedAt = new Date();
  await user.save();

  // Update request status
  request.status = 'approved';
  request.processedBy = req.user.id;
  request.processedAt = new Date();
  await request.save();

  // Notify the user that their conversion was approved
  try {
    await createNotification({
      userId: user._id,
      actorId: req.user.id,
      type: 'shop_conversion_approved',
      metadata: {
        requestId: request._id.toString(),
        shopName: request.shopName
      },
      allowSelf: false
    });
  } catch (error) {
    console.error('Failed to send approval notification to user:', error);
  }

  await resolveValidationTaskNotifications({
    entityType: 'shopConversionRequest',
    entityId: String(request._id),
    actionStatus: 'DONE',
    actorId: req.user.id,
    validationType: 'shopConversion'
  }).catch(() => {});

  res.json({
    message: 'Demande approuvée. Le compte a été converti en boutique.',
    request
  });
});

const conversionRefundStatus = (value) => {
  const status = String(value || '').toUpperCase();
  if (['COMPLETED', 'SUCCESSFUL'].includes(status)) return 'completed';
  if (['FAILED', 'REJECTED', 'CANCELLED', 'EXPIRED'].includes(status)) return 'failed';
  return 'processing';
};

export const reconcileShopConversionRefund = async (refundId, payload) => {
  const request = await ShopConversionRequest.findOne({ refundId });
  if (!request) return null;
  const status = conversionRefundStatus(payload?.status || payload?.data?.status);
  const reason = payload?.failureReason?.failureMessage || payload?.data?.failureReason?.failureMessage || payload?.failureReason?.message || '';
  request.refundStatus = status;
  request.refundFailureReason = status === 'failed' ? String(reason || 'Le remboursement PawaPay a échoué.').slice(0, 500) : '';
  if (status === 'completed') request.paymentStatus = 'refunded';
  await request.save();
  return request;
};

const refundPaidConversionRequest = async (request) => {
  if (request.paymentStatus !== 'paid') return request;
  if (request.refundStatus === 'completed') return request;
  const checkout = request.pawaPayCheckoutId
    ? await PawaPayCheckout.findOne({ checkoutId: request.pawaPayCheckoutId }).lean()
    : null;
  const depositId = String(checkout?.depositId || '').trim();
  if (!depositId) {
    request.refundStatus = 'needs_attention';
    request.refundFailureReason = 'Le dépôt PawaPay d’origine est introuvable.';
    await request.save();
    return request;
  }
  const refundId = request.refundId || crypto.randomUUID();
  request.refundId = refundId;
  request.refundStatus = 'processing';
  request.refundFailureReason = '';
  await request.save();
  try {
    const response = await initiatePawaPayRefund({
      refundId,
      depositId,
      amount: String(request.paymentAmount),
      currency: request.currency || checkout?.currency || 'XAF',
      clientReferenceId: String(request._id),
      metadata: [{ requestId: String(request._id) }, { source: 'SHOP_CONVERSION_REJECTION' }]
    });
    return reconcileShopConversionRefund(refundId, response);
  } catch (error) {
    request.refundStatus = 'needs_attention';
    request.refundFailureReason = String(error?.message || 'Impossible de lancer le remboursement PawaPay.').slice(0, 500);
    await request.save();
    return request;
  }
};

export const cleanupAbandonedShopConversionRequests = async ({ olderThanMs = 24 * 60 * 60 * 1000, limit = 100 } = {}) => {
  const cutoff = new Date(Date.now() - Math.max(60 * 60 * 1000, Number(olderThanMs) || 0));
  const requests = await ShopConversionRequest.find({
    status: 'awaiting_payment',
    paymentStatus: 'awaiting_payment',
    createdAt: { $lt: cutoff },
    documentsCleanedAt: null
  }).sort({ createdAt: 1 }).limit(Math.min(500, Math.max(1, Number(limit) || 100)));
  let cleaned = 0;
  for (const request of requests) {
    const ids = Object.values(request.verificationDocumentsPublicIds || {}).filter(Boolean);
    if (request.shopLogoPublicId) ids.push(request.shopLogoPublicId);
    await Promise.allSettled(ids.map((publicId) => destroyCloudinaryAsset(publicId, { resourceType: 'image' })));
    request.documentsCleanedAt = new Date();
    request.verificationDocuments = {
      shopPaper: '', shopInvoice: '', insidePhoto: '', outsidePhoto: ''
    };
    request.shopLogo = '';
    request.shopLogoPublicId = '';
    await request.save();
    cleaned += 1;
  }
  return cleaned;
};

export const reconcilePendingShopConversionRefunds = async ({ limit = 25 } = {}) => {
  const requests = await ShopConversionRequest.find({
    refundStatus: { $in: ['processing', 'needs_attention'] },
    refundId: { $nin: ['', null] }
  }).sort({ updatedAt: 1 }).limit(Math.min(100, Math.max(1, Number(limit) || 25)));
  for (const request of requests) {
    try {
      const status = await getPawaPayRefundStatus(request.refundId, { timeoutMs: 12_000 });
      await reconcileShopConversionRefund(request.refundId, status);
    } catch {
      // Provider retries and the next scheduled pass remain authoritative.
    }
  }
  return requests.length;
};

/**
 * Reject a shop conversion request (admin only)
 */
export const rejectShopConversionRequest = asyncHandler(async (req, res) => {
  ensureConversionAdmin(req);
  const { id } = req.params;
  const { rejectionReason } = req.body;

  const request = await ShopConversionRequest.findById(id);

  if (!request) {
    return res.status(404).json({ message: 'Demande introuvable.' });
  }
  assertCountryRecordAccess(request, req);

  if (request.status !== 'pending') {
    return res.status(400).json({ message: 'Cette demande a déjà été traitée.' });
  }

  request.status = 'rejected';
  request.processedBy = req.user.id;
  request.processedAt = new Date();
  request.rejectionReason = (rejectionReason || '').trim();
  await request.save();
  if (request.paymentStatus === 'paid') {
    await refundPaidConversionRequest(request);
  }

  // Notify the user that their conversion was rejected
  try {
    const requestPopulated = await ShopConversionRequest.findById(request._id).populate('user').lean();
    if (requestPopulated?.user?._id) {
      await createNotification({
        userId: requestPopulated.user._id,
        actorId: req.user.id,
        type: 'shop_conversion_rejected',
        metadata: {
          requestId: request._id.toString(),
          shopName: request.shopName,
          rejectionReason: (rejectionReason || '').trim()
        },
        allowSelf: false
      });
    }
  } catch (error) {
    console.error('Failed to send rejection notification to user:', error);
  }

  await resolveValidationTaskNotifications({
    entityType: 'shopConversionRequest',
    entityId: String(request._id),
    actionStatus: 'DONE',
    actorId: req.user.id,
    validationType: 'shopConversion'
  }).catch(() => {});

  res.json({
    message: 'Demande rejetée.',
    request
  });
});
