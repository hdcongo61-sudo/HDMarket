import asyncHandler from 'express-async-handler';
import ShopConversionRequest from '../models/shopConversionRequestModel.js';
import User from '../models/userModel.js';
import { uploadToCloudinary } from '../utils/cloudinaryUploader.js';
import {
  createNotification,
  resolveValidationTaskNotifications
} from '../utils/notificationService.js';
import { getSettingValue, SETTING_KEYS } from '../utils/settingsResolver.js';
import {
  isTransactionCodeAlreadyUsed,
  normalizeTransactionCode,
  TRANSACTION_CODE_REUSED_MESSAGE
} from '../utils/transactionCodeService.js';
import {
  buildShopNameExactRegex,
  findShopNameConflict,
  normalizeShopName
} from '../utils/shopNameUtils.js';
import { getRuntimeConfig } from '../services/configService.js';
import { purchaseFromWallet, refundToWallet } from '../services/walletService.js';
import { getPawaPayConfig } from '../services/pawapayService.js';

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

const getShopCreationLimitState = async () => {
  const [limitRaw, periodRaw] = await Promise.all([
    getRuntimeConfig('shop_creation_limit_count', { fallback: 100 }),
    getRuntimeConfig('shop_creation_limit_period_days', { fallback: 30 })
  ]);
  const limit = normalizeLimitNumber(limitRaw, 100);
  const periodDays = Math.max(1, normalizeLimitNumber(periodRaw, 30));
  const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);
  const createdCount = await ShopConversionRequest.countDocuments({
    status: 'approved',
    processedAt: { $gte: since }
  });
  return {
    limit,
    periodDays,
    createdCount,
    reached: createdCount >= limit
  };
};

const assertShopConversionOpen = async () => {
  const enabled = normalizeBoolean(
    await getRuntimeConfig('enable_shop_conversion', { fallback: true }),
    true
  );
  if (!enabled) {
    return {
      ok: false,
      status: 403,
      message: 'Les demandes Devenir Boutique sont temporairement désactivées.'
    };
  }

  const limitState = await getShopCreationLimitState();
  if (limitState.reached) {
    return {
      ok: false,
      status: 429,
      message: `Limite atteinte: ${limitState.limit} boutique(s) peuvent être créées sur ${limitState.periodDays} jour(s).`
    };
  }

  return { ok: true, limitState };
};

/**
 * Create a shop conversion request (for particulier users only)
 */
export const createShopConversionRequest = asyncHandler(async (req, res) => {
  const conversionState = await assertShopConversionOpen();
  if (!conversionState.ok) {
    return res.status(conversionState.status).json({ message: conversionState.message });
  }

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

  // Check if user already has a pending request
  const existingPending = await ShopConversionRequest.findOne({
    user: user._id,
    status: 'pending'
  });
  if (existingPending) {
    return res.status(400).json({
      message: 'Vous avez déjà une demande en attente de traitement.'
    });
  }

  const { shopName, shopAddress, shopDescription, paymentAmount, operator, transactionName, transactionNumber } =
    req.body;
  const paymentMethod = String(req.body?.paymentMethod || 'mobile_money').trim().toLowerCase() === 'wallet'
    ? 'wallet'
    : 'mobile_money';
  const pawaPayOnly = getPawaPayConfig().exclusiveMode;
  if (pawaPayOnly && paymentMethod !== 'wallet') {
    return res.status(403).json({
      code: 'PAWAPAY_ONLY',
      message: 'Les preuves et identifiants de transaction sont désactivés. Payez avec PawaPay.'
    });
  }
  const normalizedShopName = normalizeShopName(shopName);

  // Validate required fields
  if (!normalizedShopName) {
    return res.status(400).json({ message: 'Le nom de la boutique est requis.' });
  }
  if (!shopAddress || !shopAddress.trim()) {
    return res.status(400).json({ message: "L'adresse de la boutique est requise." });
  }
  if (paymentMethod === 'mobile_money') {
    if (!transactionName || !transactionName.trim()) {
      return res.status(400).json({ message: 'Le nom de la transaction est requis.' });
    }
    if (!transactionNumber || !transactionNumber.trim()) {
      return res.status(400).json({ message: 'Le numéro de transaction est requis.' });
    }
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

  let digitsOnly = '';
  if (paymentMethod === 'mobile_money') {
    // Validate transaction number (10 digits)
    digitsOnly = normalizeTransactionCode(transactionNumber);
    if (digitsOnly.length !== 10) {
      return res.status(400).json({ message: 'Le numéro de transaction doit contenir exactement 10 chiffres.' });
    }
    const alreadyUsed = await isTransactionCodeAlreadyUsed(digitsOnly);
    if (alreadyUsed) {
      return res.status(409).json({ message: TRANSACTION_CODE_REUSED_MESSAGE });
    }

    // Validate operator
    if (!operator || !['MTN', 'Airtel'].includes(operator)) {
      return res.status(400).json({ message: 'Veuillez sélectionner un opérateur (MTN ou Airtel).' });
    }
  } else {
    const walletEnabled =
      pawaPayOnly || await getRuntimeConfig('enable_digital_wallet', { fallback: false });
    if (!walletEnabled) {
      return res.status(403).json({ message: 'Le portefeuille HDMarket est désactivé.' });
    }
  }

  const configuredAmount = Number(await getSettingValue(SETTING_KEYS.SHOP_CONVERSION_AMOUNT, 50000));
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
  try {
    const uploads = await Promise.all(
      verificationFileDefinitions.map(async ([key]) => {
        const uploaded = await uploadToCloudinary({
          buffer: req.files[key][0].buffer,
          resourceType: 'image',
          folder: `shop-conversions/verification/${key}`,
          options: { quality: 'auto', fetch_format: 'auto', flags: 'progressive' }
        });
        return [key, uploaded.secure_url || uploaded.url || ''];
      })
    );
    uploads.forEach(([key, url]) => { verificationDocuments[key] = url; });
  } catch (error) {
    console.error('Shop verification upload error:', error);
    return res.status(500).json({ message: 'Erreur lors de l’envoi des justificatifs de la boutique.' });
  }

  // Handle logo upload
  let shopLogoUrl = '';
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
    } catch (error) {
      console.error('Logo upload error:', error);
      return res.status(500).json({ message: 'Erreur lors de l\'upload du logo.' });
    }
  }

  // Handle payment proof upload
  let paymentProofUrl = paymentMethod === 'wallet' ? 'wallet-payment' : '';
  const paymentProofFile = req.files?.paymentProof?.[0] || null;
  if (paymentMethod === 'mobile_money' && !paymentProofFile) {
    return res.status(400).json({ message: 'La preuve de paiement est requise.' });
  }
  if (paymentMethod === 'mobile_money') {
    try {
      const uploaded = await uploadToCloudinary({
        buffer: paymentProofFile.buffer,
        resourceType: 'image',
        folder: 'shop-conversions/payment-proofs'
      });
      paymentProofUrl = uploaded.secure_url || uploaded.url;
    } catch (error) {
      console.error('Payment proof upload error:', error);
      return res.status(500).json({ message: 'Erreur lors de l\'upload de la preuve de paiement.' });
    }
  }

  // Create the request
  const request = await ShopConversionRequest.create({
    user: user._id,
    shopName: normalizedShopName,
    shopAddress: shopAddress.trim(),
    shopLogo: shopLogoUrl,
    shopDescription: (shopDescription || '').trim(),
    verificationDocuments,
    paymentProof: paymentProofUrl,
    paymentAmount: amount,
    paymentMethod,
    paymentStatus: paymentMethod === 'wallet' ? 'paid' : 'pending_admin_validation',
    operator: paymentMethod === 'wallet' ? 'HDMarket Wallet' : operator,
    transactionName: paymentMethod === 'wallet' ? (user.name || 'Portefeuille HDMarket') : transactionName.trim(),
    transactionNumber: paymentMethod === 'wallet' ? `wallet-${Date.now()}` : digitsOnly,
    status: 'pending'
  });

  if (paymentMethod === 'wallet') {
    try {
      const walletPayment = await purchaseFromWallet({
        userId: user._id,
        amount,
        orderId: String(request._id),
        reference: `shop-conversion-${request._id}`,
        purpose: 'shop_conversion',
        note: `Paiement Devenir Boutique — ${normalizedShopName}`,
        metadata: {
          shopConversionRequestId: String(request._id),
          role: 'shop_conversion_payment'
        }
      });
      request.walletTransactionId = String(walletPayment?.transactionId || '');
      await request.save();
    } catch (error) {
      await ShopConversionRequest.deleteOne({ _id: request._id }).catch(() => {});
      throw error;
    }
  }

  // Notify all admins about the new conversion request
  try {
    const admins = await User.find({
      role: { $in: ['admin', 'founder', 'manager'] }
    })
      .select('_id role')
      .lean();

    const actorId = user._id;
    const metadata = {
      requestId: request._id.toString(),
      shopName: normalizedShopName,
      userName: user.name,
      userEmail: user.email,
      userPhone: user.phone,
      paymentAmount: amount,
      paymentMethod,
      paymentStatus: request.paymentStatus,
      operator: request.operator,
      transactionNumber: request.transactionNumber,
      requiredDocuments: ['shopPaper', 'shopInvoice', 'insidePhoto', 'outsidePhoto']
    };

    for (const admin of admins) {
      const adminId = admin._id.toString();
      if (adminId === actorId.toString()) continue;
      await createNotification({
        userId: admin._id,
        actorId: actorId,
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
      });
    }
  } catch (error) {
    console.error('Failed to send admin notifications for shop conversion request:', error);
    // Don't fail the request if notification fails
  }

  res.status(201).json({
    message:
      paymentMethod === 'wallet'
        ? 'Demande de conversion soumise et payée avec le portefeuille HDMarket. Traitement sous 48h.'
        : 'Demande de conversion en boutique soumise avec succès. Traitement sous 48h.',
    request: {
      _id: request._id,
      shopName: request.shopName,
      status: request.status,
      createdAt: request.createdAt
    }
  });
});

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
  const { status } = req.query;
  const filter = {};
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
  const { id } = req.params;
  const request = await ShopConversionRequest.findById(id)
    .populate('user', 'name email phone accountType')
    .populate('processedBy', 'name email')
    .lean();

  if (!request) {
    return res.status(404).json({ message: 'Demande introuvable.' });
  }

  res.json(request);
});

/**
 * Approve a shop conversion request (admin only)
 */
export const approveShopConversionRequest = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const request = await ShopConversionRequest.findById(id).populate('user');

  if (!request) {
    return res.status(404).json({ message: 'Demande introuvable.' });
  }

  if (request.status !== 'pending') {
    return res.status(400).json({ message: 'Cette demande a déjà été traitée.' });
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

  const conversionState = await assertShopConversionOpen();
  if (!conversionState.ok) {
    return res.status(conversionState.status).json({ message: conversionState.message });
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
  user.shopVerified = false; // Will need separate verification
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

/**
 * Reject a shop conversion request (admin only)
 */
export const rejectShopConversionRequest = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { rejectionReason } = req.body;

  const request = await ShopConversionRequest.findById(id);

  if (!request) {
    return res.status(404).json({ message: 'Demande introuvable.' });
  }

  if (request.status !== 'pending') {
    return res.status(400).json({ message: 'Cette demande a déjà été traitée.' });
  }

  request.status = 'rejected';
  if (request.paymentMethod === 'wallet' && request.paymentStatus === 'paid' && Number(request.paymentAmount || 0) > 0) {
    await refundToWallet({
      userId: request.user,
      amount: Number(request.paymentAmount || 0),
      orderId: String(request._id),
      processedBy: req.user.id,
      note: 'Remboursement demande Devenir Boutique rejetée'
    });
    request.paymentStatus = 'refunded';
  }
  request.processedBy = req.user.id;
  request.processedAt = new Date();
  request.rejectionReason = (rejectionReason || '').trim();
  await request.save();

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
