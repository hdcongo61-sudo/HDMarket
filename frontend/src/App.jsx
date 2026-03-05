import React, { useContext, useEffect, useRef, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import api, { abortPendingRequests } from './services/api';
import Navbar from './components/Navbar';
import SplashScreen from './components/SplashScreen';
import AppLoader from './components/AppLoader';
import NetworkStatusBanner from './components/NetworkStatusBanner';
import Footer from './components/Footer';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import UserDashboard from './pages/UserDashboard';
import MyListingDetail from './pages/MyListingDetail';
import AdminDashboard from './pages/AdminDashboard';
import AdminPayments from './pages/AdminPayments';
import AdminUsers from './pages/AdminUsers';
import AdminOrders from './pages/AdminOrders';
import AdminDeliveryGuys from './pages/AdminDeliveryGuys';
import AdminDeliveryRequests from './pages/AdminDeliveryRequests';
import CourierDashboard from './pages/CourierDashboard';
import DeliveryAssignmentDetail from './pages/delivery/DeliveryAssignmentDetail';
import DeliveryHistory from './pages/delivery/DeliveryHistory';
import DeliveryProfile from './pages/delivery/DeliveryProfile';
import TopDeals from './pages/TopDeals';
import TopRanking from './pages/TopRanking';
import TopFavorites from './pages/TopFavorites';
import TopSales from './pages/TopSales';
import TopDiscounts from './pages/TopDiscounts';
import TopNewProducts from './pages/TopNewProducts';
import TopUsedProducts from './pages/TopUsedProducts';
import CategoryProducts from './pages/CategoryProducts';
import Products from './pages/Products';
import CityProducts from './pages/CityProducts';
import ProtectedRoute from './components/ProtectedRoute';
import ProductDetails from './pages/ProductDetails';
import ProductPreview from './pages/ProductPreview';
import EditProduct from './pages/EditProduct';
import Cart from './pages/Cart';
import Profile from './pages/Profile';
import MyComplaints from './pages/MyComplaints';
import MyFeedback from './pages/MyFeedback';
import Notifications from './pages/Notifications';
import Favorites from './pages/Favorites';
import ShopProfile from './pages/ShopProfile';
import HelpCenter from './pages/HelpCenter';
import UserSettings from './pages/UserSettings';
import VerifiedShops from './pages/VerifiedShops';
import FreeDeliveryShops from './pages/FreeDeliveryShops';
import UserStats from './pages/UserStats';
import UserOrders from './pages/UserOrders';
import OrderDetail from './pages/OrderDetail';
import SellerOrders from './pages/SellerOrders';
import SellerOrderDetail from './pages/SellerOrderDetail';
import SellerDisputes from './pages/SellerDisputes';
import SellerBoosts from './pages/SellerBoosts';
import OrderCheckout from './pages/OrderCheckout';
import DraftOrders from './pages/DraftOrders';
import usePreventNewTabOnMobile from './hooks/usePreventNewTabOnMobile';
import ScrollToTop from './components/ScrollToTop';
import ChatBox from './components/ChatBox';
import AdminChatTemplates from './pages/AdminChatTemplates';
import AdminProductBoosts from './pages/AdminProductBoosts';
import AdminProducts from './pages/AdminProducts';
import AdminFeedback from './pages/AdminFeedback';
import AdminUserStats from './pages/AdminUserStats';
import AdminPaymentVerifiers from './pages/AdminPaymentVerifiers';
import PaymentVerification from './pages/PaymentVerification';
import AdminReports from './pages/AdminReports';
import AdminAppSettings from './pages/AdminAppSettings';
import AdminSystemSettings from './pages/AdminSystemSettings';
import AdminComplaints from './pages/AdminComplaints';
import AdminPromoCodes from './pages/AdminPromoCodes';
import AdminTaskCenter from './pages/AdminTaskCenter';
import AdminBoostManagement from './pages/AdminBoostManagement';
import SettingsCategoriesPage from './pages/SettingsCategoriesPage';
import AdminLayout from './components/AdminLayout';
import FounderIntelligence from './pages/FounderIntelligence';
import FounderAccountControl from './pages/FounderAccountControl';
import FounderNotificationsIntelligence from './pages/FounderNotificationsIntelligence';
import CertifiedProducts from './pages/CertifiedProducts';
import Suggestions from './pages/Suggestions';
import AdvancedSearch from './pages/AdvancedSearch';
import OrderMessages from './pages/OrderMessages';
import PushNotificationsManager from './components/PushNotificationsManager';
import AnalyticsTracker from './components/AnalyticsTracker';
import ShopConversionRequest from './pages/ShopConversionRequest';
import PendingActionHandler from './components/PendingActionHandler';
import { useAppSettings } from './context/AppSettingsContext';
import AuthContext from './context/AuthContext';
import { ShopProfileLoadProvider, useShopProfileLoad } from './context/ShopProfileLoadContext';
import { hasAnyPermission } from './utils/permissions';
import { queryClient } from './lib/queryClient';

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
  return normalized;
};

const normalizeStoredSellerOrdersRoute = (value = '') => {
  const normalized = String(value || '').trim();
  if (normalized.startsWith('/seller/orders') || normalized.startsWith('/seller/order')) {
    return normalized;
  }
  return '';
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

function AppContent() {
  const location = useLocation();
  const { pathname } = location;
  const { user } = useContext(AuthContext);
  const { isFeatureEnabled, getRuntimeValue } = useAppSettings();
  const shopLoad = useShopProfileLoad();
  const [splashConfig, setSplashConfig] = useState(null);
  const [splashDismissed, setSplashDismissed] = useState(false);
  const [bootLoading, setBootLoading] = useState(true);
  const [routeLoading, setRouteLoading] = useState(false);
  const [loaderTimedOut, setLoaderTimedOut] = useState(false);
  const firstRouteRef = useRef(true);
  const previousPathRef = useRef(pathname);
  const isShopRoute = isShopProfileRoute(pathname);
  const showShopProfileLoader = isShopRoute && shopLoad?.isShopProfileLoading;

  useEffect(() => {
    if (pathname !== '/') return;
    api
      .get('/settings/splash')
      .then((res) => setSplashConfig(res.data || null))
      .catch(() => setSplashConfig(null));
  }, [pathname]);

  useEffect(() => {
    const timer = setTimeout(() => setBootLoading(false), 1400);
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
      <PendingActionHandler />
      <AppLoader
        visible={showLoader}
        logoSrc={showShopProfileLoader ? shopLoad?.shopLogo : undefined}
        label={showShopProfileLoader && shopLoad?.shopName ? shopLoad.shopName : 'HDMarket'}
        timedOut={loaderTimedOut}
        onRetry={() => {
          setLoaderTimedOut(false);
          if (typeof window !== 'undefined') {
            window.location.reload();
          }
        }}
      />
      <PushNotificationsManager />
      <AnalyticsTracker />
      <ScrollToTop />
      {!isCourierRoute ? <Navbar /> : null}
      <NetworkStatusBanner />
      <main
        className="pt-20 sm:pt-24 md:pt-32 pb-24 md:pb-0 main-content mobile-nav-safe no-ios-callout"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 5rem)' }}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={pageTransitionKey}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
        <Routes location={location}>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/product/:slug" element={<ProductDetails />} />
          <Route path="/product-preview/:slug" element={<ProductPreview />} />
          <Route path="/shop/:slug" element={<ShopProfile />} />
          <Route path="/shops/verified" element={<VerifiedShops />} />
          <Route path="/shops/free-delivery" element={<FreeDeliveryShops />} />
          <Route path="/help" element={<HelpCenter />} />
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
            path="/delivery/dashboard"
            element={
              <ProtectedRoute
                permissions={[
                  'courier_view_assignments',
                  'courier_accept_assignment',
                  'courier_update_status',
                  'courier_upload_proof'
                ]}
              >
                <CourierDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/delivery/assignment/:id"
            element={
              <ProtectedRoute
                permissions={[
                  'courier_view_assignments',
                  'courier_accept_assignment',
                  'courier_update_status',
                  'courier_upload_proof'
                ]}
              >
                <DeliveryAssignmentDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/delivery/history"
            element={
              <ProtectedRoute
                permissions={[
                  'courier_view_assignments',
                  'courier_accept_assignment',
                  'courier_update_status',
                  'courier_upload_proof'
                ]}
              >
                <DeliveryHistory />
              </ProtectedRoute>
            }
          />
          <Route
            path="/delivery/profile"
            element={
              <ProtectedRoute
                permissions={[
                  'courier_view_assignments',
                  'courier_accept_assignment',
                  'courier_update_status',
                  'courier_upload_proof'
                ]}
              >
                <DeliveryProfile />
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
                <CourierEntryRedirect />
              </ProtectedRoute>
            }
          />
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
            path="/orders/detail/:orderId"
            element={
              <ProtectedRoute>
                <OrderDetail />
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
            path="/orders/:status"
            element={
              <ProtectedRoute>
                <UserOrders />
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
          </motion.div>
        </AnimatePresence>
      </main>
      {!isCourierRoute ? <Footer /> : null}
      {!isCourierRoute && chatEnabled ? <ChatBox /> : null}
    </>
  );
}

export default function App() {
  usePreventNewTabOnMobile();
  const { language } = useAppSettings();

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

    api
      .get('/settings/app-logo', { skipCache: true })
      .then((res) => applyFromPayload(res?.data || {}))
      .catch(() => setHeadIcon(fallbackLogo));

    return () => {
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
        <AppContent key={`lang-${language || 'fr'}`} />
      </ShopProfileLoadProvider>
    </BrowserRouter>
  );
}
