import User from '../models/userModel.js';
import { buildPhoneCandidates } from '../utils/firebaseVerification.js';
import { ensureDefaultCountry, findCountry, resolveCountryContext } from './countryService.js';

// Market-unavailability errors under which only founders may still identify.
const UNAVAILABLE_MARKET_CODES = new Set(['COUNTRY_DISABLED', 'COUNTRY_ACCESS_DENIED']);

const founderByPhoneCandidates = (identifier, countries) => {
  const phoneCodes = [...new Set(countries.map((country) => country?.phoneCode).filter(Boolean))];
  if (!phoneCodes.length) return null;
  return User.findOne({
    role: 'founder',
    phone: { $in: phoneCodes.flatMap((phoneCode) => buildPhoneCandidates(identifier, phoneCode)) }
  });
};

/**
 * Resolve the account behind a phone identifier at login.
 *
 * When the requested country (or the default one) is not accepting
 * operations yet, only founder accounts may identify so operators can keep
 * configuring the market — everyone else keeps the regular "unavailable"
 * error. Password verification, lockout and account-status checks stay in
 * the login controller.
 */
export const findPhoneLoginUser = async (identifier, requestedCountry = null) => {
  let country;
  try {
    ({ country } = await resolveCountryContext({ requestedCountry, user: null }));
  } catch (error) {
    if (!UNAVAILABLE_MARKET_CODES.has(error.code)) throw error;

    const requested = requestedCountry ? await findCountry(requestedCountry).catch(() => null) : null;
    const fallback = await ensureDefaultCountry().catch(() => null);
    if (!requested && !fallback) throw error;

    // A founder may have registered under a different country than the one
    // requested at login — search every resolved phone code before giving up.
    const founder = await founderByPhoneCandidates(identifier, [requested, fallback]);
    if (!founder) throw error;
    return founder;
  }
  return User.findOne({ phone: { $in: buildPhoneCandidates(identifier, country.phoneCode) } });
};
