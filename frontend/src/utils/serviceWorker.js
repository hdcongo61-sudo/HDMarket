/**
 * Service Worker registration utility
 */

const isLocalHost = () => {
  if (typeof window === 'undefined') return false;
  return ['localhost', '127.0.0.1'].includes(window.location.hostname);
};

export const registerServiceWorker = async () => {
  if (isLocalHost()) {
    await unregisterServiceWorker();
    return null;
  }
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });
      
      console.log('Service Worker registered:', registration);

      const firebaseConfig = {
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
        storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
        messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
        appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
        measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || ''
      };
      const firebaseSdkBaseUrl = import.meta.env.VITE_FIREBASE_SW_SDK_BASE_URL || '';

      const postFirebaseConfig = async () => {
        if (!firebaseConfig.apiKey || !firebaseConfig.messagingSenderId) return;
        try {
          const readyReg = await navigator.serviceWorker.ready;
          const target = readyReg.active || registration.active;
          if (target) {
            target.postMessage({
              type: 'SET_FIREBASE_CONFIG',
              payload: {
                config: firebaseConfig,
                sdkBaseUrl: firebaseSdkBaseUrl
              }
            });
          }
        } catch (err) {
          console.warn('[HDMarket] Failed to send Firebase config to SW', err);
        }
      };

      postFirebaseConfig();
      
      // Check for updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New service worker available
              console.log('New service worker available');
              postFirebaseConfig();
            }
          });
        }
      });
      
      return registration;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      return null;
    }
  }
  return null;
};

export const unregisterServiceWorker = async () => {
  if ('serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
      if (typeof window !== 'undefined' && window.caches) {
        const keys = await window.caches.keys();
        await Promise.all(keys.map((key) => window.caches.delete(key)));
      }
      console.log('Service Worker unregistered');
    } catch (error) {
      console.error('Service Worker unregistration failed:', error);
    }
  }
};

export const clearServiceWorkerCache = async () => {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready;
      if (registration.active) {
        registration.active.postMessage({ type: 'CLEAR_CACHE' });
      }
    } catch (error) {
      console.error('Failed to clear service worker cache:', error);
    }
  }
};
