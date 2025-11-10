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
  Users,
  Package,
  Settings,
  Home,
  UserCircle,
  AlertCircle
} from "lucide-react";

/**
 * 🎨 NAVBAR PREMIUM HDMarket - Version Mobile First
 * - Pour les admins: "Mes annonces" retiré de la navbar desktop, conservé dans le dropdown
 * - Lien profil utilisateur amélioré sur mobile
 * - Gestion des erreurs robuste
 * - Design responsive optimisé
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

  // États
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

  // Mode sombre
  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  // Recherche avec gestion d'erreur améliorée
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setSearchError("");
      return;
    }
    
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

  return (
    <>
      {/* 🎯 NAVBAR PRINCIPALE */}
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-white/95 dark:bg-gray-900/95 shadow-lg border-b border-gray-200/50 dark:border-gray-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            
            {/* === LOGO HDMarket === */}
            <Link to="/" className="flex items-center space-x-3 group">
              <div className="w-9 h-9 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-105">
                <span className="text-white font-bold text-sm">HD</span>
              </div>
              <div className="hidden sm:flex flex-col">
                <span className="text-xl font-black bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  HDMarket
                </span>
                <span className="text-xs text-gray-500 -mt-1">Marketplace Premium</span>
              </div>
            </Link>

            {/* === PROFIL UTILISATEUR MOBILE - TOUJOURS VISIBLE === */}
            {user && (
              <div className="md:hidden flex items-center">
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
                  onMouseEnter={() => setIsShopMenuOpen(true)}
                  onMouseLeave={() => setIsShopMenuOpen(false)}
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
                    onMouseEnter={() => setIsShopMenuOpen(true)}
                    onMouseLeave={() => setIsShopMenuOpen(false)}
                  >
                    <div className="p-4 border-b border-gray-100 dark:border-gray-700">
                      <h3 className="font-bold text-gray-900 dark:text-white">Nos Boutiques</h3>
                      <p className="text-sm text-gray-500 mt-1">Découvrez nos vendeurs professionnels</p>
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
                              to={`/shop/${shop._id}`}
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
                                <span className="font-semibold text-gray-900 dark:text-white text-sm block group-hover:text-indigo-600 transition-colors">
                                  {shop.shopName}
                                </span>
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
                  {/* "Mes annonces" n'est affiché que pour les non-admins sur desktop */}
                  {user.role !== "admin" && (
                    <NavLink 
                      to="/my" 
                      className={({ isActive }) => 
                        `flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-200 ${
                          isActive 
                            ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg' 
                            : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
                        }`
                      }
                    >
                      <Package size={18} />
                      <span className="font-medium">Mes annonces</span>
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
                </>
              )}

              {/* Admin */}
              {user?.role === "admin" && (
                <NavLink 
                  to="/admin" 
                  className="relative flex items-center gap-2 px-3 py-2 rounded-xl text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-all duration-200"
                >
                  <Settings size={18} />
                  <span className="font-medium">Admin</span>
                  {waitingPayments > 0 && (
                    <span className="absolute -top-1 -right-1 bg-yellow-400 text-black text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                      {waitingPayments}
                    </span>
                  )}
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
        <div className="hidden lg:block border-t border-gray-200 dark:border-gray-800 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm">
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
                  
                  {/* RÉSULTATS DE RECHERCHE POUR BARRE DESCENDUE */}
                  {showResults && (searchResults.length > 0 || searchQuery.trim()) && (
                    <div className="absolute top-14 left-0 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl max-h-80 overflow-auto z-50">
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
                            <span className="text-gray-500 text-xs flex items-center gap-2 mt-1">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                product.type === 'shop'
                                  ? 'bg-green-100 text-green-700'
                                  : product.type === 'category'
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-indigo-100 text-indigo-700'
                              }`}>
                                {product.type === 'shop' ? 'Boutique' : product.type === 'category' ? 'Catégorie' : 'Produit'}
                              </span>
                              <span className="truncate">
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
            </div>
          </div>
        </div>

        {/* === BARRE DE RECHERCHE MOBILE === */}
        <div className="lg:hidden border-t border-gray-200 dark:border-gray-800 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm">
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
            </div>
          </div>
        </div>
      </nav>

      {/* === MENU MOBILE === */}
      {isMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 pt-16">
          <div 
            className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            onClick={() => setIsMenuOpen(false)}
          />
          <div className="absolute top-0 left-0 right-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border-b border-gray-200 dark:border-gray-800 shadow-xl max-h-[80vh] overflow-auto">
            <div className="max-w-7xl mx-auto px-4 py-4">
              <div className="grid gap-2">
                
                {/* PROFIL UTILISATEUR MOBILE AMÉLIORÉ */}
                {user && (
                  <div className="pb-3 border-b border-gray-200 dark:border-gray-700 mb-2">
                    <Link 
                      to="/profile"
                      onClick={() => setIsMenuOpen(false)}
                      className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border border-indigo-100 dark:border-indigo-800 hover:shadow-md transition-all duration-200"
                    >
                      <div className="w-12 h-12 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center shadow-md">
                        <UserCircle className="text-white" size={20} />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900 dark:text-white text-sm">
                          {user.name || "Utilisateur"}
                        </p>
                        <p className="text-xs text-gray-500 truncate">{user.email}</p>
                        <p className="text-xs text-indigo-600 font-medium mt-1 flex items-center gap-1">
                          Voir mon profil <ChevronDown size={12} className="rotate-270" />
                        </p>
                      </div>
                    </Link>
                  </div>
                )}

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

                {/* Boutiques mobile avec gestion d'erreur */}
                <div className="space-y-2">
                  <button
                    onClick={() => setIsMobileShopsOpen(!isMobileShopsOpen)}
                    className="flex items-center justify-between w-full px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Store size={20} />
                      Boutiques
                    </div>
                    <ChevronDown
                      size={16}
                      className={`transition-transform ${isMobileShopsOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  
                  {isMobileShopsOpen && (
                    <div className="ml-4 space-y-2 rounded-xl bg-gray-50 dark:bg-gray-800/50 p-3 border border-gray-200 dark:border-gray-700">
                      {shopsLoading ? (
                        <div className="flex items-center justify-center py-4">
                          <div className="animate-spin rounded-full h-6 w-6 border-2 border-indigo-600 border-t-transparent"></div>
                        </div>
                      ) : shopsError ? (
                        <div className="text-red-500 text-sm text-center py-2 flex items-center justify-center gap-2">
                          <AlertCircle size={16} />
                          {shopsError}
                        </div>
                      ) : shops.length === 0 ? (
                        <div className="text-gray-500 text-sm text-center py-2">
                          Aucune boutique disponible
                        </div>
                      ) : (
                        shops.map((shop) => (
                          <Link
                            key={shop._id}
                            to={`/shop/${shop._id}`}
                            onClick={() => {
                              setIsMenuOpen(false);
                              setIsMobileShopsOpen(false);
                            }}
                            className="flex items-center gap-3 p-3 rounded-lg hover:bg-white dark:hover:bg-gray-700 transition-colors border border-transparent hover:border-gray-200 dark:hover:border-gray-600"
                          >
                            <img
                              src={shop.shopLogo || "/api/placeholder/50/50"}
                              alt={shop.shopName}
                              className="h-10 w-10 rounded-lg object-cover border border-gray-200 dark:border-gray-600"
                              onError={(e) => {
                                e.target.src = "/api/placeholder/50/50";
                              }}
                            />
                            <div className="flex-1">
                              <p className="font-semibold text-gray-900 dark:text-white text-sm">
                                {shop.shopName}
                              </p>
                              <p className="text-xs text-gray-500">
                                {shop.productCount || 0} annonce{shop.productCount > 1 ? "s" : ""}
                              </p>
                            </div>
                          </Link>
                        ))
                      )}
                    </div>
                  )}
                </div>

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
                  </>
                )}

                {/* Admin mobile */}
                {user?.role === "admin" && (
                  <>
                    <NavLink 
                      to="/admin" 
                      onClick={() => setIsMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 font-medium hover:bg-amber-200 dark:hover:bg-amber-900/30 transition-colors"
                    >
                      <Settings size={20} />
                      Administration
                      {waitingPayments > 0 && (
                        <span className="ml-auto bg-yellow-400 text-black text-xs font-bold px-2 py-1 rounded-full">
                          {waitingPayments}
                        </span>
                      )}
                    </NavLink>
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
        </div>
      )}

      {/* ESPACE POUR LA NAVBAR FIXE */}
      <div className="h-16 lg:h-24"></div>
    </>
  );
}