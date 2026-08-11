export const PAYOUT_STATUS_GROUPS = {
  attention: ['FAILED', 'NEEDS_ATTENTION'],
  processing: ['CREATED', 'PROCESSING', 'ENQUEUED'],
  completed: ['COMPLETED'],
  cancelled: ['CANCELLED']
};

const getTimestamp = (payout) => {
  const value = payout?.createdAt || payout?.initiatedAt || '';
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const getSearchableText = (payout) => {
  const seller = payout?.seller || {};
  return [
    seller.name,
    seller.shopName,
    seller.email,
    seller.phone,
    payout?.phoneNumber,
    payout?.provider,
    payout?.payoutId,
    payout?.batchKey,
    payout?.providerTransactionId
  ]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase('fr');
};

export function payoutMatchesStatus(payout, statusGroup = 'all') {
  if (statusGroup === 'all') return true;
  const statuses = PAYOUT_STATUS_GROUPS[statusGroup];
  return Array.isArray(statuses) ? statuses.includes(payout?.status) : payout?.status === statusGroup;
}

export function filterSellerPayouts(
  payouts,
  { status = 'all', provider = 'all', search = '', sort = 'newest' } = {}
) {
  const normalizedSearch = String(search || '').trim().toLocaleLowerCase('fr');
  const filtered = (Array.isArray(payouts) ? payouts : []).filter((payout) => {
    if (!payoutMatchesStatus(payout, status)) return false;
    if (provider !== 'all' && payout?.provider !== provider) return false;
    return !normalizedSearch || getSearchableText(payout).includes(normalizedSearch);
  });

  return [...filtered].sort((left, right) => {
    const difference = getTimestamp(right) - getTimestamp(left);
    return sort === 'oldest' ? -difference : difference;
  });
}

export function summarizeSellerPayouts(payouts) {
  const items = Array.isArray(payouts) ? payouts : [];
  return items.reduce(
    (summary, payout) => {
      const amount = Number(payout?.amount || 0);
      summary.total += 1;
      if (PAYOUT_STATUS_GROUPS.attention.includes(payout?.status)) summary.attention += 1;
      if (PAYOUT_STATUS_GROUPS.processing.includes(payout?.status)) summary.processing += 1;
      if (payout?.status === 'COMPLETED') {
        summary.completed += 1;
        summary.completedAmount += Number.isFinite(amount) ? amount : 0;
      }
      return summary;
    },
    { total: 0, attention: 0, processing: 0, completed: 0, completedAmount: 0 }
  );
}

export function countPayoutsByGroup(payouts, group) {
  return (Array.isArray(payouts) ? payouts : []).filter((payout) =>
    payoutMatchesStatus(payout, group)
  ).length;
}
