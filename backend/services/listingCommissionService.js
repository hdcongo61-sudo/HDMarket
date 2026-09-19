import { getRuntimeConfig } from './configService.js';

// Publication fees are percentages, including values below 1% and zero.
// Read fresh when quoting money: another server may have changed the setting.
export const getListingCommissionRate = async (countryId = null) => {
  const value = await getRuntimeConfig('commission_rate', {
    countryId, fallback: 3, fresh: true
  });
  if (value === null || value === undefined || value === '') return 3;
  const rate = Number(value);
  return Number.isFinite(rate) && rate >= 0 && rate <= 100 ? rate : 3;
};
