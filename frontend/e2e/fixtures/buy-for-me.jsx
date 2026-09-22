import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import '../../src/index.css';
import AuthContext from '../../src/context/AuthContext';
import CountryContext from '../../src/context/CountryContext';
import AppSettingsContext from '../../src/context/AppSettingsContext';
import { ToastProvider } from '../../src/context/ToastContext';
import BuyForMe from '../../src/pages/BuyForMe';
import BuyForMeOrderDetail from '../../src/pages/BuyForMeOrderDetail';
import AdminBuyForMe from '../../src/pages/AdminBuyForMe';
import BuyForMeJobs from '../../src/pages/delivery/BuyForMeJobs';
import BuyForMeOrders from '../../src/pages/BuyForMeOrders';
import ShoppingLayout from '../../src/components/shopping/ShoppingLayout';
import BuyForMeHome from '../../src/pages/BuyForMeHome';
import BuyForMeLists from '../../src/pages/BuyForMeLists';

const screen = new URLSearchParams(location.search).get('screen');
const country = { id: 'cccccccccccccccccccccccc', code: 'CG', currency: { code: 'XAF' } };
const user = { _id: 'bbbbbbbbbbbbbbbbbbbbbbbb', name: 'Client test', countryId: country.id, role: screen === 'admin' ? 'founder' : 'user' };
const target = screen === 'home' ? '/buy-for-me' : screen === 'lists' ? '/buy-for-me/lists' : screen === 'history' ? '/buy-for-me/orders' : screen === 'detail' ? '/buy-for-me/111111111111111111111111' : screen === 'admin' ? '/admin/buy-for-me' : screen === 'courier' ? '/delivery/buy-for-me?orderId=111111111111111111111111' : '/buy-for-me/new';
window.history.replaceState(null, '', target);
createRoot(document.getElementById('root')).render(<BrowserRouter><AuthContext.Provider value={{ user, loading: false }}>
  <CountryContext.Provider value={{ country }}><AppSettingsContext.Provider value={{ cities: [], communes: [], t: (_key, fallback) => fallback,
    getRuntimeValue: (_key, fallback) => fallback, isFeatureEnabled: () => screen !== 'history' }}><ToastProvider>
    <Routes><Route path="/buy-for-me" element={<ShoppingLayout />}><Route index element={<BuyForMeHome />} /><Route path="new" element={<BuyForMe />} /><Route path=":id" element={<BuyForMeOrderDetail />} />
      <Route path="orders" element={<BuyForMeOrders />} /><Route path="lists" element={<BuyForMeLists />} /></Route>
      <Route path="/admin/buy-for-me" element={<AdminBuyForMe />} /><Route path="/delivery/buy-for-me" element={<BuyForMeJobs />} /></Routes>
  </ToastProvider></AppSettingsContext.Provider></CountryContext.Provider>
</AuthContext.Provider></BrowserRouter>);
