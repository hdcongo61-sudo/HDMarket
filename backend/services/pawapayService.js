import crypto from 'crypto';
import { createPawaPayError, extractPawaPayFailure } from '../utils/pawapayErrors.js';

const SANDBOX_BASE_URL = 'https://api.sandbox.pawapay.io/v2';
const PRODUCTION_BASE_URL = 'https://api.pawapay.io/v2';
const DEFAULT_TIMEOUT_MS = 20_000;

const trimTrailingSlash = (value) => String(value || '').replace(/\/+$/, '');

// PawaPay supports optional RFC 9421 signatures on financial requests
// (checkouts, deposits, payouts, refunds). When the merchant enables
// "Only accept signed requests" in the PawaPay Dashboard, unsigned financial
// calls are rejected with HTTP_SIGNATURE_ERROR. Signing activates when both
// PAWAPAY_SIGNING_KEY_ID (the key id registered in the dashboard) and
// PAWAPAY_SIGNING_PRIVATE_KEY (SEC1 PEM of the EC P-256 private key) are set.
const SIGNING_ALGORITHMS = {
  'ecdsa-p256-sha256': { name: 'ecdsa-p256-sha256', digest: 'sha256', namedCurve: 'prime256v1' }
};

export const getPawaPaySigningConfig = () => {
  const keyId = String(process.env.PAWAPAY_SIGNING_KEY_ID || '').trim();
  const privateKey = String(process.env.PAWAPAY_SIGNING_PRIVATE_KEY || '').trim();
  const algorithmKey = String(process.env.PAWAPAY_SIGNING_ALGORITHM || 'ecdsa-p256-sha256')
    .toLowerCase()
    .trim();
  const algorithm = SIGNING_ALGORITHMS[algorithmKey] || SIGNING_ALGORITHMS['ecdsa-p256-sha256'];

  let keyValid = false;
  if (keyId && privateKey) {
    try {
      const keyObject = crypto.createPrivateKey(privateKey);
      keyValid = keyObject.asymmetricKeyType === 'ec';
    } catch {
      keyValid = false;
    }
  }
  if (keyId && privateKey && !keyValid) {
    // Never fail silently: a misconfigured key means unsigned requests that
    // PawaPay rejects with HTTP_SIGNATURE_ERROR when signing is required.
    console.warn(
      '[pawapay] PAWAPAY_SIGNING_PRIVATE_KEY is invalid — requests will be sent unsigned and PawaPay will reject them if signed requests are required. Use a full EC P-256 PEM (-----BEGIN EC PRIVATE KEY----- ...).'
    );
  }

  return {
    active: Boolean(keyId && privateKey && keyValid),
    keyId,
    privateKey,
    algorithm
  };
};

/**
 * Build the RFC 9421 headers PawaPay expects on signed requests:
 * Content-Digest (sha-256 of the body), Signature-Date, Signature-Input and
 * Signature, plus the Accept-Signature / Accept-Digest hints. Returns null
 * when signing is not configured or the key is invalid.
 */
export const buildPawaPaySignatureHeaders = ({ method, url, body, signing }) => {
  if (!signing?.active || !signing.privateKey || !signing.keyId) return null;
  try {
    const parsed = new URL(url);
    const authority = parsed.host;
    const path = parsed.pathname;
    const now = Math.floor(Date.now() / 1000);
    const expires = now + 300; // 5-minute window, generous for slow networks

    const components = ['"@method"', '"@authority"', '"@path"'];
    const values = new Map([
      ['@method', String(method || 'GET').toUpperCase()],
      ['@authority', authority],
      ['@path', path]
    ]);

    const headers = {};
    const signatureDate = new Date().toISOString();
    headers['Signature-Date'] = signatureDate;
    values.set('signature-date', signatureDate);
    components.push('"signature-date"');

    if (body) {
      const digest = crypto.createHash('sha256').update(body).digest('base64');
      const digestHeader = `sha-256=:${digest}:`;
      headers['Content-Digest'] = digestHeader;
      values.set('content-digest', digestHeader);
      components.push('"content-digest"');

      const contentType = 'application/json; charset=UTF-8';
      headers['Content-Type'] = contentType;
      values.set('content-type', contentType);
      components.push('"content-type"');
    }

    const paramsString = `(${components.join(' ')});${[
      `alg="${signing.algorithm.name}"`,
      `keyid="${signing.keyId}"`,
      `created=${now}`,
      `expires=${expires}`
    ].join(';')}`;

    const baseLines = [...values.entries()].map(([name, value]) => `"${name}": ${value}`);
    baseLines.push(`"@signature-params": ${paramsString}`);
    const signatureBase = baseLines.join('\n');

    const signature = crypto.sign(signing.algorithm.digest, Buffer.from(signatureBase, 'utf8'), {
      key: signing.privateKey,
      dsaEncoding: 'der'
    });

    headers['Signature-Input'] = `sig-pp=${paramsString}`;
    headers['Signature'] = `sig-pp=:${signature.toString('base64')}:`;
    headers['Accept-Signature'] = 'rsa-pss-sha512,ecdsa-p256-sha256,rsa-v1_5-sha256,ecdsa-p384-sha384';
    headers['Accept-Digest'] = 'sha-256,sha-512';

    return { headers, signatureBase };
  } catch {
    return null;
  }
};

export const getPawaPayConfig = () => {
  const environment = String(process.env.PAWAPAY_ENVIRONMENT || 'sandbox').toLowerCase();
  const defaultBaseUrl = environment === 'production' ? PRODUCTION_BASE_URL : SANDBOX_BASE_URL;

  return {
    enabled: String(process.env.PAWAPAY_ENABLED || 'false').toLowerCase() === 'true',
    // HDMarket now accepts paid operations through PawaPay only. Keep this
    // invariant server-side so an old frontend cannot restore manual payments.
    exclusiveMode: true,
    environment,
    baseUrl: trimTrailingSlash(process.env.PAWAPAY_BASE_URL || defaultBaseUrl),
    apiToken: String(process.env.PAWAPAY_API_TOKEN || '').trim()
  };
};

export const pawapayRequest = async (
  path,
  { method = 'GET', body, signal, rejectProviderFailure = false, timeoutMs = DEFAULT_TIMEOUT_MS } = {}
) => {
  const config = getPawaPayConfig();
  if (!config.enabled) {
    throw createPawaPayError({
      code: 'CONFIG_DISABLED',
      status: 503,
      message: "Le paiement PawaPay n'est pas activé.",
      retryable: false,
      action: 'CONTACT_SUPPORT'
    });
  }
  if (!config.apiToken) {
    throw createPawaPayError({
      code: 'CONFIG_MISSING',
      status: 503,
      message: 'Le paiement PawaPay est temporairement indisponible.',
      retryable: false,
      action: 'CONTACT_SUPPORT'
    });
  }

  const controller = new AbortController();
  let timedOut = false;
  const onAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', onAbort, { once: true });
  }
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, Math.max(1, Number(timeoutMs) || DEFAULT_TIMEOUT_MS));

  const fullUrl = `${config.baseUrl}/${String(path).replace(/^\/+/, '')}`;
  const bodyString = body ? JSON.stringify(body) : null;
  const signing = getPawaPaySigningConfig();
  const requestHeaders = {
    Accept: 'application/json',
    Authorization: `Bearer ${config.apiToken}`,
    ...(bodyString ? { 'Content-Type': 'application/json; charset=UTF-8' } : {})
  };
  if (signing.active) {
    const signed = buildPawaPaySignatureHeaders({
      method,
      url: fullUrl,
      body: bodyString,
      signing
    });
    if (signed) Object.assign(requestHeaders, signed.headers);
  }

  let response;
  try {
    response = await fetch(fullUrl, {
      method,
      signal: controller.signal,
      headers: requestHeaders,
      ...(bodyString ? { body: bodyString } : {})
    });
  } catch (cause) {
    if (timedOut) {
      throw createPawaPayError({
        code: 'TIMEOUT',
        status: 504,
        message: 'PawaPay met trop de temps à répondre. Vérifiez le statut avant de recommencer.',
        retryable: true,
        action: 'CHECK_STATUS',
        meta: { cause: String(cause?.message || cause) }
      });
    }
    if (signal?.aborted) throw cause;
    const financialRequestMayBePending = rejectProviderFailure && method !== 'GET';
    throw createPawaPayError({
      code: 'NETWORK_ERROR',
      status: 502,
      message: financialRequestMayBePending
        ? 'La réponse de PawaPay n’a pas été reçue. Vérifiez le statut avant de recommencer.'
        : 'La connexion avec PawaPay a échoué. Réessayez dans quelques instants.',
      retryable: true,
      action: financialRequestMayBePending ? 'CHECK_STATUS' : 'RETRY',
      meta: { cause: String(cause?.message || cause) }
    });
  } finally {
    clearTimeout(timeout);
    if (signal) signal.removeEventListener('abort', onAbort);
  }

  const text = await response.text();
  let result = null;
  try {
    result = text ? JSON.parse(text) : null;
  } catch {
    result = text || null;
  }

  if (!response.ok) {
    const { providerCode } = extractPawaPayFailure(result);
    const providerStatus = response.status;
    const configurationFailure = new Set([
      'NO_AUTHENTICATION',
      'AUTHENTICATION_ERROR',
      'AUTHORISATION_ERROR',
      'HTTP_SIGNATURE_ERROR'
    ]).has(providerCode);
    const isProviderUncertain = providerStatus >= 500 || providerCode === 'UNKNOWN_ERROR';
    const signatureRejected = providerCode === 'HTTP_SIGNATURE_ERROR';
    throw createPawaPayError({
      failure: result,
      code: signatureRejected ? 'PAWAPAY_HTTP_SIGNATURE_ERROR' : undefined,
      message: signatureRejected
        ? 'La signature HTTP a été rejetée par PawaPay. Vérifiez que PAWAPAY_SIGNING_KEY_ID et PAWAPAY_SIGNING_PRIVATE_KEY correspondent à la clé publique enregistrée dans le tableau de bord PawaPay (même environnement sandbox/production).'
        : undefined,
      status: configurationFailure ? 503 : isProviderUncertain ? 502 : providerStatus === 429 ? 429 : 400,
      retryable: isProviderUncertain ? true : undefined,
      action: signatureRejected ? 'CONTACT_SUPPORT' : isProviderUncertain ? 'CHECK_STATUS' : undefined,
      meta: {
        providerStatus,
        providerResponse: result
      }
    });
  }

  if (rejectProviderFailure && String(result?.status || '').toUpperCase() === 'REJECTED') {
    throw createPawaPayError({
      failure: result,
      status: 400,
      meta: { providerStatus: response.status, providerResponse: result }
    });
  }

  return result;
};

export const initiatePawaPayCheckout = (payload, options) =>
  pawapayRequest('checkouts', { method: 'POST', body: payload, rejectProviderFailure: true, ...options });

export const getPawaPayCheckoutStatus = (checkoutId, options) =>
  pawapayRequest(`checkouts/${encodeURIComponent(String(checkoutId || '').trim())}`, options);

export const initiatePawaPayDeposit = (payload, options) =>
  pawapayRequest('deposits', { method: 'POST', body: payload, rejectProviderFailure: true, ...options });

export const initiatePawaPayPayout = (payload, options) =>
  pawapayRequest('payouts', { method: 'POST', body: payload, rejectProviderFailure: true, ...options });

export const getPawaPayPayoutStatus = (payoutId, options) =>
  pawapayRequest(`payouts/${encodeURIComponent(String(payoutId || '').trim())}`, options);

export const initiatePawaPayRefund = (payload, options) =>
  pawapayRequest('refunds', { method: 'POST', body: payload, rejectProviderFailure: true, ...options });

export const getPawaPayRefundStatus = (refundId, options) =>
  pawapayRequest(`refunds/${encodeURIComponent(String(refundId || '').trim())}`, options);

export const predictPawaPayProvider = (phoneNumber, options) =>
  pawapayRequest('predict-provider', {
    method: 'POST',
    body: { phoneNumber: String(phoneNumber || '').trim() },
    ...options
  });

export const getPawaPayActiveConfiguration = (options) =>
  pawapayRequest('active-conf', options);

export const getPawaPayPublicKeys = (options) =>
  pawapayRequest('public-key/http', options);

/**
 * Founder/admin diagnostic: verify the PawaPay configuration without making
 * any financial request. The public-key fingerprint lets the operator compare
 * the locally configured key with the one registered in the PawaPay dashboard.
 */
export const getPawaPayConfigCheck = () => {
  const config = getPawaPayConfig();
  const signing = getPawaPaySigningConfig();
  let publicKeyFingerprint = null;
  try {
    const publicKey = crypto.createPublicKey(signing.privateKey).export({ type: 'spki', format: 'der' });
    publicKeyFingerprint = crypto.createHash('sha256').update(publicKey).digest('hex');
  } catch {
    publicKeyFingerprint = null;
  }
  return {
    enabled: config.enabled,
    environment: config.environment,
    baseUrl: config.baseUrl,
    apiTokenSet: Boolean(config.apiToken),
    exclusiveMode: config.exclusiveMode,
    signing: {
      active: signing.active,
      keyId: signing.keyId || null,
      algorithm: signing.algorithm?.name || null,
      publicKeyFingerprintSha256: publicKeyFingerprint
    },
    signedCallbacksRequired: String(process.env.PAWAPAY_SIGNED_CALLBACKS_REQUIRED || 'false') === 'true'
  };
};
