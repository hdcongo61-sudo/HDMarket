import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChatBubbleLeftIcon, ChevronRightIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { io } from 'socket.io-client';
import AuthContext from '../context/AuthContext';
import storage from '../utils/storage';
import { fetchOrderUnreadCount } from '../queries/orderChatApi';

const DISMISS_STORAGE_KEY = 'hdmarket:unread-reminder-dismissed';

/**
 * Top-of-screen banner reminding the user they have unread order messages.
 * Appears on app open / page navigation; dismissible and auto-hides when
 * navigating to the messages page.
 *
 * Dismissal uses a session-scoped expiry: the banner stays hidden until
 * the next distinct app session (5-minute gap = new session), so it
 * refreshes on each real app open.
 */
export default function UnreadMessageReminder() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const [unread, setUnread] = useState(0);
  const [visible, setVisible] = useState(false);
  const socketRef = useRef(null);
  const fetchedRef = useRef(false);

  const isMessagesPage = location.pathname === '/orders/messages';

  // Check whether this is a "fresh" app open (≥5 min since last dismissal)
  const dismissalExpired = useCallback(() => {
    try {
      const raw = localStorage.getItem(DISMISS_STORAGE_KEY);
      if (!raw) return true;
      const dismissedAt = Number(raw);
      if (!Number.isFinite(dismissedAt)) return true;
      // Expire dismissal after 5 minutes (new session)
      return Date.now() - dismissedAt > 5 * 60 * 1000;
    } catch {
      return true;
    }
  }, []);

  const dismiss = useCallback(() => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_STORAGE_KEY, String(Date.now()));
    } catch { /* ignore */ }
  }, []);

  // Initial fetch + Socket.io listener
  useEffect(() => {
    if (!user?._id) {
      setUnread(0);
      setVisible(false);
      return () => {};
    }

    let cancelled = false;
    let mountedSocket = null;
    const userId = String(user._id);

    // Fetch unread on mount
    fetchOrderUnreadCount()
      .then(({ unreadCount }) => {
        if (cancelled) return;
        const count = Number(unreadCount || 0);
        setUnread(count);
        if (count > 0 && dismissalExpired()) {
          setVisible(true);
        }
      })
      .catch(() => {});
    fetchedRef.current = true;

    // Socket.io for live updates
    const initSocket = async () => {
      const token = await storage.get('qm_token');
      if (!token || cancelled) return;
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
      const origin = apiBase.replace(/\/api\/?$/, '');
      const socket = io(origin, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 10,
        reconnectionDelay: 1000
      });
      mountedSocket = socket;
      if (cancelled) {
        socket.disconnect();
        return;
      }
      socketRef.current = socket;

      socket.on('orders:unread:update', (payload) => {
        if (String(payload?.userId || '') !== userId) return;
        const count = Number(payload?.totalUnread || 0);
        setUnread(count);
        if (count > 0 && dismissalExpired()) {
          setVisible(true);
        } else if (count === 0) {
          setVisible(false);
        }
      });

      // Also listen for new messages as a fallback refresh trigger
      socket.on('orders:message:new', () => {
        fetchOrderUnreadCount()
          .then(({ unreadCount }) => {
            if (cancelled) return;
            const count = Number(unreadCount || 0);
            setUnread(count);
            if (count > 0 && dismissalExpired()) {
              setVisible(true);
            }
          })
          .catch(() => {});
      });
    };

    initSocket();

    return () => {
      cancelled = true;
      if (mountedSocket) {
        mountedSocket.disconnect();
      }
      if (socketRef.current === mountedSocket) {
        socketRef.current = null;
      }
    };
  }, [user?._id, dismissalExpired]);

  // Re-fetch unread on route change (e.g. coming back from messages page)
  useEffect(() => {
    if (!user?._id) return;
    if (!fetchedRef.current) return;
    fetchOrderUnreadCount()
      .then(({ unreadCount }) => {
        const count = Number(unreadCount || 0);
        setUnread(count);
        if (count > 0 && dismissalExpired()) {
          setVisible(true);
        }
      })
      .catch(() => {});
  }, [location.pathname, user?._id, dismissalExpired]);

  // Auto-hide when navigating to messages page
  useEffect(() => {
    if (isMessagesPage) {
      setVisible(false);
    }
  }, [isMessagesPage]);

  // Listen for the Navbar-dispatched unread event and other triggers
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleUnreadEvent = (event) => {
      const count = Number(event?.detail?.totalUnread);
      if (Number.isFinite(count)) {
        setUnread(count);
        if (count > 0 && dismissalExpired()) {
          setVisible(true);
        } else if (count === 0) {
          setVisible(false);
        }
      }
    };

    const handleRefresh = () => {
      fetchOrderUnreadCount()
        .then(({ unreadCount }) => {
          const count = Number(unreadCount || 0);
          setUnread(count);
          if (count > 0 && dismissalExpired()) {
            setVisible(true);
          }
        })
        .catch(() => {});
    };

    window.addEventListener('hdmarket:unread-messages', handleUnreadEvent);
    window.addEventListener('hdmarket:orders-status-updated', handleRefresh);
    window.addEventListener('hdmarket:notifications-refresh', handleRefresh);
    return () => {
      window.removeEventListener('hdmarket:unread-messages', handleUnreadEvent);
      window.removeEventListener('hdmarket:orders-status-updated', handleRefresh);
      window.removeEventListener('hdmarket:notifications-refresh', handleRefresh);
    };
  }, [dismissalExpired]);

  if (!visible || unread <= 0) return null;

  return (
    <div className="sticky top-[calc(env(safe-area-inset-top,0px)+4rem)] lg:top-[calc(env(safe-area-inset-top,0px)+7rem)] z-[45] animate-in slide-in-from-top-2 duration-300">
      <button
        type="button"
        onClick={() => navigate('/orders/messages')}
        className="flex w-full items-center gap-3 bg-[#e85d00] px-4 py-3 text-white shadow-md transition-colors hover:bg-[#f45f00] active:bg-[#cc5200]"
      >
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white/20">
          <ChatBubbleLeftIcon className="h-4 w-4" />
        </div>

        <div className="flex-1 text-left min-w-0">
          <p className="text-sm font-black leading-tight">
            {unread === 1
              ? 'Vous avez 1 message non lu'
              : `Vous avez ${unread} messages non lus`}
          </p>
          <p className="text-xs font-semibold text-orange-100">
            Appuyez pour consulter
          </p>
        </div>

        <ChevronRightIcon className="h-5 w-5 flex-shrink-0" />

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            dismiss();
          }}
          className="flex-shrink-0 rounded-full p-1.5 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
          aria-label="Fermer"
        >
          <XMarkIcon className="h-4 w-4" />
        </button>
      </button>
    </div>
  );
}
