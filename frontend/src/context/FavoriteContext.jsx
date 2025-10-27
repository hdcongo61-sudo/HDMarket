import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react';
import api from '../services/api';
import AuthContext from './AuthContext';

const FavoriteContext = createContext({
  favorites: [],
  loading: false,
  refreshFavorites: () => Promise.resolve(),
  addFavorite: () => Promise.resolve(),
  removeFavorite: () => Promise.resolve(),
  toggleFavorite: () => Promise.resolve(),
  isFavorite: () => false
});

export const FavoriteProvider = ({ children }) => {
  const { user } = useContext(AuthContext);
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchFavorites = useCallback(async () => {
    if (!user?.token) {
      setFavorites([]);
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.get('/users/favorites');
      setFavorites(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Impossible de récupérer les favoris.', error);
    } finally {
      setLoading(false);
    }
  }, [user?.token]);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  useEffect(() => {
    if (!user?.token) {
      setFavorites([]);
      setLoading(false);
    }
  }, [user?.token]);

  const isFavorite = useCallback(
    (productId) => favorites.some((item) => item._id === productId),
    [favorites]
  );

  const addFavorite = useCallback(
    async (product) => {
      if (!user?.token || !product?._id) {
        throw new Error('Authentification requise');
      }
      await api.post('/users/favorites', { productId: product._id });
      setFavorites((prev) => {
        if (prev.some((item) => item._id === product._id)) return prev;
        return [{ ...product }, ...prev];
      });
      return true;
    },
    [user?.token]
  );

  const removeFavorite = useCallback(
    async (productId) => {
      if (!user?.token || !productId) {
        throw new Error('Authentification requise');
      }
      await api.delete(`/users/favorites/${productId}`);
      setFavorites((prev) => prev.filter((item) => item._id !== productId));
      return true;
    },
    [user?.token]
  );

  const toggleFavorite = useCallback(
    async (product) => {
      if (!product?._id) return null;
      if (isFavorite(product._id)) {
        await removeFavorite(product._id);
        return false;
      }
      await addFavorite(product);
      return true;
    },
    [isFavorite, addFavorite, removeFavorite]
  );

  const value = useMemo(
    () => ({
      favorites,
      loading,
      refreshFavorites: fetchFavorites,
      addFavorite,
      removeFavorite,
      toggleFavorite,
      isFavorite
    }),
    [favorites, loading, fetchFavorites, addFavorite, removeFavorite, toggleFavorite, isFavorite]
  );

  return (
    <FavoriteContext.Provider value={value}>{children}</FavoriteContext.Provider>
  );
};

export default FavoriteContext;
