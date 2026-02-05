import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import api from './services/api';
import Navbar from './components/Navbar';
import SplashScreen from './components/SplashScreen';
import Footer from './components/Footer';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import UserDashboard from './pages/UserDashboard';
import AdminDashboard from './pages/AdminDashboard';
import AdminPayments from './pages/AdminPayments';
import AdminUsers from './pages/AdminUsers';
import AdminOrders from './pages/AdminOrders';
import AdminDeliveryGuys from './pages/AdminDeliveryGuys';
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
import Notifications from './pages/Notifications';
import Favorites from './pages/Favorites';
import ShopProfile from './pages/ShopProfile';
import HelpCenter from './pages/HelpCenter';
import VerifiedShops from './pages/VerifiedShops';
import UserStats from './pages/UserStats';
import UserOrders from './pages/UserOrders';
import SellerOrders from './pages/SellerOrders';
import OrderCheckout from './pages/OrderCheckout';
import DraftOrders from './pages/DraftOrders';
import usePreventNewTabOnMobile from './hooks/usePreventNewTabOnMobile';
import ScrollToTop from './components/ScrollToTop';
import ChatBox from './components/ChatBox';
import MobileScrollToTopButton from './components/MobileScrollToTopButton';
import AdminChatTemplates from './pages/AdminChatTemplates';
import AdminProductBoosts from './pages/AdminProductBoosts';
import AdminProducts from './pages/AdminProducts';
import AdminFeedback from './pages/AdminFeedback';
import AdminUserStats from './pages/AdminUserStats';
import AdminPaymentVerifiers from './pages/AdminPaymentVerifiers';
import PaymentVerification from './pages/PaymentVerification';
import AdminReports from './pages/AdminReports';
import AdminAppSettings from './pages/AdminAppSettings';
import CertifiedProducts from './pages/CertifiedProducts';
import Suggestions from './pages/Suggestions';
import AdvancedSearch from './pages/AdvancedSearch';
import OrderMessages from './pages/OrderMessages';
import PushNotificationsManager from './components/PushNotificationsManager';
import AnalyticsTracker from './components/AnalyticsTracker';

function AppContent() {
  const { pathname } = useLocation();
  const [splashConfig, setSplashConfig] = useState(null);
  const [splashDismissed, setSplashDismissed] = useState(false);

  useEffect(() => {
    if (pathname !== '/') return;
    api
      .get('/settings/splash')
      .then((res) => setSplashConfig(res.data || null))
      .catch(() => setSplashConfig(null));
  }, [pathname]);

  const showSplash =
    pathname === '/' &&
    splashConfig?.splashEnabled !== false &&
    splashConfig?.splashImage &&
    !splashDismissed;

  if (showSplash) {
    return (
      <SplashScreen
        splashImage={splashConfig.splashImage}
        splashDurationSeconds={splashConfig.splashDurationSeconds}
        onDismiss={() => setSplashDismissed(true)}
      />
    );
  }

  return (
    <>
      <PushNotificationsManager />
      <AnalyticsTracker />
      <ScrollToTop />
      <Navbar />
      <main
        className="pt-20 sm:pt-24 md:pt-32 pb-24 md:pb-0 main-content"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 5rem)' }}
      >
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/product/:slug" element={<ProductDetails />} />
          <Route path="/product-preview/:slug" element={<ProductPreview />} />
          <Route path="/shop/:slug" element={<ShopProfile />} />
          <Route path="/shops/verified" element={<VerifiedShops />} />
          <Route path="/help" element={<HelpCenter />} />
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
          <Route path="/suggestions" element={<Suggestions />} />
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
            path="/my/stats"
            element={
              <ProtectedRoute>
                <UserStats />
              </ProtectedRoute>
            }
          />
          <Route
            path="/orders"
            element={
              <ProtectedRoute>
                <UserOrders />
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
            path="/orders/:status"
            element={
              <ProtectedRoute>
                <UserOrders />
              </ProtectedRoute>
            }
          />
          <Route
            path="/orders/messages"
            element={
              <ProtectedRoute>
                <OrderMessages />
              </ProtectedRoute>
            }
          />
          <Route
            path="/seller/orders"
            element={
              <ProtectedRoute>
                <SellerOrders />
              </ProtectedRoute>
            }
          />
          <Route
            path="/seller/orders/:status"
            element={
              <ProtectedRoute>
                <SellerOrders />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/chat-templates"
            element={
              <ProtectedRoute roles={['admin']}>
                <AdminChatTemplates />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute roles={['admin', 'manager']}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/payments"
            element={
              <ProtectedRoute roles={['admin', 'manager']}>
                <AdminPayments />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/orders"
            element={
              <ProtectedRoute roles={['admin', 'manager']}>
                <AdminOrders />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/delivery-guys"
            element={
              <ProtectedRoute roles={['admin', 'manager']}>
                <AdminDeliveryGuys />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <ProtectedRoute role="admin">
                <AdminUsers />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/users/:id/stats"
            element={
              <ProtectedRoute roles={['admin', 'manager']}>
                <AdminUserStats />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/product-boosts"
            element={
              <ProtectedRoute allowAccess={(user) => user.role === 'admin' || user.canManageBoosts === true}>
                <AdminProductBoosts />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/products"
            element={
              <ProtectedRoute roles={['admin', 'manager']}>
                <AdminProducts />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/feedback"
            element={
              <ProtectedRoute allowAccess={(user) => user.role === 'admin' || user.canReadFeedback === true}>
                <AdminFeedback />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/payment-verifiers"
            element={
              <ProtectedRoute roles={['admin']}>
                <AdminPaymentVerifiers />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/payment-verification"
            element={
              <ProtectedRoute allowAccess={(user) => user.role === 'admin' || user.canVerifyPayments === true}>
                <PaymentVerification />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/reports"
            element={
              <ProtectedRoute roles={['admin']}>
                <AdminReports />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/settings"
            element={
              <ProtectedRoute roles={['admin']}>
                <AdminAppSettings />
              </ProtectedRoute>
            }
          />
          <Route path="/certified-products" element={<CertifiedProducts />} />
        </Routes>
      </main>
      <Footer />
      <ChatBox />
      <MobileScrollToTopButton />
    </>
  );
}

export default function App() {
  usePreventNewTabOnMobile();
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
