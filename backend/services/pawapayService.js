const SANDBOX_BASE_URL = 'https://api.sandbox.pawapay.io/v2';
const PRODUCTION_BASE_URL = 'https://api.pawapay.io/v2';

const trimTrailingSlash = (value) => String(value || '').replace(/\/+$/, '');

export const getPawaPayConfig = () => {
  const environment = String(process.env.PAWAPAY_ENVIRONMENT || 'sandbox').toLowerCase();
  const defaultBaseUrl = environment === 'production' ? PRODUCTION_BASE_URL : SANDBOX_BASE_URL;

  return {
    enabled: String(process.env.PAWAPAY_ENABLED || 'false').toLowerCase() === 'true',
    environment,
    baseUrl: trimTrailingSlash(process.env.PAWAPAY_BASE_URL || defaultBaseUrl),
    apiToken: String(process.env.PAWAPAY_API_TOKEN || '').trim()
  };
};

const createProviderError = (message, status, details) => {
  const error = new Error(message);
  error.status = status;
  error.code = 'PAWAPAY_REQUEST_FAILED';
  error.details = details;
  return error;
};

export const pawapayRequest = async (path, { method = 'GET', body, signal } = {}) => {
  const config = getPawaPayConfig();
  if (!config.enabled) {
    throw createProviderError("L'intégration PawaPay n'est pas activée.", 503);
  }
  if (!config.apiToken) {
    throw createProviderError('Le jeton API PawaPay est manquant.', 503);
  }

  const response = await fetch(`${config.baseUrl}/${String(path).replace(/^\/+/, '')}`, {
    method,
    signal,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${config.apiToken}`,
      ...(body ? { 'Content-Type': 'application/json; charset=UTF-8' } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });

  const text = await response.text();
  let result = null;
  try {
    result = text ? JSON.parse(text) : null;
  } catch {
    result = text || null;
  }

  if (!response.ok) {
    throw createProviderError('PawaPay a refusé la requête.', response.status >= 500 ? 502 : 400, {
      providerStatus: response.status,
      providerResponse: result
    });
  }

  return result;
};

export const initiatePawaPayCheckout = (payload, options) =>
  pawapayRequest('checkouts', { method: 'POST', body: payload, ...options });

export const initiatePawaPayDeposit = (payload, options) =>
  pawapayRequest('deposits', { method: 'POST', body: payload, ...options });

export const initiatePawaPayPayout = (payload, options) =>
  pawapayRequest('payouts', { method: 'POST', body: payload, ...options });

export const initiatePawaPayRefund = (payload, options) =>
  pawapayRequest('refunds', { method: 'POST', body: payload, ...options });

export const getPawaPayActiveConfiguration = (options) =>
  pawapayRequest('active-conf', options);

export const getPawaPayPublicKeys = (options) =>
  pawapayRequest('public-key/http', options);
