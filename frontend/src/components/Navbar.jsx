import React, { useContext, useState, useEffect, useCallback, useRef } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import AuthContext from "../context/AuthContext";
import CartContext from "../context/CartContext";
import FavoriteContext from "../context/FavoriteContext";
import useAdminCounts from "../hooks/useAdminCounts";
import useUserNotifications from "../hooks/useUserNotifications";
import api from "../services/api";
import { buildProductPath, buildShopPath } from "../utils/links";
import {
  ShoppingCart,
  Bell,
  MessageSquare,
  Menu,
  X,
  Search,
  LogOut,
  User,
  Sun,
  Moon,
  Heart,
  Store,
  ChevronDown,
  Users,
  Package,
  Settings,
  Home,
  UserCircle,
  AlertCircle,
  BarChart3,
  ClipboardList,
  Sparkles,
  Trash2,
  ShieldCheck,
  Truck
} from "lucide-react";
import VerifiedBadge from "./VerifiedBadge";

/**
 * 🎨 NAVBAR PREMIUM HDMarket - Version Mobile First
 * - Pour les admins: "Mes annonces" retiré de la navbar desktop, conservé dans le dropdown
 * - Lien profil utilisateur amélioré sur mobile
 * - Gestion des erreurs robuste
 * - Design responsive optimisé
 */

const formatRelativeTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffMins < 1) return "À l'instant";
  if (diffMins < 60) return `Il y a ${diffMins} min`;
  if (diffHours < 24) return `Il y a ${diffHours} h`;
  if (diffDays === 1) return 'Hier';
  if (diffDays < 7) return `Il y a ${diffDays} j`;
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: diffDays > 365 ? 'numeric' : undefined });
};

export default function Navbar() {
  const navigate = useNavigate();
  const { user, logout } = useContext(AuthContext);
  const { cart } = useContext(CartContext);
  const { favorites } = useContext(FavoriteContext);
  const cartCount = cart?.totals?.quantity || 0;
  const favoritesCount = favorites.length;
  const [activeOrders, setActiveOrders] = useState(0);
  const [sellerOrders, setSellerOrders] = useState(0);

  const isAdmin = user?.role === "admin";
  const isManager = user?.role === "manager";
  const canAccessBackOffice = isAdmin || isManager;
  const adminLinkLabel = isManager ? "Gestion" : "Admin";
  const canManageSales = Boolean(user && !isAdmin);

  const { counts } = useAdminCounts(canAccessBackOffice);
  const waitingPayments = counts.waitingPayments || 0;
  const { counts: userNotifications } = useUserNotifications(Boolean(user));
  const commentAlerts = userNotifications.commentAlerts || 0;
  const hasActiveOrders = activeOrders > 0;
  const activeOrdersBadge = activeOrders > 99 ? '99+' : activeOrders;
  const hasSellerOrders = sellerOrders > 0;
  const sellerOrdersBadge = sellerOrders > 99 ? '99+' : sellerOrders;

  // États
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [isHistoryPanelOpen, setIsHistoryPanelOpen] = useState(false);
  const [searchHistory, setSearchHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [shops, setShops] = useState([]);
  const [shopsLoading, setShopsLoading] = useState(false);
  const [shopsError, setShopsError] = useState("");
  const [appLogos, setAppLogos] = useState({ desktop: "", mobile: "" });
  const [isShopMenuOpen, setIsShopMenuOpen] = useState(false);
  const shopMenuCloseRef = useRef(null);
  const [isMobileLayout, setIsMobileLayout] = useState(() =>
    typeof window === 'undefined' ? false : window.innerWidth < 1024
  );
  const shouldHideSearchBar = isMenuOpen && isMobileLayout;
  const historyPanelOpenRef = useRef(isHistoryPanelOpen);
  const desktopLogo = appLogos.desktop || appLogos.mobile;
  const mobileLogo = appLogos.mobile || appLogos.desktop;

  const handleSearchBlur = () => {
    setTimeout(() => {
      if (!historyPanelOpenRef.current) {
        setShowResults(false);
      }
    }, 150);
  };

  // Mode sombre
  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  useEffect(() => {
    if (!user) {
      setActiveOrders(0);
      return () => {};
    }

    let cancelled = false;
    let intervalId;

    const fetchOrders = async () => {
      try {
        const { data } = await api.get('/orders?limit=50');
        if (!cancelled) {
          const collection = Array.isArray(data) ? data : data?.items || [];
          const active = collection.filter((order) => order?.status !== 'delivered').length;
          setActiveOrders(active);
        }
      } catch (error) {
        if (!cancelled) {
          setActiveOrders(0);
        }
      }
    };

    fetchOrders();
    intervalId = setInterval(fetchOrders, 60000);

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [user]);

  useEffect(() => {
    if (!user || isAdmin) {
      setSellerOrders(0);
      return () => {};
    }

    let cancelled = false;
    let intervalId;

    const fetchSellerOrders = async () => {
      try {
        const { data } = await api.get('/orders/seller?limit=50');
        if (!cancelled) {
          const collection = Array.isArray(data) ? data : data?.items || [];
          const active = collection.filter((order) => order?.status !== 'delivered').length;
          setSellerOrders(active);
        }
      } catch (error) {
        if (!cancelled) {
          setSellerOrders(0);
        }
      }
    };

    fetchSellerOrders();
    intervalId = setInterval(fetchSellerOrders, 60000);

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [user, isAdmin]);

  const clearShopMenuTimeout = useCallback(() => {
    if (shopMenuCloseRef.current) {
      clearTimeout(shopMenuCloseRef.current);
      shopMenuCloseRef.current = null;
    }
  }, []);

  const handleShopMenuOpen = useCallback(() => {
    clearShopMenuTimeout();
    setIsShopMenuOpen(true);
  }, [clearShopMenuTimeout]);

  const handleShopMenuDelayedClose = useCallback(() => {
    clearShopMenuTimeout();
    shopMenuCloseRef.current = setTimeout(() => {
      setIsShopMenuOpen(false);
      shopMenuCloseRef.current = null;
    }, 1500);
  }, [clearShopMenuTimeout]);

  useEffect(() => {
    return () => {
      clearShopMenuTimeout();
    };
  }, [clearShopMenuTimeout]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const updateViewport = () => {
      setIsMobileLayout(window.innerWidth < 1024);
    };
    updateViewport();
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, []);

  useEffect(() => {
    if (shouldHideSearchBar) {
      setShowResults(false);
      setIsHistoryPanelOpen(false);
    }
  }, [shouldHideSearchBar]);

  useEffect(() => {
    historyPanelOpenRef.current = isHistoryPanelOpen;
  }, [isHistoryPanelOpen]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const body = document.body;
    if (isMenuOpen) {
      body.style.overflow = 'hidden';
    } else {
      body.style.overflow = '';
    }
    return () => {
      body.style.overflow = '';
    };
  }, [isMenuOpen]);

  // Recherche avec gestion d'erreur améliorée
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setSearchError("");
      return;
    }

    setIsHistoryPanelOpen(false);
    
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      setSearching(true);
      setSearchError("");
      
      try {
        const { data } = await api.get(`/search?q=${encodeURIComponent(searchQuery)}`, {
          signal: controller.signal
        });
        setSearchResults(Array.isArray(data?.products) ? data.products : []);
        setShowResults(true);
      } catch (error) {
        if (error.name !== "CanceledError" && error.name !== "AbortError") {
          console.error("Search error:", error);
          setSearchError("Erreur lors de la recherche. Veuillez réessayer.");
          setSearchResults([]);
        }
      } finally {
        setSearching(false);
      }
    }, 300);
    
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [searchQuery]);

  const fetchSearchHistory = useCallback(async () => {
    if (!user) {
      setSearchHistory([]);
      return [];
    }
    setHistoryLoading(true);
    try {
      const { data } = await api.get('/users/search-history');
      const normalized = Array.isArray(data) ? data : [];
      setSearchHistory(normalized);
      return normalized;
    } catch {
      setSearchHistory([]);
      return [];
    } finally {
      setHistoryLoading(false);
    }
  }, [user]);

  const handleOpenHistoryPanel = async () => {
    if (!user) {
      navigate('/login', { state: { from: '/profile' } });
      return;
    }
    await fetchSearchHistory();
    setShowResults(true);
    setIsHistoryPanelOpen(true);
  };

  const handleCloseHistoryPanel = () => {
    setIsHistoryPanelOpen(false);
    setShowResults(false);
  };

  const handleDeleteHistoryEntry = async (id) => {
    if (!id) return;
    try {
      await api.delete(`/users/search-history/${id}`);
      setSearchHistory((prev) => prev.filter((entry) => entry._id !== id));
    } catch {
      // ignore
    }
  };

  const handleClearHistory = async () => {
    if (!user) return;
    try {
      await api.delete('/users/search-history');
      setSearchHistory([]);
    } catch {
      // ignore
    }
  };

  const getSearchEntryLink = (entry) => {
    const type = entry.metadata?.type;
    const targetSlug = entry.metadata?.targetSlug;
    const targetId = entry.metadata?.targetId;
    const hasSlug = Boolean(targetSlug);
    if (type === 'shop') {
      if (hasSlug || targetId) {
        return buildShopPath(hasSlug ? { slug: targetSlug } : { _id: targetId });
      }
      return '/shops/verified';
    }
    if (hasSlug || targetId) {
      return buildProductPath(hasSlug ? { slug: targetSlug } : { _id: targetId });
    }
    return '/shops/verified';
  };

  const handleSelectResult = (item) => {
    setShowResults(false);
    setIsHistoryPanelOpen(false);
    const term = searchQuery.trim();
    if (term && user) {
      try {
            api
              .post("/users/search-history", {
                query: term,
                metadata: {
                  type: item?.type,
                  targetId: item?._id,
                  targetSlug: item?.slug
                }
              })
          .then((response) => {
            const data = response.data;
            if (data) {
              setSearchHistory((prev) => [data, ...prev].slice(0, 20));
            }
          })
          .catch(() => {
            // ignore
          });
      } catch {
        // ignore
      }
    }
    setSearchQuery("");
    setSearchResults([]);
    if (item?.type === 'shop') {
      navigate(buildShopPath(item));
      return;
    }
    if (item?._id || item?.slug) {
      navigate(buildProductPath(item));
    }
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (searchResults.length > 0) {
        handleSelectResult(searchResults[0]);
      }
    }
  };

  const handleHistoryEntryNavigate = (entry) => {
    if (!entry) return;
    const target = getSearchEntryLink(entry);
    if (!target) return;
    handleCloseHistoryPanel();
    navigate(target);
  };

  const renderDesktopSearchResults = () => (
    <>
      {searching && (
        <div className="px-4 py-3 flex items-center space-x-3">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-indigo-600 border-t-transparent"></div>
          <span className="text-sm text-gray-500">Recherche en cours...</span>
        </div>
      )}
      {!searching && searchError && (
        <div className="px-4 py-3 flex items-center space-x-3 text-red-500 text-sm">
          <AlertCircle size={16} />
          {searchError}
        </div>
      )}
      {!searching && !searchError && searchResults.length === 0 && searchQuery.trim() && (
        <div className="px-4 py-3 text-center text-gray-500">
          Aucun résultat pour « {searchQuery} »
        </div>
      )}
      {searchQuery.trim() && (
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-center">
          <Link
            to={`/products?search=${encodeURIComponent(searchQuery.trim())}`}
            className="font-semibold text-indigo-600 hover:text-indigo-500"
            onClick={() => {
              setIsHistoryPanelOpen(false);
              setShowResults(false);
            }}
          >
            Voir tous les résultats
          </Link>
        </div>
      )}
      {searchResults.map((product) => (
        <button
          key={product._id}
          type="button"
          onClick={() => handleSelectResult(product)}
          className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3 border-b border-gray-100 dark:border-gray-700 last:border-b-0 transition-colors"
        >
          <img
            src={product.image || product.shopLogo || "/api/placeholder/60/60"}
            alt={product.title}
            className="h-10 w-10 rounded-lg object-cover border border-gray-200 dark:border-gray-600"
            onError={(e) => {
              e.target.src = "/api/placeholder/60/60";
            }}
          />
          <div className="flex-1 min-w-0">
            <span className="font-semibold text-gray-900 dark:text-white text-sm block truncate">
              {product.title}
            </span>
            <div className="text-gray-500 text-xs flex items-center gap-2 mt-1 flex-wrap">
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                  product.type === 'shop'
                    ? 'bg-green-100 text-green-700'
                    : product.type === 'category'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-indigo-100 text-indigo-700'
                }`}
              >
                {product.type === 'shop'
                  ? 'Boutique'
                  : product.type === 'category'
                  ? 'Catégorie'
                  : 'Produit'}
              </span>
              {product.type === 'shop' ? (
                <span className="flex items-center gap-2 truncate">
                  {product.shopAddress || 'Adresse non renseignée'}
                  <VerifiedBadge verified={Boolean(product.shopVerified)} showLabel={false} />
                </span>
              ) : (
                <>
                  {product.shopName && (
                    <span className="flex items-center gap-2 truncate">
                      {product.shopName}
                      <VerifiedBadge verified={Boolean(product.shopVerified)} showLabel={false} />
                    </span>
                  )}
                  {product.type !== 'category' && (
                    <span className="truncate">{product.category}</span>
                  )}
                </>
              )}
            </div>
          </div>
        </button>
      ))}
    </>
  );

  const renderMobileSearchResults = () => (
    <>
      {searching && (
        <div className="px-4 py-3 flex items-center space-x-3">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-indigo-600 border-t-transparent"></div>
          <span className="text-sm text-gray-500">Recherche en cours...</span>
        </div>
      )}
      {!searching && searchError && (
        <div className="px-4 py-3 flex items-center space-x-3 text-red-500 text-sm">
          <AlertCircle size={16} />
          {searchError}
        </div>
      )}
      {!searching && !searchError && searchResults.length === 0 && searchQuery.trim() && (
        <div className="px-4 py-3 text-center text-gray-500">
          Aucun résultat pour « {searchQuery} »
        </div>
      )}
      {searchResults.map((product) => {
        const thumbnail =
          product.images?.[0] ||
          product.image ||
          product.shopLogo ||
          "/api/placeholder/60/60";
        return (
          <button
            key={product._id || product.slug || product.shopId || thumbnail}
            type="button"
            onClick={() => handleSelectResult(product)}
            className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3 transition-colors"
          >
            <img
              src={thumbnail}
              alt={product.title || 'Résultat de recherche'}
              className="w-12 h-12 rounded-xl object-cover border border-gray-100 dark:border-gray-700"
              onError={(event) => {
                event.currentTarget.src = "/api/placeholder/60/60";
              }}
            />
            <div className="flex-1">
              <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">
                {product.title}
              </p>
            <div className="text-xs text-gray-500 flex items-center gap-2 flex-wrap">
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                  product.type === "shop"
                    ? "bg-green-100 text-green-700"
                    : product.type === "category"
                    ? "bg-blue-100 text-blue-700"
                    : "bg-indigo-100 text-indigo-700"
                }`}
              >
                {product.type === "shop"
                  ? "Boutique"
                  : product.type === "category"
                  ? "Catégorie"
                  : "Produit"}
              </span>
              {product.type === "shop" ? (
                <span className="flex items-center gap-2 truncate">
                  {product.shopAddress || "Adresse non renseignée"}
                  <VerifiedBadge verified={Boolean(product.shopVerified)} showLabel={false} />
                </span>
              ) : (
                <>
                  {product.shopName && (
                    <span className="flex items-center gap-2 truncate">
                      {product.shopName}
                      <VerifiedBadge verified={Boolean(product.shopVerified)} showLabel={false} />
                    </span>
                  )}
                  {product.type !== "category" && (
                    <span className="truncate">{product.category}</span>
                  )}
                </>
              )}
            </div>
          </div>
        </button>
          );
    })}
  </>
);

  const renderHistoryResults = () => (
    <div className="px-4 py-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-sm text-gray-900 dark:text-white space-y-3">
      <div className="flex items-center justify-between mb-1">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-300">
            Historique des recherches
          </p>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            {searchHistory.length ? `${searchHistory.length} requête(s)` : 'Aucune recherche enregistrée'}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleClearHistory}
            className="text-xs font-semibold text-red-600 hover:text-red-500"
          >
            Effacer tout
          </button>
          <button
            type="button"
            aria-label="Fermer l'historique"
            onClick={handleCloseHistoryPanel}
            className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
          >
            <X size={18} />
          </button>
        </div>
      </div>
      <div className="space-y-2 max-h-60 overflow-auto">
        {historyLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-10 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
            ))}
          </div>
        ) : searchHistory.length ? (
          searchHistory.map((entry) => {
            const typeLabel = entry.metadata?.type === 'shop'
              ? 'Boutique'
              : entry.metadata?.type === 'category'
                ? 'Catégorie'
                : 'Produit';
            return (
              <div
                key={entry._id}
                role="button"
                tabIndex={0}
                onClick={() => handleHistoryEntryNavigate(entry)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    handleHistoryEntryNavigate(entry);
                  }
                }}
                className="flex items-center justify-between gap-3 rounded-2xl border border-gray-100 dark:border-gray-800 px-3 py-2 bg-white dark:bg-gray-900 hover:border-indigo-200 hover:bg-indigo-50 dark:hover:bg-gray-800 transition-all"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">
                    {entry.query}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-1 flex-wrap">
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border border-gray-200 dark:border-gray-700"
                    >
                      {typeLabel}
                    </span>
                    <span>{formatRelativeTime(entry.createdAt)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleHistoryEntryNavigate(entry);
                    }}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-500"
                  >
                    Voir
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleDeleteHistoryEntry(entry._id);
                    }}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-300">
            Aucune recherche enregistrée pour le moment.
          </p>
        )}
      </div>
    </div>
  );

  // Chargement des boutiques avec gestion d'erreur
  useEffect(() => {
    let cancelled = false;
    
    const loadShops = async () => {
      setShopsLoading(true);
      setShopsError("");
      
      try {
        const { data } = await api.get("/shops");
        if (!cancelled) {
          setShops(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Shops loading error:", error);
          setShopsError("Impossible de charger les boutiques. Vérifiez votre connexion.");
          setShops([]);
        }
      } finally {
        if (!cancelled) {
          setShopsLoading(false);
        }
      }
    };
    
    loadShops();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadAppLogos = async () => {
      try {
        const { data } = await api.get("/settings/app-logo");
        if (cancelled) return;
        setAppLogos({
          desktop: data?.appLogoDesktop || "",
          mobile: data?.appLogoMobile || ""
        });
      } catch (error) {
        if (!cancelled) {
          setAppLogos({ desktop: "", mobile: "" });
        }
      }
    };

    loadAppLogos();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      {/* 🎯 NAVBAR PRINCIPALE */}
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-white/95 dark:bg-gray-900/95 shadow-lg border-b border-gray-200/50 dark:border-gray-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            
            {/* === LOGO HDMarket === */}
            <Link to="/" className="flex items-center space-x-3 group">
              {desktopLogo || mobileLogo ? (
                <>
                  <img
                    src={mobileLogo || desktopLogo}
                    alt="Logo HDMarket"
                    className="h-12 w-12 rounded-xl object-contain border border-gray-200 bg-white shadow-sm sm:hidden"
                  />
                  <img
                    src={desktopLogo || mobileLogo}
                    alt="Logo HDMarket"
                    className="hidden h-18 w-auto max-w-[200px] object-contain sm:block"
                  />
                </>
              ) : (
                <>
                  <div className="w-9 h-9 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-105">
                    <span className="text-white font-bold text-sm">HD</span>
                  </div>
                  <div className="hidden sm:flex flex-col">
                    <span className="text-xl font-black bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                      HDMarket
                    </span>
                    <span className="text-xs text-gray-500 -mt-1">Marketplace Premium</span>
                  </div>
                </>
              )}
            </Link>

            {/* === PROFIL UTILISATEUR MOBILE & RACCOURCI BOUTIQUES === */}
            {user && (
              <div className="md:hidden flex items-center gap-2">
                <Link 
                  to="/profile"
                  className="flex items-center gap-2 p-2 rounded-xl bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border border-indigo-100 dark:border-indigo-800"
                >
                  <div className="w-8 h-8 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full flex items-center justify-center">
                    <UserCircle className="text-white" size={16} />
                  </div>
                  <div className="hidden xs:flex flex-col items-start max-w-24">
                    <span className="font-semibold text-gray-900 dark:text-white text-xs truncate">
                      {user.name || "Profil"}
                    </span>
                    <span className="text-[10px] text-indigo-600 font-medium">Voir profil</span>
                  </div>
                </Link>
                <Link
                  to="/notifications"
                  className="relative flex items-center gap-2 p-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-100 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-200"
                  aria-label="Notifications"
                >
                  <div className="w-8 h-8 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center">
                    <Bell className="text-rose-600 dark:text-rose-200" size={16} />
                  </div>
                  <div className="hidden xs:flex flex-col items-start">
                    <span className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Alertes
                    </span>
                    <span className="text-xs font-semibold text-gray-900 dark:text-white">Voir</span>
                  </div>
                  {commentAlerts > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                      {commentAlerts}
                    </span>
                  )}
                </Link>
                <Link
                  to="/orders"
                  className="relative flex items-center gap-2 p-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-100 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-200"
                  aria-label="Mes commandes"
                >
                  <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                    <ClipboardList className="text-indigo-600 dark:text-indigo-200" size={16} />
                  </div>
                  <div className="hidden xs:flex flex-col items-start">
                    <span className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Commandes
                    </span>
                    <span className="text-xs font-semibold text-gray-900 dark:text-white">Suivre</span>
                  </div>
                  {hasActiveOrders && (
                    <span className="absolute -top-1 -right-1 bg-indigo-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                      {activeOrdersBadge}
                    </span>
                  )}
                </Link>
                {canManageSales && (
                  <Link
                    to="/seller/orders"
                    className="relative flex items-center gap-2 p-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-100 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-200"
                    aria-label="Commandes clients"
                  >
                    <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                      <Package className="text-emerald-600 dark:text-emerald-200" size={16} />
                    </div>
                    <div className="hidden xs:flex flex-col items-start">
                      <span className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Ventes
                      </span>
                      <span className="text-xs font-semibold text-gray-900 dark:text-white">Commandes</span>
                    </div>
                    {hasSellerOrders && (
                      <span className="absolute -top-1 -right-1 bg-emerald-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                        {sellerOrdersBadge}
                      </span>
                    )}
                  </Link>
                )}
                {canAccessBackOffice && (
                  <Link
                    to="/admin/orders"
                    className="relative flex items-center gap-2 p-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-100 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-200"
                    aria-label="Commandes admin"
                  >
                    <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                      <ClipboardList className="text-amber-600 dark:text-amber-200" size={16} />
                    </div>
                    <div className="hidden xs:flex flex-col items-start">
                      <span className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Admin
                      </span>
                      <span className="text-xs font-semibold text-gray-900 dark:text-white">Commandes</span>
                    </div>
                  </Link>
                )}
              </div>
            )}

            {/* === ACTIONS UTILISATEUR (Desktop) === */}
            <div className="hidden md:flex items-center gap-2">
              
              {/* Accueil */}
              <NavLink 
                to="/" 
                className={({ isActive }) => 
                  `flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-200 ${
                    isActive 
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg' 
                      : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`
                }
              >
                <Home size={18} />
                <span className="font-medium">Accueil</span>
              </NavLink>

              {/* Boutiques */}
              <div className="relative">
                <button
                  onClick={() => {
                    if (window.matchMedia('(max-width: 767px)').matches) {
                      navigate('/shops/verified');
                      setIsShopMenuOpen(false);
                    }
                  }}
                  onMouseEnter={(e) => {
                    if (!window.matchMedia('(max-width: 767px)').matches) {
                      handleShopMenuOpen();
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!window.matchMedia('(max-width: 767px)').matches) {
                      handleShopMenuDelayedClose();
                    }
                  }}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200"
                >
                  <Store size={18} />
                  <span className="font-medium">Boutiques</span>
                  <ChevronDown
                    size={16}
                    className={`transition-transform duration-200 ${isShopMenuOpen ? "rotate-180" : ""}`}
                  />
                </button>
                
                {/* MENU DÉROULANT BOUTIQUES */}
                {isShopMenuOpen && (
                  <div 
                    className="absolute left-0 mt-2 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl z-40 overflow-hidden"
                    onMouseEnter={handleShopMenuOpen}
                    onMouseLeave={handleShopMenuDelayedClose}
                  >
                    <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between gap-3">
                      <div>
                        <h3 className="font-bold text-gray-900 dark:text-white">Nos Boutiques</h3>
                        <p className="text-sm text-gray-500 mt-1">Découvrez nos vendeurs professionnels</p>
                      </div>
                      <Link
                        to="/shops/verified"
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-500"
                        onClick={() => setIsShopMenuOpen(false)}
                      >
                        Tout voir →
                      </Link>
                    </div>
                    
                    <div className="max-h-96 overflow-auto">
                      {shopsLoading ? (
                        <div className="p-4 flex items-center justify-center">
                          <div className="animate-spin rounded-full h-6 w-6 border-2 border-indigo-600 border-t-transparent"></div>
                        </div>
                      ) : shopsError ? (
                        <div className="p-4 text-center text-red-500 text-sm flex items-center justify-center gap-2">
                          <AlertCircle size={16} />
                          {shopsError}
                        </div>
                      ) : shops.length === 0 ? (
                        <div className="p-4 text-center text-gray-500 text-sm">
                          Aucune boutique enregistrée pour le moment.
                        </div>
                      ) : (
                        <div className="p-2">
                          {shops.map((shop) => (
                            <Link
                              key={shop._id}
                              to={buildShopPath(shop)}
                              className="flex items-center gap-3 rounded-xl p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group"
                              onClick={() => setIsShopMenuOpen(false)}
                            >
                              <img
                                src={shop.shopLogo || "/api/placeholder/60/60"}
                                alt={shop.shopName}
                                className="h-12 w-12 rounded-xl object-cover border border-gray-200 dark:border-gray-600 group-hover:border-indigo-300 transition-colors"
                                onError={(e) => {
                                  e.target.src = "/api/placeholder/60/60";
                                }}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-gray-900 dark:text-white text-sm block group-hover:text-indigo-600 transition-colors">
                                    {shop.shopName}
                                  </span>
                                  <VerifiedBadge verified={Boolean(shop.shopVerified)} showLabel={false} />
                                </div>
                                <span className="text-xs text-gray-500 block mt-1 truncate">
                                  {shop.shopAddress || "Adresse non renseignée"}
                                </span>
                                <span className="text-xs text-indigo-600 font-semibold">
                                  {shop.productCount || 0} annonce{shop.productCount > 1 ? "s" : ""}
                                </span>
                              </div>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Utilisateur connecté - MASQUER "Mes annonces" POUR LES ADMINS SUR DESKTOP */}
              {user && (
                <>
                  {user.accountType === "shop" && (
                    <NavLink 
                      to="/my/stats" 
                      className={({ isActive }) => 
                        `flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-200 ${
                          isActive 
                            ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg' 
                            : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
                        }`
                      }
                    >
                      <BarChart3 size={18} />
                      <span className="font-medium">Statistiques</span>
                    </NavLink>
                  )}

                  <NavLink 
                    to="/notifications" 
                    className="relative flex items-center gap-2 px-3 py-2 rounded-xl text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200"
                  >
                    <Bell size={18} />
                    <span className="font-medium">Notifications</span>
                    {commentAlerts > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                        {commentAlerts}
                      </span>
                    )}
                  </NavLink>
                {canManageSales && (
                  <NavLink
                    to="/seller/orders"
                    className="relative flex items-center gap-2 px-3 py-2 rounded-xl text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200"
                  >
                      <Package size={18} />
                      <span className="font-medium">Commandes clients</span>
                      {hasSellerOrders && (
                        <span className="absolute -top-1 -right-1 bg-emerald-600 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                          {sellerOrdersBadge}
                        </span>
                      )}
                    </NavLink>
                  )}
                </>
              )}

              {/* Admin */}
              {canAccessBackOffice && (
                <NavLink
                  to="/admin"
                  className="relative flex items-center gap-2 px-3 py-2 rounded-xl text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-all duration-200"
                >
                  <Settings size={18} />
                  <span className="font-medium">{adminLinkLabel}</span>
                  {waitingPayments > 0 && (
                    <span className="absolute -top-1 -right-1 bg-yellow-400 text-black text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                      {waitingPayments}
                    </span>
                  )}
                </NavLink>
              )}
              {canAccessBackOffice && (
                <NavLink 
                  to="/admin/orders" 
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200"
                >
                  <ClipboardList size={18} />
                  <span className="font-medium">Commandes</span>
                </NavLink>
              )}
              {/* Favoris */}
              <NavLink 
                to="/favorites" 
                className="relative flex items-center gap-2 px-3 py-2 rounded-xl text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200"
              >
                <Heart size={18} />
                <span className="font-medium">Favoris</span>
                {favoritesCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-pink-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                    {favoritesCount}
                  </span>
                )}
              </NavLink>

              {/* Panier */}
              <NavLink 
                to="/cart" 
                className="relative flex items-center gap-2 px-3 py-2 rounded-xl text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200"
              >
                <ShoppingCart size={18} />
                <span className="font-medium">Panier</span>
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-indigo-600 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                    {cartCount}
                  </span>
                )}
              </NavLink>

              {/* Mode clair/sombre */}
              <button
                onClick={() => setDarkMode((p) => !p)}
                className="flex items-center justify-center w-9 h-9 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-200"
                aria-label={darkMode ? "Activer le mode clair" : "Activer le mode sombre"}
              >
                {darkMode ? <Sun size={18} /> : <Moon size={18} />}
              </button>

              {/* Compte utilisateur */}
              {!user ? (
                <div className="flex items-center gap-2">
                  <NavLink
                    to="/login"
                    className="px-3 py-2 rounded-xl border border-indigo-600 text-indigo-600 font-medium hover:bg-indigo-50 transition-all duration-200"
                  >
                    Connexion
                  </NavLink>
                  <NavLink
                    to="/register"
                    className="px-3 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium hover:from-indigo-700 hover:to-purple-700 shadow-lg hover:shadow-xl transition-all duration-200"
                  >
                    Inscription
                  </NavLink>
                </div>
              ) : (
                <div className="relative group">
                  <button className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-200">
                    <div className="w-8 h-8 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full flex items-center justify-center">
                      <span className="text-white font-semibold text-sm">
                        {user.name?.charAt(0)?.toUpperCase() || 'U'}
                      </span>
                    </div>
                    <span className="font-medium text-gray-700 dark:text-gray-200 max-w-24 truncate hidden lg:block">
                      {user.name || "Mon compte"}
                    </span>
                    <ChevronDown size={16} className="text-gray-500 hidden lg:block" />
                  </button>
                  
                  {/* MENU DÉROULANT UTILISATEUR - GARDE "Mes annonces" POUR TOUS */}
                  <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                    <div className="p-4 border-b border-gray-100 dark:border-gray-700">
                      <p className="font-semibold text-gray-900 dark:text-white truncate">
                        {user.name || "Utilisateur"}
                      </p>
                      <p className="text-sm text-gray-500 truncate">{user.email}</p>
                    </div>
                    <div className="p-2">
                      <Link
                        to="/profile"
                        className="flex items-center gap-3 px-3 py-2 rounded-xl text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                      >
                        <User size={16} />
                        <span>Mon profil</span>
                      </Link>
                      {/* "Mes annonces" conservé dans le dropdown même pour les admins */}
                      <Link
                        to="/my"
                        className="flex items-center gap-3 px-3 py-2 rounded-xl text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                      >
                        <Package size={16} />
                        <span>Mes annonces</span>
                      </Link>
                      <Link
                        to="/orders"
                        className="relative flex items-center gap-3 px-3 py-2 rounded-xl text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                      >
                        <ClipboardList size={16} />
                        <span>Mes commandes</span>
                        {hasActiveOrders && (
                          <span className="ml-auto bg-indigo-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                            {activeOrdersBadge}
                          </span>
                        )}
                      </Link>
                      {canAccessBackOffice && (
                        <Link
                          to="/admin/delivery-guys"
                          className="flex items-center gap-3 px-3 py-2 rounded-xl text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                        >
                          <Truck size={16} />
                          <span className="text-sm font-semibold">Livreurs</span>
                        </Link>
                      )}
                      {user?.role === 'admin' && (
                        <Link
                          to="/admin/chat-templates"
                          className="flex items-center gap-3 px-3 py-2 rounded-xl text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                        >
                          <MessageSquare size={16} />
                          <span className="text-sm font-semibold">Chat templates</span>
                        </Link>
                      )}
                      {user?.role === 'admin' && (
                        <Link
                          to="/admin/product-boosts"
                          className="flex items-center gap-3 px-3 py-2 rounded-xl text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                        >
                          <Sparkles size={16} />
                          <span className="text-sm font-semibold">Boost produits</span>
                        </Link>
                      )}
                      <Link
                        to="/my/stats"
                        className="flex items-center gap-3 px-3 py-2 rounded-xl text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                      >
                        <BarChart3 size={16} />
                        <span>Statistiques</span>
                      </Link>
                      <button
                        onClick={logout}
                        className="flex items-center gap-3 px-3 py-2 rounded-xl text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors w-full text-left"
                      >
                        <LogOut size={16} />
                        <span>Déconnexion</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* === BOUTON MENU MOBILE === */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden flex items-center justify-center w-9 h-9 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-200"
              aria-label={isMenuOpen ? "Fermer le menu" : "Ouvrir le menu"}
            >
              {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* === BARRE DE RECHERCHE DESCENDUE (Desktop) === */}
        {!shouldHideSearchBar && (
          <div className="hidden lg:block mt-2 border-t border-gray-200 dark:border-gray-800 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
              <div className="flex items-center justify-center">
                <div className="w-full max-w-2xl">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Rechercher des produits, marques, catégories ou boutiques..."
                      className="w-full pl-12 pr-4 py-3 bg-gray-100 dark:bg-gray-800 border-0 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-gray-700 transition-all duration-200 placeholder-gray-500 text-sm"
                      onFocus={() => setShowResults(true)}
                      onKeyDown={handleSearchKeyDown}
                      onBlur={() => setTimeout(() => setShowResults(false), 150)}
                    />
                    <div className="absolute right-4 top-full mt-2 text-xs text-indigo-600 dark:text-indigo-400">
                      <button onClick={handleOpenHistoryPanel} className="font-semibold hover:underline">
                        Historique
                      </button>
                    </div>
                    
                    {/* RÉSULTATS DE RECHERCHE POUR BARRE DESCENDUE */}
                    {showResults && (
                      <div className="absolute top-14 left-0 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl max-h-80 overflow-auto z-50 w-full">
                        {isHistoryPanelOpen ? renderHistoryResults() : renderDesktopSearchResults()}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* === BARRE DE RECHERCHE MOBILE === */}
        <div
          className={`lg:hidden mt-2 border-t border-gray-200 dark:border-gray-800 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm mb-6 ${
            shouldHideSearchBar ? 'hidden' : ''
          }`}
        >
          <div className="max-w-7xl mx-auto px-4 py-3">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher produits, boutiques..."
                className="w-full pl-10 pr-4 py-2.5 bg-gray-100 dark:bg-gray-800 border-0 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-gray-700 transition-all duration-200 text-sm"
                onFocus={() => setShowResults(true)}
                onKeyDown={handleSearchKeyDown}
                onBlur={() => setTimeout(() => setShowResults(false), 150)}
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-indigo-600 dark:text-indigo-400">
                <button onClick={handleOpenHistoryPanel} className="font-semibold hover:underline">
                  Historique
                </button>
              </div>
              {showResults && (
                <div className="absolute top-12 left-0 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl max-h-72 overflow-auto z-40">
                  {isHistoryPanelOpen ? renderHistoryResults() : renderMobileSearchResults()}
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* === MENU MOBILE OVERLAY === */}
      {isMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm mt-16">
          <div className="bg-white dark:bg-gray-900 h-full overflow-y-auto pb-32">
            <div className="max-w-7xl mx-auto px-4 py-6 space-y-3">
              
              {/* Navigation principale mobile */}
              <NavLink 
                to="/" 
                onClick={() => setIsMenuOpen(false)}
                className={({ isActive }) => 
                  `flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 ${
                    isActive 
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg' 
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200'
                  }`
                }
              >
                <Home size={20} />
                Accueil
              </NavLink>

              {/* Boutiques mobile */}
              <NavLink
                to="/shops/verified"
                onClick={() => setIsMenuOpen(false)}
                className={({ isActive }) => 
                  `flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 ${
                    isActive 
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg' 
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200'
                  }`
                }
              >
                <Store size={20} />
                Boutiques
              </NavLink>

              {/* Utilisateur connecté mobile - TOUJOURS AFFICHER "Mes annonces" */}
              {user && (
                <>
                  <NavLink 
                    to="/my" 
                    onClick={() => setIsMenuOpen(false)}
                    className={({ isActive }) => 
                      `flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 ${
                        isActive 
                          ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg' 
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200'
                      }`
                    }
                  >
                    <Package size={20} />
                    Mes annonces
                  </NavLink>

                  {user.accountType === "shop" && (
                    <NavLink 
                      to="/my/stats" 
                      onClick={() => setIsMenuOpen(false)}
                      className={({ isActive }) => 
                        `flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 ${
                          isActive 
                            ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg' 
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200'
                        }`
                      }
                    >
                      <BarChart3 size={20} />
                      Statistiques
                    </NavLink>
                  )}

                  <NavLink 
                    to="/notifications" 
                    onClick={() => setIsMenuOpen(false)}
                    className="relative flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                    <Bell size={20} />
                    Notifications
                    {commentAlerts > 0 && (
                      <span className="ml-auto bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                        {commentAlerts}
                      </span>
                    )}
                  </NavLink>
                  <NavLink 
                    to="/orders"
                    onClick={() => setIsMenuOpen(false)}
                    className="relative flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                    <ClipboardList size={20} />
                    Mes commandes
                    {hasActiveOrders && (
                      <span className="ml-auto bg-indigo-600 text-white text-xs font-bold px-2 py-1 rounded-full">
                        {activeOrdersBadge}
                      </span>
                    )}
                  </NavLink>
                  {canManageSales && (
                    <NavLink
                      to="/seller/orders"
                      onClick={() => setIsMenuOpen(false)}
                      className="relative flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    >
                      <Package size={20} />
                      Commandes clients
                      {hasSellerOrders && (
                        <span className="ml-auto bg-emerald-600 text-white text-xs font-bold px-2 py-1 rounded-full">
                          {sellerOrdersBadge}
                        </span>
                      )}
                    </NavLink>
                  )}
                  {canAccessBackOffice && (
                    <NavLink
                      to="/admin/orders"
                      onClick={() => setIsMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    >
                      <ClipboardList size={20} />
                      Commandes admin
                    </NavLink>
                  )}
                  {canAccessBackOffice && (
                    <NavLink
                      to="/admin/delivery-guys"
                      onClick={() => setIsMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    >
                      <Truck size={20} />
                      Livreurs
                    </NavLink>
                  )}
                </>
              )}

              {/* Admin mobile */}
              {canAccessBackOffice && (
                <>
                  <NavLink 
                    to="/admin" 
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 font-medium hover:bg-amber-200 dark:hover:bg-amber-900/30 transition-colors"
                  >
                    <Settings size={20} />
                    {isManager ? "Espace gestionnaire" : "Administration"}
                    {waitingPayments > 0 && (
                      <span className="ml-auto bg-yellow-400 text-black text-xs font-bold px-2 py-1 rounded-full">
                        {waitingPayments}
                      </span>
                    )}
                  </NavLink>
                      {user?.role === 'admin' && (
                        <>
                          <NavLink
                            to="/admin/chat-templates"
                            onClick={() => setIsMenuOpen(false)}
                            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-900/20 text-gray-700 dark:text-gray-200 font-medium hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
                          >
                            <MessageSquare size={20} />
                            Chat templates
                          </NavLink>
                          <NavLink
                            to="/admin/product-boosts"
                            onClick={() => setIsMenuOpen(false)}
                            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-900/20 text-gray-700 dark:text-gray-200 font-medium hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
                          >
                            <Sparkles size={20} />
                            Boost produits
                          </NavLink>
                        </>
                      )}
                </>
              )}

              {/* Actions communes */}
              <NavLink 
                to="/favorites" 
                onClick={() => setIsMenuOpen(false)}
                className="relative flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                <Heart size={20} />
                Favoris
                {favoritesCount > 0 && (
                  <span className="ml-auto bg-pink-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                    {favoritesCount}
                  </span>
                )}
              </NavLink>

              <NavLink 
                to="/cart" 
                onClick={() => setIsMenuOpen(false)}
                className="relative flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                <ShoppingCart size={20} />
                Panier
                {cartCount > 0 && (
                  <span className="ml-auto bg-indigo-600 text-white text-xs font-bold px-2 py-1 rounded-full">
                    {cartCount}
                  </span>
                )}
              </NavLink>

              {/* Mode sombre mobile */}
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                {darkMode ? <Sun size={20} /> : <Moon size={20} />}
                {darkMode ? "Mode clair" : "Mode sombre"}
              </button>

              {/* Authentification mobile */}
              {!user ? (
                <div className="grid grid-cols-2 gap-3 pt-4 border-t border-gray-200 dark:border-gray-800">
                  <NavLink
                    to="/login"
                    onClick={() => setIsMenuOpen(false)}
                    className="px-4 py-3 rounded-xl border border-indigo-600 text-indigo-600 text-center font-medium hover:bg-indigo-50 transition-colors"
                  >
                    Connexion
                  </NavLink>
                  <NavLink
                    to="/register"
                    onClick={() => setIsMenuOpen(false)}
                    className="px-4 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-center font-medium hover:from-indigo-700 hover:to-purple-700 transition-colors"
                  >
                    Inscription
                  </NavLink>
                </div>
              ) : (
                <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
                  <button
                    onClick={() => {
                      logout();
                      setIsMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <LogOut size={20} />
                    Déconnexion
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* BARRE DE NAVIGATION FIXE MOBILE (TYPE ALIBABA) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-gray-900/95 border-t border-gray-200 dark:border-gray-800 shadow-xl backdrop-blur-xl">
        <div className="max-w-3xl mx-auto px-2 py-2">
          <div className="flex items-center justify-between text-xs font-semibold text-gray-500 dark:text-gray-300">
            <NavLink
              to="/"
              className={({ isActive }) =>
                `flex flex-col items-center justify-center flex-1 gap-1 py-1 rounded-xl transition-colors text-gray-500 dark:text-gray-300 ${
                  isActive ? "text-indigo-600" : ""
                }`
              }
            >
              <Home size={20} />
              Accueil
            </NavLink>

            <NavLink
              to="/shops/verified"
              className={({ isActive }) =>
                `flex flex-col items-center justify-center flex-1 gap-1 py-1 rounded-xl transition-colors text-gray-500 dark:text-gray-300 ${
                  isActive ? "text-indigo-600" : ""
                }`
              }
              onClick={() => setIsMenuOpen(false)}
            >
              <Store size={20} />
              Boutiques
            </NavLink>

            <NavLink
              to="/favorites"
              className={({ isActive }) =>
                `relative flex flex-col items-center justify-center flex-1 gap-1 py-1 rounded-xl transition-colors text-gray-500 dark:text-gray-300 ${
                  isActive ? "text-pink-600" : ""
                }`
              }
            >
              <Heart size={20} />
              Favoris
              {favoritesCount > 0 && (
                <span className="absolute -top-1 right-2 bg-pink-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {favoritesCount}
                </span>
              )}
            </NavLink>

            <NavLink
              to="/cart"
              className={({ isActive }) =>
                `relative flex flex-col items-center justify-center flex-1 gap-1 py-1 rounded-xl transition-colors text-gray-500 dark:text-gray-300 ${
                  isActive ? "text-indigo-600" : ""
                }`
              }
            >
              <ShoppingCart size={20} />
              Panier
              {cartCount > 0 && (
                <span className="absolute -top-1 right-2 bg-indigo-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {cartCount}
                </span>
              )}
            </NavLink>

            <button
              type="button"
              onClick={() => setIsMenuOpen(true)}
              className="flex flex-col items-center justify-center flex-1 gap-1 py-1 rounded-xl text-gray-500 dark:text-gray-300 transition-colors"
            >
              <Menu size={20} />
              Menu
            </button>
          </div>
        </div>
      </div>

      {/* ESPACES POUR LES BARRES FIXES */}
      <div className="h-16 lg:h-24"></div>
      <div className="md:hidden h-20"></div>
    </>
  );
}
