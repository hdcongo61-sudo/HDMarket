import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import AuthContext from './AuthContext';

const initialCart = {
  items: [],
  totals: { quantity: 0, subtotal: 0 },
  updatedAt: null
};

const CartContext = createContext({
  cart: initialCart,
  loading: false,
  error: '',
  addItem: async () => {},
  updateItem: async () => {},
  removeItem: async () => {},
  clearCart: async () => {},
  refresh: async () => {}
});

export const CartProvider = ({ children }) => {
  const { user } = useContext(AuthContext);
  const [cart, setCart] = useState(initialCart);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleResponse = useCallback((data) => {
    if (!data) {
      setCart(initialCart);
    } else {
      setCart({
        items: data.items || [],
        totals: data.totals || { quantity: 0, subtotal: 0 },
        updatedAt: data.updatedAt || null
      });
    }
  }, []);

  const fetchCart = useCallback(async () => {
    if (!user) {
      setCart(initialCart);
      setError('');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.get('/cart');
      handleResponse(data);
      setError('');
    } catch (e) {
      if (e.response?.status === 401) {
        setCart(initialCart);
      } else {
        setError(e.response?.data?.message || e.message || 'Erreur lors du chargement du panier.');
      }
    } finally {
      setLoading(false);
    }
  }, [handleResponse, user]);

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  const addItem = useCallback(
    async (productId, quantity = 1) => {
      if (!user) return;
      setLoading(true);
      try {
        const { data } = await api.post('/cart/items', { productId, quantity });
        handleResponse(data);
        setError('');
      } catch (e) {
        setError(e.response?.data?.message || e.message || 'Impossible d’ajouter l’article au panier.');
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [handleResponse, user]
  );

  const updateItem = useCallback(
    async (productId, quantity) => {
      if (!user) return;
      setLoading(true);
      try {
        if (quantity <= 0) {
          const { data } = await api.delete(`/cart/items/${productId}`);
          handleResponse(data);
        } else {
          const { data } = await api.put(`/cart/items/${productId}`, { quantity });
          handleResponse(data);
        }
        setError('');
      } catch (e) {
        setError(e.response?.data?.message || e.message || 'Impossible de mettre à jour le panier.');
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [handleResponse, user]
  );

  const removeItem = useCallback(
    async (productId) => {
      if (!user) return;
      setLoading(true);
      try {
        const { data } = await api.delete(`/cart/items/${productId}`);
        handleResponse(data);
        setError('');
      } catch (e) {
        setError(e.response?.data?.message || e.message || 'Impossible de retirer l’article.');
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [handleResponse, user]
  );

  const clearCart = useCallback(async () => {
    if (!user) {
      setCart(initialCart);
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.delete('/cart');
      handleResponse(data);
      setError('');
    } catch (e) {
      setError(e.response?.data?.message || e.message || 'Impossible de vider le panier.');
      throw e;
    } finally {
      setLoading(false);
    }
  }, [handleResponse, user]);

  const value = useMemo(
    () => ({
      cart,
      loading,
      error,
      addItem,
      updateItem,
      removeItem,
      clearCart,
      refresh: fetchCart
    }),
    [addItem, cart, clearCart, error, fetchCart, loading, removeItem, updateItem]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export default CartContext;
