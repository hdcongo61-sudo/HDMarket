import React, { lazy, Suspense, useContext, useEffect, useRef, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import api, { abortPendingRequests } from './services/api';
import Navbar from './components/Navbar';
import SplashScreen from './components/SplashScreen';
import BootSplash from './components/BootSplash';
import AppLoader from './components/AppLoader';
import NetworkStatusBanner from './components/NetworkStatusBanner';
import ProtectedRoute from './components/ProtectedRoute';
import usePreventNewTabOnMobile from './hooks/usePreventNewTabOnMobile';
import ScrollToTop from './components/ScrollToTop';
import AnalyticsTracker from './components/AnalyticsTracker';
import CookieConsent from './components/CookieConsent';
import PendingActionHandler from './components/PendingActionHandler';
import AppButtonFeedback from './components/AppButtonFeedback';
import { useAppSettings } from './context/AppSettingsContext';
import AuthContext from './context/AuthContext';
import { ShopProfileLoadProvider, useShopProfileLoad } from './context/ShopProfileLoadContext';
import { hasAnyPermission } from './utils/permissions';
import { applyAppBranding } from './utils/appIcon';
import { queryClient } from './lib/queryClient';
import useAppBrandLogo from './hooks/useAppBrandLogo';
import pwaInstallService from './services/pwaInstallService';
import { subscribeToSettingsRefresh } from './utils/settingsRefresh';

const Home = lazy(() => import('./pages/Home'));
const Discover = lazy(() => import('./pages/Discover'));
const Explorer = lazy(() => import('./pages/Explorer'));
const FlashSales = lazy(() => import('./pages/FlashSales'));
const Sponsorships = lazy(() => import('./pages/Sponsorships'));
const SellerAnalyticsV2 = lazy(() => import('./pages/SellerAnalyticsV2'));
const SellerPromoCodes = lazy(() => import('./pages/SellerPromoCodes'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const ReferralLanding = lazy(() => import('./pages/ReferralLanding'));
const Referrals = lazy(() => import('./pages/Referrals'));
const RequestDelivery = lazy(() => import('./pages/RequestDelivery'));
const MyParcelRequests = lazy(() => import('./pages/MyParcelRequests'));
const ParcelRequestDetail = lazy(() => import('./pages/ParcelRequestDetail'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const UserDashboard = lazy(() => import('./pages/UserDashboard'));
const MyListingDetail = lazy(() => import('./pages/MyListingDetail'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const AdminPayments = lazy(() => import('./pages/AdminPayments'));
const AdminUsers = lazy(() => import('./pages/AdminUsers'));
const AdminOrders = lazy(() => import('./pages/AdminOrders'));
const AdminDeliveryGuys = lazy(() => import('./pages/AdminDeliveryGuys'));
const AdminDeliveryRequests = lazy(() => import('./pages/AdminDeliveryRequests'));
const AdminParcelRequests = lazy(() => import('./pages/AdminParcelRequests'));
const CourierDashboard = lazy(() => import('./pages/CourierDashboard'));
const ParcelJobs = lazy(() => import('./pages/delivery/ParcelJobs'));
const DeliveryAssignmentDetail = lazy(() => import('./pages/delivery/DeliveryAssignmentDetail'));
const DeliveryHistory = lazy(() => import('./pages/delivery/DeliveryHistory'));
const DeliveryProfile = lazy(() => import('./pages/delivery/DeliveryProfile'));
const DeliveryAppShell = lazy(() => import('./components/delivery/DeliveryAppShell'));
const TopDeals = lazy(() => import('./pages/TopDeals'));
const TopRanking = lazy(() => import('./pages/TopRanking'));
const TopFavorites = lazy(() => import('./pages/TopFavorites'));
const TopSales = lazy(() => import('./pages/TopSales'));
const TopDiscounts = lazy(() => import('./pages/TopDiscounts'));
const TopNewProducts = lazy(() => import('./pages/TopNewProducts'));
const TopUsedProducts = lazy(() => import('./pages/TopUsedProducts'));
const CategoryProducts = lazy(() => import('./pages/CategoryProducts'));
const Products = lazy(() => import('./pages/Products'));
const Plans = lazy(() => import('./pages/Plans'));
const Benefits = lazy(() => import('./pages/Benefits'));
const CityProducts = lazy(() => import('./pages/CityProducts'));
const ProductDetails = lazy(() => import('./pages/ProductDetails'));
const ProductDetailsWrapper = () => {
  const { slug } = useParams();
  return <ProductDetails key={slug} />;
};
const ProductPreview = lazy(() => import('./pages/ProductPreview'));
const EditProduct = lazy(() => import('./pages/EditProduct'));
const Cart = lazy(() => import('./pages/Cart'));
const Profile = lazy(() => import('./pages/Profile'));
const MyComplaints = lazy(() => import('./pages/MyComplaints'));
const MyFeedback = lazy(() => import('./pages/MyFeedback'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Favorites = lazy(() => import('./pages/Favorites'));
const ShopProfile = lazy(() => import('./pages/ShopProfile'));
const HelpCenter = lazy(() => import('./pages/HelpCenter'));
const MobileAppGuide = lazy(() => import('./pages/MobileAppGuide'));
const LegalPage = lazy(() => import('./pages/LegalPage'));
const UserSettings = lazy(() => import('./pages/UserSettings'));
const VerifiedShops = lazy(() => import('./pages/VerifiedShops'));
const FreeDeliveryShops = lazy(() => import('./pages/FreeDeliveryShops'));
const UserStats = lazy(() => import('./pages/UserStats'));
const UserOrders = lazy(() => import('./pages/UserOrders'));
const OrderDetail = lazy(() => import('./pages/OrderDetail'));
const OrderReview = lazy(() => import('./pages/OrderReview'));
const SellerOrders = lazy(() => import('./pages/SellerOrders'));
const SellerOrderDetail = lazy(() => import('./pages/SellerOrderDetail'));
const SellerDisputes = lazy(() => import('./pages/SellerDisputes'));
const SellerBoosts = lazy(() => import('./pages/SellerBoosts'));
const OrderCheckout = lazy(() => import('./pages/OrderCheckout'));
const PawaPayReturn = lazy(() => import('./pages/PawaPayReturn'));
const DraftOrders = lazy(() => import('./pages/DraftOrders'));
const AdminChatTemplates = lazy(() => import('./pages/AdminChatTemplates'));
const AdminProductBoosts = lazy(() => import('./pages/AdminProductBoosts'));
const AdminProducts = lazy(() => import('./pages/AdminProducts'));
const AdminFeedback = lazy(() => import('./pages/AdminFeedback'));
const AdminUserStats = lazy(() => import('./pages/AdminUserStats'));
const AdminPaymentVerifiers = lazy(() => import('./pages/AdminPaymentVerifiers'));
const PaymentVerification = lazy(() => import('./pages/PaymentVerification'));
const AdminReports = lazy(() => import('./pages/AdminReports'));
const AdminAppSettings = lazy(() => import('./pages/AdminAppSettings'));
const AdminSystemSettings = lazy(() => import('./pages/AdminSystemSettings'));
const AdminComplaints = lazy(() => import('./pages/AdminComplaints'));
const AdminPromoCodes = lazy(() => import('./pages/AdminPromoCodes'));
const AdminTaskCenter = lazy(() => import('./pages/AdminTaskCenter'));
const AdminBoostManagement = lazy(() => import('./pages/AdminBoostManagement'));
const SettingsCategoriesPage = lazy(() => import('./pages/SettingsCategoriesPage'));
const AdminLayout = lazy(() => import('./components/AdminLayout'));
const FounderIntelligence = lazy(() => import('./pages/FounderIntelligence'));
const FounderAccountControl = lazy(() => import('./pages/FounderAccountControl'));
const FounderNotificationsIntelligence = lazy(() => import('./pages/FounderNotificationsIntelligence'));
const CertifiedProducts = lazy(() => import('./pages/CertifiedProducts'));
const Suggestions = lazy(() => import('./pages/Suggestions'));
const AdvancedSearch = lazy(() => import('./pages/AdvancedSearch'));
const OrderMessages = lazy(() => import('./pages/OrderMessages'));
const ShopConversionRequest = lazy(() => import('./pages/ShopConversionRequest'));
const ShopAssistant = lazy(() => import('./pages/ShopAssistant'));
const Footer = lazy(() => import('./components/Footer'));
const ChatBox = lazy(() => import('./components/ChatBox'));
const PushNotificationsManager = lazy(() => import('./components/PushNotificationsManager'));

const LAST_ADMIN_ROUTE_KEY = 'hdmarket:last-admin-route';
const LAST_COURIER_ROUTE_KEY = 'hdmarket:last-courier-route';
const LAST_ORDERS_ROUTE_KEY = 'hdmarket:last-orders-route';
const LAST_SELLER_ORDERS_ROUTE_KEY = 'hdmarket:last-seller-orders-route';
const COURIER_VIEW_MODE_KEY = 'hdmarket:courier-view-mode';

const getCourierViewMode = () => {
  if (typeof window === 'undefined') return 'courier';
  return String(window.localStorage.getItem(COURIER_VIEW_MODE_KEY) || 'courier').toLowerCase();
};

const normalizeStoredAdminRoute = (value = '') => {
  const normalized = String(value || '').trim();
  if (!normalized.startsWith('/admin')) return '';
  if (normalized === '/admin' || normalized.startsWith('/admin?')) return '';
  return normalized;
};

const normalizeStoredCourierRoute = (value = '') => {
  const normalized = String(value || '').trim();
  const isDeliveryRoute = normalized.startsWith('/delivery');
  const isCourierRoute = normalized.startsWith('/courier');
  if (!isDeliveryRoute && !isCourierRoute) return '';
  if (
    normalized === '/delivery' ||
    normalized === '/courier' ||
    normalized.startsWith('/delivery?') ||
    normalized.startsWith('/courier?')
  ) {
    return '';
  }
  return normalized;
};

const normalizeStoredOrdersRoute = (value = '') => {
  const normalized = String(value || '').trim();
  if (!normalized.startsWith('/orders')) return '';
  const pathOnly = normalized.split('?')[0].split('#')[0];
  if (pathOnly === '/orders') return normalized;
  if (
    pathOnly.startsWith('/orders/detail/') ||
    pathOnly.startsWith('/orders/messages') ||
    pathOnly.startsWith('/orders/checkout') ||
    pathOnly.startsWith('/orders/draft')
  ) {
    return '';
  }
  return /^\/orders\/[^/]+$/i.test(pathOnly) ? normalized : '';
};

const normalizeStoredSellerOrdersRoute = (value = '') => {
  const normalized = String(value || '').trim();
  if (!(normalized.startsWith('/seller/orders') || normalized.startsWith('/seller/order'))) return '';
  const pathOnly = normalized.split('?')[0].split('#')[0];
  if (pathOnly === '/seller/orders') return normalized;
  if (pathOnly.startsWith('/seller/orders/detail/') || pathOnly.startsWith('/seller/order/detail/')) {
    return '';
  }
  return /^\/seller\/orders\/[^/]+$/i.test(pathOnly) ? normalized : '';
};

const getRouteModule = (path = '') => {
  const normalized = String(path || '').trim().toLowerCase();
  if (!normalized) return '';
  if (normalized.startsWith('/admin')) return 'admin';
  if (normalized.startsWith('/delivery') || normalized.startsWith('/courier')) return 'courier';
  if (normalized.startsWith('/orders') || normalized.startsWith('/order')) return 'orders';
  if (normalized.startsWith('/seller/orders') || normalized.startsWith('/seller/order')) return 'seller-orders';
  if (
    normalized === '/my' ||
    normalized.startsWith('/profile') ||
    normalized.startsWith('/settings/preferences') ||
    normalized.startsWith('/notifications') ||
    normalized.startsWith('/favorites') ||
    normalized.startsWith('/stats') ||
    normalized.startsWith('/reclamations') ||
    normalized.startsWith('/avis-amelioration')
  ) {
    return 'account';
  }
  if (
    normalized === '/' ||
    normalized === '/discover' ||
    normalized === '/explore' ||
    normalized === '/products' ||
    normalized.startsWith('/product/') ||
    normalized.startsWith('/product-preview/') ||
    normalized.startsWith('/categories/') ||
    normalized.startsWith('/shop/') ||
    normalized === '/search' ||
    normalized === '/cities' ||
    normalized.startsWith('/top-') ||
    normalized === '/flash-sales' ||
    normalized === '/suggestions' ||
    normalized === '/certified-products' ||
    normalized === '/shops/verified' ||
    normalized === '/shops/free-delivery'
  ) {
    return 'commerce';
  }
  return '';
};

const getPageTransitionKey = (path = '') => {
  const moduleKey = getRouteModule(path);
  return moduleKey ? `module:${moduleKey}` : path;
};

function LegacyOrderRouteResolver() {
  const { legacyValue = '' } = useParams();
  const value = String(legacyValue).trim();
  if (!value) return <Navigate to="/orders" replace />;

  // Support old deep links: /order/:orderId
  if (/^[a-f\d]{24}$/i.test(value)) {
    return <Navigate to={`/orders/detail/${value}`} replace />;
  }

  // Keep legacy status links working: /order/:status -> /orders/:status
  return <Navigate to={`/orders/${value.toLowerCase()}`} replace />;
}

function LegacyOrderReviewRedirect() {
  const { orderId = '' } = useParams();
  const targetId = String(orderId || '').trim();
  if (!targetId) return <Navigate to="/orders" replace />;
  return <Navigate to={`/orders/${encodeURIComponent(targetId)}/review`} replace />;
}

function OrdersStatusRouteResolver() {
  const { status = '' } = useParams();
  const value = String(status || '').trim();
  if (/^[a-f\d]{24}$/i.test(value)) {
    return <Navigate to={`/orders/detail/${value}`} replace />;
  }
  return <UserOrders />;
}

function AdminIndexRedirect() {
  const stored =
    typeof window !== 'undefined'
      ? normalizeStoredAdminRoute(window.localStorage.getItem(LAST_ADMIN_ROUTE_KEY))
      : '';
  if (stored) {
    return <Navigate to={stored} replace />;
  }
  return <AdminDashboard />;
}

function CourierEntryRedirect() {
  const stored =
    typeof window !== 'undefined'
      ? normalizeStoredCourierRoute(window.localStorage.getItem(LAST_COURIER_ROUTE_KEY))
      : '';

  if (stored) {
    return <Navigate to={stored} replace />;
  }

  return <Navigate to="/delivery/dashboard" replace />;
}

function OrdersEntryRedirect() {
  const stored =
    typeof window !== 'undefined'
      ? normalizeStoredOrdersRoute(window.localStorage.getItem(LAST_ORDERS_ROUTE_KEY))
      : '';
  if (stored && stored !== '/orders') {
    return <Navigate to={stored} replace />;
  }
  return <UserOrders />;
}

function SellerOrdersEntryRedirect() {
  const stored =
    typeof window !== 'undefined'
      ? normalizeStoredSellerOrdersRoute(window.localStorage.getItem(LAST_SELLER_ORDERS_ROUTE_KEY))
      : '';
  if (stored && stored !== '/seller/orders') {
    return <Navigate to={stored} replace />;
  }
  return <SellerOrders />;
}

const isShopProfileRoute = (path) => /^\/shop\/[^/]+$/.test(path || '');

// Animated launch splash (BootSplash) preferences, configured independently per
// platform and cached locally so a disabled splash never flashes on the next
// launch before the config fetch resolves.
const BOOT_SPLASH_PREF_KEY = 'hd_boot_splash_pref';
// Matches useIsMobile's default breakpoint so the synchronous (pre-render)
// platform choice is consistent with the rest of the app.
const isMobileViewport = () => {
  try {
    return window.matchMedia('(max-width: 767px)').matches;
  } catch {
    return false;
  }
};
const readBootSplashPref = () => {
  const fallback = { enabled: true, durationMs: 2400 };
  try {
    const raw = JSON.parse(window.localStorage.getItem(BOOT_SPLASH_PREF_KEY) || '{}');
    const platform = isMobileViewport() ? raw.mobile : raw.desktop;
    if (!platform) return fallback;
    const durationMs = Number(platform.durationMs);
    return {
      enabled: platform.enabled !== false,
      durationMs: durationMs > 0 ? durationMs : 2400
    };
  } catch {
    return fallback;
  }
};

function AppContent() {
  const location = useLocation();
  const { pathname } = location;
  const { user } = useContext(AuthContext);
  const { isFeatureEnabled, getRuntimeValue, assistantChatEnabled } = useAppSettings();
  const shopLoad = useShopProfileLoad();
  const { logoSrc: appBrandLogo } = useAppBrandLogo();
  const [splashConfig, setSplashConfig] = useState(null);
  const [splashDismissed, setSplashDismissed] = useState(false);
  const bootSplashPrefRef = useRef(readBootSplashPref());
  const [showBootSplash, setShowBootSplash] = useState(bootSplashPrefRef.current.enabled);
  const [bootLoading, setBootLoading] = useState(true);
  const [routeLoading, setRouteLoading] = useState(false);
  const [loaderTimedOut, setLoaderTimedOut] = useState(false);
  const firstRouteRef = useRef(true);
  const previousPathRef = useRef(pathname);
  const isShopRoute = isShopProfileRoute(pathname);
  const showShopProfileLoader = isShopRoute && shopLoad?.isShopProfileLoading;

  useEffect(() => {
    // Fetched once on mount (not just on '/') so the launch-splash toggle applies
    // on every route. The promo splash still only shows on '/' (see showSplash).
    const loadSplashSettings = () => api
      .get('/settings/splash', { skipCache: true, headers: { 'x-skip-cache': '1' } })
      .then((res) => {
        const data = res.data || null;
        setSplashConfig(data);
        if (data) {
          const toMs = (s) => Math.round((Number(s) || 2.4) * 1000);
          const pref = {
            desktop: {
              enabled: data.bootSplashDesktopEnabled !== false,
              durationMs: toMs(data.bootSplashDesktopDurationSeconds)
            },
            mobile: {
              enabled: data.bootSplashMobileEnabled !== false,
              durationMs: toMs(data.bootSplashMobileDurationSeconds)
            }
          };
          try {
            window.localStorage.setItem(BOOT_SPLASH_PREF_KEY, JSON.stringify(pref));
          } catch {
            /* ignore quota/availability errors */
          }
          const current = isMobileViewport() ? pref.mobile : pref.desktop;
          if (!current.enabled) setShowBootSplash(false);
        }
      })
      .catch(() => setSplashConfig(null));
    loadSplashSettings();
    return subscribeToSettingsRefresh(loadSplashSettings);
  }, []);

  useEffect(() => {
    let active = true;
    const branding = { icon: '', favicon: '' };
    const onLogoUpdate = (event) => {
      const { appIcon, appFavicon } = event?.detail || {};
      if (!appIcon && !appFavicon) return;
      if (appIcon) branding.icon = appIcon;
      if (appFavicon) branding.favicon = appFavicon;
      applyAppBranding(branding);
    };
    window.addEventListener('hdmarket:app-logo-updated', onLogoUpdate);
    api
      .get('/settings/app-logo')
      .then((res) => {
        if (!active) return;
        branding.icon = res?.data?.appIcon || '';
        branding.favicon = res?.data?.appFavicon || '';
        if (branding.icon || branding.favicon) applyAppBranding(branding);
      })
      .catch(() => {});
    return () => {
      active = false;
      window.removeEventListener('hdmarket:app-logo-updated', onLogoUpdate);
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setBootLoading(false), 120);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (firstRouteRef.current) {
      firstRouteRef.current = false;
      previousPathRef.current = pathname;
      return;
    }
    const previousPath = String(previousPathRef.current || '');
    const previousModule = getRouteModule(previousPath);
    const currentModule = getRouteModule(pathname);
    const isIntraModuleNavigation = Boolean(previousModule) && previousModule === currentModule;
    previousPathRef.current = pathname;
    if (isIntraModuleNavigation) {
      setRouteLoading(false);
      return;
    }
    setRouteLoading(true);
    const timer = setTimeout(() => setRouteLoading(false), 800);
    return () => clearTimeout(timer);
  }, [pathname]);

  const showSplash =
    pathname === '/' &&
    splashConfig?.splashEnabled !== false &&
    splashConfig?.splashImage &&
    !splashDismissed;

  // The admin promo splash takes precedence over the branded launch splash, so
  // the two never stack into a double splash.
  useEffect(() => {
    if (showSplash) setShowBootSplash(false);
  }, [showSplash]);

  const showLoader = !showSplash && (bootLoading || routeLoading || showShopProfileLoader);
  const chatEnabled = isFeatureEnabled('enable_chat', { defaultValue: true });
  const boostEnabled = isFeatureEnabled('enable_boost', { defaultValue: true });
  const aiRecommendationsEnabled = isFeatureEnabled('enable_ai_recommendations', {
    defaultValue: true
  });
  const platformDeliveryEnabled =
    ['true', '1', 'yes', 'on'].includes(
      String(getRuntimeValue('enable_platform_delivery', false)).trim().toLowerCase()
    ) &&
    !['false', '0', 'no', 'off'].includes(
      String(getRuntimeValue('enable_delivery_requests', true)).trim().toLowerCase()
    );
  const courierModeEnabled =
    ['true', '1', 'yes', 'on'].includes(
      String(getRuntimeValue('enable_delivery_agents', true)).trim().toLowerCase()
    ) && platformDeliveryEnabled;
  const normalizedUserRole = String(user?.role || '').toLowerCase();
  const isBackofficeRole = ['admin', 'founder', 'manager'].includes(normalizedUserRole);
  const courierAccessAllowed =
    !isBackofficeRole &&
    (normalizedUserRole === 'delivery_agent' ||
    hasAnyPermission(user, [
      'courier_view_assignments',
      'courier_accept_assignment',
      'courier_update_status',
      'courier_upload_proof'
    ]));
  const isCourierRoute = pathname.startsWith('/courier') || pathname.startsWith('/delivery');
  const pageTransitionKey = getPageTransitionKey(pathname);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!pathname.startsWith('/admin')) return;
    const route = normalizeStoredAdminRoute(`${pathname}${location.search || ''}${location.hash || ''}`);
    if (!route) return;
    window.localStorage.setItem(LAST_ADMIN_ROUTE_KEY, route);
  }, [pathname, location.search, location.hash]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!(pathname.startsWith('/delivery') || pathname.startsWith('/courier'))) return;
    const route = normalizeStoredCourierRoute(`${pathname}${location.search || ''}${location.hash || ''}`);
    if (!route) return;
    window.localStorage.setItem(LAST_COURIER_ROUTE_KEY, route);
  }, [pathname, location.search, location.hash]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!pathname.startsWith('/orders')) return;
    const route = normalizeStoredOrdersRoute(`${pathname}${location.search || ''}${location.hash || ''}`);
    if (!route) return;
    window.localStorage.setItem(LAST_ORDERS_ROUTE_KEY, route);
  }, [pathname, location.search, location.hash]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!(pathname.startsWith('/seller/orders') || pathname.startsWith('/seller/order'))) return;
    const route = normalizeStoredSellerOrdersRoute(
      `${pathname}${location.search || ''}${location.hash || ''}`
    );
    if (!route) return;
    window.localStorage.setItem(LAST_SELLER_ORDERS_ROUTE_KEY, route);
  }, [pathname, location.search, location.hash]);

  const previousPathnameRef = useRef(pathname);
  useEffect(() => {
    if (previousPathnameRef.current !== pathname) {
      abortPendingRequests('REQUEST_ABORT_NAVIGATION');
      previousPathnameRef.current = pathname;
    }
  }, [pathname]);

  useEffect(
    () => () => {
      abortPendingRequests('REQUEST_ABORT_UNMOUNT');
    },
    []
  );

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleReconnect = () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const scope = JSON.stringify(query?.queryKey || []).toLowerCase();
          return (
            scope.includes('product') ||
            scope.includes('home') ||
            scope.includes('shop') ||
            scope.includes('category') ||
            scope.includes('order') ||
            scope.includes('delivery') ||
            scope.includes('notification') ||
            scope.includes('admin') ||
            scope.includes('task')
          );
        }
      });
      window.dispatchEvent(new CustomEvent('hdmarket:network-recovered'));
    };
    window.addEventListener('online', handleReconnect);
    return () => {
      window.removeEventListener('online', handleReconnect);
    };
  }, []);

  useEffect(() => {
    if (!isShopRoute && shopLoad?.setShopLogo) {
      shopLoad.setShopLogo('');
      shopLoad.setShopName('');
    }
  }, [pathname, isShopRoute, shopLoad]);

  useEffect(() => {
    if (!showLoader) {
      setLoaderTimedOut(false);
      return undefined;
    }
    const timer = setTimeout(() => setLoaderTimedOut(true), 8000);
    return () => clearTimeout(timer);
  }, [showLoader]);

  if (showSplash) {
    return (
      <SplashScreen
        splashImage={splashConfig.splashImage}
        splashDurationSeconds={splashConfig.splashDurationSeconds}
        onDismiss={() => setSplashDismissed(true)}
      />
    );
  }

  // Only redirect to courier dashboard when user has courier access but is on a normal route
  // and has not explicitly chosen "Compte normal" (view as normal account).
  if (courierModeEnabled && courierAccessAllowed && !isCourierRoute) {
    if (getCourierViewMode() === 'normal') {
      // User chose to view as normal account; allow staying on /my, /profile, etc.
    } else {
      const storedRoute =
        typeof window !== 'undefined'
          ? normalizeStoredCourierRoute(window.localStorage.getItem(LAST_COURIER_ROUTE_KEY))
          : '';
      return <Navigate to={storedRoute || '/delivery/dashboard'} replace />;
    }
  }

  return (
    <>
      {showBootSplash ? (
        <BootSplash
          logoSrc={appBrandLogo}
          minDuration={bootSplashPrefRef.current.durationMs}
          onDone={() => setShowBootSplash(false)}
        />
      ) : (
        <AppLoader
          visible={showLoader}
          logoSrc={showShopProfileLoader ? shopLoad?.shopLogo : appBrandLogo}
          label={showShopProfileLoader && shopLoad?.shopName ? shopLoad.shopName : 'HDMarket'}
          timedOut={loaderTimedOut}
          onRetry={() => {
            setLoaderTimedOut(false);
            if (typeof window !== 'undefined') window.location.reload();
          }}
        />
      )}
      <PendingActionHandler />
      <Suspense fallback={null}>
        <PushNotificationsManager />
      </Suspense>
      <AnalyticsTracker />
      <CookieConsent />
      <ScrollToTop />
      {!isCourierRoute ? <Navbar /> : null}
      <NetworkStatusBanner />
      <main
        className={isCourierRoute
          ? 'app-main-shell min-h-[100dvh] p-0 main-content no-ios-callout'
          : 'app-main-shell pt-[calc(env(safe-area-inset-top,0px)+4rem)] pb-24 md:pb-0 lg:pt-[calc(env(safe-area-inset-top,0px)+7rem)] main-content mobile-nav-safe no-ios-callout'}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={pageTransitionKey}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
        <Suspense
          fallback={
            <div className="mx-auto max-w-7xl px-4 py-6">
              <div className="h-28 animate-pulse rounded-2xl bg-neutral-100 dark:bg-neutral-900" />
            </div>
          }
        >
        <Routes location={location}>
          <Route path="/" element={<Home />} />
          <Route path="/discover" element={<Discover />} />
          <Route path="/avantages" element={<Benefits />} />
          <Route path="/benefits" element={<Benefits />} />
          <Route path="/explore" element={<Explorer />} />
          <Route path="/flash-sales" element={<FlashSales />} />
          <Route
            path="/payment/pawapay/return"
            element={
              <ProtectedRoute>
                <PawaPayReturn />
              </ProtectedRoute>
            }
          />
          <Route path="/seller/analytics" element={<SellerAnalyticsV2 />} />
          <Route path="/seller/promo-codes" element={<SellerPromoCodes />} />
          <Route path="/seller/assistant" element={<ShopAssistant />} />
          <Route path="/seller/assistant/workspace" element={<ShopAssistant />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/r/:code" element={<ReferralLanding />} />
          <Route path="/referrals" element={<Referrals />} />
          <Route path="/parcels/new" element={<RequestDelivery />} />
          <Route path="/parcels/:id" element={<ParcelRequestDetail />} />
          <Route path="/parcels" element={<MyParcelRequests />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ForgotPassword />} />
          <Route path="/user-stats" element={<Navigate to="/stats" replace />} />
          <Route path="/product" element={<Navigate to="/products" replace />} />
          <Route path="/shop" element={<Navigate to="/shops/verified" replace />} />
          <Route path="/product/:slug" element={<ProductDetailsWrapper />} />
          <Route path="/product-preview/:slug" element={<ProductPreview />} />
          <Route path="/shop/:slug" element={<ShopProfile />} />
          <Route path="/shops/verified" element={<VerifiedShops />} />
          <Route path="/shops/free-delivery" element={<FreeDeliveryShops />} />
          <Route path="/help" element={<HelpCenter />} />
          <Route path="/installer-application" element={<MobileAppGuide />} />
          <Route path="/conditions-utilisation" element={<LegalPage type="conditions-utilisation" />} />
          <Route path="/conditions-vente" element={<LegalPage type="conditions-vente" />} />
          <Route path="/confidentialite" element={<LegalPage type="confidentialite" />} />
          <Route path="/mentions-legales" element={<LegalPage type="mentions-legales" />} />
          <Route path="/retours-remboursements" element={<LegalPage type="retours-remboursements" />} />
          <Route path="/cookies" element={<LegalPage type="cookies" />} />
          <Route
            path="/courier/dashboard"
            element={
              <ProtectedRoute>
                <CourierDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/courier/assignment/:id"
            element={
              <ProtectedRoute>
                <DeliveryAssignmentDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/courier/history"
            element={
              <ProtectedRoute>
                <DeliveryHistory />
              </ProtectedRoute>
            }
          />
          <Route
            path="/courier/profile"
            element={
              <ProtectedRoute>
                <DeliveryProfile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/courier"
            element={
              <ProtectedRoute>
                <CourierEntryRedirect />
              </ProtectedRoute>
            }
          />
          <Route
            path="/delivery"
            element={
              <ProtectedRoute
                permissions={[
                  'courier_view_assignments',
                  'courier_accept_assignment',
                  'courier_update_status',
                  'courier_upload_proof'
                ]}
              >
                <DeliveryAppShell />
              </ProtectedRoute>
            }
          >
            <Route index element={<CourierEntryRedirect />} />
            <Route path="dashboard" element={<CourierDashboard />} />
            <Route path="assignment/:id" element={<DeliveryAssignmentDetail />} />
            <Route path="parcels" element={<ParcelJobs />} />
            <Route path="history" element={<DeliveryHistory />} />
            <Route path="profile" element={<DeliveryProfile />} />
          </Route>
          <Route
            path="/settings/categories"
            element={
              <ProtectedRoute roles={['admin', 'founder']}>
                <SettingsCategoriesPage />
              </ProtectedRoute>
            }
          />
          <Route path="/top-deals" element={<TopDeals />} />
          <Route path="/top-ranking" element={<TopRanking />} />
          <Route path="/top-favorites" element={<TopFavorites />} />
          <Route path="/top-discounts" element={<TopDiscounts />} />
          <Route path="/top-new" element={<TopNewProducts />} />
          <Route path="/top-used" element={<TopUsedProducts />} />
          <Route path="/top-sales" element={<TopSales />} />
          <Route path="/products" element={<Products />} />
          <Route path="/plans" element={<Plans />} />
          <Route path="/search" element={<AdvancedSearch />} />
          <Route path="/cities" element={<CityProducts />} />
          <Route path="/categories/:categoryId" element={<CategoryProducts />} />
          <Route
            path="/suggestions"
            element={
              aiRecommendationsEnabled ? <Suggestions /> : <Navigate to="/" replace />
            }
          />
          <Route
            path="/favorites"
            element={
              <ProtectedRoute>
                <Favorites />
              </ProtectedRoute>
            }
          />
            <Route
              path="/product/:slug/edit"
              element={
              <ProtectedRoute>
                <EditProduct />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings/preferences"
            element={
              <ProtectedRoute>
                <UserSettings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reclamations"
            element={
              <ProtectedRoute>
                <MyComplaints />
              </ProtectedRoute>
            }
          />
          <Route
            path="/avis-amelioration"
            element={
              <ProtectedRoute>
                <MyFeedback />
              </ProtectedRoute>
            }
          />
          <Route
            path="/notifications"
            element={
              <ProtectedRoute>
                <Notifications />
              </ProtectedRoute>
            }
          />
          <Route
            path="/cart"
            element={
              <ProtectedRoute>
                <Cart />
              </ProtectedRoute>
            }
          />
          <Route
            path="/my"
            element={
              <ProtectedRoute>
                <UserDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/my/annonce/:listingId"
            element={
              <ProtectedRoute>
                <MyListingDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/stats"
            element={
              <ProtectedRoute>
                <UserStats />
              </ProtectedRoute>
            }
          />
          <Route
            path="/stats/*"
            element={
              <ProtectedRoute>
                <UserStats />
              </ProtectedRoute>
            }
          />
          <Route
            path="/my/stats"
            element={
              <ProtectedRoute>
                <Navigate to="/stats" replace />
              </ProtectedRoute>
            }
          />
          <Route
            path="/seller/analytics"
            element={
              <ProtectedRoute>
                <UserStats />
              </ProtectedRoute>
            }
          />
          <Route
            path="/shop-conversion-request"
            element={
              <ProtectedRoute>
                <ShopConversionRequest />
              </ProtectedRoute>
            }
          />
          <Route
            path="/orders/checkout"
            element={
              <ProtectedRoute>
                <OrderCheckout />
              </ProtectedRoute>
            }
          />
          <Route
            path="/orders/draft"
            element={
              <ProtectedRoute>
                <DraftOrders />
              </ProtectedRoute>
            }
          />
          <Route
            path="/orders/:orderId/review"
            element={
              <ProtectedRoute>
                <OrderReview />
              </ProtectedRoute>
            }
          />
          <Route
            path="/orders/detail/:orderId"
            element={
              <ProtectedRoute>
                <OrderDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/order/:orderId/review"
            element={
              <ProtectedRoute>
                <LegacyOrderReviewRedirect />
              </ProtectedRoute>
            }
          />
          <Route
            path="/order/detail/:orderId"
            element={
              <ProtectedRoute>
                <OrderDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/orders/messages"
            element={
              <ProtectedRoute>
                {chatEnabled ? <OrderMessages /> : <Navigate to="/orders" replace />}
              </ProtectedRoute>
            }
          />
          <Route
            path="/orders"
            element={
              <ProtectedRoute>
                <OrdersEntryRedirect />
              </ProtectedRoute>
            }
          />
          <Route
            path="/sponsorships"
            element={
              <ProtectedRoute>
                <Sponsorships />
              </ProtectedRoute>
            }
          />
          <Route
            path="/orders/:status"
            element={
              <ProtectedRoute>
                <OrdersStatusRouteResolver />
              </ProtectedRoute>
            }
          />
          <Route
            path="/order"
            element={
              <ProtectedRoute>
                <OrdersEntryRedirect />
              </ProtectedRoute>
            }
          />
          <Route path="/order/:legacyValue" element={<LegacyOrderRouteResolver />} />
          <Route
            path="/seller/dashboard"
            element={
              <ProtectedRoute>
                <Navigate to="/my" replace />
              </ProtectedRoute>
            }
          />
          <Route
            path="/seller/products"
            element={
              <ProtectedRoute>
                <ShopAssistant />
              </ProtectedRoute>
            }
          />
          <Route
            path="/seller/orders/detail/:orderId"
            element={
              <ProtectedRoute>
                <SellerOrderDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/seller/order/detail/:orderId"
            element={
              <ProtectedRoute>
                <SellerOrderDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/seller/orders"
            element={
              <ProtectedRoute>
                <SellerOrdersEntryRedirect />
              </ProtectedRoute>
            }
          />
          <Route
            path="/seller/orders/:status?"
            element={
              <ProtectedRoute>
                <SellerOrders />
              </ProtectedRoute>
            }
          />
          <Route
            path="/seller/order"
            element={
              <ProtectedRoute>
                <SellerOrdersEntryRedirect />
              </ProtectedRoute>
            }
          />
          <Route
            path="/seller/order/:status?"
            element={
              <ProtectedRoute>
                <SellerOrders />
              </ProtectedRoute>
            }
          />
          <Route
            path="/seller/disputes"
            element={
              <ProtectedRoute>
                <SellerDisputes />
              </ProtectedRoute>
            }
          />
          <Route
            path="/seller/boosts"
            element={
              <ProtectedRoute>
                {boostEnabled ? <SellerBoosts /> : <Navigate to="/my" replace />}
              </ProtectedRoute>
            }
          />
          {/* Admin: layout with sidebar on desktop, nested routes */}
          <Route
            path="/admin"
            element={
                <ProtectedRoute
                  allowAccess={(u) =>
                    u?.role === 'admin' ||
                    u?.role === 'founder' ||
                    u?.role === 'manager' ||
                    hasAnyPermission(u, [
                      'view_admin_dashboard',
                      'manage_users',
                      'manage_orders',
                      'manage_sellers',
                      'manage_settings',
                      'manage_delivery'
                    ]) ||
                    u?.canManageComplaints === true ||
                    u?.canManageDelivery === true ||
                    u?.canManageProducts === true ||
                  u?.canManageBoosts === true ||
                  u?.canManageChatTemplates === true ||
                  u?.canReadFeedback === true ||
                  u?.canVerifyPayments === true
                }
              >
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<AdminIndexRedirect />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="payments" element={<AdminPayments />} />
            <Route path="orders" element={<AdminOrders />} />
            <Route
              path="delivery-guys"
              element={platformDeliveryEnabled ? <AdminDeliveryGuys /> : <Navigate to="/admin" replace />}
            />
            <Route
              path="delivery-requests"
              element={platformDeliveryEnabled ? <AdminDeliveryRequests /> : <Navigate to="/admin" replace />}
            />
            <Route path="parcel-requests" element={<AdminParcelRequests />} />
            <Route
              path="complaints"
              element={
                <ProtectedRoute allowAccess={(u) => u?.role === 'admin' || u?.role === 'founder' || u?.role === 'manager' || u?.canManageComplaints === true || hasAnyPermission(u, ['manage_complaints'])}>
                  <AdminComplaints />
                </ProtectedRoute>
              }
            />
            <Route path="users/:id/stats" element={<AdminUserStats />} />
            <Route
              path="products"
              element={
                <ProtectedRoute allowAccess={(user) => user?.role === 'admin' || user?.role === 'founder' || user?.role === 'manager' || user?.canManageProducts === true || hasAnyPermission(user, ['manage_products'])}>
                  <AdminProducts />
                </ProtectedRoute>
              }
            />
            <Route
              path="product-boosts"
              element={
                <ProtectedRoute allowAccess={(user) => user?.role === 'admin' || user?.role === 'founder' || user?.canManageBoosts === true || hasAnyPermission(user, ['manage_boosts'])}>
                  {boostEnabled ? <AdminProductBoosts /> : <Navigate to="/admin" replace />}
                </ProtectedRoute>
              }
            />
            <Route
              path="boost-management"
              element={
                <ProtectedRoute allowAccess={(user) => user?.role === 'admin' || user?.role === 'founder' || user?.canManageBoosts === true || hasAnyPermission(user, ['manage_boosts'])}>
                  {boostEnabled ? <AdminBoostManagement /> : <Navigate to="/admin" replace />}
                </ProtectedRoute>
              }
            />
            <Route
              path="feedback"
              element={
                <ProtectedRoute allowAccess={(user) => user?.role === 'admin' || user?.role === 'founder' || user?.canReadFeedback === true || hasAnyPermission(user, ['read_feedback'])}>
                  <AdminFeedback />
                </ProtectedRoute>
              }
            />
            <Route
              path="payment-verification"
              element={
                <ProtectedRoute allowAccess={(user) => user?.role === 'admin' || user?.role === 'founder' || user?.canVerifyPayments === true || hasAnyPermission(user, ['verify_payments'])}>
                  <PaymentVerification />
                </ProtectedRoute>
              }
            />
            <Route
              path="chat-templates"
              element={
                <ProtectedRoute allowAccess={(user) => user?.role === 'admin' || user?.role === 'founder' || user?.canManageChatTemplates === true || hasAnyPermission(user, ['manage_chat_templates'])}>
                  <AdminChatTemplates />
                </ProtectedRoute>
              }
            />
            <Route
              path="payment-verifiers"
              element={
                <ProtectedRoute roles={['admin', 'founder']} permissions={['manage_permissions']}>
                  <AdminPaymentVerifiers />
                </ProtectedRoute>
              }
            />
            <Route
              path="reports"
              element={
                <ProtectedRoute roles={['admin', 'founder']} permissions={['view_logs']}>
                  <AdminReports />
                </ProtectedRoute>
              }
            />
            <Route
              path="settings"
              element={
                <ProtectedRoute roles={['admin', 'founder']} permissions={['manage_settings']}>
                  <AdminAppSettings />
                </ProtectedRoute>
              }
            />
            <Route
              path="system-settings"
              element={
                <ProtectedRoute roles={['admin', 'founder']}>
                  <AdminSystemSettings />
                </ProtectedRoute>
              }
            />
            <Route
              path="settings/categories"
              element={
                <ProtectedRoute roles={['admin', 'founder']} permissions={['manage_settings']}>
                  <SettingsCategoriesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="users"
              element={
                <ProtectedRoute roles={['admin', 'founder']} permissions={['manage_users']}>
                  <AdminUsers />
                </ProtectedRoute>
              }
            />
            <Route
              path="task-center"
              element={
                <ProtectedRoute allowAccess={(u) => u?.role === 'admin' || u?.role === 'founder' || u?.role === 'manager'}>
                  <AdminTaskCenter />
                </ProtectedRoute>
              }
            />
            <Route
              path="founder-intelligence"
              element={
                <ProtectedRoute roles={['founder']}>
                  <FounderIntelligence />
                </ProtectedRoute>
              }
            />
            <Route
              path="founder-notifications-intelligence"
              element={
                <ProtectedRoute roles={['founder']}>
                  <FounderNotificationsIntelligence />
                </ProtectedRoute>
              }
            />
            <Route
              path="founder-account-control"
              element={
                <ProtectedRoute roles={['founder']}>
                  <FounderAccountControl />
                </ProtectedRoute>
              }
            />
            <Route
              path="promo-codes"
              element={
                <ProtectedRoute roles={['admin', 'founder']} permissions={['manage_settings']}>
                  <AdminPromoCodes />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Route>
          <Route path="/certified-products" element={<CertifiedProducts />} />
          <Route
            path="/founder/notifications-intelligence"
            element={
              <ProtectedRoute roles={['founder']}>
                <FounderNotificationsIntelligence />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
          </motion.div>
        </AnimatePresence>
      </main>
      {!isCourierRoute ? (
        <Suspense fallback={null}>
          <Footer />
        </Suspense>
      ) : null}
      {!isCourierRoute && chatEnabled && assistantChatEnabled ? (
        <Suspense fallback={null}>
          <ChatBox />
        </Suspense>
      ) : null}
    </>
  );
}

export default function App() {
  usePreventNewTabOnMobile();
  const { language } = useAppSettings();

  useEffect(() => {
    pwaInstallService.start();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const fallbackLogo = '/favicon.svg';

    const setHeadIcon = (href) => {
      const iconHref = href || fallbackLogo;
      const upsert = (rel) => {
        let link = document.querySelector(`link[rel="${rel}"]`);
        if (!link) {
          link = document.createElement('link');
          link.setAttribute('rel', rel);
          document.head.appendChild(link);
        }
        link.setAttribute('href', iconHref);
      };

      upsert('icon');
      upsert('shortcut icon');
      upsert('apple-touch-icon');
    };

    const applyFromPayload = (payload) => {
      const nextLogo = payload?.appLogoDesktop || payload?.appLogoMobile || '';
      setHeadIcon(nextLogo || fallbackLogo);
    };

    const onAppLogoUpdated = (event) => {
      applyFromPayload(event?.detail || {});
    };

    setHeadIcon(fallbackLogo);
    window.addEventListener('hdmarket:app-logo-updated', onAppLogoUpdated);

    const timer = window.setTimeout(() => {
      api
        .get('/settings/app-logo', { silentGlobalError: true })
        .then((res) => applyFromPayload(res?.data || {}))
        .catch(() => setHeadIcon(fallbackLogo));
    }, 800);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('hdmarket:app-logo-updated', onAppLogoUpdated);
    };
  }, []);

  return (
    <BrowserRouter
      basename={import.meta.env.BASE_URL || '/'}
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true
      }}
    >
      <ShopProfileLoadProvider>
        <AppButtonFeedback />
        <AppContent key={`lang-${language || 'fr'}`} />
      </ShopProfileLoadProvider>
    </BrowserRouter>
  );
}
