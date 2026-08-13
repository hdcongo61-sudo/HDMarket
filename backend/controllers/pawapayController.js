import crypto from 'crypto';
import asyncHandler from 'express-async-handler';
import Payment from '../models/paymentModel.js';
import PawaPayEvent from '../models/pawapayEventModel.js';
import PawaPayCheckout from '../models/pawapayCheckoutModel.js';
import Refund from '../models/refundModel.js';
import Product from '../models/productModel.js';
import ShopConversionRequest from '../models/shopConversionRequestModel.js';
import User from '../models/userModel.js';
import Order from '../models/orderModel.js';
import {
  getPawaPayCheckoutStatus,
  getPawaPayPublicKeys,
  getPawaPayRefundStatus,
  initiatePawaPayCheckout
} from '../services/pawapayService.js';
import { reconcileRefund } from '../services/refundService.js';
import { reconcileSellerPayout } from '../services/sellerSettlementService.js';
import { getPawaPayFailurePresentation } from '../utils/pawapayErrors.js';
import { createNotification } from '../utils/notificationService.js';
import { invalidateProductCache } from '../utils/cache.js';
import { invalidateVerifiedProductCache } from '../utils/publicProductVisibility.js';
import { calculateCommissionBreakdown, normalizePromoCode } from '../utils/promoCodeUtils.js';
import { consumePromoCodeForSeller, previewPromoForSeller } from '../utils/promoCodeService.js';
import { getRuntimeConfig } from '../services/configService.js';
import { recordEscrowAudit } from '../services/escrowService.js';
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
import { createGlobalNotificationRequest } from './globalNotificationController.js';
import { completeShopConversionPawaPay } from './shopConversionController.js';
import { pawaPayCreateParcelRequest } from './parcelRequestController.js';
import {
  pawaPayCompleteBuyForMeAdditionalPayment,
  pawaPayCreateBuyForMeOrder
} from './buyForMeController.js';

const RESOURCE_CONFIG = {
  checkout: { idField: 'checkoutId' },
  deposit: { idField: 'depositId' },
  payout: { idField: 'payoutId' },
  refund: { idField: 'refundId' }
};

const FINAL_SUCCESS = new Set(['COMPLETED', 'SUCCESSFUL']);
const FINAL_FAILURE = new Set(['FAILED', 'CANCELLED', 'EXPIRED', 'REJECTED']);

export const normalizePawaPayCheckoutStatus = (value, fallback = 'WAITING_PAYMENT') => {
  const status = String(value || '').trim().toUpperCase();
  if (FINAL_SUCCESS.has(status)) return 'COMPLETED';
  // PawaPay uses REJECTED, while the persisted checkout state intentionally
  // exposes all provider rejections through the single FAILED state.
  if (status === 'REJECTED') return 'FAILED';
  if (FINAL_FAILURE.has(status) || status === 'PROCESSING') return status;
  return fallback;
};
const CHECKOUT_PURPOSES = new Set([
  'CHECKOUT_FUNDING',
  'LISTING_FEE_FUNDING',
  'INSTALLMENT_FUNDING',
  'BOOST_FUNDING',
  'SHOP_CONVERSION_FUNDING',
  'PARCEL_REQUEST_FUNDING',
  'BUY_FOR_ME_FUNDING',
  'BUY_FOR_ME_ADDITIONAL_FUNDING',
  'GLOBAL_NOTIFICATION_FUNDING'
]);
const ACTION_CONTEXT_KINDS = new Set([
  'ORDER_CHECKOUT',
  'ORDER_PAYMENT',
  'INSTALLMENT_CHECKOUT',
  'INSTALLMENT_PAYMENT',
  'BOOST_REQUEST',
  'SHOP_CONVERSION_REQUEST',
  'SPONSORSHIP_ACCEPT',
  'SPONSORSHIP_PAY_SELF',
  'PARCEL_REQUEST_CHECKOUT',
  'BUY_FOR_ME_ORDER',
  'BUY_FOR_ME_ADDITIONAL_PAYMENT',
  'GLOBAL_NOTIFICATION_REQUEST'
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
  if (kind === 'ORDER_PAYMENT' && purpose !== 'CHECKOUT_FUNDING') return null;
  if (kind.startsWith('INSTALLMENT_') && purpose !== 'INSTALLMENT_FUNDING') return null;
  if (kind === 'BOOST_REQUEST' && purpose !== 'BOOST_FUNDING') return null;
  if (kind === 'SHOP_CONVERSION_REQUEST' && purpose !== 'SHOP_CONVERSION_FUNDING') return null;
  if (kind.startsWith('SPONSORSHIP_') && purpose !== 'CHECKOUT_FUNDING') return null;
  if (kind === 'PARCEL_REQUEST_CHECKOUT' && purpose !== 'PARCEL_REQUEST_FUNDING') return null;
  if (kind === 'BUY_FOR_ME_ORDER' && purpose !== 'BUY_FOR_ME_FUNDING') return null;
  if (kind === 'BUY_FOR_ME_ADDITIONAL_PAYMENT' && purpose !== 'BUY_FOR_ME_ADDITIONAL_FUNDING') return null;
  if (kind === 'GLOBAL_NOTIFICATION_REQUEST' && purpose !== 'GLOBAL_NOTIFICATION_FUNDING') return null;
  parsed.kind = kind;
  return parsed;
};

export const checkoutReturnUrl = () => {
  const configured = String(
    process.env.PAWAPAY_CHECKOUT_RETURN_URL || 'https://www.hdmarket.store/payment/pawapay/return'
  ).trim();
  const url = new URL(configured);
  // PawaPay now appends checkoutCode when returning the customer. Do not leak
  // or duplicate the merchant-generated checkoutId in the browser URL.
  url.searchParams.delete('checkoutId');
  url.searchParams.delete('checkoutCode');
  return url.toString();
};

const checkoutVerificationUrl = (checkout) => {
  const checkoutCode = String(checkout?.checkoutCode || '').trim();
  if (checkoutCode) {
    return `/payment/pawapay/return?checkoutCode=${encodeURIComponent(checkoutCode)}`;
  }
  return `/payment/pawapay/return?checkoutId=${encodeURIComponent(String(checkout?.checkoutId || ''))}`;
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
  if (actionContext?.kind === 'ORDER_CHECKOUT') {
    const minimumDepositPercent = Math.max(
      50,
      Math.min(100, Number(await getRuntimeConfig('escrow_minimum_deposit_percent', { fallback: 50 })) || 50)
    );
    const paymentPercent = Number(actionContext.paymentPercent ?? 100);
    if (![50, 70, 100].includes(paymentPercent) || paymentPercent < minimumDepositPercent) {
      return sendPawaPayError(
        res,
        400,
        'PAWAPAY_ESCROW_DEPOSIT_INVALID',
        `Choisissez un paiement autorisé d’au moins ${minimumDepositPercent}%.`
      );
    }
    actionContext.paymentPercent = paymentPercent;
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
  if (actionContext?.kind === 'ORDER_PAYMENT') {
    const order = await Order.findOne({ _id: actionContext.orderId, customer: req.user._id }).lean();
    if (!order) {
      return sendPawaPayError(res, 404, 'PAWAPAY_ORDER_NOT_FOUND', 'Commande introuvable.');
    }
    if (!order.quotationSnapshot?.applied) {
      return sendPawaPayError(res, 400, 'PAWAPAY_ORDER_PAYMENT_INVALID', 'Cette commande ne provient pas d’un devis.');
    }
    if (String(order.paymentStatus || '').toUpperCase() === 'PAID_FULL') {
      return sendPawaPayError(res, 409, 'PAWAPAY_ORDER_ALREADY_PAID', 'Cette commande est déjà payée.');
    }
    const amountDue = Math.round(Number(order.remainingAmount ?? order.totalAmount ?? 0));
    if (!(amountDue > 0) || amountDue !== amount) {
      return sendPawaPayError(res, 409, 'PAWAPAY_ORDER_AMOUNT_CHANGED', 'Le montant restant de la commande a changé.');
    }
    actionContext.amount = amountDue;
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
    product = await Product.findById(productId)
      .select('_id user status requiresAdditionalPayment')
      .lean();
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
    if (product.requiresAdditionalPayment) {
      return sendPawaPayError(
        res,
        409,
        'PAWAPAY_LISTING_FEE_RECONCILIATION_UNSUPPORTED',
        'Utilisez le formulaire de complément pour payer uniquement la différence de commission.'
      );
    }
  }
  if (actionContext?.kind === 'SHOP_CONVERSION_REQUEST') {
    const requestId = String(actionContext.requestId || '').trim();
    const shopRequest = /^[a-f\d]{24}$/i.test(requestId)
      ? await ShopConversionRequest.findOne({
          _id: requestId,
          user: req.user._id,
          status: 'awaiting_payment',
          paymentStatus: 'awaiting_payment'
        })
          .select('_id paymentAmount')
          .lean()
      : null;
    if (!shopRequest) {
      return sendPawaPayError(
        res,
        404,
        'PAWAPAY_SHOP_REQUEST_NOT_FOUND',
        'Le dossier boutique à payer est introuvable ou a déjà été traité.'
      );
    }
    if (Math.abs(Number(shopRequest.paymentAmount || 0) - amount) > 0.01) {
      return sendPawaPayError(
        res,
        400,
        'PAWAPAY_SHOP_AMOUNT_INVALID',
        'Le montant PawaPay ne correspond pas aux frais de conversion en boutique.'
      );
    }
    const existingCheckout = await PawaPayCheckout.findOne({
      user: req.user._id,
      'actionContext.kind': 'SHOP_CONVERSION_REQUEST',
      'actionContext.requestId': requestId,
      status: { $in: ['CREATED', 'WAITING_PAYMENT', 'PROCESSING'] },
      $or: [
        { expiresAt: null },
        { expiresAt: { $exists: false } },
        { expiresAt: { $gt: new Date() } }
      ]
    })
      .sort({ createdAt: -1 })
      .lean();
    if (existingCheckout?.redirectUrl) {
      return res.status(200).json({
        checkoutId: existingCheckout.checkoutId,
        checkoutCode: existingCheckout.checkoutCode || '',
        status: existingCheckout.status,
        redirectUrl: existingCheckout.redirectUrl,
        expiresAt: existingCheckout.expiresAt
      });
    }
    if (existingCheckout) {
      return res.status(202).json({
        checkoutId: existingCheckout.checkoutId,
        status: existingCheckout.status,
        pending: true,
        verificationUrl: checkoutVerificationUrl(existingCheckout),
        message: 'Ce paiement PawaPay est déjà en cours de vérification.'
      });
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
      returnUrl: checkoutReturnUrl(),
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
    checkout.checkoutCode = String(result.checkoutCode || '').trim();
    checkout.expiresAt = result.expiresAt ? new Date(result.expiresAt) : null;
    await checkout.save();

    return res.status(201).json({
      checkoutId,
      checkoutCode: checkout.checkoutCode,
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
        verificationUrl: checkoutVerificationUrl(checkout),
        message: error.message,
        details: error.details
      });
    }
    throw error;
  }
});

const respondWithMyPawaPayCheckout = async (checkout, res) => {
  if (!checkout) {
    return sendPawaPayError(
      res,
      404,
      'PAWAPAY_CHECKOUT_NOT_FOUND',
      'Paiement PawaPay introuvable.',
      { providerCode: 'NOT_FOUND', retryable: false, action: 'RETURN' }
    );
  }

  checkout = await reconcileCheckoutStatusFromProvider(checkout);

  const failure = checkout.failureReason
    ? getPawaPayFailurePresentation(checkout.failureReason)
    : null;

  return res.json({
    checkoutId: checkout.checkoutId,
    checkoutCode: checkout.checkoutCode,
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
};

export const getMyPawaPayCheckout = asyncHandler(async (req, res) => {
  const checkout = await PawaPayCheckout.findOne({
    checkoutId: String(req.params.checkoutId || '').trim(),
    user: req.user._id
  });
  return respondWithMyPawaPayCheckout(checkout, res);
});

export const getMyPawaPayCheckoutByCode = asyncHandler(async (req, res) => {
  const checkoutCode = String(req.params.checkoutCode || '').trim().slice(0, 200);
  const checkout = checkoutCode
    ? await PawaPayCheckout.findOne({ checkoutCode, user: req.user._id })
    : null;
  return respondWithMyPawaPayCheckout(checkout, res);
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

  checkout.status = normalizePawaPayCheckoutStatus(status, checkout.status);
  checkout.providerTransactionId = String(payload.providerTransactionId || payload.deposit?.providerTransactionId || '');
  const providerCheckoutCode = String(payload.checkoutCode || '').trim();
  if (providerCheckoutCode) checkout.checkoutCode = providerCheckoutCode;
  const completedDeposit = Array.isArray(payload.depositsHistory)
    ? payload.depositsHistory.find((entry) => FINAL_SUCCESS.has(String(entry?.status || '').toUpperCase()))
    : null;
  const deposit = payload.deposit || completedDeposit;
  if (deposit?.depositId) checkout.depositId = String(deposit.depositId);
  if (deposit?.status) checkout.depositStatus = String(deposit.status).toUpperCase();
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

const reconcileCheckoutStatusFromProvider = async (checkout, { force = false } = {}) => {
  if (!checkout) return checkout;

  const runAutomaticCompletion = async (current) => {
    if (
      current?.status !== 'COMPLETED' ||
      current?.paymentState !== 'CONFIRMED' ||
      current?.autoValidationState === 'COMPLETED'
    ) {
      return;
    }
    try {
      if (current.actionContext?.kind) {
        await autoCompleteCheckoutAction(current);
      } else if (current.purpose === 'LISTING_FEE_FUNDING') {
        await autoValidateListingCheckout(current);
      }
    } catch {
      // The completion helpers persist a user-safe FAILED state. Return that
      // state to the client instead of turning a successful status check into 500.
    }
  };

  if (checkout.status === 'COMPLETED' && checkout.paymentState === 'CONFIRMED') {
    await runAutomaticCompletion(checkout);
    return PawaPayCheckout.findById(checkout._id);
  }
  if (FINAL_FAILURE.has(String(checkout.status || '').toUpperCase())) return checkout;

  const now = new Date();
  const statusCheckQuery = {
    _id: checkout._id,
    status: { $in: ['CREATED', 'WAITING_PAYMENT', 'PROCESSING'] }
  };
  if (!force) {
    statusCheckQuery.$or = [
      { lastProviderStatusCheckAt: null },
      { lastProviderStatusCheckAt: { $exists: false } },
      { lastProviderStatusCheckAt: { $lt: new Date(now.getTime() - 4_000) } }
    ];
  }
  const claimed = await PawaPayCheckout.findOneAndUpdate(
    statusCheckQuery,
    { $set: { lastProviderStatusCheckAt: now } },
    { new: true }
  );
  if (!claimed) return PawaPayCheckout.findById(checkout._id);

  try {
    const providerResult = await getPawaPayCheckoutStatus(claimed.checkoutId, {
      timeoutMs: 12_000
    });
    if (
      String(providerResult?.status || '').toUpperCase() !== 'FOUND' ||
      !providerResult?.data
    ) {
      return PawaPayCheckout.findById(claimed._id);
    }

    const providerCheckout = providerResult.data;
    const reconciled = await reconcilePawaPayCheckout({
      resourceType: 'checkout',
      resourceId: claimed.checkoutId,
      status: String(providerCheckout.status || '').trim().toUpperCase(),
      amount: normalizedAmount(providerCheckout),
      currency: String(
        providerCheckout.currency ||
        providerCheckout.deposit?.currency ||
        providerCheckout.amounts?.[0]?.currency ||
        ''
      ).trim().toUpperCase(),
      payload: sanitizePayload(providerCheckout)
    });
    await runAutomaticCompletion(reconciled);
  } catch {
    // Callbacks remain the primary source. A temporary status endpoint failure
    // must not replace a legitimate pending payment with an application error.
  }

  return PawaPayCheckout.findById(claimed._id);
};

// Callbacks and the client's own status poll (when it returns to the app)
// are the primary way a checkout resolves — but if the client closes the tab
// right after paying, or a callback is dropped, nothing else ever re-checks
// it. This periodic pass sweeps checkouts still stuck in WAITING_PAYMENT/
// PROCESSING and reconciles them against PawaPay directly, same as the
// refund/settlement reconciliation passes already scheduled in server.js.
export const reconcilePendingPawaPayCheckouts = async ({ limit = 50 } = {}) => {
  const staleBefore = new Date(Date.now() - 60_000);
  const checkouts = await PawaPayCheckout.find({
    status: { $in: ['CREATED', 'WAITING_PAYMENT', 'PROCESSING'] },
    $or: [
      { lastProviderStatusCheckAt: null },
      { lastProviderStatusCheckAt: { $exists: false } },
      { lastProviderStatusCheckAt: { $lt: staleBefore } }
    ]
  })
    .sort({ lastProviderStatusCheckAt: 1, createdAt: 1 })
    .limit(limit);

  let reconciledCount = 0;
  for (const checkout of checkouts) {
    try {
      await reconcileCheckoutStatusFromProvider(checkout);
      reconciledCount += 1;
    } catch {
      // A later scheduled pass or a provider callback will safely retry this checkout.
    }
  }
  return reconciledCount;
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
      $or: [
        { autoValidationState: { $in: ['PENDING', 'FAILED'] } },
        {
          autoValidationState: 'PROCESSING',
          updatedAt: { $lt: new Date(Date.now() - 2 * 60 * 1000) }
        }
      ]
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
    let successPath = claimed.returnPath || '/orders';
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
          pointsToRedeem: action.pointsToRedeem,
          groupBuyId: action.groupBuyId,
          paymentPercent: action.paymentPercent
        }
      });
      const firstOrderId = result?.orders?.[0]?._id || result?.orders?.[0]?.id || '';
      title = 'Commande PawaPay confirmée';
      message = `Une commande de ${Number(claimed.amount || 0).toLocaleString('fr-FR')} FCFA a été payée et créée automatiquement avec PawaPay.`;
      deepLink = firstOrderId ? `/admin/orders?orderId=${encodeURIComponent(String(firstOrderId))}` : '/admin/orders';
      entityId = firstOrderId || claimed.checkoutId;
      successPath = firstOrderId ? `/order/detail/${encodeURIComponent(String(firstOrderId))}` : '/orders';
    } else if (action.kind === 'ORDER_PAYMENT') {
      const order = await Order.findOne({ _id: action.orderId, customer: claimed.user });
      if (!order) throw new Error('Commande introuvable pour ce paiement.');
      const orderTotal = Number(order.totalAmount || 0);
      if (!(orderTotal > 0) || Math.abs(orderTotal - Number(claimed.amount || 0)) > 0.01) {
        throw new Error('Le montant PawaPay ne correspond pas au total de la commande.');
      }
      if (String(order.paymentStatus || '').toUpperCase() !== 'PAID_FULL') {
        const previousEscrowStatus = order.escrowStatus || 'WAITING_PAYMENT';
        order.paymentSource = 'pawapay';
        order.paymentCheckoutId = claimed.checkoutId;
        order.paymentDepositId = claimed.depositId || '';
        order.paidAmount = orderTotal;
        order.remainingAmount = 0;
        order.paymentStatus = 'PAID_FULL';
        order.paymentCompletedAt = new Date();
        order.status = 'paid';
        order.escrowStatus = 'IN_ESCROW';
        order.escrowAmount = orderTotal;
        await order.save();
        await recordEscrowAudit({
          order,
          actor: claimed.user,
          actorRole: 'buyer',
          action: 'ESCROW_FUNDED',
          fromStatus: previousEscrowStatus,
          toStatus: 'IN_ESCROW',
          amount: orderTotal,
          metadata: { checkoutId: claimed.checkoutId, quotationRequest: String(order.quotationRequest || '') }
        }).catch(() => null);
        const sellerId = String(order.items?.[0]?.snapshot?.shopId || '');
        if (sellerId && sellerId !== String(claimed.user)) {
          await createNotification({
            userId: sellerId,
            actorId: claimed.user,
            type: 'payment_validated',
            priority: 'HIGH',
            deepLink: `/seller/orders/detail/${order._id}`,
            actionLink: `/seller/orders/detail/${order._id}`,
            entityType: 'order',
            entityId: String(order._id),
            title: 'Devis payé avec PawaPay',
            message: 'La commande négociée est payée et les fonds sont en séquestre.',
            actionLabel: 'Voir la commande',
            metadata: { orderId: order._id, quotationRequest: order.quotationRequest, paymentSource: 'pawapay' }
          }).catch(() => null);
        }
      }
      result = { orderId: order._id };
      title = 'Commande PawaPay payée';
      message = `La commande a été réglée avec PawaPay pour ${Number(claimed.amount || 0).toLocaleString('fr-FR')} FCFA.`;
      deepLink = `/admin/orders?orderId=${encodeURIComponent(String(order._id))}`;
      entityId = order._id;
      successPath = `/orders/detail/${encodeURIComponent(String(order._id))}`;
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
      successPath = orderId ? `/order/detail/${encodeURIComponent(String(orderId))}` : '/orders';
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
      successPath = action.orderId
        ? `/order/detail/${encodeURIComponent(String(action.orderId))}`
        : '/orders';
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
      successPath = '/sponsorships';
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
      successPath = '/seller/boosts';
    } else if (action.kind === 'GLOBAL_NOTIFICATION_REQUEST') {
      result = await invokeCompletionController({
        handler: createGlobalNotificationRequest,
        checkout: claimed,
        body: {
          title: action.title,
          message: action.message,
          productId: action.productId || '',
          audienceCity: action.audienceCity || '',
          audienceGender: action.audienceGender || 'all',
          image: action.image
        }
      });
      const requestId = result?.request?.id || '';
      title = 'Notification globale PawaPay payée';
      message = `Une notification globale de ${Number(claimed.amount || 0).toLocaleString('fr-FR')} FCFA a été créée automatiquement après confirmation PawaPay. En attente de validation admin.`;
      deepLink = requestId
        ? `/admin/global-notifications?requestId=${encodeURIComponent(String(requestId))}`
        : '/admin/global-notifications';
      entityId = requestId || claimed.checkoutId;
      successPath = '/seller/global-notifications';
    } else if (action.kind === 'SHOP_CONVERSION_REQUEST') {
      result = await completeShopConversionPawaPay({
        checkout: claimed,
        requestId: String(action.requestId || '')
      });
      const requestId = result?.request?._id || action.requestId || '';
      title = 'Demande boutique payée avec PawaPay';
      message = `Une demande de conversion en boutique de ${Number(claimed.amount || 0).toLocaleString('fr-FR')} FCFA a été payée avec PawaPay.`;
      deepLink = requestId
        ? `/admin/users?shopConversionRequestId=${encodeURIComponent(String(requestId))}`
        : '/admin/users';
      entityId = requestId || claimed.checkoutId;
      successPath = '/shop-conversion-request';
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
      successPath = '/sponsorships';
    } else if (action.kind === 'PARCEL_REQUEST_CHECKOUT') {
      result = await invokeCompletionController({
        handler: pawaPayCreateParcelRequest,
        checkout: claimed,
        body: {
          pickup: action.pickup,
          dropoff: action.dropoff,
          parcelDescription: action.parcelDescription,
          referenceCode: action.referenceCode,
          notes: action.notes,
          proofImageUrl: action.proofImageUrl,
          packageTypeId: action.packageTypeId,
          weightKg: action.weightKg,
          deliverySpeed: action.deliverySpeed,
          promoCode: action.promoCode
        }
      });
      const parcelRequestId = result?._id || '';
      title = 'Course colis payée avec PawaPay';
      message = `Une course colis de ${Number(claimed.amount || 0).toLocaleString('fr-FR')} FCFA a été payée et créée automatiquement avec PawaPay.`;
      deepLink = parcelRequestId
        ? `/admin/parcel-requests?requestId=${encodeURIComponent(String(parcelRequestId))}`
        : '/admin/parcel-requests';
      entityId = parcelRequestId || claimed.checkoutId;
      successPath = parcelRequestId ? `/parcels/${encodeURIComponent(String(parcelRequestId))}` : '/parcels';
    } else if (action.kind === 'BUY_FOR_ME_ORDER') {
      result = await invokeCompletionController({
        handler: pawaPayCreateBuyForMeOrder,
        checkout: claimed,
        body: {
          storeType: action.storeType,
          preferredStore: action.preferredStore,
          pickup: action.pickup,
          dropoff: action.dropoff,
          items: action.items,
          authorizationMode: action.authorizationMode,
          shoppingBudget: action.shoppingBudget,
          specialInstructions: action.specialInstructions,
          balancePreference: action.balancePreference
        }
      });
      const shoppingOrderId = result?._id || '';
      title = 'Demande Acheter Pour Moi payée';
      message = `Votre demande d’achat de ${Number(claimed.amount || 0).toLocaleString('fr-FR')} FCFA est confirmée. Nous recherchons un livreur.`;
      deepLink = shoppingOrderId ? `/admin/buy-for-me?orderId=${encodeURIComponent(String(shoppingOrderId))}` : '/admin/buy-for-me';
      entityId = shoppingOrderId || claimed.checkoutId;
      successPath = shoppingOrderId ? `/buy-for-me/${encodeURIComponent(String(shoppingOrderId))}` : '/buy-for-me/orders';
    } else if (action.kind === 'BUY_FOR_ME_ADDITIONAL_PAYMENT') {
      result = await invokeCompletionController({
        handler: pawaPayCompleteBuyForMeAdditionalPayment,
        checkout: claimed,
        body: { orderId: action.orderId }
      });
      const shoppingOrderId = result?._id || action.orderId || '';
      title = 'Complément Acheter Pour Moi payé';
      message = `Le complément de ${Number(claimed.amount || 0).toLocaleString('fr-FR')} FCFA a été confirmé.`;
      deepLink = shoppingOrderId ? `/admin/buy-for-me?orderId=${encodeURIComponent(String(shoppingOrderId))}` : '/admin/buy-for-me';
      entityId = shoppingOrderId || claimed.checkoutId;
      successPath = shoppingOrderId ? `/buy-for-me/${encodeURIComponent(String(shoppingOrderId))}` : '/buy-for-me/orders';
    } else {
      throw new Error('Action automatique PawaPay inconnue.');
    }

    claimed.autoValidationState = 'COMPLETED';
    claimed.autoValidatedAt = new Date();
    claimed.autoValidationError = '';
    claimed.completionResult = {
      actionKind: action.kind,
      entityId: String(entityId || ''),
      successPath,
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
      $or: [
        { autoValidationState: { $in: ['PENDING', 'FAILED'] } },
        {
          autoValidationState: 'PROCESSING',
          updatedAt: { $lt: new Date(Date.now() - 2 * 60 * 1000) }
        }
      ]
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
      const creditedFee = Number(
        existingPayment.commissionBaseAmount ??
          existingPayment.commissionDueAmount ??
          existingPayment.amountPaid ??
          existingPayment.amount ??
          0
      );
      product.listingFeePaid = Math.max(Number(product.listingFeePaid || 0), creditedFee);
      product.listingFeeRequired = Math.max(Number(product.listingFeeRequired || 0), creditedFee);
      product.listingFeeRemaining = 0;
      product.approvedPrice = Number(product.price || 0);
      product.pendingPrice = null;
      product.requiresAdditionalPayment = false;
      product.listingFeeStatus = creditedFee > 0 ? 'PAID' : 'NOT_REQUIRED';
      product.listingFeeSettled = true;
      await product.save();
      claimed.autoValidationState = 'COMPLETED';
      claimed.autoValidatedPayment = existingPayment._id;
      claimed.autoValidatedAt = new Date();
      claimed.completionResult = {
        actionKind: 'LISTING_FEE_FUNDING',
        entityId: String(product._id),
        successPath: claimed.returnPath || `/my/annonce/${product.slug || product._id}`,
        orderIds: [],
        message: 'Annonce validée automatiquement avec PawaPay.'
      };
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
    const creditedFee = Number(commission.baseAmount || dueAmount || 0);
    product.listingFeePaid = Math.max(Number(product.listingFeePaid || 0), creditedFee);
    product.listingFeeRequired = Math.max(Number(product.listingFeeRequired || 0), creditedFee);
    product.listingFeeRemaining = 0;
    product.approvedPrice = Number(product.price || 0);
    product.pendingPrice = null;
    product.requiresAdditionalPayment = false;
    product.listingFeeStatus = creditedFee > 0 ? 'PAID' : 'NOT_REQUIRED';
    product.listingFeeSettled = true;
    await product.save();
    invalidateVerifiedProductCache();
    await invalidateProductCache();

    claimed.autoValidationState = 'COMPLETED';
    claimed.autoValidatedPayment = payment._id;
    claimed.autoValidatedAt = new Date();
    claimed.autoValidationError = '';
    claimed.completionResult = {
      actionKind: 'LISTING_FEE_FUNDING',
      entityId: String(product._id),
      successPath: claimed.returnPath || `/my/annonce/${product.slug || product._id}`,
      orderIds: [],
      message: 'Annonce validée automatiquement avec PawaPay.'
    };
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
    const currency = String(req.body.currency || req.body.deposit?.currency || '').trim().toUpperCase();
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
    const refund = resourceType === 'refund'
      ? await reconcileRefund(resourceId, payload)
      : null;
    const sellerPayout = resourceType === 'payout'
      ? await reconcileSellerPayout(resourceId, payload)
      : null;
    const reconciliation = refund || sellerPayout
      ? { payment: null, reconciliationStatus: 'MATCHED' }
      : await reconcilePayment({ resourceType, resourceId, status, amount, currency, payload });
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
          matchedRefund: refund?._id || null,
          matchedPayout: sellerPayout?._id || null,
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

export const listPawaPayRefundsAdmin = asyncHandler(async (req, res) => {
  const status = String(req.query.status || '').trim().toUpperCase();
  const query = status ? { status } : {};
  const refunds = await Refund.find(query)
    .populate('order', 'status refundStatus refundAmount refundFailureReason')
    .populate('customer', 'name email phone')
    .sort({ createdAt: -1 })
    .limit(Math.min(100, Math.max(1, Number(req.query.limit || 50))))
    .lean();
  res.json({ refunds });
});

export const refreshPawaPayRefundAdmin = asyncHandler(async (req, res) => {
  const refund = await Refund.findOne({ refundId: String(req.params.refundId || '').trim() });
  if (!refund) return res.status(404).json({ message: 'Remboursement introuvable.' });
  try {
    const providerStatus = await getPawaPayRefundStatus(refund.refundId, { timeoutMs: 12_000 });
    const reconciled = await reconcileRefund(refund.refundId, providerStatus);
    return res.json({ refund: reconciled });
  } catch (error) {
    return res.status(Number(error?.status || 502)).json({
      message: error?.message || 'Impossible de vérifier le remboursement auprès de PawaPay.'
    });
  }
});

const isAdminOrFounder = (user) => ['admin', 'founder'].includes(String(user?.role || '').toLowerCase());

export const refreshPawaPayCheckoutAdmin = asyncHandler(async (req, res) => {
  if (!isAdminOrFounder(req.user)) {
    return res.status(403).json({ message: 'Accès refusé.' });
  }
  const checkout = await PawaPayCheckout.findOne({
    checkoutId: String(req.params.checkoutId || '').trim()
  });
  if (!checkout) return res.status(404).json({ message: 'Paiement PawaPay introuvable.' });

  // Force the provider check through the existing atomic claim. Saving the
  // whole document here can fail validation for legacy checkout records even
  // though this action only needs to update the check timestamp.
  const reconciled = await reconcileCheckoutStatusFromProvider(checkout, { force: true });
  return res.json({
    message: 'Statut synchronisé avec PawaPay.',
    checkout: reconciled
  });
});

export const retryPawaPayCheckoutCompletionAdmin = asyncHandler(async (req, res) => {
  if (!isAdminOrFounder(req.user)) {
    return res.status(403).json({ message: 'Accès refusé.' });
  }
  const checkout = await PawaPayCheckout.findOne({
    checkoutId: String(req.params.checkoutId || '').trim()
  });
  if (!checkout) return res.status(404).json({ message: 'Paiement PawaPay introuvable.' });
  if (checkout.status !== 'COMPLETED' || checkout.paymentState !== 'CONFIRMED') {
    return res.status(409).json({
      message: 'La finalisation ne peut être relancée que pour un paiement confirmé par PawaPay.'
    });
  }
  if (checkout.autoValidationState === 'COMPLETED') {
    return res.json({ message: 'Ce paiement est déjà finalisé.', checkout });
  }
  if (checkout.autoValidationState !== 'FAILED') {
    return res.status(409).json({
      message: 'Cette transaction ne présente aucun échec de finalisation à relancer.'
    });
  }

  const reconciled = await reconcileCheckoutStatusFromProvider(checkout);
  if (reconciled?.autoValidationState === 'FAILED') {
    return res.status(422).json({
      message: reconciled.autoValidationError || 'La finalisation a encore échoué.',
      checkout: reconciled
    });
  }
  return res.json({ message: 'Paiement finalisé avec succès.', checkout: reconciled });
});

// Replaces the old wallet oversight view (soldes/files d'attente/mouvements)
// now that PawaPay is the real payment rail: checkout status breakdown, stuck
// payments needing attention, checkouts whose payment succeeded but order
// creation failed (money taken, nothing created — the exact incident class
// investigated earlier), outstanding COD/partial balances from the 50-100%
// PawaPay split, and a recent transactions ledger.
export const getAdminPawaPayOverview = asyncHandler(async (req, res) => {
  if (!isAdminOrFounder(req.user)) {
    return res.status(403).json({ message: 'Accès refusé.' });
  }

  const stuckSince = new Date(Date.now() - 15 * 60 * 1000);

  const [statusRows, completedRows, stuckCheckouts, failedCompletions, outstandingRows, recentCheckouts] =
    await Promise.all([
      PawaPayCheckout.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 }, amount: { $sum: '$amount' } } }
      ]),
      PawaPayCheckout.aggregate([
        { $match: { status: 'COMPLETED' } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
      ]),
      PawaPayCheckout.find({
        status: { $in: ['WAITING_PAYMENT', 'PROCESSING'] },
        createdAt: { $lt: stuckSince }
      })
        .sort({ createdAt: 1 })
        .limit(50)
        .populate('user', 'name phone')
        .lean(),
      PawaPayCheckout.find({ autoValidationState: 'FAILED' })
        .sort({ updatedAt: -1 })
        .limit(50)
        .populate('user', 'name phone')
        .lean(),
      Order.aggregate([
        { $match: { paymentStatus: 'PARTIAL', remainingAmount: { $gt: 0 } } },
        { $group: { _id: null, total: { $sum: '$remainingAmount' }, count: { $sum: 1 } } }
      ]),
      PawaPayCheckout.find({})
        .sort({ createdAt: -1 })
        .limit(30)
        .populate('user', 'name phone')
        .lean()
    ]);

  const statusCounts = statusRows.reduce((acc, row) => {
    acc[row._id] = { count: row.count, amount: Number(row.amount || 0) };
    return acc;
  }, {});

  return res.json({
    statusCounts,
    completed: {
      total: Number(completedRows[0]?.total || 0),
      count: Number(completedRows[0]?.count || 0)
    },
    outstandingBalance: {
      total: Number(outstandingRows[0]?.total || 0),
      count: Number(outstandingRows[0]?.count || 0)
    },
    stuckCheckouts,
    failedCompletions,
    recentCheckouts
  });
});
