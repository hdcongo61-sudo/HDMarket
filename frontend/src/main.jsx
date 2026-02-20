import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { FavoriteProvider } from './context/FavoriteContext';
import { ToastProvider } from './context/ToastContext';
import { AppSettingsProvider } from './context/AppSettingsContext';
import { registerServiceWorker, unregisterServiceWorker } from './utils/serviceWorker';

const root = createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <AuthProvider>
      <AppSettingsProvider>
        <CartProvider>
          <FavoriteProvider>
            <ToastProvider>
              <App />
            </ToastProvider>
          </FavoriteProvider>
        </CartProvider>
      </AppSettingsProvider>
    </AuthProvider>
  </React.StrictMode>
);

// Register service worker for PWA (offline support + web push)
const enableServiceWorker =
  import.meta.env.PROD && String(import.meta.env.VITE_ENABLE_SW) === 'true';
if (enableServiceWorker) {
  registerServiceWorker();
} else if (typeof window !== 'undefined') {
  unregisterServiceWorker();
}
