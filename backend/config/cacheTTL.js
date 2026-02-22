const SECOND = 1000;

export const CACHE_TTL = Object.freeze({
  defaults: {
    public: 120 * SECOND,
    user: 60 * SECOND,
    seller: 120 * SECOND,
    admin: 45 * SECOND,
    role: 60 * SECOND
  },
  domains: {
    products: {
      public: 180 * SECOND,
      user: 90 * SECOND,
      seller: 120 * SECOND,
      admin: 60 * SECOND
    },
    categories: { public: 300 * SECOND },
    settings: { public: 300 * SECOND },
    cities: { public: 300 * SECOND },
    communes: { public: 300 * SECOND },
    currencies: { public: 300 * SECOND },
    cart: { user: 60 * SECOND },
    orders: { user: 45 * SECOND, seller: 45 * SECOND, admin: 30 * SECOND },
    dashboard: { seller: 90 * SECOND, admin: 45 * SECOND },
    analytics: { seller: 120 * SECOND, admin: 60 * SECOND },
    notifications: { user: 45 * SECOND }
  }
});

export const resolveCacheTTL = ({ domain = 'misc', scope = 'public', overrideTtl } = {}) => {
  if (Number.isFinite(Number(overrideTtl)) && Number(overrideTtl) > 0) {
    return Number(overrideTtl);
  }

  const byDomain = CACHE_TTL.domains[domain] || null;
  if (byDomain && Number.isFinite(Number(byDomain[scope])) && Number(byDomain[scope]) > 0) {
    return Number(byDomain[scope]);
  }

  return Number(CACHE_TTL.defaults[scope] || CACHE_TTL.defaults.public);
};

export default CACHE_TTL;
