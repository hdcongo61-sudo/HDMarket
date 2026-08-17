import { resolveCountryContext } from '../services/countryService.js';

const requestedCountryFrom = (req) =>
  req.headers?.['x-country-id'] ||
  req.headers?.['x-country-code'] ||
  req.query?.countryId ||
  req.query?.country ||
  null;

export const attachCountryContext = async (req, _res, next) => {
  try {
    req.countryContext = await resolveCountryContext({
      requestedCountry: requestedCountryFrom(req),
      user: req.user || null
    });
  } catch (error) {
    req.countryContextError = error;
  }
  next();
};

export const requireCountryContext = async (req, res, next) => {
  try {
    req.countryContext = await resolveCountryContext({
      requestedCountry: requestedCountryFrom(req),
      user: req.user || null
    });
    return next();
  } catch (error) {
    return res.status(error.status || 400).json({
      message: error.message,
      code: error.code || 'COUNTRY_NOT_AVAILABLE'
    });
  }
};

export const requireSameResourceCountry = (resolver) => async (req, res, next) => {
  try {
    const resourceCountryId = await resolver(req);
    req.countryContext = await resolveCountryContext({
      resourceCountryId,
      requestedCountry: requestedCountryFrom(req),
      user: req.user || null,
      historical: req.method === 'GET'
    });
    return next();
  } catch (error) {
    return res.status(error.status || 403).json({
      message: error.message,
      code: error.code || 'COUNTRY_ACCESS_DENIED'
    });
  }
};

export default { attachCountryContext, requireCountryContext, requireSameResourceCountry };
