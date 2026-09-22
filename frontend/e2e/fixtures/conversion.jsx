import React, { useContext, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '../../src/index.css';
import AuthContext from '../../src/context/AuthContext';
import CountryContext from '../../src/context/CountryContext';
import AppSettingsContext from '../../src/context/AppSettingsContext';
import CartContext, { CartProvider } from '../../src/context/CartContext';
import { ToastProvider } from '../../src/context/ToastContext';
import { AlertDialogProvider } from '../../src/context/AlertDialogContext';
import Cart from '../../src/pages/Cart';
import Register from '../../src/pages/Register';
import OrderCheckout from '../../src/pages/OrderCheckout';
import OrderDetail from '../../src/pages/OrderDetail';
import PawaPayButton from '../../src/components/PawaPayButton';
import PawaPayReturn from '../../src/pages/PawaPayReturn';
import ProductDetails from '../../src/pages/ProductDetails';
import Footer from '../../src/components/Footer';
import Benefits from '../../src/pages/Benefits';
import Home from '../../src/pages/Home';
import MyComplaints from '../../src/pages/MyComplaints';
import AdminComplaints from '../../src/pages/AdminComplaints';
import Profile from '../../src/pages/Profile';
import Sponsorships from '../../src/pages/Sponsorships';

const country = { id: 'cccccccccccccccccccccccc', name: 'République du Congo', code: 'CG', phoneCode: '+242', currency: { code: 'XAF' } };
const userProfile = { _id: 'bbbbbbbbbbbbbbbbbbbbbbbb', name: 'Test Buyer', phone: '+242060000001', email: 'test@example.invalid', accountType: 'person', city: 'Brazzaville', commune: 'Poto-Poto', countryId: country.id, role: 'user', selectedCountryId: country.id };
const productId = '111111111111111111111111';
const flags = JSON.parse(localStorage.getItem('test-flags') || '{}');
const settings = {
  language: 'fr', runtime: { auth_google_registration_enabled: false, auth_apple_registration_enabled: false },
  cities: [{ _id: 'dddddddddddddddddddddddd', name: 'Brazzaville' }],
  communes: [{ _id: 'eeeeeeeeeeeeeeeeeeeeeeee', cityId: 'dddddddddddddddddddddddd', name: 'Poto-Poto' }],
  t: (_key, fallback) => fallback,
  getRuntimeValue: (key, fallback) => key in flags ? flags[key] : key === 'registration_sms_verification_required' ? false : fallback,
  isFeatureEnabled: (key, { defaultValue = true } = {}) => flags[key] ?? defaultValue,
  formatPrice: (value) => String(value), app: {}
};
function Screen({ signIn }) {
  const { cart, addItem, loading, error } = useContext(CartContext);
  const location = useLocation();
  const screen = new URLSearchParams(location.search).get('screen');
  return <>
    <div className="flex flex-wrap gap-4 p-4">
      <button onClick={() => addItem(productId, 1, [{ name: 'Taille', value: 'S' }])}>Ajouter S</button>
      <button onClick={() => addItem(productId, 1, [{ name: 'Taille', value: 'L' }])}>Ajouter L</button>
      <button onClick={signIn}>Connexion de test</button>
      <output data-testid="cart-quantity">{cart.totals?.quantity || 0}</output>
      <output data-testid="cart-total">{cart.totals?.subtotal || 0}</output>
      <output data-testid="cart-loading">{String(loading)}</output>
      <output data-testid="cart-error">{error}</output>
    </div>
    {screen === 'product' ? <ProductDetails />
      : screen === 'services' ? <><Benefits /><Footer /></>
      : screen === 'home' ? <Home />
      : screen === 'complaints' ? <MyComplaints />
      : screen === 'admin-complaints' ? <AdminComplaints />
      : screen === 'profile' ? <Profile />
      : screen === 'sponsorships' ? <Sponsorships />
      : screen === 'payment' ? <PawaPayButton amount={12000} actionContext={{ kind: 'ORDER_CHECKOUT' }} returnPath="/e2e/fixtures/conversion.html?screen=checkout" />
      : screen === 'return' ? <PawaPayReturn />
      : screen === 'checkout' ? <OrderCheckout />
      : screen === 'installment-order' ? <OrderDetail />
      : screen === 'register' ? <Register /> : <Cart />}
  </>;
}
function Fixture() {
  const [user, setUser] = useState(() => localStorage.getItem('test-auth') ? userProfile : null);
  return <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <BrowserRouter><AuthContext.Provider value={{ user, loading: false, login: async () => setUser(userProfile), updateUser: setUser, logout: () => setUser(null) }}>
      <CountryContext.Provider value={{ country, countries: [country], changeCountry: async () => {} }}>
        <AppSettingsContext.Provider value={settings}><ToastProvider><AlertDialogProvider><CartProvider>
          <Routes>{['/e2e/fixtures/:orderId', '*'].map(path => <Route key={path} path={path} element={<Screen signIn={() => { localStorage.setItem('test-auth', '1'); setUser(userProfile); }} />} />)}</Routes>
        </CartProvider></AlertDialogProvider></ToastProvider></AppSettingsContext.Provider>
      </CountryContext.Provider>
    </AuthContext.Provider></BrowserRouter>
  </QueryClientProvider>;
}
createRoot(document.getElementById('root')).render(<React.StrictMode><Fixture /></React.StrictMode>);
