export const isShopConversionAccountChange = ({ currentType, nextType }) =>
  String(currentType || 'person') !== 'shop' && String(nextType || 'person') === 'shop';

export const shouldHonorConversionRequestAmount = ({ requestAmount, checkoutAmount }) =>
  Number.isFinite(Number(requestAmount)) &&
  Number.isFinite(Number(checkoutAmount)) &&
  Math.abs(Number(requestAmount) - Number(checkoutAmount)) <= 0.01;

export const buildShopConversionCountryFilter = (countryIds = []) => {
  const ids = (Array.isArray(countryIds) ? countryIds : [countryIds])
    .map((id) => String(id || '').trim())
    .filter(Boolean);
  if (!ids.length) return {};
  return ids.length === 1 ? { countryId: ids[0] } : { countryId: { $in: ids } };
};
