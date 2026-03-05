import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';
import api from '../services/api';

const isDev = import.meta.env?.DEV === true;
const debugPush = isDev && String(import.meta.env?.VITE_DEBUG_PUSH) === 'true';
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
  const webPushUnsubscribeRef = useRef(null);

  useEffect(() => {
    if (!user?.token) return;
    let active = true;
    const retryTimers = new Set();

    const clearRetryTimers = () => {
      retryTimers.forEach((timerId) => clearTimeout(timerId));
      retryTimers.clear();
    };

    const scheduleRetry = (callback, delayMs) => {
      if (!active) return;
      const timerId = setTimeout(() => {
        retryTimers.delete(timerId);
        if (!active) return;
        callback();
      }, Math.max(500, Number(delayMs || 0)));
      retryTimers.add(timerId);
    };

    const sendTokenToServer = async (tokenValue, platform, retryCount = 0) => {
      if (!active) return false;
      try {
        const payload = {
          token: tokenValue,
          platform,
          deviceInfo: {
            deviceId: Capacitor.isNativePlatform() ? (window?.device?.uuid || '') : '',
            model: Capacitor.isNativePlatform() ? (window?.device?.model || '') : '',
            osVersion: Capacitor.isNativePlatform() ? (window?.device?.version || '') : '',
            appVersion: import.meta.env.VITE_APP_VERSION || ''
          }
        };
        try {
          await api.post('/devices/register', payload);
        } catch {
          // backward-compatible fallback
          await api.post('/users/push-tokens', payload);
        }
        if (debugPush) console.log('[HDMarket] Push token registered', platform);
        return true;
      } catch (err) {
        if (debugPush) console.warn('[HDMarket] Push token API error:', err?.response?.status ?? err.message);
        if (active && retryCount < PUSH_TOKEN_MAX_RETRIES) {
          scheduleRetry(() => {
            sendTokenToServer(tokenValue, platform, retryCount + 1);
          }, PUSH_TOKEN_RETRY_DELAY_MS);
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
            if (debugPush) console.warn('[HDMarket] Push: permission not granted');
            return;
          }
        }
        await PushNotifications.register();
      };

      register().catch((err) => {
        if (debugPush) console.warn('[HDMarket] Push register error:', err);
      });

      const registrationListener = PushNotifications.addListener('registration', async (token) => {
        if (!active || !token?.value) return;
        await sendTokenToServer(token.value, Capacitor.getPlatform());
      });

      const registrationErrorListener = PushNotifications.addListener('registrationError', (err) => {
        if (debugPush) console.warn('[HDMarket] Push registrationError:', err);
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
        if (debugPush) console.warn('[HDMarket] Web push: Firebase config missing');
        return;
      }
      try {
        const support = await isSupported();
        if (!support) {
          if (debugPush) console.warn('[HDMarket] Web push: browser not supported');
          return;
        }
      } catch {
        if (debugPush) console.warn('[HDMarket] Web push: support check failed');
        return;
      }

      let permission = Notification.permission;
      if (permission === 'default') {
        try {
          permission = await Notification.requestPermission();
        } catch (e) {
          if (debugPush) console.warn('[HDMarket] Web push: requestPermission failed', e);
          return;
        }
      }
      if (permission !== 'granted') {
        if (debugPush) console.warn('[HDMarket] Web push: permission not granted');
        return;
      }

      try {
        const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
        const messaging = getMessaging(app);

        let registration = null;
        try {
          registration = await navigator.serviceWorker.ready;
        } catch {
          registration = null;
        }
        if (!registration) {
          registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        }

        const vapidKey =
          import.meta.env.VITE_FIREBASE_VAPID_KEY ||
          import.meta.env.VITE_VAPID_PUBLIC_KEY ||
          undefined;
        if (!vapidKey && debugPush) {
          console.warn('[HDMarket] Web push: VAPID key missing, fallback token strategy in use');
        }
        const tokenOptions = { serviceWorkerRegistration: registration };
        if (vapidKey) tokenOptions.vapidKey = vapidKey;
        const token = await getToken(messaging, tokenOptions);
        if (!active || !token) return;
        await sendTokenToServer(token, 'web');

        const unsubscribe = onMessage(messaging, (payload) => {
          if (!active) return;
          dispatchNotificationEvents(payload);
        });
        webPushUnsubscribeRef.current = unsubscribe;
      } catch (err) {
        if (debugPush) console.warn('[HDMarket] Web push registration error:', err?.message ?? err);
      }
    })();

    return () => {
      active = false;
      clearRetryTimers();
      const unsub = webPushUnsubscribeRef.current;
      if (typeof unsub === 'function') {
        try { unsub(); } catch (_) {}
        webPushUnsubscribeRef.current = null;
      }
    };
  }, [user?._id, user?.token]);
}
