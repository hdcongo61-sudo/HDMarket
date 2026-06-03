import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import api from '../services/api';
import AuthContext from './AuthContext';
import {
  buildCartItemMutationKey,
  patchCartItemQuantity,
  recalculateCart,
  removeCartItem
} from '../utils/cartPricing';

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
  const mutationSeqRef = useRef(0);
  const latestItemMutationRef = useRef(new Map());

  const handleResponse = useCallback((data) => {
    if (!data) {
      setCart(initialCart);
    } else {
      setCart(recalculateCart({
        items: data.items || [],
        totals: data.totals || { quantity: 0, subtotal: 0 },
        updatedAt: data.updatedAt || null
      }));
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
    const timer = setTimeout(() => {
      fetchCart();
    }, user ? 700 : 0);
    return () => clearTimeout(timer);
  }, [fetchCart]);

  const addItem = useCallback(
    async (productId, quantity = 1, selectedAttributes = []) => {
      if (!user) return;
      setLoading(true);
      try {
        const { data } = await api.post('/cart/items', {
          productId,
          quantity,
          selectedAttributes
        });
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
    async (productId, quantity, selectedAttributes = [], selectionKey = '') => {
      if (!user) return;
      const mutationKey = buildCartItemMutationKey({ productId, selectionKey, selectedAttributes });
      const mutationSeq = mutationSeqRef.current + 1;
      mutationSeqRef.current = mutationSeq;
      latestItemMutationRef.current.set(mutationKey, mutationSeq);
      const rollbackCart = cart;
      setCart((current) =>
        patchCartItemQuantity(current, {
          productId,
          quantity,
          selectionKey,
          selectedAttributes
        })
      );
      setError('');
      try {
        if (quantity <= 0) {
          const { data } = await api.delete(`/cart/items/${productId}`, {
            data: { selectionKey, selectedAttributes }
          });
          if (latestItemMutationRef.current.get(mutationKey) === mutationSeq) {
            handleResponse(data);
          }
        } else {
          const { data } = await api.put(`/cart/items/${productId}`, {
            quantity,
            selectionKey,
            selectedAttributes
          });
          if (latestItemMutationRef.current.get(mutationKey) === mutationSeq) {
            handleResponse(data);
          }
        }
        setError('');
      } catch (e) {
        if (latestItemMutationRef.current.get(mutationKey) === mutationSeq) {
          setCart(rollbackCart);
          setError(e.response?.data?.message || e.message || 'Impossible de mettre à jour le panier.');
        }
        throw e;
      } finally {
        if (latestItemMutationRef.current.get(mutationKey) === mutationSeq) {
          latestItemMutationRef.current.delete(mutationKey);
        }
      }
    },
    [cart, handleResponse, user]
  );

  const removeItem = useCallback(
    async (productId, selectedAttributes = [], selectionKey = '') => {
      if (!user) return;
      const mutationKey = buildCartItemMutationKey({ productId, selectionKey, selectedAttributes });
      const mutationSeq = mutationSeqRef.current + 1;
      mutationSeqRef.current = mutationSeq;
      latestItemMutationRef.current.set(mutationKey, mutationSeq);
      const rollbackCart = cart;
      const itemToRemove = (cart.items || []).find(
        (item) => buildCartItemMutationKey({
          productId: item?.product?._id || item?.product,
          selectionKey: item?.selectionKey || '',
          selectedAttributes: item?.selectedAttributes || []
        }) === mutationKey
      );
      if (itemToRemove) {
        setCart((current) => removeCartItem(current, itemToRemove));
      }
      setError('');
      try {
        const { data } = await api.delete(`/cart/items/${productId}`, {
          data: { selectionKey, selectedAttributes }
        });
        if (latestItemMutationRef.current.get(mutationKey) === mutationSeq) {
          handleResponse(data);
        }
        setError('');
      } catch (e) {
        if (latestItemMutationRef.current.get(mutationKey) === mutationSeq) {
          setCart(rollbackCart);
          setError(e.response?.data?.message || e.message || 'Impossible de retirer l’article.');
        }
        throw e;
      } finally {
        if (latestItemMutationRef.current.get(mutationKey) === mutationSeq) {
          latestItemMutationRef.current.delete(mutationKey);
        }
      }
    },
    [cart, handleResponse, user]
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
