import React, { createContext, useEffect, useState } from 'react';
import api from '../services/api';
import { jwtDecode } from 'jwt-decode';

const AuthContext = createContext();

const readPersistedUser = () => {
  if (typeof window === 'undefined') return null;
  const token = window.localStorage.getItem('qm_token');
  if (!token) return null;
  try {
    const payload = jwtDecode(token);
    const stored = window.localStorage.getItem('qm_user');
    let parsed = {};
    if (stored) {
      try {
        parsed = JSON.parse(stored);
      } catch {
        parsed = {};
      }
    }
    const normalized = {
      ...parsed,
      shopHours: Array.isArray(parsed.shopHours) ? parsed.shopHours : [],
      shopVerified: Boolean(parsed.shopVerified),
      phoneVerified: Boolean(parsed.phoneVerified),
      followingShops: Array.isArray(parsed.followingShops) ? parsed.followingShops : []
    };
    return { id: payload.id, role: payload.role, token, ...normalized };
  } catch {
    window.localStorage.removeItem('qm_token');
    window.localStorage.removeItem('qm_user');
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => readPersistedUser()); // {id, name, email, role}

  const persistUser = (data) => {
    const { token: _token, ...rest } = data || {};
    try {
      localStorage.setItem('qm_user', JSON.stringify(rest));
    } catch {}
  };

  const login = (data) => {
    localStorage.setItem('qm_token', data.token);
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
      country: data.country || 'République du Congo',
      address: data.address || '',
      city: data.city || '',
      gender: data.gender || ''
    };
    persistUser(userData);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('qm_token');
    localStorage.removeItem('qm_user');
    setUser(null);
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

  const updateUser = (patch) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      persistUser(next);
      return next;
    });
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
