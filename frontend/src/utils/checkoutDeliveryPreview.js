import { getProductDeliveryFee } from './productDeliveryFee';

export const getSellerDeliveryPreview = (group, commune) => {
  const policy = String(commune?.deliveryPolicy || 'DEFAULT_RULE').toUpperCase();
  if (policy === 'FREE') return { fee: 0, source: 'COMMUNE_FREE', pending: false };
  if (policy === 'FIXED_FEE') {
    const raw = commune?.fixedFee;
    const fee = raw != null && String(raw).trim() !== '' && Number.isFinite(Number(raw)) && Number(raw) >= 0
      ? Number(raw) : null;
    return { fee, source: 'COMMUNE_FIXED', pending: fee === null };
  }
  if (group?.items?.[0]?.product?.user?.freeDeliveryEnabled) {
    return { fee: 0, source: 'SHOP_FREE', pending: false };
  }
  let fee = 0;
  let pending = false;
  for (const item of group.items || []) {
    const product = item?.product || {};
    if (product.deliveryAvailable === false || product.deliveryAvailable === 'false') continue;
    const delivery = getProductDeliveryFee({
      ...product,
      deliveryFeeEnabled: product.deliveryFeeEnabled === 'false' ? false : product.deliveryFeeEnabled
    });
    if (delivery.free) continue;
    if (delivery.fee === null) pending = true;
    else fee = Math.max(fee, delivery.fee);
  }
  return { fee: pending ? null : fee, source: 'PRODUCT_FEE', pending };
};
