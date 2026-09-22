import { captureMonitoring } from '../services/productMonitoring';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import api from '../services/api';
import AuthContext from './AuthContext';
import { useCountry } from './CountryContext';
import { readGuestCart, writeGuestCart, clearGuestCart, guestCartSelections } from '../utils/guestCart';
import {
  buildCartItemMutationKey,
  patchCartItemQuantity,
  recalculateCart,
  removeCartItem
} from '../utils/cartPricing';

const initialCart = {
  items: [],
  totals: { quantity: 0, subtotal: 0 },
  countryId: '',
  currency: '',
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
  const { country, loading: countryLoading } = useCountry();
  const countryId = String(country?.id || country?._id || '');
  const userId = String(user?._id || user?.id || '');
  const scope = `${userId}:${countryId}`;
  const scopeRef = useRef(scope);
  scopeRef.current = scope;
  const mergeRef = useRef(null);
  const guestQueue = useRef(Promise.resolve());
  const [cart, setCart] = useState(initialCart);
  const [loading, setLoading] = useState(true);
  const [loadedScope, setLoadedScope] = useState('');
  const [error, setError] = useState('');
  const mutationSeqRef = useRef(0);
  const latestItemMutationRef = useRef(new Map());
  const pendingRemovalPromisesRef = useRef(new Map());

  const handleResponse = useCallback((data) => {
    if (!data) {
      setCart(initialCart);
    } else {
      setCart(recalculateCart({
        items: data.items || [],
        totals: data.totals || { quantity: 0, subtotal: 0 },
        countryId: data.countryId || '',
        currency: data.currency || '',
        updatedAt: data.updatedAt || null
      }, { preservePricing: true }));
    }
  }, []);

  const ensureGuestMerged = useCallback(async () => {
    if (!userId) return;
    await guestQueue.current.catch(() => {});
    if (scopeRef.current !== scope) return;
    if (mergeRef.current?.scope === scope) return mergeRef.current.promise;
    const guest = readGuestCart(countryId);
    if (!guest.items?.length || !guest.mergeId) return;
    const promise = api.post('/cart/merge', { mergeId: guest.mergeId, items: guestCartSelections(guest) }, { headers: { 'x-country-id': countryId } })
      .then(({ data }) => {
        clearGuestCart(countryId, guest.mergeId);
        if (scopeRef.current === scope && data.rejected?.length) {
          setError(`${data.rejected.length} article(s) ne sont plus disponibles. Les autres ont été conservés.`);
        }
        return data;
      }).finally(() => { if (mergeRef.current?.promise === promise) mergeRef.current = null; });
    mergeRef.current = { scope, promise };
    return promise;
  }, [countryId, scope, userId]);

  const mutateGuest = useCallback((mutation) => {
    const operation = guestQueue.current.catch(() => {}).then(async () => {
      const current = readGuestCart(countryId);
      const next = await mutation(current);
      const saved = writeGuestCart(countryId, { ...next, countryId, currency: country?.currency?.code || 'XAF' });
      if (scopeRef.current === scope) handleResponse(saved);
      return saved;
    });
    guestQueue.current = operation;
    return operation;
  }, [countryId, country?.currency?.code, handleResponse, scope]);

  const fetchCart = useCallback(async () => {
    if (!countryId) {
      setLoading(false);
      setLoadedScope(scope);
      return;
    }
    if (!user) {
      const guest = readGuestCart(countryId);
      handleResponse(guest);
      setLoading(false);
      setLoadedScope(scope);
      setError('');
      if (guest.items.length) {
        try {
          const { data } = await api.post('/cart/preview', { items: guestCartSelections(guest) }, { headers: { 'x-country-id': countryId } });
          if (scopeRef.current !== scope || readGuestCart(countryId).mergeId !== guest.mergeId) return;
          handleResponse(writeGuestCart(countryId, { ...data, mergeId: guest.mergeId }, { changed: false }));
          if (data.rejected?.length) setError('Certains articles ne sont plus disponibles et ont été retirés du panier.');
        } catch { /* Keep the saved cart when offline; checkout revalidates on the server. */ }
      }
      return;
    }
    setLoading(true);
    try {
      setError('');
      const merged = await ensureGuestMerged();
      const { data } = merged ? { data: merged } : await api.get('/cart', { skipCache: true, headers: { 'x-country-id': countryId } });
      if (scopeRef.current === scope) handleResponse(data);
    } catch (e) {
      if (scopeRef.current !== scope) return;
      if (e.response?.status === 401) {
        setCart(initialCart);
      } else {
        setError(e.response?.data?.message || e.message || 'Erreur lors du chargement du panier.');
      }
    } finally {
      if (scopeRef.current === scope) { setLoading(false); setLoadedScope(scope); }
    }
  }, [countryId, ensureGuestMerged, handleResponse, scope, user]);

  useEffect(() => {
    setCart(initialCart);
    void fetchCart();
  }, [fetchCart]);

  const addItem = useCallback(
    async (productId, quantity = 1, selectedAttributes = []) => {
      if (!countryId) throw new Error('Choisissez votre pays avant d’ajouter un article.');
      if (!user) {
        setLoading(true);
        setError('');
        try {
          await mutateGuest(async (current) => {
            const items = [...guestCartSelections(current), { productId, quantity, selectedAttributes }];
            const { data } = await api.post('/cart/preview', { items }, { headers: { 'x-country-id': countryId } });
            if (data.rejected?.some((item) => item.productId === productId)) throw new Error('Ce produit ou cette option est indisponible.');
            return data;
          });
          captureMonitoring('cart_item_added', { quantity: Number(quantity) || 1 });
        } catch (e) {
          setError(e.response?.data?.message || e.message);
          throw e;
        } finally { setLoading(false); }
        return;
      }
      setLoading(true);
      try {
        await ensureGuestMerged();
        if (scopeRef.current !== scope) return;
        const { data } = await api.post('/cart/items', {
          productId,
          quantity,
          selectedAttributes
        });
        if (scopeRef.current === scope) handleResponse(data);
        captureMonitoring('cart_item_added', { quantity: Number(quantity) || 1 });
        setError('');
      } catch (e) {
        setError(e.response?.data?.message || e.message || 'Impossible d’ajouter l’article au panier.');
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [countryId, ensureGuestMerged, handleResponse, mutateGuest, scope, user]
  );

  const updateItem = useCallback(
    async (productId, quantity, selectedAttributes = [], selectionKey = '') => {
      if (!user) return mutateGuest(async (current) => {
        const next = patchCartItemQuantity(current, { productId, quantity, selectedAttributes, selectionKey });
        const { data } = await api.post('/cart/preview', { items: guestCartSelections(next) }, { headers: { 'x-country-id': countryId } });
        return data;
      });
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
            params: selectionKey ? { selectionKey } : undefined,
            data: { selectionKey, selectedAttributes },
            silentGlobalError: true
          });
          if (scopeRef.current === scope && latestItemMutationRef.current.get(mutationKey) === mutationSeq) {
            handleResponse(data);
          }
        } else {
          const { data } = await api.put(`/cart/items/${productId}`, {
            quantity,
            selectionKey,
            selectedAttributes
          });
          if (scopeRef.current === scope && latestItemMutationRef.current.get(mutationKey) === mutationSeq) {
            handleResponse(data);
          }
        }
        setError('');
      } catch (e) {
        if (quantity <= 0 && Number(e.response?.status || 0) === 404) {
          setError('');
          return;
        }
        if (scopeRef.current === scope && latestItemMutationRef.current.get(mutationKey) === mutationSeq) {
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
    [cart, countryId, handleResponse, mutateGuest, scope, user]
  );

  const removeItem = useCallback(
    (productId, selectedAttributes = [], selectionKey = '') => {
      if (!user) return updateItem(productId, 0, selectedAttributes, selectionKey);
      const mutationKey = buildCartItemMutationKey({ productId, selectionKey, selectedAttributes });
      const pendingRemoval = pendingRemovalPromisesRef.current.get(mutationKey);
      if (pendingRemoval) return pendingRemoval;

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

      const removalPromise = (async () => {
        try {
          const { data } = await api.delete(`/cart/items/${productId}`, {
            params: selectionKey ? { selectionKey } : undefined,
            data: { selectionKey, selectedAttributes },
            silentGlobalError: true
          });
          if (scopeRef.current === scope && latestItemMutationRef.current.get(mutationKey) === mutationSeq) {
            handleResponse(data);
          }
          setError('');
        } catch (e) {
          // Older API instances may still answer 404 after another identical
          // request succeeded. The desired end state is already achieved.
          if (Number(e.response?.status || 0) === 404) {
            setError('');
            return;
          }
          if (scopeRef.current === scope && latestItemMutationRef.current.get(mutationKey) === mutationSeq) {
            setCart(rollbackCart);
            setError(e.response?.data?.message || e.message || 'Impossible de retirer l’article.');
          }
          throw e;
        } finally {
          if (latestItemMutationRef.current.get(mutationKey) === mutationSeq) {
            latestItemMutationRef.current.delete(mutationKey);
          }
        }
      })();

      pendingRemovalPromisesRef.current.set(mutationKey, removalPromise);
      const clearPendingRemoval = () => {
        if (pendingRemovalPromisesRef.current.get(mutationKey) === removalPromise) {
          pendingRemovalPromisesRef.current.delete(mutationKey);
        }
      };
      void removalPromise.then(clearPendingRemoval, clearPendingRemoval);
      return removalPromise;
    },
    [cart, handleResponse, scope, updateItem, user]
  );

  const clearCart = useCallback(async () => {
    if (!user) {
      return mutateGuest(() => initialCart);
    }
    setLoading(true);
    try {
      const { data } = await api.delete('/cart');
      if (scopeRef.current === scope) handleResponse(data);
      setError('');
    } catch (e) {
      setError(e.response?.data?.message || e.message || 'Impossible de vider le panier.');
      throw e;
    } finally {
      setLoading(false);
    }
  }, [handleResponse, mutateGuest, scope, user]);

  const value = useMemo(
    () => ({
      cart: loadedScope === scope ? cart : initialCart,
      loading: loading || Boolean(countryLoading) || loadedScope !== scope,
      error,
      addItem,
      updateItem,
      removeItem,
      clearCart,
      refresh: fetchCart
    }),
    [addItem, cart, clearCart, error, fetchCart, loading, countryLoading, loadedScope, scope, removeItem, updateItem]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export default CartContext;
