import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import UserDashboard from './pages/UserDashboard';
import AdminDashboard from './pages/AdminDashboard';
import AdminPayments from './pages/AdminPayments';
import AdminUsers from './pages/AdminUsers';
import AdminOrders from './pages/AdminOrders';
import TopDeals from './pages/TopDeals';
import TopRanking from './pages/TopRanking';
import TopFavorites from './pages/TopFavorites';
import TopDiscounts from './pages/TopDiscounts';
import TopNewProducts from './pages/TopNewProducts';
import TopUsedProducts from './pages/TopUsedProducts';
import CategoryProducts from './pages/CategoryProducts';
import Products from './pages/Products';
import CityProducts from './pages/CityProducts';
import ProtectedRoute from './components/ProtectedRoute';
import ProductDetails from './pages/ProductDetails';
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
import usePreventNewTabOnMobile from './hooks/usePreventNewTabOnMobile';
import ScrollToTop from './components/ScrollToTop';

export default function App() {
  usePreventNewTabOnMobile();
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Navbar />
      <main className="pt-20 sm:pt-24 md:pt-32 pb-24 md:pb-0">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/product/:id" element={<ProductDetails />} />
          <Route path="/shop/:id" element={<ShopProfile />} />
          <Route path="/shops/verified" element={<VerifiedShops />} />
          <Route path="/help" element={<HelpCenter />} />
          <Route path="/top-deals" element={<TopDeals />} />
          <Route path="/top-ranking" element={<TopRanking />} />
          <Route path="/top-favorites" element={<TopFavorites />} />
          <Route path="/top-discounts" element={<TopDiscounts />} />
          <Route path="/top-new" element={<TopNewProducts />} />
          <Route path="/top-used" element={<TopUsedProducts />} />
          <Route path="/products" element={<Products />} />
          <Route path="/cities" element={<CityProducts />} />
          <Route path="/categories/:categoryId" element={<CategoryProducts />} />
          <Route
            path="/favorites"
            element={
              <ProtectedRoute>
                <Favorites />
              </ProtectedRoute>
            }
          />
          <Route
            path="/product/:id/edit"
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
            path="/orders/:status"
            element={
              <ProtectedRoute>
                <UserOrders />
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
            path="/admin/users"
            element={
              <ProtectedRoute role="admin">
                <AdminUsers />
              </ProtectedRoute>
            }
          />
        </Routes>
      </main>
      <Footer />
    </BrowserRouter>
  );
}
