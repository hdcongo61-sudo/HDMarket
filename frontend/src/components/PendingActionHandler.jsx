import React, { useContext, useEffect, useRef } from 'react';
import AuthContext from '../context/AuthContext';
import FavoriteContext from '../context/FavoriteContext';
import CartContext from '../context/CartContext';
import api from '../services/api';
import { getPendingAction, clearPendingAction } from '../utils/pendingAction';

/**
 * After login, run any pending action that was stored before redirect (e.g. add to favorites, add to cart, follow shop).
 */
export default function PendingActionHandler() {
  const { user, updateUser } = useContext(AuthContext);
  const { addFavorite } = useContext(FavoriteContext);
  const { addItem } = useContext(CartContext);
  const doneRef = useRef(false);

  useEffect(() => {
    if (!user?.token) {
      doneRef.current = false;
      return;
    }
    const action = getPendingAction();
    if (!action) return;
    if (doneRef.current) return;
    doneRef.current = true;

    (async () => {
      try {
        if (action.type === 'addFavorite' && action.payload?.product) {
          await addFavorite(action.payload.product);
        } else if (action.type === 'addToCart' && action.payload?.productId) {
          await addItem(action.payload.productId, action.payload.quantity ?? 1);
        } else if (action.type === 'followShop' && action.payload?.shopId) {
          await api.post(`/users/shops/${action.payload.shopId}/follow`);
          if (typeof updateUser === 'function') {
            const shopId = String(action.payload.shopId);
            const current = (user?.followingShops || []).map(String);
            updateUser({
              followingShops: Array.from(new Set([...current, shopId]))
            });
          }
        }
      } catch (e) {
        console.warn('Pending action failed:', e);
      } finally {
        clearPendingAction();
      }
    })();
  }, [user?.token, user?.followingShops, addFavorite, addItem, updateUser]);

  return null;
}
