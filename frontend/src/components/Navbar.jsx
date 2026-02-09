import React, { useContext, useState, useEffect, useCallback, useRef } from "react";
import { Link, NavLink, useNavigate, useLocation } from "react-router-dom";
import AuthContext from "../context/AuthContext";
import CartContext from "../context/CartContext";
import FavoriteContext from "../context/FavoriteContext";
import useAdminCounts from "../hooks/useAdminCounts";
import useUserNotifications from "../hooks/useUserNotifications";
import api from "../services/api";
import { buildProductPath, buildShopPath } from "../utils/links";
import { getCachedSearch, setCachedSearch } from "../utils/searchCache.js";
import categoryGroups from "../data/categories";
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
  ChevronRight,
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
  Truck,
  CheckCircle,
  FileText,
  SlidersHorizontal,
  Star,
  Tag,
  Filter,
  MapPin,
  Clock,
  TrendingUp,
  Download,
  Pin,
  PinOff,
  Calendar,
  Flame,
  Zap,
  Bookmark,
  BookmarkCheck,
  Save,
  ArrowDown,
  ChevronUp,
  MoreVertical,
  Edit,
  Grid3x3,
  Plus
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

const highlightText = (text, query) => {
  if (!query || !text) return text;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);
  return parts.map((part, index) =>
    regex.test(part) ? (
      <mark key={index} className="bg-yellow-200 text-gray-900 rounded px-0.5">
        {part}
      </mark>
    ) : (
      part
    )
  );
};

const formatCurrency = (value) => {
  const num = Number(value);
  if (Number.isNaN(num)) return '0 FCFA';
  return num.toLocaleString('fr-FR') + ' FCFA';
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
  const [unreadOrderMessages, setUnreadOrderMessages] = useState(0);

  const isAdmin = user?.role === "admin";
  const isManager = user?.role === "manager";
  const canAccessBackOffice = isAdmin || isManager;
  const canVerifyPayments = Boolean(user?.canVerifyPayments);
  const adminLinkLabel = isManager ? "Gestion" : "Admin";

  // Enable admin counts for admins, managers, and users with payment verification access
  const shouldLoadAdminCounts = canAccessBackOffice || canVerifyPayments;
  const { counts } = useAdminCounts(shouldLoadAdminCounts);
  const waitingPayments = counts.waitingPayments || 0;
  const unreadFeedback = counts.unreadFeedback || 0;
  const { counts: userNotifications } = useUserNotifications(Boolean(user));
  const commentAlerts = userNotifications.commentAlerts || 0;
  const hasActiveOrders = activeOrders > 0;
  const activeOrdersBadge = activeOrders > 99 ? '99+' : activeOrders;
  const hasSellerOrders = sellerOrders > 0;
  const sellerOrdersBadge = sellerOrders > 99 ? '99+' : sellerOrders;
  const hasUnreadOrderMessages = unreadOrderMessages > 0;
  const unreadOrderMessagesBadge = unreadOrderMessages > 99 ? '99+' : unreadOrderMessages;

  // États
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState({ products: [], shops: [], categories: [], totals: { products: 0, shops: 0, categories: 0, total: 0 } });
  const [displayedResults, setDisplayedResults] = useState({ products: [], shops: [], categories: [], totals: { products: 0, shops: 0, categories: 0, total: 0 } });
  const [resultsLimit, setResultsLimit] = useState({ products: 5, shops: 3, categories: 3 }); // Initial display limits
  const [showResults, setShowResults] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [isHistoryPanelOpen, setIsHistoryPanelOpen] = useState(false);
  const [searchHistory, setSearchHistory] = useState([]);
  const [groupedHistory, setGroupedHistory] = useState({ pinned: [], today: [], yesterday: [], thisWeek: [], older: [] });
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [showHistoryGrouped, setShowHistoryGrouped] = useState(true);
  const [relatedSearches, setRelatedSearches] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    category: '',
    minPrice: '',
    maxPrice: '',
    city: '',
    shopVerified: false,
    condition: ''
  });
  const [availableCategories, setAvailableCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [shops, setShops] = useState([]);
  const [shopsLoading, setShopsLoading] = useState(false);
  const [shopsError, setShopsError] = useState("");
  const [appLogos, setAppLogos] = useState({ desktop: "", mobile: "" });
  const [isShopMenuOpen, setIsShopMenuOpen] = useState(false);
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);
  const shopMenuCloseRef = useRef(null);
  const categoryMenuCloseRef = useRef(null);
  const [isMobileLayout, setIsMobileLayout] = useState(() =>
    typeof window === 'undefined' ? false : window.innerWidth < 1024
  );
  const shouldHideSearchBar = isMenuOpen && isMobileLayout;
  const historyPanelOpenRef = useRef(isHistoryPanelOpen);
  const searchInputRef = useRef(null);
  const searchOverlayRef = useRef(null);
  const [isSearchFullScreen, setIsSearchFullScreen] = useState(false);
  const [savedSearches, setSavedSearches] = useState([]);
  const [searchTemplates, setSearchTemplates] = useState(() => [
    { id: 'new_products', label: 'Nouveaux produits', path: '/products?sort=new', icon: Sparkles },
    { id: 'top_deals', label: 'Meilleures offres', path: '/products?sort=price_asc', icon: Flame },
    { id: 'verified_shops', label: 'Boutiques vérifiées', path: '/shops/verified', icon: ShieldCheck },
    { id: 'trending', label: 'Tendances', path: '/products?sort=popular', icon: TrendingUp }
  ]);
  const [touchStartY, setTouchStartY] = useState(null);
  const [showBottomSheet, setShowBottomSheet] = useState(false);
  const [bottomBarExpanded, setBottomBarExpanded] = useState(false);
  const [bottomBarTouchStart, setBottomBarTouchStart] = useState(null);
  const [longPressTimer, setLongPressTimer] = useState(null);
  const [showQuickActions, setShowQuickActions] = useState(null); // ID of item showing quick actions
  const [customNavItems, setCustomNavItems] = useState(null); // Will be loaded from localStorage
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

  useEffect(() => {
    if (!user) {
      setUnreadOrderMessages(0);
      return () => {};
    }

    let cancelled = false;
    let intervalId;

    const fetchUnreadOrderMessages = async () => {
      try {
        const { data } = await api.get('/orders/messages/unread');
        if (!cancelled) {
          setUnreadOrderMessages(data?.unreadCount || 0);
        }
      } catch (error) {
        if (!cancelled) {
          setUnreadOrderMessages(0);
        }
      }
    };

    fetchUnreadOrderMessages();
    intervalId = setInterval(fetchUnreadOrderMessages, 30000); // Check every 30 seconds

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [user]);

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

  const clearCategoryMenuTimeout = useCallback(() => {
    if (categoryMenuCloseRef.current) {
      clearTimeout(categoryMenuCloseRef.current);
      categoryMenuCloseRef.current = null;
    }
  }, []);

  const handleCategoryMenuOpen = useCallback(() => {
    clearCategoryMenuTimeout();
    setIsCategoryMenuOpen(true);
  }, [clearCategoryMenuTimeout]);

  const handleCategoryMenuDelayedClose = useCallback(() => {
    clearCategoryMenuTimeout();
    categoryMenuCloseRef.current = setTimeout(() => {
      setIsCategoryMenuOpen(false);
      categoryMenuCloseRef.current = null;
    }, 1500);
  }, [clearCategoryMenuTimeout]);

  useEffect(() => {
    return () => {
      clearShopMenuTimeout();
      clearCategoryMenuTimeout();
    };
  }, [clearShopMenuTimeout, clearCategoryMenuTimeout]);

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
    if (isMenuOpen || isSearchFullScreen) {
      body.style.overflow = 'hidden';
      if (isMenuOpen) body.classList.add('menu-open');
    } else {
      body.style.overflow = '';
      body.classList.remove('menu-open');
    }
    return () => {
      body.style.overflow = '';
      body.classList.remove('menu-open');
    };
  }, [isMenuOpen, isSearchFullScreen]);

  // Keyboard shortcut: '/' to focus search
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const handleKeyDown = (e) => {
      // Only trigger if not typing in an input/textarea
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
        return;
      }
      // Check for '/' key
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        if (searchInputRef.current) {
          searchInputRef.current.focus();
          if (isMobileLayout) {
            setIsSearchFullScreen(true);
          }
        }
      }
      // ESC to close search overlay
      if (e.key === 'Escape' && (isSearchFullScreen || showResults)) {
        setIsSearchFullScreen(false);
        setShowResults(false);
        setIsHistoryPanelOpen(false);
        if (searchInputRef.current) {
          searchInputRef.current.blur();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isMobileLayout, isSearchFullScreen, showResults]);

  // Load saved searches from localStorage (user only)
  useEffect(() => {
    if (!user) {
      setSavedSearches([]);
      return;
    }
    try {
      const saved = localStorage.getItem('hdmarket_saved_searches');
      if (saved) {
        setSavedSearches(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Error loading saved searches:', e);
    }
  }, [user]);

  // Load quick filters from backend (Nouveaux produits, Meilleures offres, etc.)
  const QUICK_FILTER_ICONS = { sparkles: Sparkles, flame: Flame, 'shield-check': ShieldCheck, 'trending-up': TrendingUp };
  useEffect(() => {
    let cancelled = false;
    api.get('/search/quick-filters')
      .then(({ data }) => {
        if (cancelled || !Array.isArray(data) || data.length === 0) return;
        const withIcons = data.map((t) => ({
          ...t,
          icon: QUICK_FILTER_ICONS[t.icon] || Sparkles
        }));
        setSearchTemplates(withIcons);
      })
      .catch(() => { /* keep initial default templates */ });
    return () => { cancelled = true; };
  }, []);

  // Load custom navigation items from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('hdmarket_custom_nav_items');
      if (saved) {
        setCustomNavItems(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Error loading custom nav items:', e);
    }
  }, []);

  // Default navigation items
  const defaultNavItems = [
    { id: 'home', label: 'Accueil', path: '/', icon: Home, badge: null, visible: true, order: 0 },
    { id: 'shops', label: 'Boutiques', path: '/shops/verified', icon: Store, badge: null, visible: true, order: 1 },
    { id: 'favorites', label: 'Favoris', path: '/favorites', icon: Heart, badge: favoritesCount, visible: true, order: 2 },
    { id: 'cart', label: 'Panier', path: '/cart', icon: ShoppingCart, badge: cartCount, visible: true, order: 3 },
    { id: 'menu', label: 'Menu', path: null, icon: Menu, badge: null, visible: true, order: 4, isButton: true },
    // Additional items for expanded view
    { id: 'profile', label: 'Profil', path: '/profile', icon: User, badge: null, visible: user ? true : false, order: 5 },
    { id: 'notifications', label: 'Notifications', path: '/notifications', icon: Bell, badge: commentAlerts, visible: user ? true : false, order: 6 },
    { id: 'orders', label: 'Commandes', path: '/orders', icon: ClipboardList, badge: activeOrders, visible: user ? true : false, order: 7 },
    { id: 'messages', label: 'Messages', path: '/orders/messages', icon: MessageSquare, badge: unreadOrderMessages, visible: user ? true : false, order: 8 },
    { id: 'my', label: 'Mes annonces', path: '/my', icon: Package, badge: null, visible: user ? true : false, order: 9 },
    { id: 'shop-conversion', label: 'Devenir Boutique', path: '/shop-conversion-request', icon: Store, badge: null, visible: user && user.accountType !== 'shop' ? true : false, order: 10 },
    { id: 'suggestions', label: 'Suggestions', path: '/suggestions', icon: Sparkles, badge: null, visible: true, order: 11 }
  ];

  const navItems = customNavItems || defaultNavItems;
  const primaryItems = navItems.filter(item => item.visible && item.order < 5).sort((a, b) => a.order - b.order);
  const secondaryItems = navItems.filter(item => item.visible && item.order >= 5).sort((a, b) => a.order - b.order);

  // Bottom bar swipe gesture handlers
  const handleBottomBarTouchStart = (e) => {
    setBottomBarTouchStart(e.touches[0].clientY);
    // Long press detection
    const timer = setTimeout(() => {
      const itemId = e.currentTarget.dataset.itemId;
      if (itemId) {
        setShowQuickActions(itemId);
        triggerHaptic('medium');
      }
    }, 500); // 500ms for long press
    setLongPressTimer(timer);
  };

  const handleBottomBarTouchMove = (e) => {
    if (bottomBarTouchStart === null) return;
    const touchY = e.touches[0].clientY;
    const diff = bottomBarTouchStart - touchY; // Negative for swipe up
    
    // Cancel long press if moved
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
    
    // Swipe up to expand (only if not already expanded)
    if (!bottomBarExpanded && diff > 20) {
      setBottomBarExpanded(true);
      triggerHaptic('light');
    }
  };

  const handleBottomBarTouchEnd = (e) => {
    // Clear long press timer
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
    setBottomBarTouchStart(null);
  };

  // Save custom navigation items
  const saveCustomNavItems = (items) => {
    try {
      localStorage.setItem('hdmarket_custom_nav_items', JSON.stringify(items));
      setCustomNavItems(items);
      triggerHaptic('success');
    } catch (e) {
      console.error('Error saving custom nav items:', e);
    }
  };

  // Quick actions for navigation items
  const getQuickActions = (itemId) => {
    const actions = {
      home: [
        { label: 'Rechercher', action: () => { if (searchInputRef.current) searchInputRef.current.focus(); triggerHaptic('light'); } },
        { label: 'Nouveaux produits', action: () => { navigate('/products?sort=newest'); triggerHaptic('light'); } }
      ],
      favorites: [
        { label: 'Vider les favoris', action: () => { /* Clear favorites */ triggerHaptic('warning'); } }
      ],
      cart: [
        { label: 'Vider le panier', action: () => { /* Clear cart */ triggerHaptic('warning'); } },
        { label: 'Voir le panier', action: () => { navigate('/cart'); triggerHaptic('light'); } }
      ],
      profile: [
        { label: 'Paramètres', action: () => { navigate('/profile'); triggerHaptic('light'); } },
        { label: 'Statistiques', action: () => { navigate('/my/stats'); triggerHaptic('light'); } }
      ],
      notifications: [
        { label: 'Marquer tout lu', action: () => { /* Mark all read */ triggerHaptic('light'); } },
        { label: 'Paramètres notifications', action: () => { navigate('/profile'); triggerHaptic('light'); } }
      ]
    };
    return actions[itemId] || [];
  };

  // Swipe gesture handler for mobile
  const handleTouchStart = (e) => {
    if (!isMobileLayout || !isSearchFullScreen) return;
    setTouchStartY(e.touches[0].clientY);
  };

  const handleTouchMove = (e) => {
    if (!isMobileLayout || !isSearchFullScreen || touchStartY === null) return;
    const touchY = e.touches[0].clientY;
    const diff = touchY - touchStartY;
    // Only allow downward swipe
    if (diff > 0 && searchOverlayRef.current) {
      searchOverlayRef.current.style.transform = `translateY(${Math.min(diff, 100)}px)`;
      searchOverlayRef.current.style.opacity = `${1 - diff / 300}`;
    }
  };

  const handleTouchEnd = (e) => {
    if (!isMobileLayout || !isSearchFullScreen || touchStartY === null) return;
    const touchY = e.changedTouches[0].clientY;
    const diff = touchY - touchStartY;
    if (diff > 100) {
      // Swipe down threshold reached, close overlay
      setIsSearchFullScreen(false);
      setShowResults(false);
      setIsHistoryPanelOpen(false);
      if (searchInputRef.current) {
        searchInputRef.current.blur();
      }
      // Haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    } else if (searchOverlayRef.current) {
      // Reset position
      searchOverlayRef.current.style.transform = '';
      searchOverlayRef.current.style.opacity = '';
    }
    setTouchStartY(null);
  };

  // Enhanced haptic feedback helper with different patterns
  const triggerHaptic = (pattern = 50) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      if (typeof pattern === 'string') {
        // Pattern presets
        switch (pattern) {
          case 'light':
            navigator.vibrate(25);
            break;
          case 'medium':
            navigator.vibrate(50);
            break;
          case 'heavy':
            navigator.vibrate(100);
            break;
          case 'success':
            navigator.vibrate([50, 30, 50]);
            break;
          case 'error':
            navigator.vibrate([100, 50, 100]);
            break;
          case 'warning':
            navigator.vibrate([75, 50, 75]);
            break;
          default:
            navigator.vibrate(50);
        }
      } else {
        navigator.vibrate(pattern);
      }
    }
  };

  // Save search
  const handleSaveSearch = (query, filters = {}) => {
    if (!query.trim()) return;
    const newSaved = {
      id: Date.now().toString(),
      query: query.trim(),
      filters,
      createdAt: new Date().toISOString()
    };
    const updated = [newSaved, ...savedSearches.filter(s => s.query !== query.trim())].slice(0, 10);
    setSavedSearches(updated);
    try {
      localStorage.setItem('hdmarket_saved_searches', JSON.stringify(updated));
    } catch (e) {
      console.error('Error saving search:', e);
    }
    triggerHaptic(50);
  };

  // Delete saved search
  const handleDeleteSavedSearch = (id) => {
    const updated = savedSearches.filter(s => s.id !== id);
    setSavedSearches(updated);
    try {
      localStorage.setItem('hdmarket_saved_searches', JSON.stringify(updated));
    } catch (e) {
      console.error('Error deleting saved search:', e);
    }
    triggerHaptic(50);
  };

  // Apply search template
  const handleApplyTemplate = (template) => {
    setSearchQuery(template.query || '');
    setFilters(prev => ({ ...prev, ...template.filters }));
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
    triggerHaptic(50);
  };

  // Quick action handlers (align with backend quick-filters paths)
  const handleQuickAction = (action) => {
    triggerHaptic(50);
    switch (action) {
      case 'new_products':
        navigate('/products?sort=new');
        break;
      case 'top_deals':
        navigate('/products?sort=price_asc');
        break;
      case 'verified_shops':
        navigate('/shops/verified');
        break;
      case 'trending':
        navigate('/products?sort=popular');
        break;
      default:
        break;
    }
    setIsSearchFullScreen(false);
    setShowResults(false);
  };

  // Recherche avec gestion d'erreur améliorée et cache
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults({ products: [], shops: [], categories: [], totals: { products: 0, shops: 0, categories: 0, total: 0 } });
      setDisplayedResults({ products: [], shops: [], categories: [], totals: { products: 0, shops: 0, categories: 0, total: 0 } });
      setResultsLimit({ products: 5, shops: 3, categories: 3 }); // Reset limits
      setSearchError("");
      return;
    }

    setIsHistoryPanelOpen(false);
    
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      setSearching(true);
      setSearchError("");
      
      try {
        // Check cache first
        const cachedResult = await getCachedSearch(searchQuery.trim(), filters);
        if (cachedResult) {
          setSearchResults(cachedResult);
          // Update displayed results from cache
          setDisplayedResults({
            products: cachedResult.products.slice(0, resultsLimit.products),
            shops: cachedResult.shops.slice(0, resultsLimit.shops),
            categories: cachedResult.categories.slice(0, resultsLimit.categories),
            totals: cachedResult.totals
          });
          setShowResults(true);
          setSearching(false);
          
          // Generate related searches from cached data
          const relatedTerms = new Set();
          const products = Array.isArray(cachedResult?.products) ? cachedResult.products : [];
          const categories = Array.isArray(cachedResult?.categories) ? cachedResult.categories : [];
          
          categories.slice(0, 3).forEach(cat => {
            if (cat.title && cat.title.toLowerCase() !== searchQuery.trim().toLowerCase()) {
              relatedTerms.add(cat.title);
            }
          });
          
          products.slice(0, 5).forEach(product => {
            if (product.category && product.category.toLowerCase() !== searchQuery.trim().toLowerCase()) {
              relatedTerms.add(product.category);
            }
            if (product.brand && product.brand.toLowerCase() !== searchQuery.trim().toLowerCase()) {
              relatedTerms.add(product.brand);
            }
          });
          
          setRelatedSearches(Array.from(relatedTerms).slice(0, 5));
          
          // Still fetch fresh data in background to update cache
          // (don't await, let it run in background)
        }
        
        // Build query params with filters
        const params = new URLSearchParams();
        params.append('q', searchQuery.trim());
        
        if (filters.category) params.append('category', filters.category);
        if (filters.minPrice) params.append('minPrice', filters.minPrice);
        if (filters.maxPrice) params.append('maxPrice', filters.maxPrice);
        if (filters.city) params.append('city', filters.city);
        if (filters.shopVerified) params.append('shopVerified', 'true');
        if (filters.condition) params.append('condition', filters.condition);

        const { data } = await api.get(`/search?${params.toString()}`, {
          signal: controller.signal
        });
        
        const results = {
          products: Array.isArray(data?.products) ? data.products : [],
          shops: Array.isArray(data?.shops) ? data.shops : [],
          categories: Array.isArray(data?.categories) ? data.categories : [],
          totals: data?.totals || { products: 0, shops: 0, categories: 0, total: 0 }
        };
        
        // Only update if not cancelled and not using cached result
        if (!cachedResult) {
          setSearchResults(results);
          // Update displayed results with initial limits
          setDisplayedResults({
            products: results.products.slice(0, resultsLimit.products),
            shops: results.shops.slice(0, resultsLimit.shops),
            categories: results.categories.slice(0, resultsLimit.categories),
            totals: results.totals
          });
          setShowResults(true);
        } else {
          // Even with cached result, update displayed results
          setDisplayedResults({
            products: cachedResult.products.slice(0, resultsLimit.products),
            shops: cachedResult.shops.slice(0, resultsLimit.shops),
            categories: cachedResult.categories.slice(0, resultsLimit.categories),
            totals: cachedResult.totals
          });
        }
        
        // Cache the results
        await setCachedSearch(searchQuery.trim(), filters, results);

        // Generate related searches based on results
        const relatedTerms = new Set();
        const products = Array.isArray(data?.products) ? data.products : [];
        const categories = Array.isArray(data?.categories) ? data.categories : [];

        // Add category names as related searches
        categories.slice(0, 3).forEach(cat => {
          if (cat.title && cat.title.toLowerCase() !== searchQuery.trim().toLowerCase()) {
            relatedTerms.add(cat.title);
          }
        });

        // Add product categories and brand names
        products.slice(0, 5).forEach(product => {
          if (product.category && product.category.toLowerCase() !== searchQuery.trim().toLowerCase()) {
            relatedTerms.add(product.category);
          }
          if (product.brand && product.brand.toLowerCase() !== searchQuery.trim().toLowerCase()) {
            relatedTerms.add(product.brand);
          }
        });

        // Limit to 5 related searches
        if (!cachedResult) {
          setRelatedSearches(Array.from(relatedTerms).slice(0, 5));
        }
      } catch (error) {
        if (error.name !== "CanceledError" && error.name !== "AbortError") {
          console.error("Search error:", error);
          // Try to use cached result on error
          const cachedResult = await getCachedSearch(searchQuery.trim(), filters);
          if (cachedResult) {
            setSearchResults(cachedResult);
            setDisplayedResults({
              products: cachedResult.products.slice(0, resultsLimit.products),
              shops: cachedResult.shops.slice(0, resultsLimit.shops),
              categories: cachedResult.categories.slice(0, resultsLimit.categories),
              totals: cachedResult.totals
            });
            setShowResults(true);
          } else {
            setSearchError("Erreur lors de la recherche. Veuillez réessayer.");
            setSearchResults({ products: [], shops: [], categories: [], totals: { products: 0, shops: 0, categories: 0, total: 0 } });
            setDisplayedResults({ products: [], shops: [], categories: [], totals: { products: 0, shops: 0, categories: 0, total: 0 } });
          }
        }
      } finally {
        setSearching(false);
      }
    }, 300);
    
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [searchQuery, filters]);

  const fetchSearchHistory = useCallback(async () => {
    if (!user) {
      setSearchHistory([]);
      setGroupedHistory({ pinned: [], today: [], yesterday: [], thisWeek: [], older: [] });
      return [];
    }
    setHistoryLoading(true);
    try {
      const params = new URLSearchParams();
      if (showHistoryGrouped) params.append('groupByDate', 'true');
      if (historySearchQuery.trim()) params.append('search', historySearchQuery.trim());
      
      const { data } = await api.get(`/users/search-history?${params.toString()}`);
      
      if (showHistoryGrouped && data && typeof data === 'object' && !Array.isArray(data)) {
        // Grouped format
        setGroupedHistory({
          pinned: Array.isArray(data.pinned) ? data.pinned : [],
          today: Array.isArray(data.today) ? data.today : [],
          yesterday: Array.isArray(data.yesterday) ? data.yesterday : [],
          thisWeek: Array.isArray(data.thisWeek) ? data.thisWeek : [],
          older: Array.isArray(data.older) ? data.older : []
        });
        // Flatten for backward compatibility
        const allHistory = [
          ...(data.pinned || []),
          ...(data.today || []),
          ...(data.yesterday || []),
          ...(data.thisWeek || []),
          ...(data.older || [])
        ];
        setSearchHistory(allHistory);
        return allHistory;
      } else {
        // Array format
        const normalized = Array.isArray(data) ? data : [];
        setSearchHistory(normalized);
        setGroupedHistory({ pinned: [], today: [], yesterday: [], thisWeek: [], older: [] });
        return normalized;
      }
    } catch {
      setSearchHistory([]);
      setGroupedHistory({ pinned: [], today: [], yesterday: [], thisWeek: [], older: [] });
      return [];
    } finally {
      setHistoryLoading(false);
    }
  }, [user, showHistoryGrouped, historySearchQuery]);

  const handleOpenHistoryPanel = async () => {
    if (!user) {
      navigate('/login', { state: { from: '/profile' } });
      return;
    }
    setHistorySearchQuery('');
    await fetchSearchHistory();
    setShowResults(true);
    setIsHistoryPanelOpen(true);
  };

  // Refresh history when search query changes (debounced)
  useEffect(() => {
    if (isHistoryPanelOpen && user && historySearchQuery !== undefined) {
      const timeout = setTimeout(() => {
        fetchSearchHistory();
      }, 300);
      return () => clearTimeout(timeout);
    }
  }, [historySearchQuery, isHistoryPanelOpen, user, fetchSearchHistory]);

  const handleCloseHistoryPanel = () => {
    setIsHistoryPanelOpen(false);
    setShowResults(false);
  };

  const handleDeleteHistoryEntry = async (id) => {
    if (!id) return;
    try {
      await api.delete(`/users/search-history/${id}`);
      setSearchHistory((prev) => prev.filter((entry) => entry._id !== id));
      // Update grouped history
      setGroupedHistory((prev) => {
        const updated = { ...prev };
        Object.keys(updated).forEach((key) => {
          updated[key] = updated[key].filter((entry) => entry._id !== id);
        });
        return updated;
      });
      // Refresh to re-group
      await fetchSearchHistory();
    } catch {
      // ignore
    }
  };

  const handleClearHistory = async (dateRange = null) => {
    if (!user) return;
    try {
      await api.delete('/users/search-history', {
        data: dateRange ? { dateRange } : {}
      });
      setSearchHistory([]);
      setGroupedHistory({ pinned: [], today: [], yesterday: [], thisWeek: [], older: [] });
      await fetchSearchHistory();
    } catch {
      // ignore
    }
  };

  const handleTogglePin = async (entryId) => {
    if (!user || !entryId) return;
    try {
      const { data } = await api.patch(`/users/search-history/${entryId}/pin`);
      // Update local state
      setSearchHistory((prev) =>
        prev.map((entry) =>
          entry._id === entryId ? { ...entry, isPinned: data.isPinned, pinnedAt: data.pinnedAt } : entry
        )
      );
      setGroupedHistory((prev) => {
        const updated = { ...prev };
        Object.keys(updated).forEach((key) => {
          updated[key] = updated[key].map((entry) =>
            entry._id === entryId ? { ...entry, isPinned: data.isPinned, pinnedAt: data.pinnedAt } : entry
          );
        });
        return updated;
      });
      // Refresh to re-group
      await fetchSearchHistory();
    } catch {
      // ignore
    }
  };

  const handleExportHistory = async (format = 'json') => {
    if (!user) return;
    try {
      const response = await api.get(`/users/search-history/export?format=${format}`, {
        responseType: 'blob'
      });
      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `search-history-${Date.now()}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting history:', error);
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
    if (hasSlug) {
      return buildProductPath({ slug: targetSlug });
    }
    return '/shops/verified';
  };

  const handleSelectResult = (item) => {
    setShowResults(false);
    setIsSearchFullScreen(false);
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
    setSearchResults({ products: [], shops: [], categories: [], totals: { products: 0, shops: 0, categories: 0, total: 0 } });
    if (item?.type === 'shop') {
      navigate(buildShopPath(item));
      return;
    }
    if (item?.type === 'category') {
      navigate(`/products?category=${encodeURIComponent(item.title)}&search=${encodeURIComponent(searchQuery.trim())}`);
      return;
    }
    if (item?.slug) {
      navigate(buildProductPath(item));
    }
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const { products = [], shops = [], categories = [] } = searchResults || {};
      const allResults = [...products, ...shops, ...categories];
      if (allResults.length > 0) {
        handleSelectResult(allResults[0]);
      }
    }
  };

  const handleCategorySelect = (category) => {
    setShowResults(false);
    setIsHistoryPanelOpen(false);
    navigate(`/products?category=${encodeURIComponent(category.title)}&search=${encodeURIComponent(searchQuery.trim())}`);
    setSearchQuery("");
  };

  const handleHistoryEntryNavigate = (entry) => {
    if (!entry) return;
    const target = getSearchEntryLink(entry);
    if (!target) return;
    handleCloseHistoryPanel();
    navigate(target);
  };

  const handleFilterChange = (filterType, value) => {
    setFilters((prev) => ({
      ...prev,
      [filterType]: value
    }));
  };

  const clearFilters = () => {
    setFilters({
      category: '',
      minPrice: '',
      maxPrice: '',
      city: '',
      shopVerified: false,
      condition: ''
    });
  };

  const hasActiveFilters = filters.category || filters.minPrice || filters.maxPrice || filters.city || filters.shopVerified || filters.condition;

  // Skeleton loader component
  const SearchResultSkeleton = () => (
    <div className="px-4 py-3 flex items-center gap-3 animate-pulse">
      <div className="h-12 w-12 rounded-lg bg-gray-200 dark:bg-gray-700"></div>
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
      </div>
    </div>
  );

  const renderFilterPanel = (isBottomSheet = false) => {
    return (
      <div className={isBottomSheet ? '' : 'border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50'}>
        {!isBottomSheet && (
          <button
            type="button"
            onClick={() => {
              if (isMobileLayout) {
                setShowBottomSheet(true);
                triggerHaptic(50);
              } else {
                setShowFilters(!showFilters);
              }
            }}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-gray-600 dark:text-gray-400" />
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Filtres</span>
              {hasActiveFilters && (
                <span className="bg-[#007AFF] text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {[
                    filters.category && 1,
                    filters.minPrice && 1,
                    filters.maxPrice && 1,
                    filters.city && 1,
                    filters.shopVerified && 1,
                    filters.condition && 1
                  ].filter(Boolean).length}
                </span>
              )}
            </div>
            <ChevronDown
              size={16}
              className={`text-gray-500 transition-transform ${showFilters ? 'rotate-180' : ''}`}
            />
          </button>
        )}

        {(showFilters || isBottomSheet) && (
        <div className="px-4 py-3 space-y-4 border-t border-gray-200 dark:border-gray-700">
          {/* Category Filter */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Catégorie
            </label>
            <select
              value={filters.category}
              onChange={(e) => handleFilterChange('category', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#007AFF] focus:border-[#007AFF]"
            >
              <option value="">Toutes les catégories</option>
              {categoriesLoading ? (
                <option disabled>Chargement...</option>
              ) : (
                availableCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Price Range Filter */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Prix (FCFA)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                placeholder="Min"
                value={filters.minPrice}
                onChange={(e) => handleFilterChange('minPrice', e.target.value)}
                className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#007AFF] focus:border-[#007AFF]"
                min="0"
              />
              <span className="text-gray-500">-</span>
              <input
                type="number"
                placeholder="Max"
                value={filters.maxPrice}
                onChange={(e) => handleFilterChange('maxPrice', e.target.value)}
                className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#007AFF] focus:border-[#007AFF]"
                min="0"
              />
            </div>
          </div>

          {/* City Filter */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
              <MapPin size={12} className="inline mr-1" />
              Ville
            </label>
            <select
              value={filters.city}
              onChange={(e) => handleFilterChange('city', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#007AFF] focus:border-[#007AFF]"
            >
              <option value="">Toutes les villes</option>
              <option value="Brazzaville">Brazzaville</option>
              <option value="Pointe-Noire">Pointe-Noire</option>
              <option value="Ouesso">Ouesso</option>
              <option value="Oyo">Oyo</option>
            </select>
          </div>

          {/* Condition Filter */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
              État
            </label>
            <select
              value={filters.condition}
              onChange={(e) => handleFilterChange('condition', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#007AFF] focus:border-[#007AFF]"
            >
              <option value="">Tous les états</option>
              <option value="new">Neuf</option>
              <option value="used">Occasion</option>
            </select>
          </div>

          {/* Shop Verification Filter */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.shopVerified}
                onChange={(e) => handleFilterChange('shopVerified', e.target.checked)}
                className="w-4 h-4 text-[#007AFF] border-gray-300 rounded focus:ring-[#007AFF]"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Boutiques vérifiées uniquement
              </span>
            </label>
          </div>

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="w-full px-3 py-2 text-sm font-semibold text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 border border-red-300 dark:border-red-700 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              Effacer les filtres
            </button>
          )}
        </div>
        )}
      </div>
    );
  };

  // Handle suggestion click
  const handleSuggestionClick = (query) => {
    setSearchQuery(query);
    setShowResults(true);
    
    // Track analytics for popular search click
    api.post('/search/analytics', {
      query: query,
      action: 'click'
    }).catch(() => {
      // ignore errors
    });
  };

  // Render search suggestions when input is empty
  const renderSearchSuggestions = () => {
    const recentSearches = searchHistory.slice(0, 5);
    const hasRecentSearches = recentSearches.length > 0;
    const topCategories = availableCategories.slice(0, 4);
    const topShops = shops.filter(s => s.verified).slice(0, 4);

    return (
      <div className="max-h-[400px] overflow-auto">
        {/* Recent Searches - Quick Access (Last 5) */}
        {user && hasRecentSearches && (
          <div className="border-b border-gray-100 dark:border-gray-700">
            <div className="px-4 py-2.5 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock size={14} className="text-[#007AFF]" />
                  <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wide">
                    Recherches récentes
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleOpenHistoryPanel}
                  className="text-[10px] font-semibold text-[#007AFF] hover:underline"
                >
                  Voir tout
                </button>
              </div>
            </div>
            <div className="p-2 flex flex-wrap gap-2">
              {recentSearches.map((entry) => (
                <button
                  key={entry._id}
                  type="button"
                  onClick={() => handleSuggestionClick(entry.query)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
                >
                  <Clock size={12} className="text-gray-400" />
                  <span className="truncate max-w-[120px]">{entry.query}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Category Suggestions */}
        {topCategories.length > 0 && (
          <div className="border-b border-gray-100 dark:border-gray-700">
            <div className="px-4 py-2.5 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20">
              <div className="flex items-center gap-2">
                <Tag size={14} className="text-[#007AFF]" />
                <span className="text-xs font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wide">
                  Catégories
                </span>
              </div>
            </div>
            <div className="p-2 grid grid-cols-2 gap-2">
              {topCategories.map((category) => (
                <button
                  key={category._id || category.title}
                  type="button"
                  onClick={() => {
                    setShowResults(false);
                    navigate(`/products?category=${encodeURIComponent(category.title)}`);
                  }}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-[#007AFF]/40 hover:bg-[rgba(0,122,255,0.08)] transition-all text-left group"
                >
                  <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/30 group-hover:bg-blue-200 dark:group-hover:bg-blue-800/40 transition-colors">
                    <Tag size={14} className="text-[#007AFF]" />
                  </div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                    {category.title}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Shop Suggestions (Verified Shops) */}
        {topShops.length > 0 && (
          <div>
            <div className="px-4 py-2.5 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Store size={14} className="text-purple-600 dark:text-purple-400" />
                  <span className="text-xs font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wide">
                    Boutiques vérifiées
                  </span>
                </div>
                <Link
                  to="/shops/verified"
                  onClick={() => setShowResults(false)}
                  className="text-[10px] font-semibold text-purple-600 dark:text-purple-400 hover:underline"
                >
                  Voir tout
                </Link>
              </div>
            </div>
            <div className="p-2 space-y-1">
              {topShops.map((shop) => (
                <button
                  key={shop._id}
                  type="button"
                  onClick={() => {
                    setShowResults(false);
                    navigate(buildShopPath(shop));
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors text-left group"
                >
                  <img
                    src={shop.shopLogo || '/api/placeholder/40/40'}
                    alt={shop.shopName}
                    className="w-10 h-10 rounded-lg object-cover border border-gray-200 dark:border-gray-700"
                    onError={(e) => { e.target.src = '/api/placeholder/40/40'; }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                        {shop.shopName}
                      </span>
                      <VerifiedBadge verified={shop.verified} showLabel={false} />
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {shop.shopAddress || 'HDMarket'}
                    </p>
                  </div>
                  <ChevronRight size={16} className="text-gray-300 dark:text-gray-600 group-hover:text-purple-500 transition-colors" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Load more results (lazy loading)
  const loadMoreResults = useCallback((type) => {
    const currentLimit = resultsLimit[type] || 0;
    const allResults = searchResults[type] || [];
    const newLimit = Math.min(currentLimit + 5, allResults.length);
    
    setResultsLimit(prev => ({ ...prev, [type]: newLimit }));
    setDisplayedResults(prev => ({
      ...prev,
      [type]: allResults.slice(0, newLimit)
    }));
    triggerHaptic(50);
  }, [resultsLimit, searchResults]);

  const renderDesktopSearchResults = () => {
    const { products = [], shops = [], categories = [], totals = {} } = displayedResults || searchResults || {};
    const allProducts = searchResults?.products || [];
    const allShops = searchResults?.shops || [];
    const allCategories = searchResults?.categories || [];
    const hasMoreProducts = allProducts.length > products.length;
    const hasMoreShops = allShops.length > shops.length;
    const hasMoreCategories = allCategories.length > categories.length;
    const hasResults = (products?.length || 0) > 0 || (shops?.length || 0) > 0 || (categories?.length || 0) > 0;
    const totalCount = totals?.total || 0;

    // Show suggestions when search is empty
    if (!searchQuery.trim() && !isHistoryPanelOpen) {
      return renderSearchSuggestions();
    }

    return (
      <>
        {/* Loading State */}
        {searching && (
          <div className="py-2">
            {[1, 2, 3].map((i) => (
              <SearchResultSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Error State */}
        {!searching && searchError && (
          <div className="px-4 py-3 flex items-center space-x-3 text-red-500 text-sm">
            <AlertCircle size={16} />
            {searchError}
          </div>
        )}

        {/* Empty State */}
        {!searching && !searchError && !hasResults && searchQuery.trim() && (
          <div className="px-4 py-6 text-center text-gray-500">
            <p className="text-sm">Aucun résultat pour « {searchQuery} »</p>
            <p className="text-xs mt-2 text-gray-400">Essayez avec d'autres mots-clés</p>
          </div>
        )}

        {/* Results */}
        {!searching && !searchError && hasResults && (
          <div className="max-h-96 overflow-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700">
            {/* Products Section */}
            {products.length > 0 && (
              <div className="border-b border-gray-200 dark:border-gray-700">
                <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                      Produits ({(totals?.products || 0) > products.length ? `${products.length} sur ${totals.products}` : products.length})
                    </span>
                  </div>
                </div>
                {products.map((product) => (
                  <button
                    key={product._id}
                    type="button"
                    onClick={() => handleSelectResult(product)}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3 border-b border-gray-100 dark:border-gray-700 last:border-b-0 transition-colors"
                  >
                    <img
                      src={product.image || product.shopLogo || "/api/placeholder/60/60"}
                      alt={product.title}
                      className="h-12 w-12 rounded-lg object-cover border border-gray-200 dark:border-gray-600 flex-shrink-0"
                      onError={(e) => {
                        e.target.src = "/api/placeholder/60/60";
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 dark:text-white text-sm block truncate">
                        {highlightText(product.title, searchQuery)}
                      </div>
                      <div className="text-gray-500 text-xs flex items-center gap-2 mt-1 flex-wrap">
                        {product.price && (
                          <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                            {formatCurrency(product.price)}
                            {product.discount > 0 && (
                              <span className="ml-1 text-green-600 dark:text-green-400">
                                (-{product.discount}%)
                              </span>
                            )}
                          </span>
                        )}
                        {product.rating > 0 && (
                          <span className="flex items-center gap-1">
                            <Star size={12} className="fill-yellow-400 text-yellow-400" />
                            <span>{product.rating.toFixed(1)}</span>
                            {product.ratingCount > 0 && (
                              <span className="text-gray-400">({product.ratingCount})</span>
                            )}
                          </span>
                        )}
                        {product.condition && (
                          <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                            product.condition === 'new' 
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                              : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                          }`}>
                            {product.condition === 'new' ? 'Neuf' : 'Occasion'}
                          </span>
                        )}
                        {product.shopName && (
                          <span className="flex items-center gap-1 truncate">
                            {product.shopName}
                            <VerifiedBadge verified={Boolean(product.shopVerified)} showLabel={false} />
                          </span>
                        )}
                        {product.category && (
                          <span className="truncate">{product.category}</span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
                {hasMoreProducts && (
                  <button
                    type="button"
                    onClick={() => loadMoreResults('products')}
                    className="w-full px-4 py-2 text-sm font-medium text-[#007AFF] hover:bg-[rgba(0,122,255,0.08)] border-t border-gray-200 dark:border-gray-700 transition-colors"
                  >
                    Voir plus de produits ({allProducts.length - products.length} restant{allProducts.length - products.length > 1 ? 's' : ''})
                  </button>
                )}
              </div>
            )}

            {/* Shops Section */}
            {shops.length > 0 && (
              <div className="border-b border-gray-200 dark:border-gray-700">
                <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                    Boutiques ({(totals?.shops || 0) > shops.length ? `${shops.length} sur ${totals?.shops || 0}` : shops.length})
                  </span>
                </div>
                {shops.map((shop) => (
                  <button
                    key={shop._id}
                    type="button"
                    onClick={() => handleSelectResult(shop)}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3 border-b border-gray-100 dark:border-gray-700 last:border-b-0 transition-colors"
                  >
                    <img
                      src={shop.image || shop.shopLogo || "/api/placeholder/60/60"}
                      alt={shop.title}
                      className="h-12 w-12 rounded-lg object-cover border border-gray-200 dark:border-gray-600 flex-shrink-0"
                      onError={(e) => {
                        e.target.src = "/api/placeholder/60/60";
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 dark:text-white text-sm block truncate">
                        {highlightText(shop.title, searchQuery)}
                      </div>
                      <div className="text-gray-500 text-xs flex items-center gap-2 mt-1 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Package size={12} />
                          <span>{shop.productCount || 0} produit{shop.productCount !== 1 ? 's' : ''}</span>
                        </span>
                        {shop.shopAddress && (
                          <span className="truncate">{shop.shopAddress}</span>
                        )}
                        <VerifiedBadge verified={Boolean(shop.shopVerified)} showLabel={false} />
                      </div>
                    </div>
                  </button>
                ))}
                {hasMoreShops && (
                  <button
                    type="button"
                    onClick={() => loadMoreResults('shops')}
                    className="w-full px-4 py-2 text-sm font-medium text-[#007AFF] hover:bg-[rgba(0,122,255,0.08)] border-t border-gray-200 dark:border-gray-700 transition-colors"
                  >
                    Voir plus de boutiques ({allShops.length - shops.length} restant{allShops.length - shops.length > 1 ? 's' : ''})
                  </button>
                )}
              </div>
            )}

            {/* Categories Section */}
            {categories.length > 0 && (
              <div>
                <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                    Catégories ({categories.length})
                  </span>
                </div>
                {categories.map((category) => (
                  <button
                    key={category._id}
                    type="button"
                    onClick={() => handleCategorySelect(category)}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3 border-b border-gray-100 dark:border-gray-700 last:border-b-0 transition-colors"
                  >
                    <div className="h-12 w-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                      <Tag size={20} className="text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 dark:text-white text-sm">
                        {highlightText(category.title, searchQuery)}
                      </div>
                      <div className="text-gray-500 text-xs mt-1">
                        Voir tous les produits de cette catégorie
                      </div>
                    </div>
                  </button>
                ))}
                {hasMoreCategories && (
                  <button
                    type="button"
                    onClick={() => loadMoreResults('categories')}
                    className="w-full px-4 py-2 text-sm font-medium text-[#007AFF] hover:bg-[rgba(0,122,255,0.08)] border-t border-gray-200 dark:border-gray-700 transition-colors"
                  >
                    Voir plus de catégories ({allCategories.length - categories.length} restant{allCategories.length - categories.length > 1 ? 's' : ''})
                  </button>
                )}
              </div>
            )}

            {/* People Also Searched For */}
            {relatedSearches.length > 0 && (
              <div className="border-t border-gray-100 dark:border-gray-700 bg-gradient-to-r from-gray-50 to-white dark:from-gray-800/50 dark:to-gray-900/50">
                <div className="px-4 py-2.5">
                  <div className="flex items-center gap-2 mb-2">
                    <Users size={14} className="text-gray-500 dark:text-gray-400" />
                    <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                      Les gens recherchent aussi
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {relatedSearches.map((term, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSuggestionClick(term)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-700 dark:text-gray-300 hover:border-[#007AFF]/40 hover:text-[#007AFF] hover:bg-[rgba(0,122,255,0.08)] transition-all"
                      >
                        <Search size={10} className="text-gray-400" />
                        {term}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* View All Link – redirect to Products page with current search and show results */}
            {searchQuery.trim() && totalCount > 0 && (
              <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-center sticky bottom-0">
                <Link
                  to={`/products?search=${encodeURIComponent(searchQuery.trim())}`}
                  className="font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 inline-flex items-center gap-2"
                  onClick={() => {
                    setIsHistoryPanelOpen(false);
                    setShowResults(false);
                    setIsSearchFullScreen(false);
                  }}
                >
                  Voir tous les résultats ({totalCount})
                  <ChevronDown size={16} className="rotate-[-90deg]" />
                </Link>
              </div>
            )}
          </div>
        )}
      </>
    );
  };

  const renderMobileSearchResults = () => {
    const { products = [], shops = [], categories = [], totals = {} } = displayedResults || searchResults || {};
    const allProducts = searchResults?.products || [];
    const allShops = searchResults?.shops || [];
    const allCategories = searchResults?.categories || [];
    const hasMoreProducts = allProducts.length > products.length;
    const hasMoreShops = allShops.length > shops.length;
    const hasMoreCategories = allCategories.length > categories.length;
    const hasResults = (products?.length || 0) > 0 || (shops?.length || 0) > 0 || (categories?.length || 0) > 0;
    const totalCount = totals?.total || 0;

    // Show suggestions when search is empty
    if (!searchQuery.trim() && !isHistoryPanelOpen) {
      return renderSearchSuggestions();
    }

    return (
      <>
        {/* Filter Panel */}
        {searchQuery.trim() && !isMobileLayout && renderFilterPanel()}
        {searchQuery.trim() && isMobileLayout && (
          <button
            type="button"
            onClick={() => {
              setShowBottomSheet(true);
              triggerHaptic(50);
            }}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors border-b border-gray-200 dark:border-gray-700"
          >
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-gray-600 dark:text-gray-400" />
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Filtres</span>
              {hasActiveFilters && (
                <span className="px-2 py-0.5 bg-[#007AFF] text-white text-xs font-bold rounded-full">
                  {Object.values(filters).filter(Boolean).length}
                </span>
              )}
            </div>
            <ChevronDown size={16} className="text-gray-500 dark:text-gray-400" />
          </button>
        )}

        {/* Loading State */}
        {searching && (
          <div className="py-2">
            {[1, 2, 3].map((i) => (
              <SearchResultSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Error State */}
        {!searching && searchError && (
          <div className="px-4 py-3 flex items-center space-x-3 text-red-500 text-sm">
            <AlertCircle size={16} />
            {searchError}
          </div>
        )}

        {/* Empty State */}
        {!searching && !searchError && !hasResults && searchQuery.trim() && (
          <div className="px-4 py-6 text-center text-gray-500">
            <p className="text-sm">Aucun résultat pour « {searchQuery} »</p>
            <p className="text-xs mt-2 text-gray-400">Essayez avec d'autres mots-clés</p>
          </div>
        )}

        {/* Results */}
        {!searching && !searchError && hasResults && (
          <div className="max-h-80 overflow-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700">
            {/* Products Section */}
            {products.length > 0 && (
              <div className="border-b border-gray-200 dark:border-gray-700">
                <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                    Produits ({totals.products > products.length ? `${products.length} sur ${totals.products}` : products.length})
                  </span>
                </div>
                {products.map((product) => {
                  const thumbnail = product.image || product.shopLogo || "/api/placeholder/60/60";
                  return (
                    <button
                      key={product._id}
                      type="button"
                      onClick={() => handleSelectResult(product)}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3 transition-colors border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                    >
                      <img
                        src={thumbnail}
                        alt={product.title || 'Résultat de recherche'}
                        className="w-14 h-14 rounded-xl object-cover border border-gray-200 dark:border-gray-600 flex-shrink-0"
                        onError={(event) => {
                          event.currentTarget.src = "/api/placeholder/60/60";
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">
                          {highlightText(product.title, searchQuery)}
                        </p>
                        <div className="text-xs text-gray-500 flex items-center gap-2 mt-1 flex-wrap">
                          {product.price && (
                            <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                              {formatCurrency(product.price)}
                              {product.discount > 0 && (
                                <span className="ml-1 text-green-600 dark:text-green-400">
                                  (-{product.discount}%)
                                </span>
                              )}
                            </span>
                          )}
                          {product.rating > 0 && (
                            <span className="flex items-center gap-1">
                              <Star size={12} className="fill-yellow-400 text-yellow-400" />
                              <span>{product.rating.toFixed(1)}</span>
                              {product.ratingCount > 0 && (
                                <span className="text-gray-400">({product.ratingCount})</span>
                              )}
                            </span>
                          )}
                          {product.condition && (
                            <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                              product.condition === 'new' 
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                                : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                            }`}>
                              {product.condition === 'new' ? 'Neuf' : 'Occasion'}
                            </span>
                          )}
                          {product.shopName && (
                            <span className="flex items-center gap-1 truncate">
                              {product.shopName}
                              <VerifiedBadge verified={Boolean(product.shopVerified)} showLabel={false} />
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Shops Section */}
            {shops.length > 0 && (
              <div className="border-b border-gray-200 dark:border-gray-700">
                <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                    Boutiques ({(totals?.shops || 0) > shops.length ? `${shops.length} sur ${totals?.shops || 0}` : shops.length})
                  </span>
                </div>
                {shops.map((shop) => {
                  const thumbnail = shop.image || shop.shopLogo || "/api/placeholder/60/60";
                  return (
                    <button
                      key={shop._id}
                      type="button"
                      onClick={() => handleSelectResult(shop)}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3 transition-colors border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                    >
                      <img
                        src={thumbnail}
                        alt={shop.title || 'Boutique'}
                        className="w-14 h-14 rounded-xl object-cover border border-gray-200 dark:border-gray-600 flex-shrink-0"
                        onError={(event) => {
                          event.currentTarget.src = "/api/placeholder/60/60";
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">
                          {highlightText(shop.title, searchQuery)}
                        </p>
                        <div className="text-xs text-gray-500 flex items-center gap-2 mt-1 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Package size={12} />
                            <span>{shop.productCount || 0} produit{shop.productCount !== 1 ? 's' : ''}</span>
                          </span>
                          {shop.shopAddress && (
                            <span className="truncate">{shop.shopAddress}</span>
                          )}
                          <VerifiedBadge verified={Boolean(shop.shopVerified)} showLabel={false} />
                        </div>
                      </div>
                    </button>
                  );
                })}
                {hasMoreProducts && (
                  <button
                    type="button"
                    onClick={() => loadMoreResults('products')}
                    className="w-full px-4 py-2 text-sm font-medium text-[#007AFF] hover:bg-[rgba(0,122,255,0.08)] border-t border-gray-200 dark:border-gray-700 transition-colors"
                  >
                    Voir plus ({allProducts.length - products.length} restant{allProducts.length - products.length > 1 ? 's' : ''})
                  </button>
                )}
              </div>
            )}

            {/* Categories Section */}
            {categories.length > 0 && (
              <div>
                <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                    Catégories ({categories.length})
                  </span>
                </div>
                {categories.map((category) => (
                  <button
                    key={category._id}
                    type="button"
                    onClick={() => handleCategorySelect(category)}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3 transition-colors border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                  >
                    <div className="w-14 h-14 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                      <Tag size={20} className="text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-white text-sm">
                        {highlightText(category.title, searchQuery)}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Voir tous les produits
                      </p>
                    </div>
                  </button>
                ))}
                {hasMoreProducts && (
                  <button
                    type="button"
                    onClick={() => loadMoreResults('products')}
                    className="w-full px-4 py-2 text-sm font-medium text-[#007AFF] hover:bg-[rgba(0,122,255,0.08)] border-t border-gray-200 dark:border-gray-700 transition-colors"
                  >
                    Voir plus ({allProducts.length - products.length} restant{allProducts.length - products.length > 1 ? 's' : ''})
                  </button>
                )}
              </div>
            )}

            {/* People Also Searched For - Mobile */}
            {relatedSearches.length > 0 && (
              <div className="border-t border-gray-100 dark:border-gray-700 bg-gradient-to-r from-gray-50 to-white dark:from-gray-800/50 dark:to-gray-900/50">
                <div className="px-4 py-2.5">
                  <div className="flex items-center gap-2 mb-2">
                    <Users size={14} className="text-gray-500 dark:text-gray-400" />
                    <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                      Les gens recherchent aussi
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {relatedSearches.map((term, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSuggestionClick(term)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-700 dark:text-gray-300 hover:border-[#007AFF]/40 hover:text-[#007AFF] hover:bg-[rgba(0,122,255,0.08)] transition-all"
                      >
                        <Search size={10} className="text-gray-400" />
                        {term}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* View All Link – redirect to Products page with current search and show results */}
            {searchQuery.trim() && totalCount > 0 && (
              <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-center sticky bottom-0">
                <Link
                  to={`/products?search=${encodeURIComponent(searchQuery.trim())}`}
                  className="font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 inline-flex items-center gap-2"
                  onClick={() => {
                    setIsHistoryPanelOpen(false);
                    setShowResults(false);
                    setIsSearchFullScreen(false);
                  }}
                >
                  Voir tous les résultats ({totalCount})
                  <ChevronDown size={16} className="rotate-[-90deg]" />
                </Link>
              </div>
            )}
          </div>
        )}
      </>
    );
  };

  // Helper function to render a history entry
  const renderHistoryEntry = (entry, index = 0) => {
    const typeLabel = entry.metadata?.type === 'shop'
      ? 'Boutique'
      : entry.metadata?.type === 'category'
        ? 'Catégorie'
        : 'Produit';
    const typeIcon = entry.metadata?.type === 'shop' ? (
      <Store size={14} className="text-purple-500" />
    ) : entry.metadata?.type === 'category' ? (
      <Tag size={14} className="text-blue-500" />
    ) : (
      <Package size={14} className="text-indigo-500" />
    );
    const typeBgColor = entry.metadata?.type === 'shop'
      ? 'bg-purple-100 dark:bg-purple-900/30'
      : entry.metadata?.type === 'category'
        ? 'bg-blue-100 dark:bg-blue-900/30'
        : 'bg-indigo-100 dark:bg-indigo-900/30';

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
        className={`group flex items-center gap-3 p-2.5 rounded-xl bg-white dark:bg-gray-800 border transition-all duration-200 cursor-pointer ${
          entry.isPinned
            ? 'border-amber-300 dark:border-amber-600/50 bg-amber-50/50 dark:bg-amber-900/10'
            : 'border-gray-100 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600'
        } hover:shadow-md hover:shadow-indigo-100 dark:hover:shadow-indigo-900/20`}
      >
        {/* Pin indicator */}
        {entry.isPinned && (
          <div className="flex-shrink-0">
            <Pin size={14} className="text-amber-500 fill-amber-500" />
          </div>
        )}

        {/* Icon */}
        <div className={`p-2 rounded-lg ${typeBgColor} flex-shrink-0`}>
          {typeIcon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm text-gray-900 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
            {highlightText(entry.query, historySearchQuery)}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium ${
              entry.metadata?.type === 'shop'
                ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
                : entry.metadata?.type === 'category'
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                  : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
            }`}>
              {typeLabel}
            </span>
            <span className="text-[10px] text-gray-400 dark:text-gray-500">
              {formatRelativeTime(entry.createdAt)}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              handleTogglePin(entry._id);
            }}
            className={`p-1.5 rounded-lg transition-colors ${
              entry.isPinned
                ? 'text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900/30'
                : 'text-gray-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20'
            }`}
            title={entry.isPinned ? 'Désépingler' : 'Épingler'}
          >
            {entry.isPinned ? <PinOff size={14} /> : <Pin size={14} />}
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              handleHistoryEntryNavigate(entry);
            }}
            className="p-1.5 text-indigo-600 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
            title="Rechercher"
          >
            <Search size={14} />
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              handleDeleteHistoryEntry(entry._id);
            }}
            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            title="Supprimer"
          >
            <Trash2 size={14} />
          </button>
        </div>

        {/* Arrow indicator */}
        <ChevronRight size={14} className="text-gray-300 dark:text-gray-600 group-hover:text-indigo-400 transition-colors flex-shrink-0" />
      </div>
    );
  };

  const renderHistoryResults = () => {
    const hasHistory = searchHistory.length > 0;
    const hasGroupedHistory = showHistoryGrouped && (
      groupedHistory.pinned.length > 0 ||
      groupedHistory.today.length > 0 ||
      groupedHistory.yesterday.length > 0 ||
      groupedHistory.thisWeek.length > 0 ||
      groupedHistory.older.length > 0
    );

    return (
      <div className="text-sm text-gray-900 dark:text-white">
        {/* Modern Gradient Header */}
        <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 px-4 py-3 rounded-t-2xl">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-white/20 rounded-lg backdrop-blur-sm">
                <Clock size={16} className="text-white" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Historique</h3>
                <p className="text-[10px] text-indigo-100">
                  {hasHistory ? `${searchHistory.length} recherche${searchHistory.length > 1 ? 's' : ''}` : 'Aucune recherche'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {hasHistory && (
                <>
                  <button
                    type="button"
                    onClick={() => handleExportHistory('json')}
                    className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                    title="Exporter (JSON)"
                  >
                    <Download size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowHistoryGrouped(!showHistoryGrouped)}
                    className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                    title={showHistoryGrouped ? 'Vue simple' : 'Vue groupée'}
                  >
                    <Calendar size={14} />
                  </button>
                </>
              )}
              <button
                type="button"
                aria-label="Fermer l'historique"
                onClick={handleCloseHistoryPanel}
                className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Search within history */}
          {hasHistory && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60" size={14} />
              <input
                type="text"
                value={historySearchQuery}
                onChange={(e) => {
                  setHistorySearchQuery(e.target.value);
                  // Debounce search
                  setTimeout(() => fetchSearchHistory(), 300);
                }}
                placeholder="Rechercher dans l'historique..."
                className="w-full pl-9 pr-3 py-2 bg-white/20 backdrop-blur-sm border border-white/30 rounded-lg text-white placeholder:text-white/60 text-sm focus:outline-none focus:ring-2 focus:ring-white/50 focus:bg-white/30"
              />
              {historySearchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setHistorySearchQuery('');
                    fetchSearchHistory();
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-white/60 hover:text-white"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          )}
        </div>

        {/* History Content */}
        <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-b-2xl">
          {historyLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((item) => (
                <div key={item} className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-gray-800 animate-pulse">
                  <div className="h-8 w-8 rounded-lg bg-gray-200 dark:bg-gray-700" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                    <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : hasHistory ? (
            <div className="space-y-4 max-h-96 overflow-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700">
              {showHistoryGrouped && hasGroupedHistory ? (
                <>
                  {/* Pinned Section */}
                  {groupedHistory.pinned.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2 px-1">
                        <div className="flex items-center gap-2">
                          <Pin size={12} className="text-amber-500 fill-amber-500" />
                          <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                            Épinglées ({groupedHistory.pinned.length})
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleClearHistory('all')}
                          className="text-[10px] text-red-600 hover:text-red-700 dark:text-red-400"
                        >
                          Effacer
                        </button>
                      </div>
                      <div className="space-y-2">
                        {groupedHistory.pinned.map((entry, idx) => renderHistoryEntry(entry, idx))}
                      </div>
                    </div>
                  )}

                  {/* Today Section */}
                  {groupedHistory.today.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2 px-1">
                        <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                          Aujourd'hui ({groupedHistory.today.length})
                        </span>
                        <button
                          type="button"
                          onClick={() => handleClearHistory('today')}
                          className="text-[10px] text-red-600 hover:text-red-700 dark:text-red-400"
                        >
                          Effacer
                        </button>
                      </div>
                      <div className="space-y-2">
                        {groupedHistory.today.map((entry, idx) => renderHistoryEntry(entry, idx))}
                      </div>
                    </div>
                  )}

                  {/* Yesterday Section */}
                  {groupedHistory.yesterday.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2 px-1">
                        <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                          Hier ({groupedHistory.yesterday.length})
                        </span>
                        <button
                          type="button"
                          onClick={() => handleClearHistory('yesterday')}
                          className="text-[10px] text-red-600 hover:text-red-700 dark:text-red-400"
                        >
                          Effacer
                        </button>
                      </div>
                      <div className="space-y-2">
                        {groupedHistory.yesterday.map((entry, idx) => renderHistoryEntry(entry, idx))}
                      </div>
                    </div>
                  )}

                  {/* This Week Section */}
                  {groupedHistory.thisWeek.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2 px-1">
                        <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                          Cette semaine ({groupedHistory.thisWeek.length})
                        </span>
                        <button
                          type="button"
                          onClick={() => handleClearHistory('week')}
                          className="text-[10px] text-red-600 hover:text-red-700 dark:text-red-400"
                        >
                          Effacer
                        </button>
                      </div>
                      <div className="space-y-2">
                        {groupedHistory.thisWeek.map((entry, idx) => renderHistoryEntry(entry, idx))}
                      </div>
                    </div>
                  )}

                  {/* Older Section */}
                  {groupedHistory.older.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2 px-1">
                        <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                          Plus ancien ({groupedHistory.older.length})
                        </span>
                        <button
                          type="button"
                          onClick={() => handleClearHistory('month')}
                          className="text-[10px] text-red-600 hover:text-red-700 dark:text-red-400"
                        >
                          Effacer
                        </button>
                      </div>
                      <div className="space-y-2">
                        {groupedHistory.older.map((entry, idx) => renderHistoryEntry(entry, idx))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                // Simple list view (not grouped)
                <div className="space-y-2">
                  {searchHistory.map((entry, idx) => renderHistoryEntry(entry, idx))}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="inline-flex p-3 rounded-full bg-gray-100 dark:bg-gray-800 mb-3">
                <Clock size={24} className="text-gray-400" />
              </div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                {historySearchQuery ? 'Aucun résultat' : 'Aucun historique'}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                {historySearchQuery
                  ? 'Essayez avec d\'autres mots-clés'
                  : 'Vos recherches récentes apparaîtront ici'}
              </p>
            </div>
          )}

          {/* Actions Footer */}
          {hasHistory && (
            <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleExportHistory('csv')}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                >
                  <Download size={12} />
                  Exporter CSV
                </button>
                <button
                  type="button"
                  onClick={() => handleExportHistory('json')}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                >
                  <Download size={12} />
                  Exporter JSON
                </button>
              </div>
              <button
                type="button"
                onClick={() => handleClearHistory('all')}
                className="px-3 py-1.5 text-xs font-semibold text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              >
                Tout effacer
              </button>
            </div>
          )}
        </div>
      </div>
    );
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

  // Render quick action buttons (from backend quick-filters; click navigates to path)
  const handleQuickFilterClick = (template) => {
    if (template.path) {
      navigate(template.path);
      setIsSearchFullScreen(false);
      setShowResults(false);
      triggerHaptic('light');
    } else {
      handleApplyTemplate(template);
    }
  };
  const renderQuickActions = () => (
    <div className="grid grid-cols-2 gap-2 mb-4">
      {searchTemplates.map((template) => {
        const Icon = template.icon || Zap;
        return (
          <button
            key={template.id}
            type="button"
            onClick={() => handleQuickFilterClick(template)}
            className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl hover:from-indigo-100 hover:to-purple-100 dark:hover:from-indigo-900/30 dark:hover:to-purple-900/30 transition-all group"
          >
            <Icon size={18} className="text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform" />
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{template.label}</span>
          </button>
        );
      })}
    </div>
  );

  // Render saved searches
  const renderSavedSearches = () => {
    if (savedSearches.length === 0) return null;
    return (
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2 px-1">
          <div className="flex items-center gap-2">
            <BookmarkCheck size={14} className="text-indigo-600 dark:text-indigo-400" />
            <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
              Recherches sauvegardées
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {savedSearches.map((saved) => (
            <div
              key={saved.id}
              className="group flex items-center gap-2 px-3 py-2 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors"
            >
              <button
                type="button"
                onClick={() => {
                  setSearchQuery(saved.query);
                  setFilters(prev => ({ ...prev, ...saved.filters }));
                  triggerHaptic(50);
                }}
                className="flex-1 text-left text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                {saved.query}
              </button>
              <button
                type="button"
                onClick={() => handleDeleteSavedSearch(saved.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-red-500 hover:text-red-700"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Full-screen search overlay for mobile */}
      {isSearchFullScreen && isMobileLayout && (
        <div
          ref={searchOverlayRef}
          className="fixed inset-0 z-[100] bg-white dark:bg-gray-900"
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
              <button
                type="button"
                onClick={() => {
                  setIsSearchFullScreen(false);
                  setShowResults(false);
                  setIsHistoryPanelOpen(false);
                  if (searchInputRef.current) searchInputRef.current.blur();
                  triggerHaptic(50);
                }}
                className="p-2 -ml-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <ArrowDown size={20} />
              </button>
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher..."
                  className="w-full pl-10 pr-4 py-3 bg-gray-100 dark:bg-gray-800 border-0 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-gray-700 transition-all text-sm"
                  onKeyDown={handleSearchKeyDown}
                  autoFocus
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      triggerHaptic(50);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>
              {searchQuery.trim() && (
                <button
                  type="button"
                  onClick={() => handleSaveSearch(searchQuery, filters)}
                  className="p-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                  title="Sauvegarder la recherche"
                >
                  <Save size={18} />
                </button>
              )}
            </div>

            {/* Quick Actions & Saved Searches & Search Suggestions */}
            <div className="overflow-y-auto flex-1 bg-white dark:bg-gray-900">
              {!searchQuery.trim() && (
                <>
                  <div className="px-4 py-3">
                    {renderQuickActions()}
                    {renderSavedSearches()}
                  </div>
                  {renderSearchSuggestions()}
                </>
              )}
              {showResults && (
                <div className="mt-4 px-4">
                  {isHistoryPanelOpen ? renderHistoryResults() : renderMobileSearchResults()}
                </div>
              )}
            </div>

            {/* Bottom Sheet for Filters on Mobile */}
            {showBottomSheet && (
              <div className="fixed inset-x-0 bottom-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 rounded-t-3xl shadow-2xl z-[101] max-h-[80vh] overflow-y-auto">
                <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between">
                  <h3 className="font-bold text-lg text-gray-900 dark:text-white">Filtres</h3>
                  <button
                    type="button"
                    onClick={() => {
                      setShowBottomSheet(false);
                      triggerHaptic(50);
                    }}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                  >
                    <X size={20} />
                  </button>
                </div>
                <div className="p-4">
                  {renderFilterPanel(true)}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 🎯 NAVBAR PRINCIPALE - Proposal A: Two-Tier Layout */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-white/95 dark:bg-gray-900/95 shadow-lg border-b border-gray-200/50 dark:border-gray-800/50"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        {/* Top Bar: Logo, Search, Actions */}
        <div className="mx-auto px-4 sm:px-6 lg:px-8 max-w-[1400px] 2xl:max-w-[1600px]">
          <div className="flex items-center justify-between h-16 gap-4 lg:gap-6">
            
            {/* === LOGO HDMarket === */}
            <Link to="/" className="flex items-center space-x-2 sm:space-x-3 group active:scale-95 transition-transform">
              {desktopLogo || mobileLogo ? (
                <>
                  <img
                    src={mobileLogo || desktopLogo}
                    alt="Logo HDMarket"
                    className="h-10 w-10 sm:h-14 sm:w-14 rounded-xl object-contain border border-gray-200/60 dark:border-gray-700/60 bg-white dark:bg-gray-800 shadow-sm sm:shadow-md transition-all duration-300 group-hover:shadow-lg sm:hidden"
                  />
                  <img
                    src={desktopLogo || mobileLogo}
                    alt="Logo HDMarket"
                    className="hidden h-[62px] w-auto max-w-[200px] object-contain sm:block transition-all duration-300 group-hover:scale-105"
                    style={{ lineHeight: '28px' }}
                  />
                </>
              ) : (
                <>
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-indigo-600 rounded-xl flex items-center justify-center shadow-md sm:shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-105">
                    <span className="text-white font-black text-sm sm:text-base">HD</span>
                  </div>
                  <div className="hidden sm:flex flex-col">
                    <span className="text-xl font-black text-indigo-600">
                      HDMarket
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 -mt-1">Marketplace Premium</span>
                  </div>
                </>
              )}
            </Link>

            {/* === ACTIONS MOBILE SIMPLIFIÉES === */}
            {user && (
              <div className="md:hidden flex items-center gap-2">
                <Link
                  to="/notifications"
                  className="relative flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-200 active:scale-95"
                  aria-label="Notifications"
                >
                  <Bell className="text-gray-600 dark:text-gray-300" size={18} />
                  {commentAlerts > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center shadow-lg">
                      {commentAlerts > 99 ? '99+' : commentAlerts}
                    </span>
                  )}
                </Link>
              </div>
            )}

            {/* === SEARCH BAR (Centered in Top Bar) === */}
            <div className="hidden lg:flex flex-1 max-w-xl mx-4">
              <div className="relative w-full">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher produits, boutiques, catégories..."
                  className="w-full pl-12 pr-20 py-3 bg-gray-100 dark:bg-gray-800 border-0 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-gray-700 transition-all duration-200 placeholder-gray-500 text-sm"
                  onFocus={() => { 
                    setShowResults(true); 
                    if (isMobileLayout) setIsSearchFullScreen(true);
                    if (user && searchHistory.length === 0) fetchSearchHistory(); 
                  }}
                  onKeyDown={handleSearchKeyDown}
                  onBlur={() => setTimeout(() => setShowResults(false), 250)}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <button 
                    onClick={handleOpenHistoryPanel} 
                    className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 px-2 py-1 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                  >
                    Historique
                  </button>
                </div>
                {showResults && (
                  <div className="absolute top-14 left-0 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl max-h-80 overflow-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700 z-50 w-full">
                    {isHistoryPanelOpen ? renderHistoryResults() : renderDesktopSearchResults()}
                  </div>
                )}
              </div>
            </div>

            {/* === ACTIONS UTILISATEUR (Desktop) - Icons Only === */}
            <div className="hidden md:flex items-center gap-2">
              {/* Action Icons */}
              {user && (
                <>
                  <Link
                    to="/notifications"
                    className="relative flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-200"
                    aria-label="Notifications"
                  >
                    <Bell size={18} />
                    {commentAlerts > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                        {commentAlerts > 99 ? '99+' : commentAlerts}
                      </span>
                    )}
                  </Link>
                  <Link
                    to="/orders/messages"
                    className="relative flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-200"
                    aria-label="Messages"
                  >
                    <MessageSquare size={18} />
                    {hasUnreadOrderMessages && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center animate-pulse">
                        {unreadOrderMessagesBadge}
                      </span>
                    )}
                  </Link>
                  <Link
                    to="/favorites"
                    className="relative flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-200"
                    aria-label="Favoris"
                  >
                    <Heart size={18} />
                    {favoritesCount > 0 && (
                      <span className="absolute -top-1 -right-1 bg-pink-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                        {favoritesCount > 99 ? '99+' : favoritesCount}
                      </span>
                    )}
                  </Link>
                  <Link
                    to="/cart"
                    className="relative flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-200"
                    aria-label="Panier"
                  >
                    <ShoppingCart size={18} />
                    {cartCount > 0 && (
                      <span className="absolute -top-1 -right-1 bg-indigo-600 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                        {cartCount > 99 ? '99+' : cartCount}
                      </span>
                    )}
                  </Link>
                </>
              )}

              {/* Compte utilisateur */}
              {!user ? (
                <div className="flex items-center gap-2">
                  <NavLink
                    to="/login"
                    className="px-3 py-2 rounded-full border border-[#007AFF] text-[#007AFF] font-medium hover:bg-[rgba(0,122,255,0.08)] tap-feedback transition-all duration-200"
                  >
                    Connexion
                  </NavLink>
                  <NavLink
                    to="/register"
                    className="px-3 py-2 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 shadow-lg hover:shadow-xl transition-all duration-200"
                  >
                    Inscription
                  </NavLink>
                </div>
              ) : (
                <div className="relative group">
                  <button className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-200">
                    <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center">
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
                      <Link
                        to="/seller/orders"
                        className="relative flex items-center gap-3 px-3 py-2 rounded-xl text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                      >
                        <Package size={16} />
                        <span>Commandes clients</span>
                        {hasSellerOrders && (
                          <span className="ml-auto bg-emerald-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                            {sellerOrdersBadge}
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
                          to="/admin/settings"
                          className="flex items-center gap-3 px-3 py-2 rounded-xl text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                        >
                          <SlidersHorizontal size={16} />
                          <span className="text-sm font-semibold">App Settings</span>
                        </Link>
                      )}
                      {(isAdmin || user?.canReadFeedback) && (
                        <Link
                          to="/admin/feedback"
                          className="relative flex items-center gap-3 px-3 py-2 rounded-xl text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                        >
                          <MessageSquare size={16} />
                          <span className="text-sm font-semibold">Avis amélioration</span>
                          {unreadFeedback > 0 && (
                            <span className="ml-auto bg-emerald-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                              {unreadFeedback > 99 ? '99+' : unreadFeedback}
                            </span>
                          )}
                        </Link>
                      )}
                      {(isAdmin || user?.canVerifyPayments) && (
                        <Link
                          to="/admin/payment-verification"
                          className="relative flex items-center gap-3 px-3 py-2 rounded-xl text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                        >
                          <CheckCircle size={16} />
                          <span className="text-sm font-semibold">Vérifier paiements</span>
                          {waitingPayments > 0 && (
                            <span className="ml-auto flex items-center justify-center min-w-[22px] h-6 px-2 bg-red-500 text-white text-xs font-bold rounded-full shadow-lg border-2 border-white dark:border-gray-800 animate-pulse">
                              {waitingPayments > 99 ? '99+' : waitingPayments}
                            </span>
                          )}
                        </Link>
                      )}
                      {(canAccessBackOffice || user?.canManageComplaints) && (
                        <Link
                          to="/admin/complaints"
                          className="relative flex items-center gap-3 px-3 py-2 rounded-xl text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                        >
                          <AlertCircle size={16} />
                          <span className="text-sm font-semibold">Traiter les réclamations</span>
                        </Link>
                      )}
                      {!isAdmin && user?.canManageBoosts && (
                        <Link
                          to="/admin/product-boosts"
                          className="flex items-center gap-3 px-3 py-2 rounded-xl text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                        >
                          <Sparkles size={16} />
                          <span className="text-sm font-semibold">Boost produits</span>
                        </Link>
                      )}
                      {isAdmin && (
                        <Link
                          to="/admin/payment-verifiers"
                          className="flex items-center gap-3 px-3 py-2 rounded-xl text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                        >
                          <Users size={16} />
                          <span className="text-sm font-semibold">Vérificateurs paiements</span>
                        </Link>
                      )}
                      {isAdmin && (
                        <Link
                          to="/admin/product-boosts"
                          className="flex items-center gap-3 px-3 py-2 rounded-xl text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                        >
                          <Sparkles size={16} />
                          <span className="text-sm font-semibold">Boost produits</span>
                        </Link>
                      )}
                      {isAdmin && (
                        <Link
                          to="/admin/reports"
                          className="flex items-center gap-3 px-3 py-2 rounded-xl text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                        >
                          <FileText size={16} />
                          <span className="text-sm font-semibold">Rapports</span>
                        </Link>
                      )}
                      <Link
                        to="/my/stats"
                        className="flex items-center gap-3 px-3 py-2 rounded-xl text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                      >
                        <BarChart3 size={16} />
                        <span>Statistiques</span>
                      </Link>
                      <Link
                        to="/favorites"
                        className="relative flex items-center gap-3 px-3 py-2 rounded-xl text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                      >
                        <Heart size={16} />
                        <span>Favoris</span>
                        {favoritesCount > 0 && (
                          <span className="ml-auto bg-pink-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                            {favoritesCount}
                          </span>
                        )}
                      </Link>
                      <Link
                        to="/cart"
                        className="relative flex items-center gap-3 px-3 py-2 rounded-xl text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                      >
                        <ShoppingCart size={16} />
                        <span>Panier</span>
                        {cartCount > 0 && (
                          <span className="ml-auto bg-indigo-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                            {cartCount}
                          </span>
                        )}
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
              className={`md:hidden flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-300 active:scale-95 ${
                isMenuOpen 
                  ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 shadow-md' 
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
              aria-label={isMenuOpen ? "Fermer le menu" : "Ouvrir le menu"}
            >
              {isMenuOpen ? <X size={20} strokeWidth={2.5} /> : <Menu size={20} strokeWidth={2} />}
            </button>
          </div>
        </div>

        {/* === SECONDARY NAVIGATION BAR (Proposal A) === */}
        <div className="hidden lg:block bg-gradient-to-r from-indigo-600 to-indigo-700 dark:from-indigo-800 dark:to-indigo-900">
          <div className="mx-auto px-4 sm:px-6 lg:px-8 max-w-[1400px] 2xl:max-w-[1600px]">
            <div className="flex items-center gap-1 h-12">
              {/* Accueil */}
              <NavLink 
                to="/" 
                className={({ isActive }) => 
                  `px-4 py-2 text-white font-semibold text-sm hover:underline transition-all duration-200 ${
                    isActive ? 'underline' : ''
                  }`
                }
              >
                Accueil
              </NavLink>

              {/* Catégories with Mega Menu */}
              <div className="relative">
                <button
                  onMouseEnter={handleCategoryMenuOpen}
                  onMouseLeave={handleCategoryMenuDelayedClose}
                  className="px-4 py-2 text-white font-semibold text-sm hover:underline transition-all duration-200 flex items-center gap-1"
                >
                  Catégories
                  <ChevronDown
                    size={16}
                    className={`transition-transform duration-200 ${isCategoryMenuOpen ? "rotate-180" : ""}`}
                  />
                </button>
                
                {/* MEGA MENU CATÉGORIES */}
                {isCategoryMenuOpen && (
                  <div 
                    className="absolute left-0 mt-0 w-[800px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl z-50 overflow-hidden"
                    onMouseEnter={handleCategoryMenuOpen}
                    onMouseLeave={handleCategoryMenuDelayedClose}
                  >
                    <div className="p-6">
                      <div className="grid grid-cols-3 gap-6">
                        {categoryGroups.map((group) => {
                          const Icon = group.icon;
                          return (
                            <div key={group.id} className="space-y-2">
                              <div className="flex items-center gap-2 mb-3">
                                {Icon && <Icon className="w-5 h-5 text-indigo-600" />}
                                <h3 className="font-bold text-gray-900 dark:text-white text-sm">
                                  {group.label}
                                </h3>
                              </div>
                              <ul className="space-y-1">
                                {group.options.map((option) => (
                                  <li key={option.value}>
                                    <Link
                                      to={`/categories/${option.value}`}
                                      className="block px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                                      onClick={() => setIsCategoryMenuOpen(false)}
                                    >
                                      {option.label}
                                    </Link>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          );
                        })}
                      </div>
                      <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                        <Link
                          to="/products"
                          className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 flex items-center gap-2"
                          onClick={() => setIsCategoryMenuOpen(false)}
                        >
                          Voir toutes les catégories →
                        </Link>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Boutiques with Enhanced Dropdown */}
              <div className="relative">
                <button
                  onMouseEnter={handleShopMenuOpen}
                  onMouseLeave={handleShopMenuDelayedClose}
                  className="px-4 py-2 text-white font-semibold text-sm hover:underline transition-all duration-200 flex items-center gap-1"
                >
                  Boutiques
                  <ChevronDown
                    size={16}
                    className={`transition-transform duration-200 ${isShopMenuOpen ? "rotate-180" : ""}`}
                  />
                </button>
                
                {/* ENHANCED BOUTIQUES MENU */}
                {isShopMenuOpen && (
                  <div 
                    className="absolute left-0 mt-0 w-96 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl z-50 overflow-hidden"
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
                    
                    <div className="max-h-96 overflow-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700">
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

              {/* Promotions */}
              <NavLink 
                to="/top-deals" 
                className={({ isActive }) => 
                  `px-4 py-2 text-white font-semibold text-sm hover:underline transition-all duration-200 ${
                    isActive ? 'underline' : ''
                  }`
                }
              >
                Promotions
              </NavLink>

              {/* Nouveautés */}
              <NavLink 
                to="/top-new" 
                className={({ isActive }) => 
                  `px-4 py-2 text-white font-semibold text-sm hover:underline transition-all duration-200 ${
                    isActive ? 'underline' : ''
                  }`
                }
              >
                Nouveautés
              </NavLink>

              {/* Réclamations & Avis amélioration - all users (desktop) */}
              <Link
                to="/reclamations"
                className="px-4 py-2 text-white font-semibold text-sm hover:underline transition-all duration-200"
              >
                Réclamations
              </Link>
              <Link
                to="/avis-amelioration"
                className="px-4 py-2 text-white font-semibold text-sm hover:underline transition-all duration-200"
              >
                Avis amélioration
              </Link>

              {/* Devenir Boutique - non-shop users (desktop) */}
              {user && user.accountType !== 'shop' && (
                <NavLink
                  to="/shop-conversion-request"
                  className={({ isActive }) =>
                    `px-4 py-2 text-white font-semibold text-sm hover:underline transition-all duration-200 ${
                      isActive ? 'underline' : ''
                    }`
                  }
                >
                  Devenir Boutique
                </NavLink>
              )}

              {/* Admin (desktop) */}
              {canAccessBackOffice && (
                <NavLink
                  to="/admin"
                  className={({ isActive }) =>
                    `px-4 py-2 text-white font-semibold text-sm hover:underline transition-all duration-200 flex items-center gap-1.5 ${
                      isActive ? 'underline' : ''
                    }`
                  }
                >
                  <Settings size={16} />
                  {isManager ? 'Gestion' : 'Admin'}
                </NavLink>
              )}

              {/* Vendre Button */}
              {user && (
                <Link
                  to="/my"
                  className="ml-auto px-4 py-2 bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 font-bold text-sm rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all duration-200 flex items-center gap-2 shadow-md hover:shadow-lg"
                >
                  <Plus size={16} />
                  Vendre
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* === BARRE DE RECHERCHE MOBILE === */}
        <div
          className={`lg:hidden mt-2 border-t border-gray-200/60 dark:border-gray-800/60 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md mb-6 ${
            shouldHideSearchBar ? 'hidden' : ''
          }`}
        >
          <div className="max-w-7xl mx-auto px-4 py-3">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" size={18} />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher produits, boutiques..."
                className="w-full pl-11 pr-20 py-3 bg-gray-50 dark:bg-gray-800/80 border border-gray-200/60 dark:border-gray-700/60 rounded-2xl focus:ring-2 focus:ring-[#007AFF]/50 focus:border-[#007AFF] focus:bg-white dark:focus:bg-gray-800 transition-all duration-200 text-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 shadow-sm focus:shadow-md"
                onFocus={() => { 
                  setShowResults(true); 
                  if (isMobileLayout) setIsSearchFullScreen(true);
                  if (user && searchHistory.length === 0) fetchSearchHistory(); 
                }}
                onKeyDown={handleSearchKeyDown}
                onBlur={() => setTimeout(() => setShowResults(false), 250)}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <button 
                  onClick={handleOpenHistoryPanel} 
                  className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 px-2 py-1 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                >
                  Historique
                </button>
              </div>
              {showResults && !isSearchFullScreen && (
                <div className="absolute top-14 left-0 right-0 bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-700/80 rounded-2xl shadow-2xl max-h-80 overflow-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700 z-40 backdrop-blur-xl">
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
                      ? 'bg-indigo-600 text-white shadow-lg' 
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
                      ? 'bg-indigo-600 text-white shadow-lg' 
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200'
                  }`
                }
              >
                <Store size={20} />
                Boutiques
              </NavLink>

              <NavLink
                to="/suggestions"
                onClick={() => setIsMenuOpen(false)}
                className={({ isActive }) => 
                  `flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 ${
                    isActive 
                      ? 'bg-indigo-600 text-white shadow-lg' 
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200'
                  }`
                }
              >
                <Sparkles size={20} />
                Suggestions
              </NavLink>

              {/* Réclamations & Avis amélioration - all users (mobile) */}
              <Link
                to="/reclamations"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                <AlertCircle size={20} />
                Réclamations
              </Link>
              <Link
                to="/avis-amelioration"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                <MessageSquare size={20} />
                Avis amélioration
              </Link>

              {/* Utilisateur connecté mobile - TOUJOURS AFFICHER "Mes annonces" */}
              {user && (
                <>
                  <NavLink 
                    to="/my" 
                    onClick={() => setIsMenuOpen(false)}
                    className={({ isActive }) => 
                      `flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 ${
                        isActive 
                          ? 'bg-indigo-600 text-white shadow-lg' 
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200'
                      }`
                    }
                  >
                    <Package size={20} />
                    Mes annonces
                  </NavLink>

                  <NavLink 
                    to="/profile" 
                    onClick={() => setIsMenuOpen(false)}
                    className={({ isActive }) => 
                      `flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 ${
                        isActive 
                          ? 'bg-indigo-600 text-white shadow-lg' 
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200'
                      }`
                    }
                  >
                    <User size={20} />
                    Mon profil
                  </NavLink>

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

                  {user && user.accountType !== 'shop' && (
                    <NavLink 
                      to="/shop-conversion-request" 
                      onClick={() => setIsMenuOpen(false)}
                      className={({ isActive }) => 
                        `flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 ${
                          isActive 
                            ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg' 
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200'
                        }`
                      }
                    >
                      <Store size={20} />
                      Devenir Boutique
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
                  <NavLink
                    to="/orders/messages"
                    onClick={() => setIsMenuOpen(false)}
                    className="relative flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                    <MessageSquare size={20} />
                    Messages
                    {hasUnreadOrderMessages && (
                      <span className="ml-auto bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full animate-pulse">
                        {unreadOrderMessagesBadge}
                      </span>
                    )}
                  </NavLink>
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
                  {(isAdmin || user?.canReadFeedback) && (
                    <NavLink
                      to="/admin/feedback"
                      onClick={() => setIsMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    >
                      <MessageSquare size={20} />
                      Avis amélioration
                      {unreadFeedback > 0 && (
                        <span className="ml-auto bg-emerald-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                          {unreadFeedback > 99 ? '99+' : unreadFeedback}
                        </span>
                      )}
                    </NavLink>
                  )}
                  {(isAdmin || user?.canVerifyPayments) && (
                    <NavLink
                      to="/admin/payment-verification"
                      onClick={() => setIsMenuOpen(false)}
                      className="relative flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    >
                      <CheckCircle size={20} />
                      <span>Vérifier paiements</span>
                      {waitingPayments > 0 && (
                        <span className="ml-auto flex items-center justify-center min-w-[22px] h-6 px-2 bg-red-500 text-white text-xs font-bold rounded-full shadow-lg border-2 border-white dark:border-gray-800 animate-pulse">
                          {waitingPayments > 99 ? '99+' : waitingPayments}
                        </span>
                      )}
                    </NavLink>
                  )}
                  {(canAccessBackOffice || user?.canManageComplaints) && (
                    <NavLink
                      to="/admin/complaints"
                      onClick={() => setIsMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    >
                      <AlertCircle size={20} />
                      Traiter les réclamations
                    </NavLink>
                  )}
                  {!isAdmin && user?.canManageBoosts && (
                    <NavLink
                      to="/admin/product-boosts"
                      onClick={() => setIsMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    >
                      <Sparkles size={20} />
                      Boost produits
                    </NavLink>
                  )}
                  {isAdmin && (
                    <NavLink
                      to="/admin/payment-verifiers"
                      onClick={() => setIsMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    >
                      <Users size={20} />
                      Vérificateurs paiements
                    </NavLink>
                  )}
                  {isAdmin && (
                    <NavLink
                      to="/admin/product-boosts"
                      onClick={() => setIsMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    >
                      <Sparkles size={20} />
                      Boost produits
                    </NavLink>
                  )}
                  {isAdmin && (
                    <NavLink
                      to="/admin/reports"
                      onClick={() => setIsMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    >
                      <FileText size={20} />
                      Rapports
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
                            to="/admin/settings"
                            onClick={() => setIsMenuOpen(false)}
                            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-900/20 text-gray-700 dark:text-gray-200 font-medium hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
                          >
                            <SlidersHorizontal size={20} />
                            App Settings
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
                    className="px-4 py-3 rounded-xl bg-indigo-600 text-white text-center font-medium hover:bg-indigo-700 transition-colors"
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

      {/* BARRE DE NAVIGATION FIXE MOBILE - DESIGN MODERNE ET AMÉLIORÉE */}
      <div 
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 border-t border-gray-200/80 dark:border-gray-800/80 shadow-2xl backdrop-blur-xl transition-all duration-300"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        onTouchStart={handleBottomBarTouchStart}
        onTouchMove={handleBottomBarTouchMove}
        onTouchEnd={handleBottomBarTouchEnd}
      >
        {/* Swipe indicator */}
        {!bottomBarExpanded && secondaryItems.length > 0 && (
          <div 
            className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center cursor-pointer z-10"
            onClick={() => {
              setBottomBarExpanded(true);
              triggerHaptic('medium');
            }}
          >
            <div className="bg-indigo-600 dark:bg-indigo-500 text-white p-1.5 rounded-full shadow-lg">
              <ChevronUp size={12} className="animate-bounce" />
            </div>
          </div>
        )}
        
        <div className={`max-w-3xl mx-auto px-3 transition-all duration-300 ${bottomBarExpanded ? 'py-3' : 'py-2.5'}`}>
          {/* Primary Navigation Items */}
          <div className="flex items-center justify-around">
            {primaryItems.map((item) => {
              const Icon = item.icon;
              const badge = item.badge || 0;
              const isActive = location.pathname === item.path;
              
              if (item.isButton) {
                return (
                  <button
                    key={item.id}
                    type="button"
                    data-item-id={item.id}
                    onClick={() => {
                      setIsMenuOpen(true);
                      triggerHaptic('light');
                    }}
                    onTouchStart={handleBottomBarTouchStart}
                    onTouchEnd={handleBottomBarTouchEnd}
                    className={`relative flex flex-col items-center justify-center gap-1.5 px-4 py-2 rounded-2xl transition-all duration-300 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 active:scale-95 ${
                      isMenuOpen ? 'text-indigo-600 dark:text-indigo-400 scale-105' : ''
                    }`}
                  >
                    <div className={`relative transition-all duration-300 ${isMenuOpen ? 'scale-110' : ''}`}>
                      {isMenuOpen ? (
                        <X size={22} className="text-indigo-600 dark:text-indigo-400" strokeWidth={2.5} />
                      ) : (
                        <Icon size={22} strokeWidth={2} />
                      )}
                      {isMenuOpen && (
                        <div className="absolute inset-0 -z-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-full blur-md animate-pulse" />
                      )}
                    </div>
                    <span className={`text-[11px] font-semibold transition-all ${isMenuOpen ? 'text-indigo-600 dark:text-indigo-400' : ''}`}>
                      {item.label}
                    </span>
                    {isMenuOpen && (
                      <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
                    )}
                    {/* Quick Actions Menu */}
                    {showQuickActions === item.id && (
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-2 min-w-[150px] z-50">
                        {getQuickActions(item.id).map((action, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              action.action();
                              setShowQuickActions(null);
                            }}
                            className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                          >
                            {action.label}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => setShowQuickActions(null)}
                          className="w-full text-left px-3 py-2 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors mt-1"
                        >
                          Annuler
                        </button>
                      </div>
                    )}
                  </button>
                );
              }
              
              return (
                <NavLink
                  key={item.id}
                  to={item.path}
                  data-item-id={item.id}
                  onTouchStart={handleBottomBarTouchStart}
                  onTouchEnd={handleBottomBarTouchEnd}
                  className={({ isActive: navIsActive }) =>
                    `relative flex flex-col items-center justify-center gap-1.5 px-4 py-2 rounded-2xl transition-all duration-300 ${
                      navIsActive 
                        ? "text-indigo-600 dark:text-indigo-400 scale-105" 
                        : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                    }`
                  }
                  onClick={() => {
                    setIsMenuOpen(false);
                    setBottomBarExpanded(false);
                    triggerHaptic('light');
                  }}
                >
                  {({ isActive: navIsActive }) => (
                    <>
                      <div className={`relative transition-all duration-300 ${navIsActive ? 'scale-110' : ''}`}>
                        <Icon 
                          size={22} 
                          className={navIsActive ? 'text-indigo-600 dark:text-indigo-400' : ''}
                          strokeWidth={navIsActive ? 2.5 : 2}
                          fill={item.id === 'favorites' && navIsActive ? 'currentColor' : 'none'}
                        />
                        {navIsActive && (
                          <div className="absolute inset-0 -z-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-full blur-md animate-pulse" />
                        )}
                      </div>
                      <span className={`text-[11px] font-semibold transition-all ${navIsActive ? 'text-indigo-600 dark:text-indigo-400' : ''}`}>
                        {item.label}
                      </span>
                      {badge > 0 && (
                        <span className={`absolute -top-0.5 right-2.5 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center shadow-lg transition-all ${
                          navIsActive ? 'bg-indigo-600' : item.id === 'favorites' ? 'bg-pink-500' : 'bg-indigo-600'
                        }`}>
                          {badge > 99 ? '99+' : badge}
                        </span>
                      )}
                      {navIsActive && (
                        <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
                      )}
                      {/* Quick Actions Menu */}
                      {showQuickActions === item.id && (
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-2 min-w-[150px] z-50">
                          {getQuickActions(item.id).map((action, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                action.action();
                                setShowQuickActions(null);
                              }}
                              className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            >
                              {action.label}
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setShowQuickActions(null);
                            }}
                            className="w-full text-left px-3 py-2 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors mt-1"
                          >
                            Annuler
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </NavLink>
              );
            })}
          </div>

          {/* Secondary Navigation Items (Expanded) */}
          {bottomBarExpanded && secondaryItems.length > 0 && (
            <>
              <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-2 px-2">
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Plus d'options</span>
                  <button
                    type="button"
                    onClick={() => {
                      setBottomBarExpanded(false);
                      triggerHaptic('light');
                    }}
                    className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <ChevronUp size={16} className="rotate-180" />
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {secondaryItems.map((item) => {
                    const Icon = item.icon;
                    const badge = item.badge || 0;
                    const isActive = location.pathname === item.path;
                    
                    return (
                      <NavLink
                        key={item.id}
                        to={item.path}
                        data-item-id={item.id}
                        onTouchStart={handleBottomBarTouchStart}
                        onTouchEnd={handleBottomBarTouchEnd}
                        className={({ isActive: navIsActive }) =>
                          `relative flex flex-col items-center justify-center gap-1 px-2 py-2 rounded-xl transition-all duration-300 ${
                            navIsActive 
                              ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 scale-105" 
                              : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                          }`
                        }
                        onClick={() => {
                          setBottomBarExpanded(false);
                          triggerHaptic('light');
                        }}
                      >
                        {({ isActive: navIsActive }) => (
                          <>
                            <div className="relative">
                              <Icon 
                                size={18} 
                                className={navIsActive ? 'text-indigo-600 dark:text-indigo-400' : ''}
                                strokeWidth={navIsActive ? 2.5 : 2}
                              />
                              {badge > 0 && (
                                <span className={`absolute -top-1 -right-1 text-white text-[9px] font-bold px-1 py-0.5 rounded-full min-w-[16px] text-center shadow-lg ${
                                  navIsActive ? 'bg-indigo-600' : 'bg-red-500'
                                }`}>
                                  {badge > 99 ? '99+' : badge}
                                </span>
                              )}
                            </div>
                            <span className={`text-[10px] font-medium transition-all truncate w-full text-center ${navIsActive ? 'text-indigo-600 dark:text-indigo-400' : ''}`}>
                              {item.label}
                            </span>
                            {navIsActive && (
                              <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-0.5 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
                            )}
                            {/* Quick Actions Menu */}
                            {showQuickActions === item.id && (
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-2 min-w-[150px] z-50">
                                {getQuickActions(item.id).map((action, idx) => (
                                  <button
                                    key={idx}
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      action.action();
                                      setShowQuickActions(null);
                                    }}
                                    className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                  >
                                    {action.label}
                                  </button>
                                ))}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setShowQuickActions(null);
                                  }}
                                  className="w-full text-left px-3 py-2 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors mt-1"
                                >
                                  Annuler
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ESPACES POUR LES BARRES FIXES */}
      <div className="h-16 lg:h-24"></div>
      <div className="md:hidden h-20"></div>
    </>
  );
}
