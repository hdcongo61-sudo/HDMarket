import React, { createContext, useEffect, useState } from 'react';
import api, { clearAllCache } from '../services/api';
import { jwtDecode } from 'jwt-decode';
import storage from '../utils/storage';
import indexedDB, { STORES } from '../utils/indexedDB';
import { clearSearchCache } from '../utils/searchCache';
import { clearUserDataOnLogout } from '../utils/clearUserDataOnLogout';

const AuthContext = createContext();

const readPersistedUser = async () => {
  if (typeof window === 'undefined') return null;
  try {
    const token = await storage.get('qm_token');
    if (!token) return null;
    
    const payload = jwtDecode(token);
    const stored = await storage.get('qm_user');
    const parsed = stored || {};
    
    const normalized = {
      ...parsed,
      shopHours: Array.isArray(parsed.shopHours) ? parsed.shopHours : [],
      shopVerified: Boolean(parsed.shopVerified),
      phoneVerified: Boolean(parsed.phoneVerified),
      followingShops: Array.isArray(parsed.followingShops) ? parsed.followingShops : [],
      canReadFeedback: Boolean(parsed.canReadFeedback),
      canVerifyPayments: Boolean(parsed.canVerifyPayments),
      canManageBoosts: Boolean(parsed.canManageBoosts),
      canManageComplaints: Boolean(parsed.canManageComplaints)
    };
    return { id: payload.id, role: payload.role, token, ...normalized };
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
    readPersistedUser().then((userData) => {
      setUser(userData);
      setLoading(false);
    });
  }, []);

  const persistUser = async (data) => {
    const { token: _token, ...rest } = data || {};
    try {
      await storage.set('qm_user', rest);
    } catch {}
  };

  const login = async (data) => {
    await storage.set('qm_token', data.token);
    const userData = {
      id: data._id,
      role: data.role,
      token: data.token,
      name: data.name,
      email: data.email,
      phone: data.phone,
      phoneVerified: Boolean(data.phoneVerified),
      accountType: data.accountType || 'person',
      shopName: data.shopName || '',
      shopAddress: data.shopAddress || '',
      shopLogo: data.shopLogo || '',
      shopBanner: data.shopBanner || '',
      shopDescription: data.shopDescription || '',
      shopHours: Array.isArray(data.shopHours) ? data.shopHours : [],
      shopVerified: Boolean(data.shopVerified),
      followingShops: Array.isArray(data.followingShops) ? data.followingShops : [],
      canReadFeedback: Boolean(data.canReadFeedback),
      canVerifyPayments: Boolean(data.canVerifyPayments),
      canManageBoosts: Boolean(data.canManageBoosts),
      canManageComplaints: Boolean(data.canManageComplaints),
      country: data.country || 'République du Congo',
      address: data.address || '',
      city: data.city || '',
      gender: data.gender || ''
    };
    await persistUser(userData);
    setUser(userData);
  };

  const logout = async () => {
    try {
      await clearAllCache();
      await clearUserDataOnLogout();
      await Promise.all([
        indexedDB.clear(STORES.PRODUCTS),
        indexedDB.clear(STORES.SEARCH_RESULTS),
        indexedDB.clear(STORES.SHOP_DATA)
      ]);
      await clearSearchCache();
    } catch {
      // ignore cache clear errors
    }
    await storage.remove('qm_token');
    await storage.remove('qm_user');
    setUser(null);
    // Full reload so the next user on the same device does not see any cached UI state
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  };

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user?.token) return;
      try {
        const { data } = await api.get('/users/profile');
        updateUser(data);
      } catch (e) {
        if (e.response?.status === 401) {
          logout();
        } else if (e.response?.status === 403 && e.response?.data?.code === 'ACCOUNT_BLOCKED') {
          const message =
            e.response?.data?.message ||
            'Votre compte est suspendu. Contactez l’administrateur pour plus d’informations.';
          logout();
          alert(message);
        }
      }
    };
    fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.token]);

  const updateUser = async (patch) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
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
