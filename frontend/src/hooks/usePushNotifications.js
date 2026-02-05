import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import api from '../services/api';

const isDev = import.meta.env?.DEV === true;
const PUSH_TOKEN_RETRY_DELAY_MS = 3000;
const PUSH_TOKEN_MAX_RETRIES = 2;

export default function usePushNotifications(user) {
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!user?.token) return;
    if (!Capacitor.isNativePlatform()) return;
    if (initializedRef.current) return;
    initializedRef.current = true;
    let active = true;

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

    const sendTokenToServer = async (tokenValue, retryCount = 0) => {
      try {
        await api.post('/users/push-tokens', {
          token: tokenValue,
          platform: Capacitor.getPlatform()
        });
        if (isDev) console.log('[HDMarket] Push token registered');
        return true;
      } catch (err) {
        if (isDev) console.warn('[HDMarket] Push token API error:', err?.response?.status ?? err.message);
        if (active && retryCount < PUSH_TOKEN_MAX_RETRIES) {
          setTimeout(() => sendTokenToServer(tokenValue, retryCount + 1), PUSH_TOKEN_RETRY_DELAY_MS);
        }
        return false;
      }
    };

    const registrationListener = PushNotifications.addListener('registration', async (token) => {
      if (!active || !token?.value) return;
      await sendTokenToServer(token.value);
    });

    const registrationErrorListener = PushNotifications.addListener('registrationError', (err) => {
      if (isDev) console.warn('[HDMarket] Push registrationError:', err);
    });

    const resolveNotificationLink = (payload) => {
      const data = payload?.notification?.data || payload?.data || {};
      const rawLink = data.url || data.link || data.deeplink || data.path;
      if (!rawLink || typeof rawLink !== 'string') return null;
      const trimmed = rawLink.trim();
      if (!trimmed) return null;
      if (trimmed.startsWith('http')) return trimmed;
      if (trimmed.startsWith('/')) return trimmed;
      return `/${trimmed}`;
    };

    const receivedListener = PushNotifications.addListener('pushNotificationReceived', (notification) => {
      const link = resolveNotificationLink(notification);
      if (link && typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('hdmarket:notification-link', {
            detail: { link },
            bubbles: true,
            cancelable: false
          })
        );
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('hdmarket:notifications-refresh'));
      }
    });

    const actionListener = PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
      const link = resolveNotificationLink(notification);
      if (link && typeof window !== 'undefined') {
        window.location.assign(link);
        return;
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('hdmarket:notifications-refresh'));
      }
    });

    return () => {
      active = false;
      registrationListener.remove();
      registrationErrorListener.remove();
      receivedListener.remove();
      actionListener.remove();
    };
  }, [user?.token]);
}
