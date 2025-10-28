import React, { useContext, useState, useEffect } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import AuthContext from "../context/AuthContext";
import CartContext from "../context/CartContext";
import FavoriteContext from "../context/FavoriteContext";
import useAdminCounts from "../hooks/useAdminCounts";
import useUserNotifications from "../hooks/useUserNotifications";
import api from "../services/api";
import {
  ShoppingCart,
  Bell,
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
  Users
} from "lucide-react";

/**
 * 🎨 Navbar moderne et responsive pour HDMarket
 * - Mobile-first avec menu hamburger
 * - Recherche globale
 * - Notifications + panier avec badges
 * - Menu utilisateur déroulant
 * - Mode clair/sombre (optionnel)
 */
export default function Navbar() {
  const navigate = useNavigate();
  const { user, logout } = useContext(AuthContext);
  const { cart } = useContext(CartContext);
  const { favorites } = useContext(FavoriteContext);
  const cartCount = cart?.totals?.quantity || 0;
  const favoritesCount = favorites.length;

  const { counts } = useAdminCounts(user?.role === "admin");
  const waitingPayments = counts.waitingPayments || 0;
  const { counts: userNotifications } = useUserNotifications(Boolean(user));
  const commentAlerts = userNotifications.commentAlerts || 0;

  // États du menu mobile et du mode clair/sombre
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [shops, setShops] = useState([]);
  const [shopsLoading, setShopsLoading] = useState(false);
  const [shopsError, setShopsError] = useState("");
  const [isShopMenuOpen, setIsShopMenuOpen] = useState(false);
  const [isMobileShopsOpen, setIsMobileShopsOpen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setSearchError("");
      return;
    }
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      setSearching(true);
      try {
        const { data } = await api.get(`/search?q=${encodeURIComponent(searchQuery)}`, {
          signal: controller.signal
        });
        setSearchResults(Array.isArray(data?.products) ? data.products : []);
        setSearchError("");
        setShowResults(true);
      } catch (e) {
        if (e.name !== "CanceledError" && e.name !== "AbortError") {
          setSearchError("Erreur lors de la recherche");
        }
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [searchQuery]);

  const handleSelectResult = (item) => {
    setShowResults(false);
    setSearchQuery("");
    setSearchResults([]);
    if (item?.type === 'shop') {
      navigate(`/shop/${item._id}`);
    } else {
      navigate(`/product/${item._id}`);
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
      } catch (e) {
        if (!cancelled) {
          setShopsError("Impossible de charger les boutiques.");
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

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-lg bg-white/70 dark:bg-gray-900/70 shadow-sm border-b border-gray-200 dark:border-gray-800 transition">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* === LOGO === */}
          <Link
            to="/"
            className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 tracking-tight"
          >
            HDMarket
          </Link>

          {/* === ACTIONS (Desktop) === */}
          <div className="hidden md:flex items-center gap-5">
            <NavLink to="/" className="hover:text-indigo-600">
              Accueil
            </NavLink>
            <div
              className="relative"
              onMouseEnter={() => setIsShopMenuOpen(true)}
              onMouseLeave={() => setIsShopMenuOpen(false)}
            >
              <button
                type="button"
                onClick={() => setIsShopMenuOpen((prev) => !prev)}
                onFocus={() => setIsShopMenuOpen(true)}
                className="inline-flex items-center gap-1 hover:text-indigo-600"
              >
                <Store size={18} />
                Boutiques
                <ChevronDown
                  size={16}
                  className={`transition-transform ${isShopMenuOpen ? "rotate-180" : ""}`}
                />
              </button>
              {isShopMenuOpen && (
                <div className="absolute left-0 mt-2 w-72 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-40 p-3 space-y-2">
                  {shopsLoading ? (
                    <p className="text-sm text-gray-500">Chargement…</p>
                  ) : shopsError ? (
                    <p className="text-sm text-red-600">{shopsError}</p>
                  ) : shops.length === 0 ? (
                    <p className="text-sm text-gray-500">Aucune boutique enregistrée pour le moment.</p>
                  ) : (
                    <ul className="space-y-2 max-h-72 overflow-auto">
                      {shops.map((shop) => (
                        <li key={shop._id}>
                          <Link
                            to={`/shop/${shop._id}`}
                            className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                            onClick={() => setIsShopMenuOpen(false)}
                          >
                            <img
                              src={shop.shopLogo || "https://via.placeholder.com/50"}
                              alt={shop.shopName}
                              className="h-10 w-10 rounded-full object-cover border border-gray-200 dark:border-gray-700"
                              loading="lazy"
                            />
                            <div className="flex flex-col text-sm">
                              <span className="font-semibold text-gray-900 dark:text-white">
                                {shop.shopName}
                              </span>
                              <span className="text-xs text-gray-500">
                                {shop.shopAddress || "Adresse non renseignée"}
                              </span>
                              <span className="text-xs text-indigo-600">
                                {shop.productCount} annonce{shop.productCount > 1 ? "s" : ""}
                              </span>
                            </div>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            {user && (
              <>
                <NavLink to="/my" className="hover:text-indigo-600">
                  Mes annonces
                </NavLink>
                <NavLink to="/notifications" className="relative hover:text-indigo-600">
                  <Bell size={20} />
                  {commentAlerts > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
                      {commentAlerts}
                    </span>
                  )}
                </NavLink>
              </>
            )}

            {user?.role === "admin" && (
              <>
                <NavLink to="/admin" className="relative hover:text-indigo-600">
                  <Bell size={20} />
                  {waitingPayments > 0 && (
                    <span className="absolute -top-1 -right-1 bg-yellow-400 text-black text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
                      {waitingPayments}
                    </span>
                  )}
                </NavLink>
                <NavLink to="/admin/users" className="flex items-center gap-1 hover:text-indigo-600 text-sm">
                  <Users size={18} />
                  Gestion utilisateurs
                </NavLink>
              </>
            )}

            {/* Favoris */}
            <NavLink to="/favorites" className="relative hover:text-indigo-600">
              <Heart size={20} />
              {favoritesCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-pink-500 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
                  {favoritesCount}
                </span>
              )}
            </NavLink>

            {/* Panier */}
            <NavLink to="/cart" className="relative hover:text-indigo-600">
              <ShoppingCart size={20} />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-indigo-600 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
                  {cartCount}
                </span>
              )}
            </NavLink>

            {/* Mode clair/sombre */}
            <button
              onClick={() => setDarkMode((p) => !p)}
              className="hover:text-indigo-600"
            >
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {/* Utilisateur */}
            {!user ? (
              <div className="flex items-center gap-3">
                <NavLink
                  to="/login"
                  className="px-3 py-1 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition"
                >
                  Connexion
                </NavLink>
                <NavLink
                  to="/register"
                  className="px-3 py-1 border border-indigo-600 text-indigo-600 rounded-lg hover:bg-indigo-50 transition"
                >
                  Inscription
                </NavLink>
              </div>
            ) : (
              <div className="relative group">
                <button className="flex items-center gap-2 hover:text-indigo-600">
                  <User size={20} />
                  <span>{user.name || "Mon compte"}</span>
                </button>
                {/* Menu déroulant */}
                <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-gray-800 border rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                  <Link
                    to="/profile"
                    className="block px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    Profil
                  </Link>
                  <button
                    onClick={logout}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <LogOut size={14} className="inline mr-1" /> Déconnexion
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* === BOUTON MOBILE === */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden p-2 text-gray-700 dark:text-gray-200"
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* === SEARCH BAR (Desktop, second row) === */}
      <div className="hidden md:flex justify-center px-4 sm:px-6 lg:px-8 pb-3">
        <div className="relative w-full max-w-3xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher par produit, catégorie ou boutique"
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            onFocus={() => setShowResults(true)}
            onKeyDown={handleSearchKeyDown}
            onBlur={() => setTimeout(() => setShowResults(false), 150)}
          />
          {showResults && (searchResults.length > 0 || searchQuery.trim()) && (
            <div
              className="absolute top-11 left-0 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg max-h-80 overflow-auto z-50"
              onMouseDown={(e) => e.preventDefault()}
            >
              {searching && (
                <p className="px-4 py-2 text-sm text-gray-500">Recherche…</p>
              )}
              {!searching && searchError && (
                <p className="px-4 py-2 text-sm text-red-500">{searchError}</p>
              )}
              {!searching && !searchError && searchResults.length === 0 && (
                <p className="px-4 py-2 text-sm text-gray-500">
                  Aucun résultat pour « {searchQuery} »
                </p>
              )}
              {searchResults.map((product) => (
                <button
                  key={product._id}
                  type="button"
                  onClick={() => handleSelectResult(product)}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3"
                >
                  <img
                    src={product.image || product.shopLogo || "https://via.placeholder.com/60"}
                    alt={product.title}
                    className="h-10 w-10 rounded object-cover"
                  />
                  <div className="flex flex-col text-sm">
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {product.title}
                    </span>
                    <span className="text-gray-500 flex items-center gap-1">
                      <span className="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-700 px-2 py-0.5 text-[11px] uppercase tracking-wide font-semibold text-gray-700 dark:text-gray-200">
                        {product.type === 'shop'
                          ? 'Boutique'
                          : product.type === 'category'
                          ? 'Catégorie'
                          : 'Produit'}
                      </span>
                      <span>
                        {product.type === 'shop'
                          ? product.shopAddress || 'Adresse non renseignée'
                          : product.type === 'category'
                          ? product.category
                          : `${product.category}${product.shopName ? ` • ${product.shopName}` : ''}`}
                      </span>
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* === MENU MOBILE === */}
      {isMenuOpen && (
        <div className="md:hidden bg-white/95 dark:bg-gray-900/95 border-t border-gray-200 dark:border-gray-800">
          <div className="flex flex-col space-y-2 p-4 text-sm">
            <div className="relative">
              <div className="flex items-center border rounded-lg px-3 py-2 bg-white dark:bg-gray-800">
                <Search className="text-gray-400 mr-2" size={18} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher un produit, une catégorie ou une boutique"
                  className="flex-1 bg-transparent text-sm focus:outline-none"
                  onFocus={() => setShowResults(true)}
                  onKeyDown={handleSearchKeyDown}
                  onBlur={() => setTimeout(() => setShowResults(false), 150)}
                />
              </div>
              {showResults && (searchResults.length > 0 || searchQuery.trim()) && (
                <div
                  className="absolute left-0 right-0 mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg max-h-60 overflow-auto z-50"
                  onMouseDown={(e) => e.preventDefault()}
                >
                  {searching && (
                    <p className="px-4 py-2 text-sm text-gray-500">Recherche…</p>
                  )}
                  {!searching && searchError && (
                    <p className="px-4 py-2 text-sm text-red-500">{searchError}</p>
                  )}
                  {!searching && !searchError && searchResults.length === 0 && (
                    <p className="px-4 py-2 text-sm text-gray-500">
                      Aucun résultat pour « {searchQuery} »
                    </p>
                  )}
                  {searchResults.map((product) => (
                    <button
                      key={product._id}
                      type="button"
                      onClick={() => {
                        setIsMenuOpen(false);
                        handleSelectResult(product);
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3"
                    >
                      <img
                      src={product.image || product.shopLogo || "https://via.placeholder.com/60"}
                        alt={product.title}
                        className="h-10 w-10 rounded object-cover"
                      />
                      <div className="flex flex-col text-sm">
                        <span className="font-semibold text-gray-900 dark:text-white">
                          {product.title}
                        </span>
                        <span className="text-gray-500 flex items-center gap-1">
                          <span className="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-700 px-2 py-0.5 text-[11px] uppercase tracking-wide font-semibold text-gray-700 dark:text-gray-200">
                            {product.type === 'shop'
                              ? 'Boutique'
                              : product.type === 'category'
                              ? 'Catégorie'
                              : 'Produit'}
                          </span>
                          <span>
                            {product.type === 'shop'
                              ? product.shopAddress || 'Adresse non renseignée'
                              : product.type === 'category'
                              ? product.category
                              : `${product.category}${product.shopName ? ` • ${product.shopName}` : ''}`}
                          </span>
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <NavLink to="/" onClick={() => setIsMenuOpen(false)}>
              Accueil
            </NavLink>
            <button
              type="button"
              onClick={() => setIsMobileShopsOpen((prev) => !prev)}
              className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-left"
            >
              <span className="inline-flex items-center gap-2">
                <Store size={16} />
                Boutiques
              </span>
              <ChevronDown
                size={16}
                className={`transition-transform ${isMobileShopsOpen ? "rotate-180" : ""}`}
              />
            </button>
            {isMobileShopsOpen && (
              <div className="space-y-2 rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-xs text-gray-600 dark:text-gray-300">
                {shopsLoading ? (
                  <p>Chargement…</p>
                ) : shopsError ? (
                  <p className="text-red-500">{shopsError}</p>
                ) : shops.length === 0 ? (
                  <p>Aucune boutique enregistrée.</p>
                ) : (
                  shops.map((shop) => (
                    <Link
                      key={shop._id}
                      to={`/shop/${shop._id}`}
                      onClick={() => {
                        setIsMenuOpen(false);
                        setIsMobileShopsOpen(false);
                      }}
                      className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-white dark:hover:bg-gray-700 transition"
                    >
                      <img
                        src={shop.shopLogo || "https://via.placeholder.com/50"}
                        alt={shop.shopName}
                        className="h-8 w-8 rounded-full object-cover border border-gray-200 dark:border-gray-700"
                        loading="lazy"
                      />
                      <div className="flex-1">
                        <p className="font-medium text-gray-800 dark:text-white text-sm">{shop.shopName}</p>
                        <p>{shop.productCount} annonce{shop.productCount > 1 ? "s" : ""}</p>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            )}
            {user && (
              <>
                <NavLink to="/my" onClick={() => setIsMenuOpen(false)}>
                  Mes annonces
                </NavLink>
                <NavLink to="/notifications" onClick={() => setIsMenuOpen(false)}>
                  Notifications
                </NavLink>
              </>
            )}
            {user?.role === "admin" && (
              <NavLink to="/admin" onClick={() => setIsMenuOpen(false)}>
                Tableau Admin
              </NavLink>
            )}
            {user?.role === "admin" && (
              <NavLink to="/admin/users" onClick={() => setIsMenuOpen(false)}>
                Gestion utilisateurs
              </NavLink>
            )}
            <NavLink to="/favorites" onClick={() => setIsMenuOpen(false)}>
              Favoris ({favoritesCount})
            </NavLink>
            <NavLink to="/cart" onClick={() => setIsMenuOpen(false)}>
              Panier ({cartCount})
            </NavLink>

            {!user ? (
              <>
                <NavLink to="/login" onClick={() => setIsMenuOpen(false)}>
                  Connexion
                </NavLink>
                <NavLink to="/register" onClick={() => setIsMenuOpen(false)}>
                  Inscription
                </NavLink>
              </>
            ) : (
              <button
                onClick={() => {
                  logout();
                  setIsMenuOpen(false);
                }}
                className="text-left text-red-600"
              >
                Déconnexion
              </button>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
