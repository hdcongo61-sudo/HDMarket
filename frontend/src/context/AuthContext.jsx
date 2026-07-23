import React, { createContext, useEffect, useState } from 'react';
import api, { abortPendingRequests, clearAllCache } from '../services/api';
import { jwtDecode } from 'jwt-decode';
import storage from '../utils/storage';
import indexedDB, { STORES } from '../utils/indexedDB';
import { clearSearchCache } from '../utils/searchCache';
import { clearUserDataOnLogout } from '../utils/clearUserDataOnLogout';
import { queryClient } from '../lib/queryClient';
import { normalizeUser } from '../utils/normalizeUser';
import { appAlert } from '../utils/appDialog';

export const defaultAuthContextValue = {
  user: null,
  loading: false,
  login: async () => {},
  logout: async () => {},
  updateUser: async () => {}
};

const AuthContext = createContext(defaultAuthContextValue);

const isJwtExpired = (payload) => {
  const exp = Number(payload?.exp || 0);
  if (!Number.isFinite(exp) || exp <= 0) return false;
  return Date.now() >= exp * 1000;
};

const readPersistedUser = async () => {
  if (typeof window === 'undefined') return null;
  try {
    const token = await storage.get('qm_token');
    if (!token) return null;

    const payload = jwtDecode(token);
    if (isJwtExpired(payload)) {
      await storage.remove('qm_token');
      await storage.remove('qm_user');
      return null;
    }
    const stored = await storage.get('qm_user');
    return normalizeUser({ ...stored, id: payload.id, role: payload.role, token });
  } catch {
    await storage.remove('qm_token');
    await storage.remove('qm_user');
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load persisted user on mount
  useEffect(() => {
    let mounted = true;
    let resolved = false;
    const timeout = setTimeout(() => {
      if (!mounted || resolved) return;
      setLoading(false);
    }, 8000);

    readPersistedUser()
      .then((userData) => {
        if (!mounted) return;
        setUser(userData);
      })
      .finally(() => {
        resolved = true;
        clearTimeout(timeout);
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
      clearTimeout(timeout);
    };
  }, []);

  const persistUser = async (data) => {
    const { token: _token, ...rest } = data || {};
    try {
      await storage.set('qm_user', rest);
    } catch {}
  };

  const login = async (data) => {
    await storage.set('qm_token', data.token);
    const userData = normalizeUser(data);
    await persistUser(userData);
    setUser(userData);
  };

  const logout = async () => {
    const logoutToken = String(user?.token || '').trim();

    // 1. Clear UI state first (instant feedback)
    setUser(null);

    // 2. Clear client caches synchronously
    queryClient.clear();
    abortPendingRequests('USER_LOGOUT');

    // 3. Clear persisted storage
    await Promise.allSettled([
      storage.remove('qm_token'),
      storage.remove('qm_user'),
      clearUserDataOnLogout({ clearBrowserCaches: false })
    ]);

    // 4. Redirect immediately (user sees home page)
    if (typeof window !== 'undefined') {
      window.location.replace('/');
    }

    // 5. Fire-and-forget server-side cleanup (best-effort, don't block redirect)
    if (logoutToken) {
      const authConfig = { timeout: 2500, headers: { Authorization: `Bearer ${logoutToken}` } };
      Promise.allSettled([
        api.post('/auth/logout', {}, authConfig),
        api.post('/users/logout-cache', {}, authConfig),
        clearAllCache(),
        clearSearchCache(),
        indexedDB.clear(STORES.PRODUCTS),
        indexedDB.clear(STORES.SEARCH_RESULTS),
        indexedDB.clear(STORES.SHOP_DATA),
        clearUserDataOnLogout({ clearBrowserCaches: true })
      ]).catch(() => {});
    }
  };

  useEffect(() => {
    if (!user?.token) return undefined;
    let cancelled = false;
    const fetchProfile = async () => {
      if (cancelled || !user?.token) return;
      try {
        const { data } = await api.get('/users/profile');
        if (cancelled) return;
        updateUser(data);
      } catch (e) {
        if (cancelled) return;
        if (e.response?.status === 401) {
          logout();
        } else if (
          e.response?.status === 403 &&
          ['ACCOUNT_BLOCKED', 'ACCOUNT_INACTIVE', 'ACCOUNT_LOCKED'].includes(
            e.response?.data?.code
          )
        ) {
          const message =
            e.response?.data?.message ||
            'Votre compte n’est plus actif. Contactez le support pour plus d’informations.';
          logout();
          appAlert(message);
        }
      }
    };
    const timer = setTimeout(fetchProfile, 900);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.token]);

  const updateUser = async (patch) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = normalizeUser({ ...prev, ...patch });
      persistUser(next);
      return next;
    });
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
