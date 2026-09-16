export const getProductDeliveryFee = (product) => {
  const raw = product?.deliveryFee;
  const fee = raw !== null && raw !== undefined && String(raw).trim() !== '' &&
    Number.isFinite(Number(raw)) && Number(raw) >= 0 ? Number(raw) : null;
  const free = product?.deliveryAvailable !== false && Boolean(
    product?.user?.freeDeliveryEnabled || product?.shopFreeDeliveryEnabled ||
    product?.deliveryFeeEnabled === false || fee === 0
  );
  return { fee, free };
};
