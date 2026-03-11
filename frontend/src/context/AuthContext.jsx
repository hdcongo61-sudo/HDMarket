import React, { createContext, useEffect, useState } from 'react';
import api, { clearAllCache } from '../services/api';
import { jwtDecode } from 'jwt-decode';
import storage from '../utils/storage';
import indexedDB, { STORES } from '../utils/indexedDB';
import { clearSearchCache } from '../utils/searchCache';
import { clearUserDataOnLogout } from '../utils/clearUserDataOnLogout';
import { queryClient } from '../lib/queryClient';
import { normalizePermissions } from '../utils/permissions';
import { appAlert } from '../utils/appDialog';

const AuthContext = createContext();

const isTruthyFlag = (value) => {
  if (value === true || value === 1) return true;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on';
  }
  return false;
};

const withResolvedCapabilities = (rawUser = {}) => {
  const role = String(rawUser?.role || '').toLowerCase();
  const isFounder = role === 'founder';
  const permissions = normalizePermissions(rawUser?.permissions);
  const permissionSet = new Set(permissions);
  const hasPermission = (permission) => isFounder || permissionSet.has(permission);

  return {
    ...rawUser,
    permissions,
    canReadFeedback: isTruthyFlag(rawUser?.canReadFeedback) || hasPermission('read_feedback'),
    canVerifyPayments: isTruthyFlag(rawUser?.canVerifyPayments) || hasPermission('verify_payments'),
    canManageBoosts: isTruthyFlag(rawUser?.canManageBoosts) || hasPermission('manage_boosts'),
    canManageComplaints: isTruthyFlag(rawUser?.canManageComplaints) || hasPermission('manage_complaints'),
    canManageProducts: isTruthyFlag(rawUser?.canManageProducts) || hasPermission('manage_products'),
    canManageDelivery: isTruthyFlag(rawUser?.canManageDelivery) || hasPermission('manage_delivery'),
    canManageChatTemplates:
      isTruthyFlag(rawUser?.canManageChatTemplates) || hasPermission('manage_chat_templates'),
    canManageHelpCenter:
      isTruthyFlag(rawUser?.canManageHelpCenter) || hasPermission('manage_help_center')
  };
};

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
    const parsed = stored || {};
    
    const normalized = withResolvedCapabilities({
      ...parsed,
      shopHours: Array.isArray(parsed.shopHours) ? parsed.shopHours : [],
      shopVerified: Boolean(parsed.shopVerified),
      phoneVerified: Boolean(parsed.phoneVerified),
      followingShops: Array.isArray(parsed.followingShops) ? parsed.followingShops : [],
      preferredLanguage: parsed.preferredLanguage || 'fr',
      preferredCurrency: parsed.preferredCurrency || 'XAF',
      preferredCity: parsed.preferredCity || parsed.city || '',
      commune: parsed.commune || '',
      theme: ['light', 'dark', 'system'].includes(parsed.theme) ? parsed.theme : 'system',
      shopLocation:
        parsed?.shopLocation &&
        Array.isArray(parsed.shopLocation.coordinates) &&
        parsed.shopLocation.coordinates.length === 2
          ? parsed.shopLocation
          : null,
      shopLocationVerified: Boolean(parsed.shopLocationVerified),
      shopLocationAccuracy:
        parsed.shopLocationAccuracy === null || parsed.shopLocationAccuracy === undefined
          ? null
          : Number(parsed.shopLocationAccuracy),
      shopLocationUpdatedAt: parsed.shopLocationUpdatedAt || null,
      shopLocationTrustScore:
        parsed.shopLocationTrustScore === null || parsed.shopLocationTrustScore === undefined
          ? 0
          : Number(parsed.shopLocationTrustScore),
      shopLocationNeedsReview: Boolean(parsed.shopLocationNeedsReview),
      shopLocationReviewStatus: parsed.shopLocationReviewStatus || 'approved',
      shopLocationReviewFlags: Array.isArray(parsed.shopLocationReviewFlags)
        ? parsed.shopLocationReviewFlags
        : []
    });
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
    const userData = withResolvedCapabilities({
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
      profileImage: data.profileImage || '',
      shopBanner: data.shopBanner || '',
      shopDescription: data.shopDescription || '',
      shopLocation:
        data?.shopLocation &&
        Array.isArray(data.shopLocation.coordinates) &&
        data.shopLocation.coordinates.length === 2
          ? data.shopLocation
          : null,
      shopLocationVerified: Boolean(data.shopLocationVerified),
      shopLocationAccuracy:
        data.shopLocationAccuracy === null || data.shopLocationAccuracy === undefined
          ? null
          : Number(data.shopLocationAccuracy),
      shopLocationUpdatedAt: data.shopLocationUpdatedAt || null,
      shopLocationTrustScore:
        data.shopLocationTrustScore === null || data.shopLocationTrustScore === undefined
          ? 0
          : Number(data.shopLocationTrustScore),
      shopLocationNeedsReview: Boolean(data.shopLocationNeedsReview),
      shopLocationReviewStatus: data.shopLocationReviewStatus || 'approved',
      shopLocationReviewFlags: Array.isArray(data.shopLocationReviewFlags)
        ? data.shopLocationReviewFlags
        : [],
      shopHours: Array.isArray(data.shopHours) ? data.shopHours : [],
      shopVerified: Boolean(data.shopVerified),
      followingShops: Array.isArray(data.followingShops) ? data.followingShops : [],
      permissions: data.permissions,
      country: data.country || 'République du Congo',
      address: data.address || '',
      city: data.city || '',
      commune: data.commune || '',
      preferredLanguage: data.preferredLanguage || 'fr',
      preferredCurrency: data.preferredCurrency || 'XAF',
      preferredCity: data.preferredCity || data.city || '',
      theme: ['light', 'dark', 'system'].includes(data.theme) ? data.theme : 'system',
      gender: data.gender || ''
    });
    await persistUser(userData);
    setUser(userData);
  };

  const logout = async () => {
    try {
      if (user?.token) {
        try {
          await api.post('/auth/logout');
        } catch {
          // ignore logout auth API errors
        }
        try {
          await api.post('/users/logout-cache');
        } catch {
          // ignore logout cache API errors
        }
      }
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
    queryClient.clear();
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
          appAlert(message);
        }
      }
    };
    fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.token]);

  const updateUser = async (patch) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = withResolvedCapabilities({ ...prev, ...patch });
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
