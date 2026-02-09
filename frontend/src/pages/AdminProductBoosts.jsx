import React, { useCallback, useEffect, useState, useContext, useMemo } from 'react';
import {
  Sparkles,
  Search,
  TrendingUp,
  Package,
  Users,
  BarChart3,
  Zap,
  Calendar,
  Tag,
  Star,
  ShoppingCart,
  Heart,
  ChevronRight,
  X,
  Check,
  Loader2,
  AlertCircle,
  UserPlus,
  UserMinus,
  Store,
  MapPin
} from 'lucide-react';
import api from '../services/api';
import AuthContext from '../context/AuthContext';

const PAGE_SIZE = 12;

export default function AdminProductBoosts() {
  const { user } = useContext(AuthContext);
  const [boostedProducts, setBoostedProducts] = useState([]);
  const [nonBoostedProducts, setNonBoostedProducts] = useState([]);
  const [boostedLoading, setBoostedLoading] = useState(false);
  const [nonBoostedLoading, setNonBoostedLoading] = useState(false);
  const [boostedError, setBoostedError] = useState('');
  const [nonBoostedError, setNonBoostedError] = useState('');
  const [boostedPage, setBoostedPage] = useState(1);
  const [nonBoostedPage, setNonBoostedPage] = useState(1);
  const [boostedTotalPages, setBoostedTotalPages] = useState(1);
  const [nonBoostedTotalPages, setNonBoostedTotalPages] = useState(1);
  const [savingId, setSavingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [boostManagers, setBoostManagers] = useState([]);
  const [managersLoading, setManagersLoading] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [showUserManager, setShowUserManager] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [productDateRanges, setProductDateRanges] = useState({});
  // Shop boost state
  const [boostedShops, setBoostedShops] = useState([]);
  const [nonBoostedShops, setNonBoostedShops] = useState([]);
  const [boostedShopsLoading, setBoostedShopsLoading] = useState(false);
  const [nonBoostedShopsLoading, setNonBoostedShopsLoading] = useState(false);
  const [boostedShopsError, setBoostedShopsError] = useState('');
  const [nonBoostedShopsError, setNonBoostedShopsError] = useState('');
  const [boostedShopsPage, setBoostedShopsPage] = useState(1);
  const [nonBoostedShopsPage, setNonBoostedShopsPage] = useState(1);
  const [boostedShopsTotalPages, setBoostedShopsTotalPages] = useState(1);
  const [nonBoostedShopsTotalPages, setNonBoostedShopsTotalPages] = useState(1);
  const [savingShopId, setSavingShopId] = useState(null);
  const [shopSearchTerm, setShopSearchTerm] = useState('');
  const [shopStats, setShopStats] = useState(null);
  const [shopStatsLoading, setShopStatsLoading] = useState(true);
  const [shopDateRanges, setShopDateRanges] = useState({});
  // Filter states
  const [productFilter, setProductFilter] = useState('all'); // 'all', 'boosted', 'non-boosted'
  const [shopFilter, setShopFilter] = useState('all'); // 'all', 'boosted', 'non-boosted'

  const isAdmin = user?.role === 'admin';

  const handleSearchTermChange = (event) => {
    setSearchTerm(event.target.value);
    setBoostedPage(1);
    setNonBoostedPage(1);
  };

  const handleShopSearchTermChange = (event) => {
    setShopSearchTerm(event.target.value);
    setBoostedShopsPage(1);
    setNonBoostedShopsPage(1);
  };

  const fetchStatistics = useCallback(async () => {
    setStatsLoading(true);
    try {
      const { data } = await api.get('/admin/products/boosts/stats');
      setStats(data);
    } catch (err) {
      console.error('Stats load error', err);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const fetchShopStatistics = useCallback(async () => {
    setShopStatsLoading(true);
    try {
      const { data } = await api.get('/admin/shops/boosts/stats');
      setShopStats(data);
    } catch (err) {
      console.error('Shop stats load error', err);
    } finally {
      setShopStatsLoading(false);
    }
  }, []);

  const fetchBoostManagers = useCallback(async () => {
    if (!isAdmin) return;
    setManagersLoading(true);
    try {
      const { data } = await api.get('/admin/boost-managers');
      setBoostManagers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Boost managers load error', err);
    } finally {
      setManagersLoading(false);
    }
  }, [isAdmin]);

  const fetchUsers = useCallback(async (query = '') => {
    if (!isAdmin) return;
    setUsersLoading(true);
    try {
      const { data } = await api.get('/admin/users', {
        params: { q: query, limit: 50 }
      });
      const users = Array.isArray(data) ? data : data?.items || [];
      setAllUsers(users);
    } catch (err) {
      console.error('Users load error', err);
    } finally {
      setUsersLoading(false);
    }
  }, [isAdmin]);

  const fetchProductsSection = useCallback(
    async ({
      boostedFilter,
      pageNumber,
      searchQuery,
      setItems,
      setTotalPages,
      setLoading,
      setError
    }) => {
      setLoading(true);
      setError('');
      try {
        const { data } = await api.get('/admin/products/boosts', {
          params: {
            q: searchQuery,
            page: pageNumber,
            limit: PAGE_SIZE,
            boosted: boostedFilter
          }
        });
        setItems(Array.isArray(data?.items) ? data.items : []);
        setTotalPages(data?.pagination?.pages || 1);
      } catch (err) {
        console.error('Boosts load error', err);
        setItems([]);
        setTotalPages(1);
        setError(
          boostedFilter
            ? 'Impossible de charger les produits boostés.'
            : 'Impossible de charger les produits à booster.'
        );
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const fetchShopsSection = useCallback(
    async ({
      boostedFilter,
      pageNumber,
      searchQuery,
      setItems,
      setTotalPages,
      setLoading,
      setError
    }) => {
      setLoading(true);
      setError('');
      try {
        const { data } = await api.get('/admin/shops/boosts', {
          params: {
            q: searchQuery,
            page: pageNumber,
            limit: PAGE_SIZE,
            boosted: boostedFilter
          }
        });
        setItems(Array.isArray(data?.items) ? data.items : []);
        setTotalPages(data?.pagination?.pages || 1);
      } catch (err) {
        console.error('Shop boosts load error', err);
        setItems([]);
        setTotalPages(1);
        setError(
          boostedFilter
            ? 'Impossible de charger les boutiques boostées.'
            : 'Impossible de charger les boutiques à booster.'
        );
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchStatistics();
    fetchShopStatistics();
    fetchBoostManagers();
    const interval = setInterval(() => {
      fetchStatistics();
      fetchShopStatistics();
    }, 60000); // Refresh stats every minute
    return () => clearInterval(interval);
  }, [fetchStatistics, fetchShopStatistics, fetchBoostManagers]);

  useEffect(() => {
    fetchProductsSection({
      boostedFilter: true,
      pageNumber: boostedPage,
      searchQuery: searchTerm,
      setItems: setBoostedProducts,
      setTotalPages: setBoostedTotalPages,
      setLoading: setBoostedLoading,
      setError: setBoostedError
    });
  }, [searchTerm, boostedPage, fetchProductsSection]);

  useEffect(() => {
    fetchProductsSection({
      boostedFilter: false,
      pageNumber: nonBoostedPage,
      searchQuery: searchTerm,
      setItems: setNonBoostedProducts,
      setTotalPages: setNonBoostedTotalPages,
      setLoading: setNonBoostedLoading,
      setError: setNonBoostedError
    });
  }, [searchTerm, nonBoostedPage, fetchProductsSection]);

  useEffect(() => {
    fetchShopsSection({
      boostedFilter: true,
      pageNumber: boostedShopsPage,
      searchQuery: shopSearchTerm,
      setItems: setBoostedShops,
      setTotalPages: setBoostedShopsTotalPages,
      setLoading: setBoostedShopsLoading,
      setError: setBoostedShopsError
    });
  }, [shopSearchTerm, boostedShopsPage, fetchShopsSection]);

  useEffect(() => {
    fetchShopsSection({
      boostedFilter: false,
      pageNumber: nonBoostedShopsPage,
      searchQuery: shopSearchTerm,
      setItems: setNonBoostedShops,
      setTotalPages: setNonBoostedShopsTotalPages,
      setLoading: setNonBoostedShopsLoading,
      setError: setNonBoostedShopsError
    });
  }, [shopSearchTerm, nonBoostedShopsPage, fetchShopsSection]);

  useEffect(() => {
    // Only fetch users when search query has at least 2 characters
    if (showUserManager && userSearchQuery.length >= 2) {
      fetchUsers(userSearchQuery);
    } else if (showUserManager && userSearchQuery.length === 0) {
      setAllUsers([]);
    }
  }, [showUserManager, userSearchQuery, fetchUsers]);

  const handleDateRangeChange = (productId, field, value) => {
    setProductDateRanges((prev) => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        [field]: value
      }
    }));
  };

  const handleShopDateRangeChange = (shopId, field, value) => {
    setShopDateRanges((prev) => ({
      ...prev,
      [shopId]: {
        ...prev[shopId],
        [field]: value
      }
    }));
  };

  const handleToggle = async (id) => {
    setSavingId(id);
    try {
      const dateRange = productDateRanges[id] || {};
      const payload = {};
      
      if (dateRange.boostStartDate) {
        payload.boostStartDate = dateRange.boostStartDate;
      }
      if (dateRange.boostEndDate) {
        payload.boostEndDate = dateRange.boostEndDate;
      }

      await api.patch(`/admin/products/${id}/boost`, payload);
      
      // Clear date range for this product after successful boost
      setProductDateRanges((prev) => {
        const updated = { ...prev };
        delete updated[id];
        return updated;
      });

      await Promise.all([
        fetchProductsSection({
          boostedFilter: true,
          pageNumber: boostedPage,
          searchQuery: searchTerm,
          setItems: setBoostedProducts,
          setTotalPages: setBoostedTotalPages,
          setLoading: setBoostedLoading,
          setError: setBoostedError
        }),
        fetchProductsSection({
          boostedFilter: false,
          pageNumber: nonBoostedPage,
          searchQuery: searchTerm,
          setItems: setNonBoostedProducts,
          setTotalPages: setNonBoostedTotalPages,
          setLoading: setNonBoostedLoading,
          setError: setNonBoostedError
        }),
        fetchStatistics()
      ]);
    } catch (err) {
      console.error('Toggle boost error', err);
      const message = err.response?.data?.message || 'Impossible de modifier le boost.';
      setBoostedError(message);
      setNonBoostedError(message);
    } finally {
      setSavingId(null);
    }
  };

  const handleToggleShopBoost = async (id) => {
    setSavingShopId(id);
    try {
      const dateRange = shopDateRanges[id] || {};
      const payload = {};
      
      if (dateRange.shopBoostStartDate) {
        payload.shopBoostStartDate = dateRange.shopBoostStartDate;
      }
      if (dateRange.shopBoostEndDate) {
        payload.shopBoostEndDate = dateRange.shopBoostEndDate;
      }

      await api.patch(`/admin/shops/${id}/boost`, payload);
      
      // Clear date range for this shop after successful boost
      setShopDateRanges((prev) => {
        const updated = { ...prev };
        delete updated[id];
        return updated;
      });

      await Promise.all([
        fetchShopsSection({
          boostedFilter: true,
          pageNumber: boostedShopsPage,
          searchQuery: shopSearchTerm,
          setItems: setBoostedShops,
          setTotalPages: setBoostedShopsTotalPages,
          setLoading: setBoostedShopsLoading,
          setError: setBoostedShopsError
        }),
        fetchShopsSection({
          boostedFilter: false,
          pageNumber: nonBoostedShopsPage,
          searchQuery: shopSearchTerm,
          setItems: setNonBoostedShops,
          setTotalPages: setNonBoostedShopsTotalPages,
          setLoading: setNonBoostedShopsLoading,
          setError: setNonBoostedShopsError
        }),
        fetchShopStatistics()
      ]);
    } catch (err) {
      console.error('Toggle shop boost error', err);
      const message = err.response?.data?.message || 'Impossible de modifier le boost.';
      setBoostedShopsError(message);
      setNonBoostedShopsError(message);
    } finally {
      setSavingShopId(null);
    }
  };

  const handleToggleBoostManager = async (userId) => {
    try {
      await api.patch(`/admin/boost-managers/${userId}/toggle`);
      await Promise.all([fetchBoostManagers(), fetchUsers(userSearchQuery)]);
    } catch (err) {
      console.error('Toggle boost manager error', err);
      alert(err.response?.data?.message || 'Erreur lors de la modification de la permission.');
    }
  };

  const renderPaginationButtons = (groupId, currentPage, total, onPageChange) => {
    if (total <= 1) return null;
    const buttons = [];
    const maxVisible = 7;
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(total, start + maxVisible - 1);
    if (end - start < maxVisible - 1) {
      start = Math.max(1, end - maxVisible + 1);
    }

    if (start > 1) {
      buttons.push(
        <button
          key={`${groupId}-1`}
          type="button"
          onClick={() => onPageChange(1)}
          className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        >
          1
        </button>
      );
      if (start > 2) {
        buttons.push(
          <span key={`${groupId}-ellipsis-start`} className="px-2 text-gray-500">
            ...
          </span>
        );
      }
    }

    for (let i = start; i <= end; i++) {
      buttons.push(
        <button
          key={`${groupId}-${i}`}
          type="button"
          onClick={() => onPageChange(i)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            currentPage === i
              ? 'bg-indigo-600 text-white shadow-md'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          {i}
        </button>
      );
    }

    if (end < total) {
      if (end < total - 1) {
        buttons.push(
          <span key={`${groupId}-ellipsis-end`} className="px-2 text-gray-500">
            ...
          </span>
        );
      }
      buttons.push(
        <button
          key={`${groupId}-${total}`}
          type="button"
          onClick={() => onPageChange(total)}
          className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        >
          {total}
        </button>
      );
    }

    return buttons;
  };

  const renderProductCard = (product) => {
    const imageUrl =
      product.images?.[0] ||
      product.image ||
      "https://via.placeholder.com/400x400?text=HDMarket";
    const descriptionExcerpt = product.description
      ? `${product.description.slice(0, 100)}...`
      : 'Aucune description disponible.';
    const priceValue = Number(product.price);
    const priceLabel = Number.isFinite(priceValue) ? priceValue.toLocaleString('fr-FR') : '-';
    const createdDate = product.createdAt
      ? new Date(product.createdAt).toLocaleDateString('fr-FR')
      : '-';

    return (
      <article
        key={product._id}
        className="group rounded-2xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm hover:shadow-lg hover:border-indigo-300 dark:hover:border-indigo-600 transition-all duration-300"
      >
        <div className="mb-4 h-48 overflow-hidden rounded-xl bg-gray-100 dark:bg-gray-700">
          <img
            src={imageUrl}
            alt={product.title}
            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        </div>
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Tag className="h-3.5 w-3.5 text-indigo-500 flex-shrink-0" />
                <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400 truncate">
                  {product.category}
                </p>
              </div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white line-clamp-2">
                {product.title}
              </h2>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-lg font-black text-indigo-600 dark:text-indigo-400">
                {priceLabel} FCFA
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{createdDate}</p>
            </div>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
            {descriptionExcerpt}
          </p>
          <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
            <div className="flex items-center gap-1">
              <Heart className="h-3.5 w-3.5" />
              <span>{product.favoritesCount || 0}</span>
            </div>
            <div className="flex items-center gap-1">
              <ShoppingCart className="h-3.5 w-3.5" />
              <span>{product.salesCount || 0}</span>
            </div>
            {product.user?.shopName && (
              <div className="flex items-center gap-1">
                <span className="truncate max-w-[100px]">{product.user.shopName}</span>
              </div>
            )}
          </div>
          {!product.boosted && (
            <div className="space-y-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-4 w-4 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Période de boost (optionnel)</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Date de début</label>
                  <input
                    type="date"
                    value={productDateRanges[product._id]?.boostStartDate || ''}
                    onChange={(e) => handleDateRangeChange(product._id, 'boostStartDate', e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Date de fin</label>
                  <input
                    type="date"
                    value={productDateRanges[product._id]?.boostEndDate || ''}
                    onChange={(e) => handleDateRangeChange(product._id, 'boostEndDate', e.target.value)}
                    min={productDateRanges[product._id]?.boostStartDate || new Date().toISOString().split('T')[0]}
                    className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Laissez vide pour un boost permanent
              </p>
            </div>
          )}
          {product.boosted && (product.boostStartDate || product.boostEndDate) && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800">
              <Calendar className="h-4 w-4 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
              <div className="flex-1 text-xs text-indigo-700 dark:text-indigo-300">
                {product.boostStartDate && product.boostEndDate ? (
                  <span>
                    Du {new Date(product.boostStartDate).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric'
                    })} au {new Date(product.boostEndDate).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </span>
                ) : product.boostStartDate ? (
                  <span>
                    À partir du {new Date(product.boostStartDate).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </span>
                ) : product.boostEndDate ? (
                  <span>
                    Jusqu'au {new Date(product.boostEndDate).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </span>
                ) : null}
              </div>
            </div>
          )}
          <button
            onClick={() => handleToggle(product._id)}
            disabled={savingId === product._id}
            className={`w-full rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${
              product.boosted
                ? 'bg-red-500 hover:bg-red-600 text-white shadow-md hover:shadow-lg'
                : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-md hover:shadow-lg'
            } disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
          >
            {savingId === product._id ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Chargement...</span>
              </>
            ) : product.boosted ? (
              <>
                <X className="h-4 w-4" />
                <span>Retirer le boost</span>
              </>
            ) : (
              <>
                <Zap className="h-4 w-4" />
                <span>Booster ce produit</span>
              </>
            )}
          </button>
        </div>
      </article>
    );
  };

  const renderShopCard = (shop) => {
    const logoUrl = shop.shopLogo || "https://via.placeholder.com/200x200?text=HDMarket";
    const createdDate = shop.createdAt
      ? new Date(shop.createdAt).toLocaleDateString('fr-FR')
      : '-';

    return (
      <article
        key={shop._id}
        className="group rounded-2xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm hover:shadow-lg hover:border-indigo-300 dark:hover:border-indigo-600 transition-all duration-300"
      >
        <div className="mb-4 h-48 overflow-hidden rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
          <img
            src={logoUrl}
            alt={shop.shopName || shop.name}
            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        </div>
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Store className="h-3.5 w-3.5 text-indigo-500 flex-shrink-0" />
                <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400 truncate">
                  Boutique vérifiée
                </p>
              </div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white line-clamp-2">
                {shop.shopName || shop.name}
              </h2>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-xs text-gray-500 dark:text-gray-400">{createdDate}</p>
            </div>
          </div>
          {shop.shopAddress && (
            <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
              <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="line-clamp-1">{shop.shopAddress}</span>
            </div>
          )}
          <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
            <div className="flex items-center gap-1">
              <Heart className="h-3.5 w-3.5" />
              <span>{shop.followersCount || 0}</span>
            </div>
            <div className="flex items-center gap-1">
              <ShoppingCart className="h-3.5 w-3.5" />
              <span>{shop.productCount || 0}</span>
            </div>
            {shop.ratingAverage > 0 && (
              <div className="flex items-center gap-1">
                <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
                <span>{Number(shop.ratingAverage).toFixed(1)}</span>
                {shop.ratingCount > 0 && (
                  <span className="text-gray-400">({shop.ratingCount})</span>
                )}
              </div>
            )}
          </div>
          {!isShopCurrentlyBoosted(shop) && (
            <div className="space-y-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-4 w-4 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Période de boost (optionnel)</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Date de début</label>
                  <input
                    type="date"
                    value={shopDateRanges[shop._id]?.shopBoostStartDate || ''}
                    onChange={(e) => handleShopDateRangeChange(shop._id, 'shopBoostStartDate', e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Date de fin</label>
                  <input
                    type="date"
                    value={shopDateRanges[shop._id]?.shopBoostEndDate || ''}
                    onChange={(e) => handleShopDateRangeChange(shop._id, 'shopBoostEndDate', e.target.value)}
                    min={shopDateRanges[shop._id]?.shopBoostStartDate || new Date().toISOString().split('T')[0]}
                    className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Laissez vide pour un boost permanent
              </p>
            </div>
          )}
          {isShopCurrentlyBoosted(shop) && (shop.shopBoostStartDate || shop.shopBoostEndDate) && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800">
              <Calendar className="h-4 w-4 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
              <div className="flex-1 text-xs text-indigo-700 dark:text-indigo-300">
                {shop.shopBoostStartDate && shop.shopBoostEndDate ? (
                  <span>
                    Du {new Date(shop.shopBoostStartDate).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric'
                    })} au {new Date(shop.shopBoostEndDate).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </span>
                ) : shop.shopBoostStartDate ? (
                  <span>
                    À partir du {new Date(shop.shopBoostStartDate).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </span>
                ) : shop.shopBoostEndDate ? (
                  <span>
                    Jusqu'au {new Date(shop.shopBoostEndDate).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </span>
                ) : null}
              </div>
            </div>
          )}
          <button
            onClick={() => handleToggleShopBoost(shop._id)}
            disabled={savingShopId === shop._id}
            className={`w-full rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${
              isShopCurrentlyBoosted(shop)
                ? 'bg-red-500 hover:bg-red-600 text-white shadow-md hover:shadow-lg'
                : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-md hover:shadow-lg'
            } disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
          >
            {savingShopId === shop._id ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Chargement...</span>
              </>
            ) : isShopCurrentlyBoosted(shop) ? (
              <>
                <X className="h-4 w-4" />
                <span>Retirer le boost</span>
              </>
            ) : (
              <>
                <Zap className="h-4 w-4" />
                <span>Booster cette boutique</span>
              </>
            )}
          </button>
        </div>
      </article>
    );
  };

  // Combine and filter products client-side
  const allProducts = useMemo(() => {
    return [...boostedProducts, ...nonBoostedProducts];
  }, [boostedProducts, nonBoostedProducts]);

  const filteredProducts = useMemo(() => {
    if (productFilter === 'all') return allProducts;
    if (productFilter === 'boosted') return allProducts.filter(p => p.boosted);
    if (productFilter === 'non-boosted') return allProducts.filter(p => !p.boosted);
    return allProducts;
  }, [allProducts, productFilter]);

  // Helper function to check if a shop is currently boosted based on date range
  const isShopCurrentlyBoosted = useCallback((shop) => {
    if (!shop.shopBoosted) return false;
    
    const now = new Date();
    const hasStartDate = shop.shopBoostStartDate !== null && shop.shopBoostStartDate !== undefined;
    const hasEndDate = shop.shopBoostEndDate !== null && shop.shopBoostEndDate !== undefined;
    
    // If no dates are set, consider it always boosted (backward compatibility)
    if (!hasStartDate && !hasEndDate) {
      return true;
    }
    
    // Check if current date is within the boost range
    if (hasStartDate && now < new Date(shop.shopBoostStartDate)) {
      return false; // Boost hasn't started yet
    }
    
    if (hasEndDate && now > new Date(shop.shopBoostEndDate)) {
      return false; // Boost has ended
    }
    
    return true;
  }, []);

  // Combine and filter shops client-side
  const allShops = useMemo(() => {
    return [...boostedShops, ...nonBoostedShops];
  }, [boostedShops, nonBoostedShops]);

  const filteredShops = useMemo(() => {
    if (shopFilter === 'all') return allShops;
    if (shopFilter === 'boosted') return allShops.filter(s => isShopCurrentlyBoosted(s));
    if (shopFilter === 'non-boosted') return allShops.filter(s => !isShopCurrentlyBoosted(s));
    return allShops;
  }, [allShops, shopFilter, isShopCurrentlyBoosted]);

  const boostedPagination = renderPaginationButtons(
    'boosted',
    boostedPage,
    boostedTotalPages,
    setBoostedPage
  );
  const nonBoostedPagination = renderPaginationButtons(
    'non-boosted',
    nonBoostedPage,
    nonBoostedTotalPages,
    setNonBoostedPage
  );
  const boostedShopsPagination = renderPaginationButtons(
    'boosted-shops',
    boostedShopsPage,
    boostedShopsTotalPages,
    setBoostedShopsPage
  );
  const nonBoostedShopsPagination = renderPaginationButtons(
    'non-boosted-shops',
    nonBoostedShopsPage,
    nonBoostedShopsTotalPages,
    setNonBoostedShopsPage
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg">
            <Sparkles className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-gray-900 dark:text-white">Gestion des Boosts</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Promouvez vos produits et augmentez leur visibilité
            </p>
          </div>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setShowUserManager(!showUserManager)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-md hover:shadow-lg transition-all"
          >
            <Users className="h-5 w-5" />
            <span>Gérer les permissions</span>
          </button>
        )}
      </header>

      {/* Statistics Dashboard */}
      {statsLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="rounded-2xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 animate-pulse"
            >
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-3" />
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-16" />
            </div>
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-2xl border-2 border-indigo-200 dark:border-indigo-800 bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900/20 dark:to-indigo-800/20 p-6 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-xl bg-indigo-500 text-white">
                <Zap className="h-5 w-5" />
              </div>
              <TrendingUp className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-300 mb-1">
              Produits boostés
            </p>
            <p className="text-3xl font-black text-indigo-900 dark:text-indigo-100">
              {stats.totalBoosted || 0}
            </p>
            <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-2">
              Sur {stats.totalProducts || 0} produits
            </p>
          </div>

          <div className="rounded-2xl border-2 border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 p-6 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-xl bg-purple-500 text-white">
                <Package className="h-5 w-5" />
              </div>
              <BarChart3 className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <p className="text-sm font-semibold text-purple-700 dark:text-purple-300 mb-1">
              Non boostés
            </p>
            <p className="text-3xl font-black text-purple-900 dark:text-purple-100">
              {stats.totalNonBoosted || 0}
            </p>
            <p className="text-xs text-purple-600 dark:text-purple-400 mt-2">
              Disponibles pour boost
            </p>
          </div>

          <div className="rounded-2xl border-2 border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 p-6 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-xl bg-emerald-500 text-white">
                <Calendar className="h-5 w-5" />
              </div>
              <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300 mb-1">
              Boostés ce mois
            </p>
            <p className="text-3xl font-black text-emerald-900 dark:text-emerald-100">
              {stats.boostedThisMonth || 0}
            </p>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2">
              {stats.boostedThisWeek || 0} cette semaine
            </p>
          </div>

          <div className="rounded-2xl border-2 border-amber-200 dark:border-amber-800 bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 p-6 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-xl bg-amber-500 text-white">
                <Users className="h-5 w-5" />
              </div>
              <ChevronRight className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-300 mb-1">
              Gestionnaires
            </p>
            <p className="text-3xl font-black text-amber-900 dark:text-amber-100">
              {boostManagers.length}
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
              Utilisateurs autorisés
            </p>
          </div>
        </div>
      ) : null}

      {/* Category Statistics */}
      {stats?.boostedByCategory && stats.boostedByCategory.length > 0 && (
        <div className="rounded-2xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-lg">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Tag className="h-5 w-5 text-indigo-600" />
            Top catégories boostées
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {stats.boostedByCategory.map((cat, idx) => (
              <div
                key={cat._id || idx}
                className="p-4 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 border border-gray-200 dark:border-gray-600"
              >
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 truncate">
                  {cat._id || 'Non catégorisé'}
                </p>
                <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                  {cat.count}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* User Management Section */}
      {isAdmin && showUserManager && (
        <div className="rounded-2xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Users className="h-5 w-5 text-indigo-600" />
              Gestionnaires de boosts
            </h2>
            <button
              type="button"
              onClick={() => setShowUserManager(false)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                placeholder="Rechercher un utilisateur..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900 transition-all"
              />
            </div>
          </div>

          {/* Current Managers */}
          {boostManagers.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                Gestionnaires actuels ({boostManagers.length})
              </h3>
              <div className="space-y-2">
                {boostManagers.map((manager) => (
                  <div
                    key={manager._id}
                    className="flex items-center justify-between p-3 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-indigo-500 text-white">
                        <Users className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {manager.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{manager.email}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleBoostManager(manager._id)}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors"
                    >
                      <UserMinus className="h-4 w-4" />
                      <span>Retirer</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* All Users */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Tous les utilisateurs
            </h3>
            {usersLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {allUsers
                  .filter(
                    (u) =>
                      !u.isBlocked &&
                      u.role !== 'admin' &&
                      !boostManagers.some((m) => m._id === u._id || m._id === u.id)
                  )
                  .map((userItem) => (
                    <div
                      key={userItem._id || userItem.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-gray-200 dark:bg-gray-700">
                          <Users className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white">
                            {userItem.name}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {userItem.email} • {userItem.role}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleBoostManager(userItem._id || userItem.id)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors"
                      >
                        <UserPlus className="h-4 w-4" />
                        <span>Ajouter</span>
                      </button>
                    </div>
                  ))}
                {allUsers.filter(
                  (u) =>
                    !u.isBlocked &&
                    u.role !== 'admin' &&
                    !boostManagers.some((m) => m._id === u._id || m._id === u.id)
                ).length === 0 && (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    Aucun utilisateur disponible
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Search Bar and Filter */}
      <div className="flex flex-col gap-3 rounded-2xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/20">
            <Search className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <input
            value={searchTerm}
            onChange={handleSearchTermChange}
            placeholder="Rechercher par titre, catégorie ou vendeur..."
            className="flex-1 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900 transition-all text-gray-900 dark:text-white placeholder-gray-400"
          />
        </div>
        <div className="flex items-center justify-between pl-12">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Recherche dans les produits approuvés avec tri par statut de boost
          </p>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Filtrer:</span>
            <button
              type="button"
              onClick={() => setProductFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                productFilter === 'all'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Tous ({allProducts.length})
            </button>
            <button
              type="button"
              onClick={() => setProductFilter('boosted')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                productFilter === 'boosted'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Boostés ({boostedProducts.length})
            </button>
            <button
              type="button"
              onClick={() => setProductFilter('non-boosted')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                productFilter === 'non-boosted'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Non boostés ({nonBoostedProducts.length})
            </button>
          </div>
        </div>
      </div>

      {/* Products Section */}
      <section className="space-y-8">
        <div className="space-y-5 rounded-2xl border-2 border-indigo-200 dark:border-indigo-800 bg-white dark:bg-gray-800 p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-indigo-500 text-white">
                <Package className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-gray-900 dark:text-white">
                  Produits
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {productFilter === 'all' && 'Tous les produits'}
                  {productFilter === 'boosted' && 'Produits boostés uniquement'}
                  {productFilter === 'non-boosted' && 'Produits non boostés uniquement'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                {filteredProducts.length} produit{filteredProducts.length !== 1 ? 's' : ''}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {productFilter === 'all' && `${boostedProducts.length} boostés, ${nonBoostedProducts.length} non boostés`}
                {productFilter === 'boosted' && `${boostedProducts.length} au total`}
                {productFilter === 'non-boosted' && `${nonBoostedProducts.length} au total`}
              </p>
            </div>
          </div>
          {(boostedError || nonBoostedError) && (
            <div className="rounded-xl border-2 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300 flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              {boostedError || nonBoostedError}
            </div>
          )}
          <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
            {(boostedLoading || nonBoostedLoading) ? (
              <div className="col-span-full rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-12 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mx-auto mb-3" />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Chargement des produits...
                </p>
              </div>
            ) : filteredProducts.length ? (
              filteredProducts.map((product) => renderProductCard(product))
            ) : (
              <div className="col-span-full rounded-2xl border-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-12 text-center">
                <Package className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  {productFilter === 'all' && 'Aucun produit disponible pour le moment.'}
                  {productFilter === 'boosted' && 'Aucun produit boosté pour le moment.'}
                  {productFilter === 'non-boosted' && 'Aucun produit non boosté pour le moment.'}
                </p>
              </div>
            )}
          </div>
          {/* Show pagination only when viewing all or when filter matches the section */}
          {(productFilter === 'all' || productFilter === 'boosted') && boostedPagination && boostedPagination.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
              {boostedPagination}
            </div>
          )}
          {(productFilter === 'all' || productFilter === 'non-boosted') && nonBoostedPagination && nonBoostedPagination.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
              {nonBoostedPagination}
            </div>
          )}
        </div>
      </section>

      {/* Shop Boost Section */}
      <section className="space-y-8 mt-12">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-xl bg-emerald-500 text-white">
            <Store className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-gray-900 dark:text-white">Boosts Boutiques Certifiées</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Promouvez les boutiques vérifiées et augmentez leur visibilité
            </p>
          </div>
        </div>

        {/* Shop Statistics Dashboard */}
        {shopStatsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="rounded-2xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 animate-pulse"
              >
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-3" />
                <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-16" />
              </div>
            ))}
          </div>
        ) : shopStats ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl border-2 border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 p-6 shadow-lg">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 rounded-xl bg-emerald-500 text-white">
                  <Zap className="h-5 w-5" />
                </div>
                <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300 mb-1">
                Boutiques boostées
              </p>
              <p className="text-3xl font-black text-emerald-900 dark:text-emerald-100">
                {shopStats.totalBoosted || 0}
              </p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2">
                Sur {shopStats.totalShops || 0} boutiques vérifiées
              </p>
            </div>

            <div className="rounded-2xl border-2 border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 p-6 shadow-lg">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 rounded-xl bg-purple-500 text-white">
                  <Store className="h-5 w-5" />
                </div>
                <BarChart3 className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <p className="text-sm font-semibold text-purple-700 dark:text-purple-300 mb-1">
                Non boostées
              </p>
              <p className="text-3xl font-black text-purple-900 dark:text-purple-100">
                {shopStats.totalNonBoosted || 0}
              </p>
              <p className="text-xs text-purple-600 dark:text-purple-400 mt-2">
                Disponibles pour boost
              </p>
            </div>

            <div className="rounded-2xl border-2 border-amber-200 dark:border-amber-800 bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 p-6 shadow-lg">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 rounded-xl bg-amber-500 text-white">
                  <Calendar className="h-5 w-5" />
                </div>
                <TrendingUp className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <p className="text-sm font-semibold text-amber-700 dark:text-amber-300 mb-1">
                Boostées ce mois
              </p>
              <p className="text-3xl font-black text-amber-900 dark:text-amber-100">
                {shopStats.boostedThisMonth || 0}
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                {shopStats.boostedThisWeek || 0} cette semaine
              </p>
            </div>

            <div className="rounded-2xl border-2 border-indigo-200 dark:border-indigo-800 bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900/20 dark:to-indigo-800/20 p-6 shadow-lg">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 rounded-xl bg-indigo-500 text-white">
                  <Heart className="h-5 w-5" />
                </div>
                <ChevronRight className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-300 mb-1">
                Total followers
              </p>
              <p className="text-3xl font-black text-indigo-900 dark:text-indigo-100">
                {shopStats.topBoostedShops?.reduce((sum, shop) => sum + (shop.followersCount || 0), 0) || 0}
              </p>
              <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-2">
                Boutiques boostées
              </p>
            </div>
          </div>
        ) : null}

        {/* Shop Search Bar and Filter */}
        <div className="flex flex-col gap-3 rounded-2xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/20">
              <Search className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <input
              value={shopSearchTerm}
              onChange={handleShopSearchTermChange}
              placeholder="Rechercher par nom de boutique ou adresse..."
              className="flex-1 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-4 py-2.5 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 dark:focus:ring-emerald-900 transition-all text-gray-900 dark:text-white placeholder-gray-400"
            />
          </div>
          <div className="flex items-center justify-between pl-12">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Recherche dans les boutiques vérifiées avec tri par statut de boost
            </p>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Filtrer:</span>
              <button
                type="button"
                onClick={() => setShopFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  shopFilter === 'all'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                Toutes ({allShops.length})
              </button>
              <button
                type="button"
                onClick={() => setShopFilter('boosted')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  shopFilter === 'boosted'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                Boostées ({boostedShops.length})
              </button>
              <button
                type="button"
                onClick={() => setShopFilter('non-boosted')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  shopFilter === 'non-boosted'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                Non boostées ({nonBoostedShops.length})
              </button>
            </div>
          </div>
        </div>

        {/* Shops Section */}
        <div className="space-y-5 rounded-2xl border-2 border-emerald-200 dark:border-emerald-800 bg-white dark:bg-gray-800 p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-500 text-white">
                <Store className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-gray-900 dark:text-white">
                  Boutiques
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {shopFilter === 'all' && 'Toutes les boutiques'}
                  {shopFilter === 'boosted' && 'Boutiques boostées uniquement'}
                  {shopFilter === 'non-boosted' && 'Boutiques non boostées uniquement'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                {filteredShops.length} boutique{filteredShops.length !== 1 ? 's' : ''}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {shopFilter === 'all' && `${boostedShops.length} boostées, ${nonBoostedShops.length} non boostées`}
                {shopFilter === 'boosted' && `${boostedShops.length} au total`}
                {shopFilter === 'non-boosted' && `${nonBoostedShops.length} au total`}
              </p>
            </div>
          </div>
          {(boostedShopsError || nonBoostedShopsError) && (
            <div className="rounded-xl border-2 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300 flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              {boostedShopsError || nonBoostedShopsError}
            </div>
          )}
          <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
            {(boostedShopsLoading || nonBoostedShopsLoading) ? (
              <div className="col-span-full rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-12 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-600 mx-auto mb-3" />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Chargement des boutiques...
                </p>
              </div>
            ) : filteredShops.length ? (
              filteredShops.map((shop) => renderShopCard(shop))
            ) : (
              <div className="col-span-full rounded-2xl border-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-12 text-center">
                <Store className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  {shopFilter === 'all' && 'Aucune boutique disponible pour le moment.'}
                  {shopFilter === 'boosted' && 'Aucune boutique boostée pour le moment.'}
                  {shopFilter === 'non-boosted' && 'Aucune boutique non boostée pour le moment.'}
                </p>
              </div>
            )}
          </div>
          {/* Show pagination only when viewing all or when filter matches the section */}
          {(shopFilter === 'all' || shopFilter === 'boosted') && boostedShopsPagination && boostedShopsPagination.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
              {boostedShopsPagination}
            </div>
          )}
          {(shopFilter === 'all' || shopFilter === 'non-boosted') && nonBoostedShopsPagination && nonBoostedShopsPagination.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
              {nonBoostedShopsPagination}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
