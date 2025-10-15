import React, { createContext, useEffect, useState } from 'react';
import api from '../services/api';
import { jwtDecode } from 'jwt-decode';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null); // {id, name, email, role}

  useEffect(() => {
    const token = localStorage.getItem('qm_token');
    if (!token) return;
    try {
      const payload = jwtDecode(token);
      const stored = localStorage.getItem('qm_user');
      let parsed = {};
      if (stored) {
        try {
          parsed = JSON.parse(stored);
        } catch {
          parsed = {};
        }
      }
      setUser({ id: payload.id, role: payload.role, token, ...parsed });
    } catch {
      localStorage.removeItem('qm_token');
      localStorage.removeItem('qm_user');
    }
  }, []);

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
      phone: data.phone
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
