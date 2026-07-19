const escapeRegex = (value = '') =>
  String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const buildBroadcastRecipientFilter = ({ target = 'all', gender = 'all', city = '' } = {}) => {
  const filter = {
    role: { $in: ['user', 'manager'] },
    isActive: { $ne: false },
    isBlocked: { $ne: true },
    'notificationPreferences.admin_broadcast': { $ne: false }
  };
  if (target === 'person' || target === 'shop') filter.accountType = target;
  if (gender === 'homme' || gender === 'femme') filter.gender = gender;

  const normalizedCity = String(city || '').trim();
  if (normalizedCity) {
    const cityMatcher = new RegExp(`^${escapeRegex(normalizedCity)}$`, 'i');
    filter.$or = [{ city: cityMatcher }, { preferredCity: cityMatcher }];
  }
  return filter;
};

export const buildBroadcastShopLink = (shop = null) => {
  if (!shop?._id) return '';
  const identifier = String(shop.slug || shop._id).trim();
  return identifier ? `/shop/${encodeURIComponent(identifier)}` : '';
};
