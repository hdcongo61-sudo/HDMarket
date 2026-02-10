import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import api from '../services/api';

const isDev = import.meta.env?.DEV === true;
const PUSH_TOKEN_RETRY_DELAY_MS = 3000;
const PUSH_TOKEN_MAX_RETRIES = 2;

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || ''
};

function resolveNotificationLink(payload) {
  const data = payload?.notification?.data || payload?.data || payload || {};
  const rawLink = data.url || data.link || data.deeplink || data.path;
  if (!rawLink || typeof rawLink !== 'string') return null;
  const trimmed = rawLink.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('http')) return trimmed;
  if (trimmed.startsWith('/')) return trimmed;
  return `/${trimmed}`;
}

function dispatchNotificationEvents(payload) {
  const link = resolveNotificationLink(payload);
  if (typeof window === 'undefined') return;
  if (link) {
    window.dispatchEvent(
      new CustomEvent('hdmarket:notification-link', {
        detail: { link },
        bubbles: true,
        cancelable: false
      })
    );
  }
  window.dispatchEvent(new Event('hdmarket:notifications-refresh'));
}

export default function usePushNotifications(user) {
  const initializedRef = useRef(false);
  const webPushUnsubscribeRef = useRef(null);

  useEffect(() => {
    if (!user?.token) return;
    if (initializedRef.current) return;
    initializedRef.current = true;
    let active = true;

    const sendTokenToServer = async (tokenValue, platform, retryCount = 0) => {
      try {
        await api.post('/users/push-tokens', {
          token: tokenValue,
          platform
        });
        if (isDev) console.log('[HDMarket] Push token registered', platform);
        return true;
      } catch (err) {
        if (isDev) console.warn('[HDMarket] Push token API error:', err?.response?.status ?? err.message);
        if (active && retryCount < PUSH_TOKEN_MAX_RETRIES) {
          setTimeout(() => sendTokenToServer(tokenValue, platform, retryCount + 1), PUSH_TOKEN_RETRY_DELAY_MS);
        }
        return false;
      }
    };

    // Native (Capacitor) path
    if (Capacitor.isNativePlatform()) {
      const register = async () => {
        const permission = await PushNotifications.checkPermissions();
        if (permission.receive !== 'granted') {
          const request = await PushNotifications.requestPermissions();
          if (request.receive !== 'granted') {
            if (isDev) console.warn('[HDMarket] Push: permission not granted');
            return;
          }
        }
        await PushNotifications.register();
      };

      register().catch((err) => {
        if (isDev) console.warn('[HDMarket] Push register error:', err);
      });

      const registrationListener = PushNotifications.addListener('registration', async (token) => {
        if (!active || !token?.value) return;
        await sendTokenToServer(token.value, Capacitor.getPlatform());
      });

      const registrationErrorListener = PushNotifications.addListener('registrationError', (err) => {
        if (isDev) console.warn('[HDMarket] Push registrationError:', err);
      });

      const receivedListener = PushNotifications.addListener('pushNotificationReceived', (notification) => {
        dispatchNotificationEvents(notification);
      });

      const actionListener = PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
        const link = resolveNotificationLink(notification?.notification);
        if (link && typeof window !== 'undefined') {
          window.location.assign(link);
          return;
        }
        dispatchNotificationEvents(notification?.notification);
      });

      return () => {
        active = false;
        registrationListener.remove();
        registrationErrorListener.remove();
        receivedListener.remove();
        actionListener.remove();
      };
    }

    // PWA / Web path: Firebase Cloud Messaging
    (async function registerWebPush() {
      if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) return;
      if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
        if (isDev) console.warn('[HDMarket] Web push: Firebase config missing');
        return;
      }

      let permission = Notification.permission;
      if (permission === 'default') {
        try {
          permission = await Notification.requestPermission();
        } catch (e) {
          if (isDev) console.warn('[HDMarket] Web push: requestPermission failed', e);
          return;
        }
      }
      if (permission !== 'granted') {
        if (isDev) console.warn('[HDMarket] Web push: permission not granted');
        return;
      }

      try {
        const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
        const messaging = getMessaging(app);

        const registration = await navigator.serviceWorker.ready;
        const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY || undefined;
        const token = await getToken(messaging, {
          vapidKey,
          serviceWorkerRegistration: registration
        });
        if (!active || !token) return;
        await sendTokenToServer(token, 'web');

        const unsubscribe = onMessage(messaging, (payload) => {
          if (!active) return;
          dispatchNotificationEvents(payload);
        });
        webPushUnsubscribeRef.current = unsubscribe;
      } catch (err) {
        if (isDev) console.warn('[HDMarket] Web push registration error:', err?.message ?? err);
      }
    })();

    return () => {
      active = false;
      const unsub = webPushUnsubscribeRef.current;
      if (typeof unsub === 'function') {
        try { unsub(); } catch (_) {}
        webPushUnsubscribeRef.current = null;
      }
    };
  }, [user?.token]);
}
