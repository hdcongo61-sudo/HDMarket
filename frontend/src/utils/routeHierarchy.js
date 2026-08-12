const normalizePath = (value = '/') => {
  const pathname = String(value || '/').split('?')[0].split('#')[0].trim();
  if (!pathname) return '/';
  return pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
};

const AUTH_PATHS = new Set([
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password'
]);

const CHECKOUT_PATHS = new Set([
  '/orders/checkout',
  '/payment/pawapay/return'
]);

const hasContextualMobileActions = (pathname) => (
  /^\/product\/(?![^/]+\/edit$)[^/]+$/.test(pathname) ||
  /^\/product-preview\/[^/]+$/.test(pathname) ||
  /^\/shop\/[^/]+$/.test(pathname) ||
  pathname.startsWith('/buy-for-me') ||
  pathname === '/parcels/new' ||
  pathname.startsWith('/my/annonce/') ||
  /^\/product\/[^/]+\/edit$/.test(pathname)
);

export const getRouteHierarchy = (value = '/') => {
  const pathname = normalizePath(value);
  const isCourierApplication = pathname === '/delivery/apply';
  const isCourier = !isCourierApplication && (pathname.startsWith('/delivery') || pathname.startsWith('/courier'));
  const isAdmin = pathname === '/admin' || pathname.startsWith('/admin/');
  const isSeller = pathname === '/seller' || pathname.startsWith('/seller/');
  const isAuth = AUTH_PATHS.has(pathname);
  const isCheckout = CHECKOUT_PATHS.has(pathname);
  const isVideoFeed = pathname === '/videos' || pathname.startsWith('/videos/');
  const ownsChrome = isCourier || isAdmin || isSeller || isAuth || isCheckout;

  let shell = 'commerce';
  if (isCourier) shell = 'delivery';
  else if (isAdmin) shell = 'admin';
  else if (isSeller) shell = 'seller';
  else if (isAuth) shell = 'auth';
  else if (isCheckout) shell = 'checkout';

  return {
    pathname,
    shell,
    isCourier,
    isAdmin,
    isSeller,
    isAuth,
    isCheckout,
    showGlobalNav: !ownsChrome,
    showGlobalMobileNav: !ownsChrome && !isVideoFeed && !hasContextualMobileActions(pathname),
    showFooter: !ownsChrome && !isVideoFeed,
    showChat: !ownsChrome && !isVideoFeed
  };
};

export default getRouteHierarchy;
