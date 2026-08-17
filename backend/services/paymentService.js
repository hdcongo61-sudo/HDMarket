import CountryPaymentMethod from '../models/countryPaymentMethodModel.js';
import { assertCurrencySupported, resolveCountryContext } from './countryService.js';

export const resolvePaymentProvider = async ({
  provider,
  countryId,
  currency,
  user = null,
  allowLegacyCongo = true
} = {}) => {
  const countryContext = await resolveCountryContext({ resourceCountryId: countryId, user });
  const currencyCode = assertCurrencySupported(countryContext.country, currency || countryContext.currency.code);
  const providerCode = String(provider || '').trim().toUpperCase();
  const method = await CountryPaymentMethod.findOne({
    countryId: countryContext.countryId,
    provider: providerCode,
    enabled: true,
    currencies: currencyCode
  }).lean();
  if (!method && !(allowLegacyCongo && countryContext.code === 'CG' && providerCode === 'PAWAPAY')) {
    const error = new Error(`${providerCode || 'Ce moyen de paiement'} n'est pas disponible dans ce pays.`);
    error.status = 409;
    error.code = 'COUNTRY_PAYMENT_UNAVAILABLE';
    throw error;
  }
  return { countryContext, method, currency: currencyCode, provider: providerCode };
};

export const getAvailablePaymentProviders = async ({ countryId, user = null } = {}) => {
  const countryContext = await resolveCountryContext({ resourceCountryId: countryId, user });
  const methods = await CountryPaymentMethod.find({ countryId: countryContext.countryId, enabled: true })
    .select('-configurationReference -updatedBy')
    .sort({ sortOrder: 1, displayName: 1 })
    .lean();
  if (!methods.length && countryContext.code === 'CG') {
    methods.push({
      provider: 'PAWAPAY',
      type: 'MOBILE_MONEY',
      displayName: 'PawaPay',
      enabled: true,
      currencies: ['XAF'],
      publicConfiguration: { legacyFallback: true }
    });
  }
  return { country: countryContext.country, methods };
};

export default { resolvePaymentProvider, getAvailablePaymentProviders };
