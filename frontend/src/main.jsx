import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { FavoriteProvider } from './context/FavoriteContext';
import { ToastProvider } from './context/ToastContext';
import { registerServiceWorker } from './utils/serviceWorker';

const root = createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <AuthProvider>
      <CartProvider>
        <FavoriteProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </FavoriteProvider>
      </CartProvider>
    </AuthProvider>
  </React.StrictMode>
);

// Register service worker for PWA (offline support)
if (import.meta.env.PROD) {
  registerServiceWorker();
}
