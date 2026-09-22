const keyFor = (countryId) => `hdmarket:delivery-preference:${countryId}`;
export const readDeliveryPreference = (countryId) => {
  try { return JSON.parse(sessionStorage.getItem(keyFor(countryId)) || 'null') || {}; } catch { return {}; }
};
export const saveDeliveryPreference = (countryId, { deliveryMode, cityId, communeId }) => {
  try { sessionStorage.setItem(keyFor(countryId), JSON.stringify({ deliveryMode, cityId, communeId })); } catch { /* Optional storage. */ }
};
