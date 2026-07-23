import crypto from 'crypto';
import asyncHandler from 'express-async-handler';
import Payment from '../models/paymentModel.js';
import PawaPayEvent from '../models/pawapayEventModel.js';
import PawaPayCheckout from '../models/pawapayCheckoutModel.js';
import Product from '../models/productModel.js';
import User from '../models/userModel.js';
import {
  getPawaPayPublicKeys,
  initiatePawaPayCheckout
} from '../services/pawapayService.js';
import { getPawaPayFailurePresentation } from '../utils/pawapayErrors.js';
import { createNotification } from '../utils/notificationService.js';
import { invalidateProductCache } from '../utils/cache.js';
import { invalidateVerifiedProductCache } from '../utils/publicProductVisibility.js';
import { calculateCommissionBreakdown, normalizePromoCode } from '../utils/promoCodeUtils.js';
import { consumePromoCodeForSeller, previewPromoForSeller } from '../utils/promoCodeService.js';
import { getRuntimeConfig } from '../services/configService.js';
import { getHighestProductPrice } from '../utils/productAttributes.js';
import {
  paySelfSponsorship,
  respondSponsorship,
  pawaPayCheckoutOrder
} from './orderController.js';
import {
  checkoutInstallmentOrder,
  uploadInstallmentPaymentProof
} from './installmentController.js';
import { createBoostRequest } from './boostController.js';

const RESOURCE_CONFIG = {
  checkout: { idField: 'checkoutId' },
  deposit: { idField: 'depositId' },
  payout: { idField: 'payoutId' },
  refund: { idField: 'refundId' }
};

const FINAL_SUCCESS = new Set(['COMPLETED', 'SUCCESSFUL']);
const FINAL_FAILURE = new Set(['FAILED', 'CANCELLED', 'EXPIRED', 'REJECTED']);
const CHECKOUT_PURPOSES = new Set([
  'CHECKOUT_FUNDING',
  'LISTING_FEE_FUNDING',
  'INSTALLMENT_FUNDING',
  'BOOST_FUNDING'
]);
const ACTION_CONTEXT_KINDS = new Set([
  'ORDER_CHECKOUT',
  'INSTALLMENT_CHECKOUT',
  'INSTALLMENT_PAYMENT',
  'BOOST_REQUEST',
  'SPONSORSHIP_ACCEPT',
  'SPONSORSHIP_PAY_SELF'
]);

const sendPawaPayError = (res, status, code, message, details = {}) =>
  res.status(status).json({
    success: false,
    code,
    message,
    details
  });

const normalizeReturnPath = (value) => {
  const path = String(value || '/orders').trim();
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('://')) return '/orders';
  return path.slice(0, 300);
};

const normalizeActionContext = (value, purpose) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  let serialized = '';
  try {
    serialized = JSON.stringify(value);
  } catch {
    return null;
  }
  if (!serialized || serialized.length > 30_000) return null;
  const parsed = JSON.parse(serialized);
  const kind = String(parsed.kind || '').trim().toUpperCase();
  if (!ACTION_CONTEXT_KINDS.has(kind)) return null;
  if (kind === 'ORDER_CHECKOUT' && purpose !== 'CHECKOUT_FUNDING') return null;
  if (kind.startsWith('INSTALLMENT_') && purpose !== 'INSTALLMENT_FUNDING') return null;
  if (kind === 'BOOST_REQUEST' && purpose !== 'BOOST_FUNDING') return null;
  if (kind.startsWith('SPONSORSHIP_') && purpose !== 'CHECKOUT_FUNDING') return null;
  parsed.kind = kind;
  return parsed;
};

const checkoutReturnUrl = (checkoutId) => {
  const configured = String(
    process.env.PAWAPAY_CHECKOUT_RETURN_URL || 'https://www.hdmarket.store/payment/pawapay/return'
  ).trim();
  const url = new URL(configured);
  url.searchParams.set('checkoutId', checkoutId);
  return url.toString();
};

export const createPawaPayCheckout = asyncHandler(async (req, res) => {
  const amount = Number(req.body?.amount);
  const purpose = String(req.body?.purpose || 'CHECKOUT_FUNDING').trim().toUpperCase();
  const returnPath = normalizeReturnPath(req.body?.returnPath);
  const productId = String(req.body?.productId || '').trim();
  const promoCode = normalizePromoCode(req.body?.promoCode);
  const actionContext = normalizeActionContext(req.body?.actionContext, purpose);
  if (req.body?.actionContext && !actionContext) {
    return sendPawaPayError(
      res,
      400,
      'PAWAPAY_ACTION_CONTEXT_INVALID',
      'Les informations permettant de finaliser ce paiement sont invalides.'
    );
  }

  if (!Number.isInteger(amount) || amount < 10 || amount > 1_000_000) {
    return sendPawaPayError(
      res,
      400,
      'PAWAPAY_INVALID_AMOUNT',
      'Le montant PawaPay doit être compris entre 10 et 1 000 000 FCFA.',
      { providerCode: 'INVALID_AMOUNT', retryable: false, action: 'CHANGE_AMOUNT' }
    );
  }
  if (!CHECKOUT_PURPOSES.has(purpose)) {
    return sendPawaPayError(
      res,
      400,
      'PAWAPAY_INVALID_PURPOSE',
      'Motif de paiement PawaPay invalide.',
      { providerCode: 'INVALID_PARAMETER', retryable: false, action: 'CHECK_DETAILS' }
    );
  }
  let product = null;
  if (purpose === 'LISTING_FEE_FUNDING') {
    if (!productId) {
      return sendPawaPayError(
        res,
        400,
        'PAWAPAY_PRODUCT_REQUIRED',
        'L’annonce à valider est requise pour ce paiement.'
      );
    }
    product = await Product.findById(productId).select('_id user status').lean();
    if (!product) {
      return sendPawaPayError(res, 404, 'PAWAPAY_PRODUCT_NOT_FOUND', 'Annonce introuvable.');
    }
    if (
      String(product.user) !== String(req.user._id) &&
      !['admin', 'founder'].includes(String(req.user.role || '').toLowerCase())
    ) {
      return sendPawaPayError(
        res,
        403,
        'PAWAPAY_PRODUCT_FORBIDDEN',
        'Vous ne pouvez pas payer pour cette annonce.'
      );
    }
  }

  const checkoutId = crypto.randomUUID();
  const checkout = await PawaPayCheckout.create({
    checkoutId,
    user: req.user._id,
    amount,
    purpose,
    returnPath,
    product: product?._id || null,
    promoCode,
    actionContext,
    autoValidationState: product || actionContext ? 'PENDING' : 'NOT_APPLICABLE'
  });

  try {
    const result = await initiatePawaPayCheckout({
      checkoutId,
      returnUrl: checkoutReturnUrl(checkoutId),
      returnMethod: 'INSTANT',
      defaultLanguage: 'fr',
      countries: ['COG'],
      amounts: [{ country: 'COG', currency: 'XAF', amount: String(amount) }],
      payer: {
        type: 'MMO',
        accountDetails: {
          allowCustomerToOverride: true
        }
      },
      clientReferenceId: `HDM-${checkoutId.slice(0, 8).toUpperCase()}`,
      reason: { fr: 'PAIEMENT HDMARKET', en: 'HDMARKET PAYMENT' },
      metadata: [
        { hdmarketCheckoutId: checkoutId },
        { purpose },
        ...(actionContext ? [{ actionKind: actionContext.kind }] : [])
      ]
    });

    const status = String(result?.status || '').toUpperCase();
    if (!['ACCEPTED', 'DUPLICATE_IGNORED'].includes(status) || !result?.redirectUrl) {
      checkout.status = 'FAILED';
      checkout.failureReason = result?.failureReason || { failureCode: 'CHECKOUT_REJECTED' };
      await checkout.save();
      const failure = getPawaPayFailurePresentation(checkout.failureReason);
      return sendPawaPayError(res, 400, `PAWAPAY_${failure.providerCode}`, failure.message, failure);
    }

    checkout.status = 'WAITING_PAYMENT';
    checkout.redirectUrl = String(result.redirectUrl);
    checkout.checkoutCode = String(result.checkoutCode || '');
    checkout.expiresAt = result.expiresAt ? new Date(result.expiresAt) : null;
    await checkout.save();

    return res.status(201).json({
      checkoutId,
      status: checkout.status,
      redirectUrl: checkout.redirectUrl,
      expiresAt: checkout.expiresAt
    });
  } catch (error) {
    const uncertain = error?.details?.action === 'CHECK_STATUS';
    checkout.status = uncertain ? 'PROCESSING' : 'FAILED';
    checkout.failureReason = {
      failureCode: error?.details?.providerCode || error.code || 'PAWAPAY_REQUEST_FAILED'
    };
    await checkout.save();
    if (uncertain) {
      return res.status(202).json({
        checkoutId,
        status: checkout.status,
        pending: true,
        verificationUrl: `/payment/pawapay/return?checkoutId=${encodeURIComponent(checkoutId)}`,
        message: error.message,
        details: error.details
      });
    }
    throw error;
  }
});

export const getMyPawaPayCheckout = asyncHandler(async (req, res) => {
  const checkout = await PawaPayCheckout.findOne({
    checkoutId: String(req.params.checkoutId || ''),
    user: req.user._id
  }).lean();
  if (!checkout) {
    return sendPawaPayError(
      res,
      404,
      'PAWAPAY_CHECKOUT_NOT_FOUND',
      'Paiement PawaPay introuvable.',
      { providerCode: 'NOT_FOUND', retryable: false, action: 'RETURN' }
    );
  }

  const failure = checkout.failureReason
    ? getPawaPayFailurePresentation(checkout.failureReason)
    : null;

  return res.json({
    checkoutId: checkout.checkoutId,
    amount: checkout.amount,
    currency: checkout.currency,
    purpose: checkout.purpose,
    actionKind: checkout.actionContext?.kind || '',
    status: checkout.status,
    paymentState: checkout.paymentState,
    autoValidationState: checkout.autoValidationState,
    autoValidatedPayment: checkout.autoValidatedPayment || null,
    completionResult: checkout.completionResult || null,
    autoValidationError:
      checkout.autoValidationState === 'FAILED'
        ? checkout.autoValidationError || 'La validation automatique nécessite une vérification.'
        : '',
    returnPath: checkout.returnPath,
    expiresAt: checkout.expiresAt,
    failureReason: failure
  });
});

const sanitizePayload = (value, depth = 0) => {
  if (value == null || depth > 5) return value;
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => sanitizePayload(item, depth + 1));
  if (typeof value !== 'object') return typeof value === 'string' ? value.slice(0, 1000) : value;

  return Object.entries(value).reduce((result, [key, item]) => {
    const normalizedKey = key.toLowerCase();
    if (normalizedKey.includes('phone')) {
      const phone = String(item || '');
      result[key] = phone.length > 4 ? `${'*'.repeat(Math.min(8, phone.length - 4))}${phone.slice(-4)}` : '****';
    } else {
      result[key] = sanitizePayload(item, depth + 1);
    }
    return result;
  }, {});
};

const parseContentDigest = (header) => {
  const match = String(header || '').trim().match(/^(sha-256|sha-512)=:([^:]+):$/i);
  if (!match) return null;
  return { algorithm: match[1].toLowerCase(), expected: match[2] };
};

export const verifyPawaPayContentDigest = (req, res, next) => {
  const header = req.get('content-digest');
  const digestRequired = String(process.env.PAWAPAY_CONTENT_DIGEST_REQUIRED || 'false') === 'true';

  if (!header) {
    if (digestRequired) {
      return sendPawaPayError(
        res,
        401,
        'PAWAPAY_CALLBACK_DIGEST_MISSING',
        'Content-Digest PawaPay manquant.'
      );
    }
    return next();
  }

  const parsed = parseContentDigest(header);
  const rawBody = Buffer.isBuffer(req.rawBody) ? req.rawBody : Buffer.from(JSON.stringify(req.body || {}));
  if (!parsed) {
    return sendPawaPayError(
      res,
      401,
      'PAWAPAY_CALLBACK_DIGEST_INVALID',
      'Content-Digest PawaPay invalide.'
    );
  }

  const nodeAlgorithm = parsed.algorithm.replace('-', '');
  const actual = crypto.createHash(nodeAlgorithm).update(rawBody).digest('base64');
  const expectedBuffer = Buffer.from(parsed.expected);
  const actualBuffer = Buffer.from(actual);
  if (expectedBuffer.length !== actualBuffer.length || !crypto.timingSafeEqual(expectedBuffer, actualBuffer)) {
    return sendPawaPayError(
      res,
      401,
      'PAWAPAY_CALLBACK_DIGEST_MISMATCH',
      'Le contenu du callback PawaPay a été altéré.'
    );
  }

  return next();
};

let publicKeyCache = { expiresAt: 0, keys: new Map() };

const getPublicKey = async (keyId) => {
  if (Date.now() >= publicKeyCache.expiresAt || !publicKeyCache.keys.has(keyId)) {
    const response = await getPawaPayPublicKeys();
    const entries = Array.isArray(response) ? response : [];
    publicKeyCache = {
      expiresAt: Date.now() + 60 * 60 * 1000,
      keys: new Map(entries.map((entry) => [String(entry.id), String(entry.key)]))
    };
  }
  return publicKeyCache.keys.get(keyId);
};

const signatureValueForComponent = (req, component) => {
  if (component === '@method') return req.method.toUpperCase();
  if (component === '@authority') return req.get('host');
  if (component === '@path') return String(req.originalUrl || '').split('?')[0];
  return req.get(component);
};

const verifyHttpMessageSignature = async (req) => {
  const signatureHeader = String(req.get('signature') || '');
  const inputHeader = String(req.get('signature-input') || '');
  const inputMatch = inputHeader.match(/^([A-Za-z0-9_-]+)=(\([^)]*\)(?:;.*))$/);
  if (!inputMatch) return false;

  const [, label, signatureParams] = inputMatch;
  const signatureMatch = signatureHeader.match(new RegExp(`(?:^|,\\s*)${label}=:([^:]+):`));
  if (!signatureMatch) return false;

  const componentsSection = signatureParams.match(/^\(([^)]*)\)/)?.[1] || '';
  const components = [...componentsSection.matchAll(/"([^"]+)"/g)].map((match) => match[1].toLowerCase());
  const algorithm = signatureParams.match(/;alg="([^"]+)"/)?.[1];
  const keyId = signatureParams.match(/;keyid="([^"]+)"/)?.[1];
  const created = Number(signatureParams.match(/;created=(\d+)/)?.[1]);
  const expires = Number(signatureParams.match(/;expires=(\d+)/)?.[1]);
  const now = Math.floor(Date.now() / 1000);
  if (!components.length || !algorithm || !keyId || !created || !expires) return false;
  if (created > now + 120 || expires < now - 120 || expires <= created) return false;

  const lines = [];
  for (const component of components) {
    const value = signatureValueForComponent(req, component);
    if (value == null) return false;
    lines.push(`"${component}": ${value}`);
  }
  lines.push(`"@signature-params": ${signatureParams}`);

  const publicKey = await getPublicKey(keyId);
  if (!publicKey) return false;

  const algorithms = {
    'ecdsa-p256-sha256': { digest: 'sha256' },
    'ecdsa-p384-sha384': { digest: 'sha384' },
    'rsa-v1_5-sha256': { digest: 'sha256', padding: crypto.constants.RSA_PKCS1_PADDING },
    'rsa-pss-sha512': {
      digest: 'sha512',
      padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
      saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST
    }
  };
  const verification = algorithms[algorithm];
  if (!verification) return false;

  return crypto.verify(
    verification.digest,
    Buffer.from(lines.join('\n')),
    { key: publicKey, ...(verification.padding ? { padding: verification.padding } : {}), ...(verification.saltLength ? { saltLength: verification.saltLength } : {}) },
    Buffer.from(signatureMatch[1], 'base64')
  );
};

export const verifyPawaPaySignature = asyncHandler(async (req, res, next) => {
  const required = String(process.env.PAWAPAY_SIGNED_CALLBACKS_REQUIRED || 'false') === 'true';
  if (!required) return next();

  const requiredHeaders = ['signature', 'signature-input', 'signature-date', 'content-digest'];
  if (requiredHeaders.some((header) => !req.get(header))) {
    return sendPawaPayError(
      res,
      401,
      'PAWAPAY_CALLBACK_SIGNATURE_MISSING',
      'En-têtes de signature PawaPay incomplets.'
    );
  }

  const valid = await verifyHttpMessageSignature(req);
  if (!valid) {
    return sendPawaPayError(
      res,
      401,
      'PAWAPAY_CALLBACK_SIGNATURE_INVALID',
      'Signature PawaPay invalide.'
    );
  }
  return next();
});

const normalizedAmount = (payload) => {
  const completedDeposit = Array.isArray(payload.depositsHistory)
    ? payload.depositsHistory.find((entry) => String(entry?.status || '').toUpperCase() === 'COMPLETED')
    : null;
  const value = payload.amount ?? payload.requestedAmount ?? payload.deposit?.amount ?? completedDeposit?.amount;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
};

const reconcilePawaPayCheckout = async ({ resourceType, resourceId, status, amount, currency, payload }) => {
  if (resourceType !== 'checkout') return null;
  const checkout = await PawaPayCheckout.findOne({ checkoutId: resourceId });
  if (!checkout) return null;

  const effectiveCurrency = currency || String(payload.deposit?.currency || payload.amounts?.[0]?.currency || '').toUpperCase();
  const expectedAmount = Number(checkout.amount);
  if (amount != null && Math.abs(expectedAmount - amount) > 0.01) {
    checkout.status = 'FAILED';
    checkout.failureReason = { failureCode: 'AMOUNT_MISMATCH', expectedAmount, receivedAmount: amount };
    checkout.callbackPayload = sanitizePayload(payload);
    await checkout.save();
    return checkout;
  }
  if (effectiveCurrency && effectiveCurrency !== checkout.currency) {
    checkout.status = 'FAILED';
    checkout.failureReason = { failureCode: 'CURRENCY_MISMATCH', expectedCurrency: checkout.currency, receivedCurrency: effectiveCurrency };
    checkout.callbackPayload = sanitizePayload(payload);
    await checkout.save();
    return checkout;
  }

  checkout.status = FINAL_SUCCESS.has(status)
    ? 'COMPLETED'
    : FINAL_FAILURE.has(status)
      ? status
      : status === 'PROCESSING'
        ? 'PROCESSING'
        : checkout.status;
  checkout.providerTransactionId = String(payload.providerTransactionId || payload.deposit?.providerTransactionId || '');
  checkout.failureReason = sanitizePayload(payload.failureReason || payload.deposit?.failureReason || null);
  checkout.callbackPayload = sanitizePayload(payload);
  await checkout.save();

  if (!FINAL_SUCCESS.has(status)) return checkout;

  const claimed = await PawaPayCheckout.findOneAndUpdate(
    {
      _id: checkout._id,
      $or: [
        { paymentState: 'PENDING' },
        {
          paymentState: 'PROCESSING',
          updatedAt: { $lt: new Date(Date.now() - 2 * 60 * 1000) }
        }
      ]
    },
    { $set: { paymentState: 'PROCESSING' } },
    { new: true }
  );
  if (!claimed) return checkout;

  try {
    claimed.paymentState = 'CONFIRMED';
    claimed.confirmedAt = new Date();
    await claimed.save();
  } catch (error) {
    claimed.paymentState = 'PENDING';
    await claimed.save();
    throw error;
  }

  return claimed;
};

const invokeCompletionController = async ({ handler, checkout, body = {}, params = {} }) => {
  const actor = await User.findById(checkout.user).lean();
  if (!actor) throw new Error('Utilisateur introuvable pendant la finalisation PawaPay.');

  let responseStatus = 200;
  let responsePayload = null;
  let nextError = null;
  const req = {
    user: {
      ...actor,
      id: String(actor._id),
      _id: actor._id
    },
    body,
    params,
    query: {},
    files: {},
    file: null,
    pawaPayCheckout: checkout,
    ip: 'pawapay-callback',
    headers: {
      'user-agent': 'PawaPay callback completion',
      'idempotency-key': `pawapay-${checkout.checkoutId}`
    },
    get(name) {
      return this.headers[String(name || '').toLowerCase()] || '';
    }
  };
  const res = {
    status(code) {
      responseStatus = Number(code) || 200;
      return this;
    },
    json(payload) {
      responsePayload = payload;
      return this;
    },
    send(payload) {
      responsePayload = payload;
      return this;
    }
  };

  await handler(req, res, (error) => {
    nextError = error || new Error('La finalisation PawaPay a échoué.');
  });
  if (nextError) throw nextError;
  if (responseStatus >= 400) {
    const error = new Error(
      responsePayload?.message || `La finalisation PawaPay a échoué (${responseStatus}).`
    );
    error.status = responseStatus;
    throw error;
  }
  return responsePayload;
};

const notifyPaymentCompletionToStaff = async ({ checkout, title, message, deepLink, entityId }) => {
  const recipients = await User.find({
    role: { $in: ['admin', 'founder'] },
    isActive: { $ne: false }
  })
    .select('_id role')
    .lean();
  await Promise.all(
    recipients.map((recipient) =>
      createNotification({
        userId: recipient._id,
        actorId: checkout.user,
        type: 'payment_validated',
        allowSelf: true,
        audience: String(recipient.role || '').toLowerCase() === 'founder' ? 'FOUNDER' : 'ADMIN',
        targetRole: [String(recipient.role || '').toUpperCase()],
        priority: 'HIGH',
        actionRequired: false,
        actionStatus: 'DONE',
        deepLink,
        actionLink: deepLink,
        entityType: 'payment',
        entityId: String(entityId || checkout.checkoutId),
        title,
        message,
        actionLabel: 'Voir',
        dedupeKey: `pawapay-completed:${checkout.checkoutId}:${recipient._id}`,
        metadata: {
          checkoutId: checkout.checkoutId,
          purpose: checkout.purpose,
          actionKind: checkout.actionContext?.kind || '',
          amount: Number(checkout.amount || 0),
          autoCompleted: true,
          title,
          message,
          deepLink
        }
      })
    )
  );
};

const autoCompleteCheckoutAction = async (checkout) => {
  const context = checkout?.actionContext;
  if (!context?.kind || checkout.paymentState !== 'CONFIRMED') return null;
  const claimed = await PawaPayCheckout.findOneAndUpdate(
    {
      _id: checkout._id,
      autoValidationState: { $in: ['PENDING', 'FAILED'] }
    },
    {
      $set: {
        autoValidationState: 'PROCESSING',
        autoValidationError: ''
      }
    },
    { new: true }
  );
  if (!claimed) return checkout.completionResult || null;

  try {
    let result = null;
    let title = 'Paiement PawaPay finalisé';
    let message = `Un paiement PawaPay de ${Number(claimed.amount || 0).toLocaleString('fr-FR')} FCFA a été finalisé automatiquement.`;
    let deepLink = '/admin/payment-verification?status=verified';
    let entityId = claimed.checkoutId;
    const action = claimed.actionContext || {};

    if (action.kind === 'ORDER_CHECKOUT') {
      result = await invokeCompletionController({
        handler: pawaPayCheckoutOrder,
        checkout: claimed,
        body: {
          items: action.items,
          deliveryMode: action.deliveryMode,
          shippingAddress: action.shippingAddress,
          promoEntries: action.promoEntries,
          pointsToRedeem: action.pointsToRedeem
        }
      });
      const firstOrderId = result?.orders?.[0]?._id || result?.orders?.[0]?.id || '';
      title = 'Commande PawaPay confirmée';
      message = `Une commande de ${Number(claimed.amount || 0).toLocaleString('fr-FR')} FCFA a été payée et créée automatiquement avec PawaPay.`;
      deepLink = firstOrderId ? `/admin/orders?orderId=${encodeURIComponent(String(firstOrderId))}` : '/admin/orders';
      entityId = firstOrderId || claimed.checkoutId;
    } else if (action.kind === 'INSTALLMENT_CHECKOUT') {
      result = await invokeCompletionController({
        handler: checkoutInstallmentOrder,
        checkout: claimed,
        body: {
          productId: action.productId,
          quantity: action.quantity,
          selectedAttributes: action.selectedAttributes,
          firstPaymentAmount: action.firstPaymentAmount,
          paymentMethod: 'pawapay',
          payerName: '',
          transactionCode: '',
          guarantor: action.guarantor,
          deliveryMode: action.deliveryMode,
          shippingAddress: action.shippingAddress
        }
      });
      const orderId = result?._id || result?.order?._id || '';
      title = 'Commande en tranche PawaPay confirmée';
      message = `Le premier versement PawaPay de ${Number(claimed.amount || 0).toLocaleString('fr-FR')} FCFA a été validé automatiquement.`;
      deepLink = orderId ? `/admin/orders?orderId=${encodeURIComponent(String(orderId))}` : '/admin/orders';
      entityId = orderId || claimed.checkoutId;
    } else if (action.kind === 'INSTALLMENT_PAYMENT') {
      result = await invokeCompletionController({
        handler: uploadInstallmentPaymentProof,
        checkout: claimed,
        params: {
          id: String(action.orderId || ''),
          scheduleIndex: String(action.scheduleIndex)
        },
        body: {
          paymentMethod: 'pawapay',
          payerName: '',
          transactionCode: '',
          amount: Number(action.amount || 0)
        }
      });
      title = 'Tranche PawaPay confirmée';
      message = `Une tranche de ${Number(action.amount || claimed.amount || 0).toLocaleString('fr-FR')} FCFA a été validée automatiquement avec PawaPay.`;
      deepLink = `/admin/orders?orderId=${encodeURIComponent(String(action.orderId || ''))}`;
      entityId = action.orderId || claimed.checkoutId;
    } else if (action.kind === 'SPONSORSHIP_ACCEPT') {
      result = await invokeCompletionController({
        handler: respondSponsorship,
        checkout: claimed,
        params: { groupId: String(action.groupId || '') },
        body: {
          action: 'accept',
          paymentMode: 'pawapay',
          paymentOption: action.paymentOption || 'full'
        }
      });
      title = 'Commande sponsorisée payée avec PawaPay';
      message = `Un paiement sponsorisé de ${Number(claimed.amount || 0).toLocaleString('fr-FR')} FCFA a été accepté automatiquement.`;
      deepLink = '/admin/orders';
      entityId = action.groupId || claimed.checkoutId;
    } else if (action.kind === 'BOOST_REQUEST') {
      result = await invokeCompletionController({
        handler: createBoostRequest,
        checkout: claimed,
        body: {
          boostType: action.boostType,
          duration: String(action.duration || ''),
          city: action.city || '',
          productIds: JSON.stringify(action.productIds || []),
          paymentMethod: 'pawapay'
        }
      });
      const boostId = result?._id || result?.request?._id || '';
      title = 'Boost PawaPay payé';
      message = `Une demande de boost de ${Number(claimed.amount || 0).toLocaleString('fr-FR')} FCFA a été créée automatiquement après confirmation PawaPay.`;
      deepLink = boostId
        ? `/admin/product-boosts?requestId=${encodeURIComponent(String(boostId))}`
        : '/admin/product-boosts';
      entityId = boostId || claimed.checkoutId;
    } else if (action.kind === 'SPONSORSHIP_PAY_SELF') {
      result = await invokeCompletionController({
        handler: paySelfSponsorship,
        checkout: claimed,
        params: { groupId: String(action.groupId || '') },
        body: {
          paymentMode: 'pawapay',
          paymentOption: action.paymentOption || 'full'
        }
      });
      title = 'Commande sponsorisée reprise avec PawaPay';
      message = `Le demandeur a payé lui-même ${Number(claimed.amount || 0).toLocaleString('fr-FR')} FCFA avec PawaPay.`;
      deepLink = '/admin/orders';
      entityId = action.groupId || claimed.checkoutId;
    } else {
      throw new Error('Action automatique PawaPay inconnue.');
    }

    claimed.autoValidationState = 'COMPLETED';
    claimed.autoValidatedAt = new Date();
    claimed.autoValidationError = '';
    claimed.completionResult = {
      actionKind: action.kind,
      entityId: String(entityId || ''),
      orderIds: Array.isArray(result?.orders)
        ? result.orders.map((order) => String(order?._id || order?.id || '')).filter(Boolean).slice(0, 20)
        : [],
      message: String(result?.message || '').slice(0, 300)
    };
    await claimed.save();
    await notifyPaymentCompletionToStaff({
      checkout: claimed,
      title,
      message,
      deepLink,
      entityId
    });
    return result;
  } catch (error) {
    claimed.autoValidationState = 'FAILED';
    claimed.autoValidationError = String(error?.message || error).slice(0, 500);
    await claimed.save().catch(() => {});
    throw error;
  }
};

const notifyListingPaymentValidated = async ({ checkout, payment, product, amount }) => {
  const recipients = await User.find({
    role: { $in: ['admin', 'founder'] },
    isActive: { $ne: false }
  })
    .select('_id role')
    .lean();
  if (!recipients.length) return;

  const seller = await User.findById(checkout.user).select('name').lean();
  const productTitle = String(product.title || '').trim();
  const productSlug = String(product.slug || '').trim();
  const paymentLink = `/admin/payment-verification?status=verified&paymentId=${encodeURIComponent(String(payment._id))}&productId=${encodeURIComponent(String(product._id))}`;
  const message = `${seller?.name || 'Un vendeur'} a payé ${Number(amount || 0).toLocaleString('fr-FR')} FCFA avec PawaPay pour l’annonce${productTitle ? ` « ${productTitle} »` : ''}. L’annonce a été validée automatiquement.`;

  await Promise.all(
    recipients.map((recipient) =>
      createNotification({
        userId: recipient._id,
        actorId: checkout.user,
        productId: product._id,
        type: 'payment_validated',
        allowSelf: true,
        audience: String(recipient.role || '').toLowerCase() === 'founder' ? 'FOUNDER' : 'ADMIN',
        targetRole: [String(recipient.role || '').toUpperCase()],
        priority: 'HIGH',
        actionRequired: false,
        actionStatus: 'DONE',
        deepLink: paymentLink,
        actionLink: paymentLink,
        entityType: 'payment',
        entityId: String(payment._id),
        validationType: 'productValidation',
        title: 'Paiement PawaPay confirmé',
        message,
        actionLabel: 'Voir le paiement',
        dedupeKey: `pawapay-listing-approved:${checkout.checkoutId}:${recipient._id}`,
        metadata: {
          paymentId: String(payment._id),
          productId: String(product._id),
          productSlug,
          productTitle,
          checkoutId: checkout.checkoutId,
          amount: Number(amount || 0),
          paymentType: 'LISTING_FEE',
          paymentMethod: 'PAWAPAY',
          status: 'verified',
          autoApproved: true,
          deepLink: paymentLink,
          title: 'Paiement PawaPay confirmé',
          message
        }
      })
    )
  );
};

const autoValidateListingCheckout = async (checkout) => {
  if (
    !checkout ||
    checkout.purpose !== 'LISTING_FEE_FUNDING' ||
    !checkout.product ||
    checkout.paymentState !== 'CONFIRMED'
  ) {
    return null;
  }

  const claimed = await PawaPayCheckout.findOneAndUpdate(
    {
      _id: checkout._id,
      autoValidationState: { $in: ['PENDING', 'FAILED'] }
    },
    {
      $set: {
        autoValidationState: 'PROCESSING',
        autoValidationError: ''
      }
    },
    { new: true }
  );
  if (!claimed) return checkout.autoValidatedPayment || null;

  try {
    const product = await Product.findById(claimed.product);
    if (!product) throw new Error('Annonce introuvable pendant la validation automatique PawaPay.');
    if (String(product.user) !== String(claimed.user)) {
      throw new Error('Le bénéficiaire de l’annonce ne correspond pas au paiement PawaPay.');
    }

    const existingPayment = await Payment.findOne({
      product: product._id,
      status: { $in: ['VERIFIED', 'verified'] }
    });
    if (existingPayment) {
      product.payment = existingPayment._id;
      product.status = 'approved';
      await product.save();
      claimed.autoValidationState = 'COMPLETED';
      claimed.autoValidatedPayment = existingPayment._id;
      claimed.autoValidatedAt = new Date();
      await claimed.save();
      await notifyListingPaymentValidated({
        checkout: claimed,
        payment: existingPayment,
        product,
        amount: existingPayment.amountPaid || existingPayment.amount
      });
      return existingPayment;
    }

    const commissionRateValue = Number(await getRuntimeConfig('commission_rate', { fallback: 3 }));
    const commissionRate = Number.isFinite(commissionRateValue) ? commissionRateValue : 3;
    const referencePrice = getHighestProductPrice({
      productAttributes: product.attributes,
      basePrice: product.price
    });
    const normalizedPromo = normalizePromoCode(claimed.promoCode);
    const promoPreview = normalizedPromo
      ? await previewPromoForSeller({
          code: normalizedPromo,
          sellerId: claimed.user,
          productPrice: referencePrice,
          commissionRate
        })
      : null;
    if (normalizedPromo && !promoPreview?.valid) {
      throw new Error(promoPreview?.message || 'Le code promo ne peut plus être appliqué.');
    }
    const commission =
      promoPreview?.commission ||
      calculateCommissionBreakdown({ productPrice: referencePrice, commissionRate });
    const dueAmount = Number(Number(commission.dueAmount || 0).toFixed(2));

    const payment = await Payment.create({
      user: claimed.user,
      buyer: claimed.user,
      seller: claimed.user,
      product: product._id,
      payerName: 'PawaPay',
      payerPhoneNumber: '',
      transactionNumber: claimed.checkoutId,
      transactionId: `pawapay-listing-${claimed.checkoutId}`,
      amount: dueAmount,
      expectedAmount: dueAmount,
      amountPaid: dueAmount,
      currency: 'XAF',
      commissionReferencePrice: referencePrice,
      commissionBaseAmount: Number(commission.baseAmount || 0),
      commissionDiscountAmount: Number(commission.discountAmount || 0),
      commissionDueAmount: dueAmount,
      waivedByPromo: Boolean(commission.isWaived && normalizedPromo),
      promoCodeValue: normalizedPromo || '',
      promoDiscountType: promoPreview?.promo?.discountType || null,
      promoDiscountValue: Number(promoPreview?.promo?.discountValue || 0),
      operator: 'OTHER',
      paymentType: 'LISTING_FEE',
      verificationMethod: 'WEBHOOK',
      paymentMethod: dueAmount > 0 ? 'pawapay' : 'promo',
      status: 'verified',
      verifiedBy: claimed.user,
      verifiedAt: new Date(),
      validatedBy: claimed.user,
      validatedAt: new Date(),
      gateway: {
        name: 'PAWAPAY',
        externalTransactionId: claimed.checkoutId,
        externalReference: claimed.providerTransactionId || ''
      },
      metadata: {
        checkoutId: claimed.checkoutId,
        purpose: claimed.purpose,
        autoApproved: true
      }
    });

    try {
      if (normalizedPromo) {
        try {
          const consumed = await consumePromoCodeForSeller({
            code: normalizedPromo,
            sellerId: claimed.user,
            product,
            commissionRate,
            paymentId: payment._id
          });
          if (consumed?.promo) {
            payment.promoCode = consumed.promo._id;
            payment.promoCodeValue = consumed.promo.code;
          }
        } catch (promoError) {
          // The provider payment is already final. A promo bookkeeping race must
          // not leave a paid seller's listing blocked.
          payment.metadata = {
            ...(payment.metadata || {}),
            promoConsumptionWarning: String(promoError?.message || promoError).slice(0, 300)
          };
        }
      }
      await payment.save();
    } catch (error) {
      await Payment.deleteOne({ _id: payment._id }).catch(() => {});
      throw error;
    }

    product.payment = payment._id;
    product.status = 'approved';
    await product.save();
    invalidateVerifiedProductCache();
    await invalidateProductCache();

    claimed.autoValidationState = 'COMPLETED';
    claimed.autoValidatedPayment = payment._id;
    claimed.autoValidatedAt = new Date();
    claimed.autoValidationError = '';
    await claimed.save();

    await notifyListingPaymentValidated({
      checkout: claimed,
      payment,
      product,
      amount: dueAmount
    });
    return payment;
  } catch (error) {
    claimed.autoValidationState = 'FAILED';
    claimed.autoValidationError = String(error?.message || error).slice(0, 500);
    await claimed.save().catch(() => {});
    throw error;
  }
};

const reconcilePayment = async ({ resourceType, resourceId, status, amount, currency, payload }) => {
  const payment = await Payment.findOne({
    'gateway.name': 'PAWAPAY',
    'gateway.externalTransactionId': resourceId
  });
  if (!payment) return { payment: null, reconciliationStatus: 'UNMATCHED' };

  const expectedAmount = Number(payment.expectedAmount);
  if (amount != null && Number.isFinite(expectedAmount) && Math.abs(expectedAmount - amount) > 0.01) {
    await Payment.updateOne(
      { _id: payment._id },
      { $set: { status: 'AMOUNT_MISMATCH', 'gateway.rawResponse': sanitizePayload(payload) } }
    );
    return { payment, reconciliationStatus: 'AMOUNT_MISMATCH' };
  }

  if (currency && payment.currency && currency !== String(payment.currency).toUpperCase()) {
    return { payment, reconciliationStatus: 'CURRENCY_MISMATCH' };
  }

  const updates = {
    'gateway.externalReference': String(payload.providerTransactionId || ''),
    'gateway.rawResponse': sanitizePayload(payload),
    verificationMethod: 'WEBHOOK'
  };

  if (resourceType === 'refund' && FINAL_SUCCESS.has(status)) {
    updates.status = 'REFUNDED';
  } else if (FINAL_SUCCESS.has(status)) {
    updates.status = 'VERIFIED';
    updates.amountPaid = amount ?? payment.expectedAmount;
    updates.verifiedAt = payment.verifiedAt || new Date();
  } else if (FINAL_FAILURE.has(status)) {
    updates.status = 'FAILED';
  }

  // Direct update intentionally avoids legacy manual-payment save hooks that can
  // reinterpret a provider's final status from amount/transaction fields.
  await Payment.updateOne({ _id: payment._id }, { $set: updates });
  return { payment, reconciliationStatus: 'MATCHED' };
};

export const receivePawaPayCallback = (resourceType) =>
  asyncHandler(async (req, res) => {
    const config = RESOURCE_CONFIG[resourceType];
    const resourceId = String(req.body?.[config.idField] || '').trim();
    const status = String(req.body?.status || '').trim().toUpperCase();

    if (!resourceId || !status) {
      return sendPawaPayError(
        res,
        400,
        'PAWAPAY_CALLBACK_INVALID',
        `Callback PawaPay ${resourceType} invalide.`
      );
    }

    const amount = normalizedAmount(req.body);
    const currency = String(req.body.currency || '').trim().toUpperCase();
    const payload = sanitizePayload(req.body);
    const rawBody = Buffer.isBuffer(req.rawBody) ? req.rawBody : Buffer.from(JSON.stringify(req.body || {}));
    const payloadDigest = crypto.createHash('sha256').update(rawBody).digest('hex');
    const pawaPayCheckout = await reconcilePawaPayCheckout({
      resourceType,
      resourceId,
      status,
      amount,
      currency,
      payload
    });
    const reconciliation = await reconcilePayment({ resourceType, resourceId, status, amount, currency, payload });
    if (pawaPayCheckout && FINAL_SUCCESS.has(status)) {
      if (pawaPayCheckout.actionContext?.kind) {
        await autoCompleteCheckoutAction(pawaPayCheckout);
      } else if (pawaPayCheckout.purpose === 'LISTING_FEE_FUNDING') {
        await autoValidateListingCheckout(pawaPayCheckout);
      } else {
        await notifyPaymentCompletionToStaff({
          checkout: pawaPayCheckout,
          title: 'Paiement PawaPay confirmé',
          message: `Un paiement PawaPay de ${Number(pawaPayCheckout.amount || 0).toLocaleString('fr-FR')} FCFA a été confirmé pour ${pawaPayCheckout.purpose}.`,
          deepLink: '/admin/payment-verification?status=verified',
          entityId: pawaPayCheckout.checkoutId
        });
      }
    }

    await PawaPayEvent.findOneAndUpdate(
      { resourceType, resourceId },
      {
        $set: {
          status,
          amount,
          currency,
          country: String(req.body.country || '').trim().toUpperCase(),
          providerTransactionId: String(req.body.providerTransactionId || '').trim(),
          failureReason: sanitizePayload(req.body.failureReason || null),
          metadata: sanitizePayload(req.body.metadata || {}),
          payload,
          payloadDigest,
          lastReceivedAt: new Date(),
          matchedPayment: reconciliation.payment?._id || null,
          reconciliationStatus: pawaPayCheckout ? 'MATCHED' : reconciliation.reconciliationStatus
        },
        $setOnInsert: { firstReceivedAt: new Date() },
        $inc: { callbackCount: 1 }
      },
      { upsert: true, setDefaultsOnInsert: true }
    );

    // PawaPay retries callbacks until it receives HTTP 200. Duplicate deliveries
    // are safe because the event is upserted by resource type + provider ID.
    return res.status(200).json({ received: true });
  });
