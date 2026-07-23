import crypto from 'crypto';
import asyncHandler from 'express-async-handler';
import Payment from '../models/paymentModel.js';
import PawaPayEvent from '../models/pawapayEventModel.js';
import PawaPayCheckout from '../models/pawapayCheckoutModel.js';
import Wallet from '../models/walletModel.js';
import { creditWalletTopupFromGateway } from '../services/walletService.js';
import {
  getPawaPayPublicKeys,
  initiatePawaPayCheckout
} from '../services/pawapayService.js';
import { getPawaPayFailurePresentation } from '../utils/pawapayErrors.js';

const RESOURCE_CONFIG = {
  checkout: { idField: 'checkoutId' },
  deposit: { idField: 'depositId' },
  payout: { idField: 'payoutId' },
  refund: { idField: 'refundId' }
};

const FINAL_SUCCESS = new Set(['COMPLETED', 'SUCCESSFUL']);
const FINAL_FAILURE = new Set(['FAILED', 'CANCELLED', 'EXPIRED', 'REJECTED']);
const CHECKOUT_PURPOSES = new Set([
  'WALLET_TOPUP',
  'CHECKOUT_FUNDING',
  'LISTING_FEE_FUNDING',
  'INSTALLMENT_FUNDING',
  'BOOST_FUNDING',
  'SHOP_CONVERSION_FUNDING'
]);

const sendPawaPayError = (res, status, code, message, details = {}) =>
  res.status(status).json({
    success: false,
    code,
    message,
    details
  });

const normalizeReturnPath = (value) => {
  const path = String(value || '/wallet').trim();
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('://')) return '/wallet';
  return path.slice(0, 300);
};

const checkoutReturnUrl = (checkoutId) => {
  const configured = String(
    process.env.PAWAPAY_CHECKOUT_RETURN_URL || 'https://www.hdmarket.store/payment/pawapay/return'
  ).trim();
  const url = new URL(configured);
  url.searchParams.set('checkoutId', checkoutId);
  return url.toString();
};

export const createPawaPayWalletCheckout = asyncHandler(async (req, res) => {
  const amount = Number(req.body?.amount);
  const purpose = String(req.body?.purpose || 'WALLET_TOPUP').trim().toUpperCase();
  const returnPath = normalizeReturnPath(req.body?.returnPath);

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

  const checkoutId = crypto.randomUUID();
  const checkout = await PawaPayCheckout.create({
    checkoutId,
    user: req.user._id,
    amount,
    purpose,
    returnPath
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
        { purpose }
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
    status: checkout.status,
    creditState: checkout.creditState,
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

const reconcileWalletCheckout = async ({ resourceType, resourceId, status, amount, currency, payload }) => {
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
        { creditState: 'PENDING' },
        {
          creditState: 'PROCESSING',
          updatedAt: { $lt: new Date(Date.now() - 2 * 60 * 1000) }
        }
      ]
    },
    { $set: { creditState: 'PROCESSING' } },
    { new: true }
  );
  if (!claimed) return checkout;

  try {
    await creditWalletTopupFromGateway({
      userId: claimed.user,
      amount: claimed.amount,
      gateway: 'PawaPay',
      providerTransactionId: claimed.checkoutId,
      rawPayload: sanitizePayload(payload)
    });
    claimed.creditState = 'CREDITED';
    claimed.creditedAt = new Date();
    await claimed.save();
  } catch (error) {
    claimed.creditState = 'PENDING';
    await claimed.save();
    throw error;
  }

  return claimed;
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

const reconcileWalletPayout = async ({ resourceType, resourceId, status, payload }) => {
  if (resourceType !== 'payout') return null;
  const wallet = await Wallet.findOne({
    transactions: { $elemMatch: { type: 'withdrawal', 'metadata.payoutId': resourceId } }
  });
  if (!wallet) return null;
  const transaction = wallet.transactions.find(
    (entry) => entry.type === 'withdrawal' && String(entry?.metadata?.payoutId || '') === resourceId
  );
  if (!transaction || transaction.status !== 'pending') return transaction || null;

  if (FINAL_SUCCESS.has(status)) {
    transaction.status = 'completed';
    transaction.processedAt = new Date();
    transaction.note = 'Retrait envoyé via PawaPay';
    transaction.metadata = { ...transaction.metadata, providerStatus: status };
  } else if (FINAL_FAILURE.has(status)) {
    wallet.balance += Number(transaction.amount || 0);
    transaction.status = 'failed';
    transaction.processedAt = new Date();
    transaction.balanceAfter = wallet.balance;
    transaction.note = 'Retrait PawaPay échoué — montant recrédité';
    transaction.metadata = {
      ...transaction.metadata,
      providerStatus: status,
      failureReason: sanitizePayload(payload?.failureReason || null)
    };
  }
  await wallet.save();
  return transaction;
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
    const walletCheckout = await reconcileWalletCheckout({
      resourceType,
      resourceId,
      status,
      amount,
      currency,
      payload
    });
    const walletPayout = await reconcileWalletPayout({ resourceType, resourceId, status, payload });
    const reconciliation = await reconcilePayment({ resourceType, resourceId, status, amount, currency, payload });

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
          reconciliationStatus: walletCheckout || walletPayout ? 'MATCHED' : reconciliation.reconciliationStatus
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
