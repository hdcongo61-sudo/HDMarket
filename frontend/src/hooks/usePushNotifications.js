import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import api from '../services/api';

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
          return;
        }
      }
      await PushNotifications.register();
    };

    register().catch(() => {});

    const registrationListener = PushNotifications.addListener('registration', async (token) => {
      if (!active || !token?.value) return;
      try {
        await api.post('/users/push-tokens', {
          token: token.value,
          platform: Capacitor.getPlatform()
        });
      } catch {
        // ignore registration errors
      }
    });

    const registrationErrorListener = PushNotifications.addListener('registrationError', () => {
      // ignore registration errors
    });

    const receivedListener = PushNotifications.addListener('pushNotificationReceived', () => {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('hdmarket:notifications-refresh'));
      }
    });

    const actionListener = PushNotifications.addListener('pushNotificationActionPerformed', () => {
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
