import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import storage from '../utils/storage.js';

const readAuthToken = async () => {
  try {
    const token = await storage.get('qm_token');
    if (typeof token === 'string') return token.trim();
    if (!token) return '';
    return String(token).trim();
  } catch {
    return '';
  }
};

/**
 * Subscribes to live courier GPS pushes for one order.
 *
 * The courier app pings `POST /delivery/location/ping` every ~15s while a
 * delivery is in transit; the backend then emits `delivery:location:updated`
 * to the buyer's (and seller's) user room. This hook mirrors the socket
 * pattern from `useUserNotifications` (default namespace, JWT auth — authed
 * sockets auto-join their `user:<id>` room server-side).
 *
 * The 15s HTTP polling in OrderDetail stays in place as the fallback; this
 * just makes the map move between polls.
 */
export default function useDeliveryLocationUpdates({ orderId, enabled = true, onUpdate } = {}) {
  const onUpdateRef = useRef(onUpdate);
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    const normalizedOrderId = String(orderId || '').trim();
    if (!enabled || !normalizedOrderId) return undefined;

    let cancelled = false;
    let socket = null;

    const initializeSocket = async () => {
      const token = await readAuthToken();
      if (cancelled || !token) return;

      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
      const origin = apiBase.replace(/\/api\/?$/, '');
      socket = io(origin, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 20,
        reconnectionDelay: 800
      });
      if (cancelled) {
        socket.disconnect();
        return;
      }

      socket.on('delivery:location:updated', (payload) => {
        if (!payload || String(payload.orderId || '') !== normalizedOrderId) return;
        const lat = Number(payload?.position?.lat);
        const lng = Number(payload?.position?.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
        onUpdateRef.current?.({
          position: { lat, lng },
          currentStage: String(payload.currentStage || ''),
          updatedAt: payload.updatedAt || new Date().toISOString()
        });
      });
      socket.on('connect_error', () => {
        // Polling fallback remains active.
      });
    };

    initializeSocket();

    return () => {
      cancelled = true;
      if (socket) socket.disconnect();
    };
  }, [orderId, enabled]);
}
