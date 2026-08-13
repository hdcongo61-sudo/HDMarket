import { formatPriceWithStoredSettings } from './priceFormatter';

export const quotationStatus = {
  PENDING: { label: 'En attente', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  COUNTERED: { label: 'Contre-offre', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  ACCEPTED: { label: 'Accepté', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  REJECTED: { label: 'Refusé', className: 'bg-red-50 text-red-700 border-red-200' },
  EXPIRED: { label: 'Expiré', className: 'bg-stone-100 text-stone-600 border-stone-200' },
  ORDER_CREATED: { label: 'Commande créée', className: 'bg-violet-50 text-violet-700 border-violet-200' }
};

export const getQuotationStatus = (status) => quotationStatus[status] || quotationStatus.PENDING;
export const quotationMoney = (value) => formatPriceWithStoredSettings(Number(value || 0));
export const quotationSavings = (quotation) => Math.max(0, Number(quotation?.originalSubtotal || 0) - Number(quotation?.quotedSubtotal || 0));
export const quotationShopName = (quotation) => quotation?.seller?.shopName || quotation?.seller?.name || 'Boutique';
export const quotationBuyerName = (quotation) => quotation?.buyer?.name || quotation?.buyer?.email || quotation?.buyer?.phone || 'Acheteur';
export const formatQuotationDate = (value, withTime = false) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('fr-FR', withTime
    ? { dateStyle: 'medium', timeStyle: 'short' }
    : { dateStyle: 'medium' }).format(date);
};

