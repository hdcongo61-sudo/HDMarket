import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './index.css';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { FavoriteProvider } from './context/FavoriteContext';
import { ToastProvider } from './context/ToastContext';
import { AppSettingsProvider } from './context/AppSettingsContext';
import { queryClient } from './lib/queryClient';
import { registerServiceWorker, unregisterServiceWorker } from './utils/serviceWorker';
import GlobalErrorBoundary from './components/GlobalErrorBoundary';

const root = createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <GlobalErrorBoundary>
      <QueryClientProvider client={queryClient}>
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
      </QueryClientProvider>
    </GlobalErrorBoundary>
  </React.StrictMode>
);

// Register service worker for PWA (offline support + web push)
const swFlagRaw = String(import.meta.env.VITE_ENABLE_SW || '').trim().toLowerCase();
const enableServiceWorker =
  swFlagRaw === 'true' || (import.meta.env.PROD && swFlagRaw !== 'false');
if (enableServiceWorker) {
  registerServiceWorker();
} else if (typeof window !== 'undefined') {
  unregisterServiceWorker();
}
