import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '../../src/index.css';
import ProductForm from '../../src/components/ProductForm';
import SellerProductVideos from '../../src/pages/SellerProductVideos';
import AuthContext from '../../src/context/AuthContext';
import AppSettingsContext from '../../src/context/AppSettingsContext';
import { ToastProvider } from '../../src/context/ToastContext';

const params = new URLSearchParams(window.location.search);
const editing = params.has('edit');
const embedded = params.has('embedded');
const existing = {
  _id: 'test-product', title: 'Commode en bois clair', description: 'Une commode avec trois tiroirs et des poignées en laiton.',
  price: 75000, category: 'meubles', condition: 'new', deliveryAvailable: true, pickupAvailable: true,
  images: ['/favicon.svg'], attributes: [{ name: 'Modèle', type: 'select', options: ['Petit modèle'], optionPrices: { 'petit modèle': 45000 }, optionImages: { 'petit modèle': 0 } }]
};
const settings = {
  runtime: {}, app: { maxUploadImages: 10 }, featureFlags: {},
  getRuntimeValue: (_key, fallback) => fallback,
  isFeatureEnabled: () => false,
  t: (_key, fallback) => fallback,
  formatPrice: value => `${Number(value).toLocaleString('fr-FR')} FCFA`
};
function Harness() {
  return <BrowserRouter><AuthContext.Provider value={{ user: { _id: 'test-seller', id: 'test-seller', accountType: 'shop', shopVerified: true, shopName: 'Ma boutique' } }}>
    <AppSettingsContext.Provider value={settings}><ToastProvider>
      <div className={embedded ? 'hd-my-flow' : undefined} style={embedded ? { height: '100dvh', display: 'flex', flexDirection: 'column' } : { padding: '16px 0' }}>
        {embedded && <div style={{ background: '#e85d00', color: 'white', padding: 20, flexShrink: 0 }}>Nouvelle annonce</div>}
        <div style={embedded ? { flex: 1, minHeight: 0, overflowY: 'auto' } : undefined}>
          {params.has('videos') ? <SellerProductVideos /> : <ProductForm initialValues={editing ? existing : undefined} productId={editing ? existing._id : undefined}
            embeddedInModal={embedded} hideHeader={embedded} onCancel={() => {}}
            onCreated={() => { window.formSaved = true; }} onUpdated={() => { window.formSaved = true; }} />}
        </div>
      </div>
    </ToastProvider></AppSettingsContext.Provider>
  </AuthContext.Provider></BrowserRouter>;
}
createRoot(document.getElementById('root')).render(<Harness />);
