import { createPawaPayError, extractPawaPayFailure } from '../utils/pawapayErrors.js';

const SANDBOX_BASE_URL = 'https://api.sandbox.pawapay.io/v2';
const PRODUCTION_BASE_URL = 'https://api.pawapay.io/v2';
const DEFAULT_TIMEOUT_MS = 20_000;

const trimTrailingSlash = (value) => String(value || '').replace(/\/+$/, '');

export const getPawaPayConfig = () => {
  const environment = String(process.env.PAWAPAY_ENVIRONMENT || 'sandbox').toLowerCase();
  const defaultBaseUrl = environment === 'production' ? PRODUCTION_BASE_URL : SANDBOX_BASE_URL;

  return {
    enabled: String(process.env.PAWAPAY_ENABLED || 'false').toLowerCase() === 'true',
    exclusiveMode: String(process.env.PAWAPAY_EXCLUSIVE_MODE || 'true').toLowerCase() === 'true',
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

  let response;
  try {
    response = await fetch(`${config.baseUrl}/${String(path).replace(/^\/+/, '')}`, {
      method,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${config.apiToken}`,
        ...(body ? { 'Content-Type': 'application/json; charset=UTF-8' } : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {})
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
    throw createPawaPayError({
      failure: result,
      status: configurationFailure ? 503 : isProviderUncertain ? 502 : providerStatus === 429 ? 429 : 400,
      retryable: isProviderUncertain ? true : undefined,
      action: isProviderUncertain ? 'CHECK_STATUS' : undefined,
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

export const initiatePawaPayDeposit = (payload, options) =>
  pawapayRequest('deposits', { method: 'POST', body: payload, rejectProviderFailure: true, ...options });

export const initiatePawaPayPayout = (payload, options) =>
  pawapayRequest('payouts', { method: 'POST', body: payload, rejectProviderFailure: true, ...options });

export const initiatePawaPayRefund = (payload, options) =>
  pawapayRequest('refunds', { method: 'POST', body: payload, rejectProviderFailure: true, ...options });

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
