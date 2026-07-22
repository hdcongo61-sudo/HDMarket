import crypto from 'crypto';
import asyncHandler from 'express-async-handler';
import Payment from '../models/paymentModel.js';
import PawaPayEvent from '../models/pawapayEventModel.js';
import { getPawaPayPublicKeys } from '../services/pawapayService.js';

const RESOURCE_CONFIG = {
  checkout: { idField: 'checkoutId' },
  deposit: { idField: 'depositId' },
  payout: { idField: 'payoutId' },
  refund: { idField: 'refundId' }
};

const FINAL_SUCCESS = new Set(['COMPLETED', 'SUCCESSFUL']);
const FINAL_FAILURE = new Set(['FAILED', 'CANCELLED', 'EXPIRED', 'REJECTED']);

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
    if (digestRequired) return res.status(401).json({ message: 'Content-Digest PawaPay manquant.' });
    return next();
  }

  const parsed = parseContentDigest(header);
  const rawBody = Buffer.isBuffer(req.rawBody) ? req.rawBody : Buffer.from(JSON.stringify(req.body || {}));
  if (!parsed) return res.status(401).json({ message: 'Content-Digest PawaPay invalide.' });

  const nodeAlgorithm = parsed.algorithm.replace('-', '');
  const actual = crypto.createHash(nodeAlgorithm).update(rawBody).digest('base64');
  const expectedBuffer = Buffer.from(parsed.expected);
  const actualBuffer = Buffer.from(actual);
  if (expectedBuffer.length !== actualBuffer.length || !crypto.timingSafeEqual(expectedBuffer, actualBuffer)) {
    return res.status(401).json({ message: 'Le contenu du callback PawaPay a été altéré.' });
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
    return res.status(401).json({ message: 'En-têtes de signature PawaPay incomplets.' });
  }

  const valid = await verifyHttpMessageSignature(req);
  if (!valid) return res.status(401).json({ message: 'Signature PawaPay invalide.' });
  return next();
});

const normalizedAmount = (payload) => {
  const value = payload.amount ?? payload.requestedAmount;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
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
      return res.status(400).json({ message: `Callback PawaPay ${resourceType} invalide.` });
    }

    const amount = normalizedAmount(req.body);
    const currency = String(req.body.currency || '').trim().toUpperCase();
    const payload = sanitizePayload(req.body);
    const rawBody = Buffer.isBuffer(req.rawBody) ? req.rawBody : Buffer.from(JSON.stringify(req.body || {}));
    const payloadDigest = crypto.createHash('sha256').update(rawBody).digest('hex');
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
          reconciliationStatus: reconciliation.reconciliationStatus
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
