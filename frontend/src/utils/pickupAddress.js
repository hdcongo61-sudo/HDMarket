export const isPickupOrder = (order) =>
  String(order?.deliveryMode || '').toUpperCase() === 'PICKUP';

export const getPickupShopAddress = (order) => {
  const items = Array.isArray(order?.items) ? order.items : [];
  const firstItem = items[0] || {};
  const snapshot = firstItem?.snapshot || {};
  const seller = firstItem?.product?.user || {};

  const shopName = snapshot.shopName || seller.shopName || seller.name || 'Boutique';
  const rawAddressLine = String(snapshot.shopAddress || seller.shopAddress || '').trim();
  const rawCommune = String(snapshot.shopCommune || seller.commune || '').trim();
  const rawCity = String(snapshot.shopCity || seller.city || '').trim();
  const cityLine = [rawCommune, rawCity].filter(Boolean).join(', ');

  const fallbackAddress = String(order?.deliveryAddress || '').trim();
  const fallbackCity = String(order?.deliveryCity || '').trim();

  const addressLine =
    rawAddressLine ||
    (fallbackAddress && fallbackAddress.toLowerCase() !== 'retrait en boutique'
      ? fallbackAddress
      : '');

  return {
    shopName,
    addressLine: addressLine || 'Adresse boutique non renseignée',
    cityLine: cityLine || fallbackCity || '',
    hasExactAddress: Boolean(rawAddressLine)
  };
};
