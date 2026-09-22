import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '../../src/index.css';
import AuthContext from '../../src/context/AuthContext';
import CountryContext from '../../src/context/CountryContext';
import AppSettingsContext, { AppSettingsProvider } from '../../src/context/AppSettingsContext';
import PaymentForm from '../../src/components/PaymentForm';
import PaymentVerification from '../../src/pages/PaymentVerification';
import useCommissionRate from '../../src/hooks/useCommissionRate';

const params = new URLSearchParams(window.location.search);
const user = { _id: 'seller', id: 'seller', role: 'admin' };
function PaymentScreen() {
  const { commissionRatePercent } = useCommissionRate();
  return <><output data-testid="rate">{commissionRatePercent}</output>
    <PaymentForm product={{ _id: 'listing', title: 'Commode', price: 190000, ...(params.has('topup') ? { requiresAdditionalPayment: true, pendingPrice: 200000, listingFeeRemaining: 10, listingFeeStatus: 'PAYMENT_REQUIRED' } : {}) }} />
  </>;
}
createRoot(document.getElementById('root')).render(
  <BrowserRouter><AuthContext.Provider value={{ user, updateUser: () => {} }}>
    <CountryContext.Provider value={{ country: { id: 'country' } }}>
      {params.has('fallback')
        ? <AppSettingsContext.Provider value={{ app: { commissionRate: 0.1 }, runtime: {}, getRuntimeValue: () => null }}><PaymentScreen /></AppSettingsContext.Provider>
        : <AppSettingsProvider>{params.has('verify') ? <PaymentVerification /> : <PaymentScreen />}</AppSettingsProvider>}
    </CountryContext.Provider>
  </AuthContext.Provider></BrowserRouter>
);
