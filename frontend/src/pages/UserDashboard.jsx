import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatPriceWithStoredSettings } from "../utils/priceFormatter";
import { ArrowDownIcon, ArrowDownTrayIcon, ArrowLeftIcon, ArrowPathIcon, ArrowRightIcon, ArrowTrendingUpIcon, ArrowUpIcon, ArrowsUpDownIcon, BoltIcon, CalendarDaysIcon, CalendarIcon, ChartBarIcon, CheckCircleIcon, CheckIcon, ChevronDownIcon, ChevronUpIcon, ClockIcon, CubeIcon, DocumentTextIcon, ExclamationCircleIcon, ExclamationTriangleIcon, EyeIcon, FunnelIcon, ListBulletIcon, MagnifyingGlassIcon, PencilIcon, PhotoIcon, PlusIcon, PowerIcon, ShareIcon, ShieldCheckIcon, SparklesIcon, Square2StackIcon, Squares2X2Icon, StopIcon, TrashIcon, XCircleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import AuthContext from '../context/AuthContext';
import PaymentForm from '../components/PaymentForm';
import ProductForm from '../components/ProductForm';
import ProductAnalytics from '../components/ProductAnalytics';
import ShareProductModal from '../components/social/ShareProductModal';
import useDesktopExternalLink from '../hooks/useDesktopExternalLink';
import useIsMobile from '../hooks/useIsMobile';
import { buildProductPath } from '../utils/links';
import useCategories from '../hooks/useCategories';
import storage from '../utils/storage';
import BaseModal from '../components/modals/BaseModal';
import PreviewableImage from '../components/media/PreviewableImage';
import { appConfirm } from '../utils/appDialog';
import { useAppSettings } from '../context/AppSettingsContext';

const ITEMS_PER_PAGE = 12;
const MOBILE_ITEMS_BATCH = 12;
const RECENT_CREATE_HIGHLIGHT_MS = 12000;

const STATUS_LABELS = {
  all: 'Toutes',
  pending: 'En attente',
  approved: 'Approuvées',
  rejected: 'Rejetées',
  disabled: 'Désactivées'
};

const STATUS_STYLES = {
  pending: { badge: 'bg-amber-500', card: 'bg-amber-50 border-amber-200 text-amber-800' },
  approved: { badge: 'bg-emerald-500', card: 'bg-emerald-50 border-emerald-200 text-emerald-800' },
  rejected: { badge: 'bg-red-500', card: 'bg-red-50 border-red-200 text-red-800' },
  disabled: { badge: 'bg-gray-500', card: 'bg-gray-50 border-gray-200 text-gray-700' }
};

const STATUS_ICONS = {
  pending: ClockIcon,
  approved: CheckCircleIcon,
  rejected: XMarkIcon,
  disabled: PowerIcon
};

const STATUS_MESSAGES = {
  pending: "Annonce en attente de validation après paiement.",
  approved: "Annonce validée et visible par les acheteurs.",
  rejected: "Annonce rejetée. Consultez le support pour plus de détails.",
  disabled: "Annonce désactivée. Elle n'est plus visible par les acheteurs."
};

const formatCurrency = (value) => formatPriceWithStoredSettings(value);

const normalizeSettingBoolean = (value, fallback = false) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'oui', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'non', 'off', ''].includes(normalized)) return false;
  }
  return fallback;
};

const formatDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
};

const getProductId = (product) => String(product?._id || product?.id || product?.slug || '').trim();

const normalizeCreatedProductPayload = (payload) => {
  if (!payload || typeof payload !== 'object') return null;
  if (payload.product && typeof payload.product === 'object') return payload.product;
  if (payload.item && typeof payload.item === 'object') return payload.item;
  return payload;
};

export default function UserDashboard() {
  const { categoryGroups } = useCategories();
  const { user } = useContext(AuthContext);
  const { showToast } = useToast();
  const { getRuntimeValue, isFeatureEnabled } = useAppSettings();
  const externalLinkProps = useDesktopExternalLink();
  const isMobile = useIsMobile(768);
  const isShopUser = user?.accountType === 'shop';
  const sellingEnabled = normalizeSettingBoolean(getRuntimeValue('enable_selling', true), true);
  // Defaults to hidden when unresolved — the Social Commerce Hub is a brand
  // new, off-by-default subsystem (see backend/scripts/seedSocialCommerceFeatureFlags.js).
  const socialCommerceEnabled = isFeatureEnabled('social_commerce', { defaultValue: false });
  const [shareProduct, setShareProduct] = useState(null);
  const [items, setItems] = useState([]);
  const mobileLoadMoreRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isProductModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [mobileVisibleCount, setMobileVisibleCount] = useState(MOBILE_ITEMS_BATCH);
  const [statusFilter, setStatusFilter] = useState('all');
  // Reminder: ProductForm auto-saves an unpublished new-listing draft in
  // localStorage — surface it here so the user finishes what they started.
  const [pendingDraft, setPendingDraft] = useState(null);
  const draftReminderKey = user?._id ? `hdmarket:draft:new:${user._id}` : null;
  const refreshDraftReminder = useCallback(() => {
    if (!draftReminderKey) { setPendingDraft(null); return; }
    try {
      const raw = localStorage.getItem(draftReminderKey);
      if (!raw) { setPendingDraft(null); return; }
      const saved = JSON.parse(raw);
      const form = saved?.form || {};
      const hasContent = Boolean(
        String(form.title || '').trim() || String(form.description || '').trim() || Number(form.price) > 0
      );
      setPendingDraft(hasContent ? { savedAt: saved.savedAt || null } : null);
    } catch { setPendingDraft(null); }
  }, [draftReminderKey]);
  useEffect(() => {
    // Runs on mount and every time the form modal closes — publishing
    // clears the draft, so the reminder disappears once the work is done.
    if (!isProductModalOpen) refreshDraftReminder();
  }, [isProductModalOpen, refreshDraftReminder]);
  const discardDraft = useCallback(() => {
    if (draftReminderKey) { try { localStorage.removeItem(draftReminderKey); } catch { /* ignore */ } }
    setPendingDraft(null);
  }, [draftReminderKey]);
  const [updatingId, setUpdatingId] = useState('');
  const [selectedProducts, setSelectedProducts] = useState(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [selectionMode, setSelectionMode] = useState('multiple'); // 'single' or 'multiple'
  
  // Advanced search & filtering states
  const [searchQuery, setSearchQuery] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const [boostedFilter, setBoostedFilter] = useState('all'); // 'all', 'boosted', 'non-boosted'
  const [installmentFilter, setInstallmentFilter] = useState('all'); // 'all', 'enabled', 'disabled'
  const [sortBy, setSortBy] = useState('date-desc'); // 'date-desc', 'date-asc', 'price-desc', 'price-asc', 'title-asc', 'title-desc', 'status-asc'
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [savedFilters, setSavedFilters] = useState([]);
  const [filterName, setFilterName] = useState('');
  const [analyticsProduct, setAnalyticsProduct] = useState(null);
  const [viewMode, setViewMode] = useState('list'); // 'grid' or 'list'
  const [recentlyCreatedProductId, setRecentlyCreatedProductId] = useState('');
  const [assistantAssignment, setAssistantAssignment] = useState(null);
  const [assistantInvites, setAssistantInvites] = useState([]);
  const [assistantAccessLoading, setAssistantAccessLoading] = useState(false);

  useEffect(() => {
    if (!user || isShopUser) {
      setAssistantAssignment(null);
      setAssistantInvites([]);
      return;
    }

    let cancelled = false;
    setAssistantAccessLoading(true);
    Promise.allSettled([
      api.get('/shops/me/assistant-shop'),
      api.get('/shops/me/assistant-invitations')
    ])
      .then(([assignmentRes, invitesRes]) => {
        if (cancelled) return;
        const assignment =
          assignmentRes.status === 'fulfilled' ? assignmentRes.value?.data?.data || null : null;
        const invites =
          invitesRes.status === 'fulfilled' && Array.isArray(invitesRes.value?.data?.data)
            ? invitesRes.value.data.data
            : [];
        setAssistantAssignment(assignment);
        setAssistantInvites(invites);
      })
      .finally(() => {
        if (!cancelled) setAssistantAccessLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isShopUser, user]);

  const load = async (options = {}) => {
    const silent = Boolean(options?.silent);
    if (!silent) {
      setLoading(true);
    }
    setError('');
    try {
      const { data } = await api.get('/products');
      setItems(Array.isArray(data) ? data : []);
      if (!silent) {
        setCurrentPage(1);
      }
    } catch (e) {
      setError(e.response?.data?.message || e.message || 'Impossible de charger vos annonces.');
      showToast(e.response?.data?.message || e.message || 'Erreur de chargement', { variant: 'error' });
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    load();
    loadSavedFilters();
  }, [isShopUser]);

  // Load saved filters from localStorage
  const loadSavedFilters = async () => {
    try {
      const saved = await storage.get('userDashboard_savedFilters');
      if (saved && Array.isArray(saved)) {
        setSavedFilters(saved);
      }
    } catch (err) {
      console.error('Error loading saved filters:', err);
    }
  };

  // CheckIcon current filter state
  const saveCurrentFilter = async () => {
    if (!filterName.trim()) {
      showToast('Veuillez entrer un nom pour ce filtre', { variant: 'error' });
      return;
    }

    const filterState = {
      id: Date.now().toString(),
      name: filterName.trim(),
      searchQuery,
      selectedCategories,
      priceMin,
      priceMax,
      dateFrom,
      dateTo,
      selectedStatuses,
      boostedFilter,
      installmentFilter,
      sortBy,
      createdAt: new Date().toISOString()
    };

    try {
      const updated = [...savedFilters, filterState];
      await storage.set('userDashboard_savedFilters', updated);
      setSavedFilters(updated);
      setFilterName('');
      showToast('Filtre sauvegardé avec succès', { variant: 'success' });
    } catch (err) {
      console.error('Error saving filter:', err);
      showToast('Erreur lors de la sauvegarde', { variant: 'error' });
    }
  };

  // Load a saved filter
  const loadSavedFilter = (filter) => {
    setSearchQuery(filter.searchQuery || '');
    setSearchDraft(filter.searchQuery || '');
    setSelectedCategories(filter.selectedCategories || []);
    setPriceMin(filter.priceMin || '');
    setPriceMax(filter.priceMax || '');
    setDateFrom(filter.dateFrom || '');
    setDateTo(filter.dateTo || '');
    setSelectedStatuses(filter.selectedStatuses || []);
    setBoostedFilter(filter.boostedFilter || 'all');
    setInstallmentFilter(filter.installmentFilter || 'all');
    setSortBy(filter.sortBy || 'date-desc');
    if (filter.selectedStatuses && filter.selectedStatuses.length > 0) {
      setStatusFilter('custom');
    } else {
      setStatusFilter('all');
    }
    showToast(`Filtre "${filter.name}" chargé`, { variant: 'success' });
  };

  // Delete a saved filter
  const deleteSavedFilter = async (filterId) => {
    try {
      const updated = savedFilters.filter((f) => f.id !== filterId);
      await storage.set('userDashboard_savedFilters', updated);
      setSavedFilters(updated);
      showToast('Filtre supprimé', { variant: 'success' });
    } catch (err) {
      console.error('Error deleting filter:', err);
      showToast('Erreur lors de la suppression', { variant: 'error' });
    }
  };

  // Clear all filters
  const clearAllFilters = () => {
    setSearchQuery('');
    setSearchDraft('');
    setSelectedCategories([]);
    setPriceMin('');
    setPriceMax('');
    setDateFrom('');
    setDateTo('');
    setSelectedStatuses([]);
    setBoostedFilter('all');
    setInstallmentFilter('all');
    setSortBy('date-desc');
    setStatusFilter('all');
    showToast('Filtres réinitialisés', { variant: 'success' });
  };

  const handleModalClose = () => {
    setProductModalOpen(false);
    setEditingProduct(null);
  };

  const revealCreatedProduct = (payload) => {
    const createdProduct = normalizeCreatedProductPayload(payload);
    const createdProductId = getProductId(createdProduct);

    if (!createdProductId) {
      load();
      return;
    }

    setItems((prev) => {
      const nextItems = Array.isArray(prev) ? [...prev] : [];
      const existingIndex = nextItems.findIndex((item) => getProductId(item) === createdProductId);
      if (existingIndex >= 0) {
        nextItems.splice(existingIndex, 1);
      }
      return [createdProduct, ...nextItems];
    });
    setRecentlyCreatedProductId(createdProductId);
    setCurrentPage(1);
    load({ silent: true });
  };

  const revealUpdatedProduct = (payload) => {
    const updatedProduct = normalizeCreatedProductPayload(payload);
    const updatedProductId = getProductId(updatedProduct);

    if (!updatedProductId) {
      load();
      return;
    }

    setItems((prev) => {
      const nextItems = Array.isArray(prev) ? [...prev] : [];
      const existingIndex = nextItems.findIndex((item) => getProductId(item) === updatedProductId);
      if (existingIndex >= 0) {
        nextItems.splice(existingIndex, 1);
      }
      return [updatedProduct, ...nextItems];
    });
    setRecentlyCreatedProductId(updatedProductId);
    setCurrentPage(1);
    load({ silent: true });
  };

  const updateStatus = async (id, action) => {
    setUpdatingId(id);
    try {
      await api.patch(`/products/${id}/${action}`);
      await load();
      showToast(
        action === 'disable' ? 'Annonce désactivée avec succès.' : 'Annonce réactivée avec succès.',
        { variant: 'success' }
      );
    } catch (e) {
      showToast(e.response?.data?.message || e.message || 'Erreur lors de la mise à jour', { variant: 'error' });
    } finally {
      setUpdatingId('');
    }
  };

  // Calculate statistics
  const stats = useMemo(() => {
    const total = items.length;
    const pending = items.filter((p) => p.status === 'pending').length;
    const approved = items.filter((p) => p.status === 'approved').length;
    const rejected = items.filter((p) => p.status === 'rejected').length;
    const disabled = items.filter((p) => p.status === 'disabled').length;
    const totalValue = items.reduce((sum, p) => sum + Number(p.price || 0), 0);
    return { total, pending, approved, rejected, disabled, totalValue };
  }, [items]);

  // Debounced search
  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchQuery(searchDraft.trim());
    }, 400);
    return () => clearTimeout(handler);
  }, [searchDraft]);

  // Get all unique categories from items
  const availableCategories = useMemo(() => {
    const cats = new Set();
    items.forEach((item) => {
      if (item.category) cats.add(item.category);
    });
    return Array.from(cats).sort();
  }, [items]);

  const promoEligibleProducts = useMemo(() => {
    return items
      .filter((item) => item?.status === 'approved')
      .map((item) => ({ id: item._id || item.id, title: item.title || 'Produit' }))
      .filter((item) => Boolean(item.id));
  }, [items]);

  // Calculate top performers based on combined metrics
  const topPerformers = useMemo(() => {
    return [...items]
      .filter((p) => p.status === 'approved') // Only approved products
      .map((product) => {
        const favorites = Number(product.favoritesCount || 0);
        const clicks = Number(product.whatsappClicks || 0);
        const sales = Number(product.salesCount || 0);
        // Score = weighted combination of metrics (favorites, clicks, sales)
        const score = favorites * 0.4 + clicks * 0.4 + sales * 20;
        return { ...product, performanceScore: score };
      })
      .sort((a, b) => b.performanceScore - a.performanceScore)
      .slice(0, 5)
      .map((p) => p._id || p.id);
  }, [items]);

  // FunnelIcon items by all criteria
  const filteredItems = useMemo(() => {
    let filtered = [...items];

    // MagnifyingGlassIcon by title and description
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.title?.toLowerCase().includes(query) ||
          p.description?.toLowerCase().includes(query)
      );
    }

    // FunnelIcon by categories
    if (selectedCategories.length > 0) {
      filtered = filtered.filter((p) => selectedCategories.includes(p.category));
    }

    // FunnelIcon by price range
    if (priceMin) {
      const min = Number(priceMin);
      if (!isNaN(min)) {
        filtered = filtered.filter((p) => Number(p.price || 0) >= min);
      }
    }
    if (priceMax) {
      const max = Number(priceMax);
      if (!isNaN(max)) {
        filtered = filtered.filter((p) => Number(p.price || 0) <= max);
      }
    }

    // FunnelIcon by date range
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      if (!isNaN(fromDate.getTime())) {
        filtered = filtered.filter((p) => {
          const pDate = new Date(p.createdAt);
          return pDate >= fromDate;
        });
      }
    }
    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999); // End of day
      if (!isNaN(toDate.getTime())) {
        filtered = filtered.filter((p) => {
          const pDate = new Date(p.createdAt);
          return pDate <= toDate;
        });
      }
    }

    // FunnelIcon by status (multiple statuses or single status filter)
    if (selectedStatuses.length > 0) {
      filtered = filtered.filter((p) => selectedStatuses.includes(p.status));
    } else if (statusFilter !== 'all' && statusFilter !== 'custom') {
      filtered = filtered.filter((p) => p.status === statusFilter);
    }

    // FunnelIcon by boosted status
    if (boostedFilter === 'boosted') {
      filtered = filtered.filter((p) => p.boosted === true);
    } else if (boostedFilter === 'non-boosted') {
      filtered = filtered.filter((p) => p.boosted !== true);
    }

    // FunnelIcon by installment availability
    if (installmentFilter === 'enabled') {
      filtered = filtered.filter((p) => p.installmentEnabled === true);
    } else if (installmentFilter === 'disabled') {
      filtered = filtered.filter((p) => p.installmentEnabled !== true);
    }

    // Sort items
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'date-desc':
          return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        case 'date-asc':
          return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
        case 'price-desc':
          return Number(b.price || 0) - Number(a.price || 0);
        case 'price-asc':
          return Number(a.price || 0) - Number(b.price || 0);
        case 'title-asc':
          return (a.title || '').localeCompare(b.title || '', 'fr');
        case 'title-desc':
          return (b.title || '').localeCompare(a.title || '', 'fr');
        case 'status-asc':
          return (a.status || '').localeCompare(b.status || '', 'fr');
        case 'status-desc':
          return (b.status || '').localeCompare(a.status || '', 'fr');
        default:
          return 0;
      }
    });

    return filtered;
  }, [
    items,
    searchQuery,
    selectedCategories,
    priceMin,
    priceMax,
    dateFrom,
    dateTo,
    selectedStatuses,
    statusFilter,
    boostedFilter,
    installmentFilter,
    sortBy
  ]);

  const recentlyCreatedProduct = useMemo(
    () => items.find((item) => getProductId(item) === recentlyCreatedProductId) || null,
    [items, recentlyCreatedProductId]
  );

  const isRecentlyCreatedHiddenByFilters = useMemo(() => {
    if (!recentlyCreatedProduct) return false;
    return !filteredItems.some((item) => getProductId(item) === recentlyCreatedProductId);
  }, [filteredItems, recentlyCreatedProduct, recentlyCreatedProductId]);

  const visibleItems = useMemo(() => {
    if (!recentlyCreatedProduct || !isRecentlyCreatedHiddenByFilters) {
      return filteredItems;
    }
    return [recentlyCreatedProduct, ...filteredItems];
  }, [filteredItems, isRecentlyCreatedHiddenByFilters, recentlyCreatedProduct]);

  // Pagination
  const totalPages = visibleItems.length ? Math.ceil(visibleItems.length / ITEMS_PER_PAGE) : 1;
  const hasMoreMobileItems = isMobile && mobileVisibleCount < visibleItems.length;
  const paginatedItems = useMemo(() => {
    if (isMobile) {
      return visibleItems.slice(0, mobileVisibleCount);
    }
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return visibleItems.slice(start, start + ITEMS_PER_PAGE);
  }, [visibleItems, currentPage, isMobile, mobileVisibleCount]);

  const currentRangeStart = isMobile
    ? (visibleItems.length ? 1 : 0)
    : visibleItems.length
    ? (currentPage - 1) * ITEMS_PER_PAGE + 1
    : 0;
  const currentRangeEnd = isMobile
    ? Math.min(visibleItems.length, mobileVisibleCount)
    : Math.min(visibleItems.length, currentPage * ITEMS_PER_PAGE);

  const goToPage = (page) => {
    const nextPage = Math.min(Math.max(page, 1), totalPages);
    setCurrentPage(nextPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    setCurrentPage(1);
    setMobileVisibleCount(MOBILE_ITEMS_BATCH);
    setSelectedProducts(new Set()); // Clear selection when filter changes
  }, [
    statusFilter,
    searchQuery,
    selectedCategories,
    priceMin,
    priceMax,
    dateFrom,
    dateTo,
    selectedStatuses,
    boostedFilter,
    installmentFilter,
    sortBy
  ]);

  useEffect(() => {
    setMobileVisibleCount(MOBILE_ITEMS_BATCH);
  }, [isMobile]);

  useEffect(() => {
    if (!isMobile || !hasMoreMobileItems) return undefined;
    const node = mobileLoadMoreRef.current;
    if (!node) return undefined;

    if (typeof IntersectionObserver === 'undefined') {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        setMobileVisibleCount((prev) => Math.min(prev + MOBILE_ITEMS_BATCH, visibleItems.length));
      },
      { rootMargin: '420px 0px 520px 0px', threshold: 0.01 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMoreMobileItems, isMobile, visibleItems.length]);

  useEffect(() => {
    if (!recentlyCreatedProductId) return undefined;
    const timeoutId = window.setTimeout(() => {
      setRecentlyCreatedProductId('');
    }, RECENT_CREATE_HIGHLIGHT_MS);
    return () => window.clearTimeout(timeoutId);
  }, [recentlyCreatedProductId]);

  // Clear selection when mode changes
  useEffect(() => {
    if (selectionMode === 'single' && selectedProducts.size > 1) {
      // If switching to single mode with multiple selections, keep only the first one
      const firstId = Array.from(selectedProducts)[0];
      setSelectedProducts(new Set([firstId]));
    }
  }, [selectionMode]);

  // Select/Deselect functions
  const toggleProductSelection = (productId) => {
    if (!productId) return;
    
    if (selectionMode === 'single') {
      // Single selection mode: only one product can be selected at a time
      setSelectedProducts((prev) => {
        if (prev.has(productId)) {
          return new Set(); // Deselect if already selected
        }
        return new Set([productId]); // Select only this one
      });
    } else {
      // Multiple selection mode: can select multiple products
      setSelectedProducts((prev) => {
        const next = new Set(prev);
        if (next.has(productId)) {
          next.delete(productId);
        } else {
          next.add(productId);
        }
        return next;
      });
    }
  };

  const selectAllProducts = () => {
    if (selectionMode === 'single') {
      // In single mode, select all doesn't make sense, so switch to multiple mode
      setSelectionMode('multiple');
      setSelectedProducts(new Set(paginatedItems.map((p) => p._id || p.id).filter(Boolean)));
    } else {
      // Multiple mode: toggle select all
      const allIds = paginatedItems.map((p) => p._id || p.id).filter(Boolean);
      if (selectedProducts.size === allIds.length && allIds.every((id) => selectedProducts.has(id))) {
        setSelectedProducts(new Set());
      } else {
        setSelectedProducts(new Set(allIds));
      }
    }
  };

  const clearSelection = () => {
    setSelectedProducts(new Set());
  };

  // Bulk actions
  const handleBulkEnable = async () => {
    if (selectedProducts.size === 0) return;
    if (!(await appConfirm(`Réactiver ${selectedProducts.size} produit(s) ?`))) return;

    setBulkActionLoading(true);
    try {
      await api.post('/products/bulk/enable', {
        productIds: Array.from(selectedProducts)
      });
      await load();
      clearSelection();
      showToast(`${selectedProducts.size} produit(s) réactivé(s) avec succès.`, { variant: 'success' });
    } catch (e) {
      showToast(e.response?.data?.message || e.message || 'Erreur lors de la réactivation', { variant: 'error' });
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkDisable = async () => {
    if (selectedProducts.size === 0) return;
    if (!(await appConfirm(`Désactiver ${selectedProducts.size} produit(s) ?`))) return;

    setBulkActionLoading(true);
    try {
      await api.post('/products/bulk/disable', {
        productIds: Array.from(selectedProducts)
      });
      await load();
      clearSelection();
      showToast(`${selectedProducts.size} produit(s) désactivé(s) avec succès.`, { variant: 'success' });
    } catch (e) {
      showToast(e.response?.data?.message || e.message || 'Erreur lors de la désactivation', { variant: 'error' });
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedProducts.size === 0) return;
    if (!(await appConfirm(`Supprimer définitivement ${selectedProducts.size} produit(s) ? Cette action est irréversible.`))) return;

    setBulkActionLoading(true);
    try {
      await api.post('/products/bulk/delete', {
        productIds: Array.from(selectedProducts)
      });
      await load();
      clearSelection();
      showToast(`${selectedProducts.size} produit(s) supprimé(s) avec succès.`, { variant: 'success' });
    } catch (e) {
      showToast(e.response?.data?.message || e.message || 'Erreur lors de la suppression', { variant: 'error' });
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (selectedProducts.size === 0) {
      showToast('Veuillez sélectionner au moins un produit.', { variant: 'error' });
      return;
    }

    const selectedItems = items.filter((p) => selectedProducts.has(p._id));
    const csvHeaders = ['Titre', 'Prix', 'Catégorie', 'Statut', 'Date de création'];
    const csvRows = selectedItems.map((product) => [
      product.title || '',
      product.price || 0,
      product.category || '',
      STATUS_LABELS[product.status] || product.status,
      formatDate(product.createdAt)
    ]);

    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mes_annonces_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('Export CSV réussi !', { variant: 'success' });
  };

  const handleExportPDF = () => {
    if (selectedProducts.size === 0) {
      showToast('Veuillez sélectionner au moins un produit.', { variant: 'error' });
      return;
    }

    const selectedItems = items.filter((p) => selectedProducts.has(p._id));
    const escapeHtml = (v) =>
      String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Mes Annonces - ${new Date().toLocaleDateString('fr-FR')}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { color: #4f46e5; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #4f46e5; color: white; }
            tr:nth-child(even) { background-color: #f2f2f2; }
          </style>
        </head>
        <body>
          <h1>Mes Annonces</h1>
          <p>Date d'export: ${new Date().toLocaleDateString('fr-FR')}</p>
          <p>Nombre d'annonces: ${selectedItems.length}</p>
          <table>
            <thead>
              <tr>
                <th>Titre</th>
                <th>Prix</th>
                <th>Catégorie</th>
                <th>Statut</th>
                <th>Date de création</th>
              </tr>
            </thead>
            <tbody>
              ${selectedItems.map((product) => `
                <tr>
                  <td>${escapeHtml(product.title)}</td>
                  <td>${formatCurrency(product.price || 0)}</td>
                  <td>${escapeHtml(product.category)}</td>
                  <td>${escapeHtml(STATUS_LABELS[product.status] || product.status)}</td>
                  <td>${formatDate(product.createdAt)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 250);
    }
  };

  const activeFilterCount =
    selectedCategories.length +
    (priceMin ? 1 : 0) +
    (priceMax ? 1 : 0) +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0) +
    selectedStatuses.length +
    (boostedFilter !== 'all' ? 1 : 0) +
    (installmentFilter !== 'all' ? 1 : 0);

  if (loading && items.length === 0) {
    return (
      <div className="min-h-screen bg-[#f5f2ee] dark:bg-neutral-950">
        {/* Skeleton header */}
        <div className="bg-white border-b border-gray-100 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="space-y-1.5">
              <div className="h-4 w-36 bg-gray-200 rounded-lg animate-pulse" />
              <div className="h-3 w-24 bg-gray-100 rounded animate-pulse" />
            </div>
            <div className="h-9 w-24 bg-gray-200 rounded-full animate-pulse" />
          </div>
        </div>
        {/* Skeleton KPI strip */}
        <div className="bg-white flex divide-x divide-gray-100 mt-0">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1.5 py-3">
              <div className="h-6 w-8 bg-gray-200 rounded animate-pulse" />
              <div className="h-3 w-14 bg-gray-100 rounded animate-pulse" />
            </div>
          ))}
        </div>
        <div className="h-2 bg-[#f5f5f5]" />
        {/* Skeleton list items */}
        <div className="bg-white divide-y divide-gray-50">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex gap-3 px-4 py-3">
              <div className="w-20 h-20 bg-gray-200 rounded-lg animate-pulse flex-shrink-0" />
              <div className="flex-1 space-y-2 pt-1">
                <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
                <div className="h-4 bg-gray-100 rounded animate-pulse w-1/2" />
                <div className="h-3 bg-gray-100 rounded animate-pulse w-2/5" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f2ee] text-[#231f1b] dark:bg-neutral-950">

      {/* ── TAOBAO STICKY HEADER ── */}
      <header className="border-b border-[#e2dcd2] bg-white/96 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3">
          <div className="min-w-0">
            <h1 className="text-[17px] font-black leading-tight text-[#231f1b] dark:text-white">Mes annonces</h1>
            <p className="mt-0.5 text-[11px] font-semibold leading-tight text-[#8a8378]">
              {stats.total > 0
                ? `${stats.total} annonce${stats.total > 1 ? 's' : ''} · ${stats.approved} active${stats.approved > 1 ? 's' : ''}`
                : 'Aucune annonce pour l\'instant'}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button type="button" onClick={load} disabled={loading}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-[#e2dcd2] bg-white text-[#6b6459] active:scale-95 transition-transform disabled:opacity-50 dark:bg-neutral-800 dark:text-neutral-300"
              aria-label="Actualiser">
              <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            {sellingEnabled ? (
              <button type="button"
                onClick={() => { setEditingProduct(null); setProductModalOpen(true); }}
                className="flex min-h-11 items-center gap-1.5 rounded-full bg-black pl-3 pr-4 text-sm font-black text-white active:scale-95 transition-transform">
                <PlusIcon className="w-4 h-4" />
                Publier
              </button>
            ) : (
              <span className="flex items-center gap-1 px-3 py-2 rounded-full bg-gray-100 text-gray-400 text-xs font-semibold">
                <ExclamationTriangleIcon className="w-3.5 h-3.5" /> Désactivé
              </span>
            )}
          </div>
        </div>
      </header>

      {/* ── INLINE KPI STRIP ── */}
      {!loading && stats.total > 0 && (
        <section className="mx-auto max-w-6xl bg-[#f5f2ee] px-3 pt-4" aria-label="Aperçu des annonces">
          <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
            {[
              {
                key: 'all',
                label: 'Total',
                value: stats.total,
                icon: CubeIcon,
                iconClass: 'bg-[#f5f2ee] text-[#6b6459]',
                activeClass: 'border-[#231f1b] ring-[#231f1b]/5'
              },
              {
                key: 'approved',
                label: 'En ligne',
                value: stats.approved,
                icon: CheckCircleIcon,
                iconClass: 'bg-emerald-50 text-emerald-600',
                activeClass: 'border-emerald-400 ring-emerald-500/5'
              },
              {
                key: 'pending',
                label: 'À traiter',
                value: Number(stats.pending || 0) + Number(stats.rejected || 0),
                icon: ExclamationCircleIcon,
                iconClass: 'bg-orange-50 text-[#e85d00]',
                activeClass: 'border-[#e85d00] ring-orange-500/5'
              }
            ].map(({ key, label, value, icon: Icon, iconClass, activeClass }) => {
              const active = statusFilter === key && selectedStatuses.length === 0;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => { setStatusFilter(key); setSelectedStatuses([]); }}
                  aria-pressed={active}
                  className={`group relative min-h-[88px] overflow-hidden rounded-[22px] border bg-white p-3 text-left shadow-[0_3px_14px_rgba(35,31,27,0.04)] transition duration-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 sm:min-h-[104px] sm:p-4 ${
                    active ? `${activeClass} ring-4` : 'border-[#e2dcd2]'
                  }`}
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="min-w-0">
                      <span className={`block text-[22px] font-black leading-none tracking-tight sm:text-3xl ${key === 'pending' ? 'text-[#c2410c]' : 'text-[#231f1b]'}`}>
                        {value}
                      </span>
                      <span className="mt-2 block truncate text-[11px] font-black text-[#6b6459] sm:text-xs">
                        {label}
                      </span>
                    </span>
                    <span className={`hidden h-10 w-10 shrink-0 place-items-center rounded-2xl sm:grid ${iconClass}`}>
                      <Icon className="h-4.5 w-4.5" />
                    </span>
                  </span>
                  <span className={`absolute inset-x-3 bottom-0 h-0.5 rounded-full transition sm:inset-x-4 ${active ? (key === 'approved' ? 'bg-emerald-500' : key === 'pending' ? 'bg-[#e85d00]' : 'bg-[#231f1b]') : 'bg-transparent'}`} />
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* ── UNFINISHED ACTIONS REMINDERS ── */}
      {(pendingDraft || (!loading && stats.pending > 0)) && (
        <section className="mx-auto max-w-6xl space-y-2 bg-[#f5f2ee] px-3 pt-3">
          {pendingDraft ? (
            <div className="flex items-center gap-3 rounded-2xl border border-[#f0c7aa] bg-[#fff8f2] px-3.5 py-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-[#e85d00] ring-1 ring-[#f0c7aa]">
                <DocumentTextIcon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-black text-[#231f1b]">Annonce en brouillon</p>
                <p className="truncate text-[11.5px] font-semibold text-[#8a7263]">
                  Vous avez commencé une annonce sans la publier
                  {pendingDraft.savedAt ? ` (${new Date(pendingDraft.savedAt).toLocaleDateString('fr-FR')})` : ''}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setEditingProduct(null); setProductModalOpen(true); }}
                className="shrink-0 rounded-full bg-[#e85d00] px-3.5 py-2 text-xs font-black text-white transition-transform active:scale-95"
              >
                Reprendre
              </button>
              <button
                type="button"
                onClick={discardDraft}
                aria-label="Ignorer le brouillon"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[#8a7263] active:bg-[#f5e8dc]"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
          ) : null}
          {!loading && stats.pending > 0 ? (
            <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-amber-600 ring-1 ring-amber-200">
                <ClockIcon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-black text-[#231f1b]">
                  {stats.pending} annonce{stats.pending > 1 ? 's' : ''} à finaliser
                </p>
                <p className="truncate text-[11.5px] font-semibold text-amber-800/80">
                  Réglez les frais de publication pour les rendre visibles.
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setStatusFilter('pending'); setSelectedStatuses([]); }}
                className="shrink-0 rounded-full bg-amber-500 px-3.5 py-2 text-xs font-black text-white transition-transform active:scale-95"
              >
                Terminer
              </button>
            </div>
          ) : null}
        </section>
      )}

      <div className="mx-auto max-w-6xl space-y-3 px-3 pb-32 lg:pb-12">

        {/* ── ASSISTANT BANNER (compact) ── */}
        {!loading && !isShopUser && (assistantAssignment || assistantInvites.length > 0) && (
          <div className="relative mt-3 overflow-hidden rounded-[24px] border border-[#eadfd5] bg-white p-4 shadow-[0_8px_28px_rgba(35,31,27,0.06)] sm:p-5">
            <div className="pointer-events-none absolute -right-12 -top-14 h-36 w-36 rounded-full bg-orange-100/70 blur-2xl" />
            <div className="relative flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3.5">
                <div className="grid h-12 w-12 flex-shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#fff0e4] to-[#ffe1cb] text-[#e85d00] ring-1 ring-orange-100 sm:h-14 sm:w-14">
                  <ShieldCheckIcon className="h-5 w-5 sm:h-6 sm:w-6" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#e85d00]">Espace collaboratif</p>
                  <p className="mt-0.5 truncate text-[15px] font-black text-[#231f1b] sm:text-base">Assistant boutique</p>
                  <p className="mt-0.5 truncate text-xs font-semibold text-[#8a8378]">
                    {assistantAssignment
                      ? `Workspace · ${assistantAssignment.shop?.shopName || assistantAssignment.shop?.name || 'boutique'}`
                      : `${assistantInvites.length} invitation${assistantInvites.length > 1 ? 's' : ''} à consulter`}
                  </p>
                </div>
              </div>
              <Link to="/seller/assistant/workspace"
                className="group inline-flex min-h-11 flex-shrink-0 items-center gap-1.5 rounded-full bg-[#231f1b] px-4 text-xs font-black text-white shadow-sm transition hover:bg-[#e85d00] active:scale-95 sm:px-5 sm:text-sm">
                {assistantAssignment ? 'Ouvrir' : 'Voir'}
                <ArrowRightIcon className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>
        )}
        {!loading && isShopUser && (
          <div className="relative mt-3 overflow-hidden rounded-[24px] border border-[#eadfd5] bg-white p-4 shadow-[0_8px_28px_rgba(35,31,27,0.06)] sm:p-5">
            <div className="pointer-events-none absolute -right-12 -top-14 h-36 w-36 rounded-full bg-orange-100/70 blur-2xl" />
            <div className="relative flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3.5">
                <div className="grid h-12 w-12 flex-shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#fff0e4] to-[#ffe1cb] text-[#e85d00] ring-1 ring-orange-100 sm:h-14 sm:w-14">
                  <ShieldCheckIcon className="h-5 w-5 sm:h-6 sm:w-6" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#e85d00]">Équipe boutique</p>
                  <p className="mt-0.5 text-[15px] font-black text-[#231f1b] sm:text-base">Assistant boutique</p>
                  <p className="mt-0.5 truncate text-xs font-semibold text-[#8a8378]">Invitez une personne de confiance à gérer vos annonces</p>
                </div>
              </div>
              <Link to="/seller/assistant"
                className="group inline-flex min-h-11 flex-shrink-0 items-center gap-1.5 rounded-full bg-[#e85d00] px-4 text-xs font-black text-white shadow-[0_5px_15px_rgba(232,93,0,0.22)] transition hover:bg-[#c94f00] active:scale-95 sm:px-5 sm:text-sm">
                Gérer
                <ArrowRightIcon className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>
        )}

        {/* ── TAOBAO SEARCH + FILTER BAR ── */}
        {!loading && items.length > 0 && (
          <div className="rounded-2xl border border-[#e2dcd2] bg-white shadow-sm">
            {/* MagnifyingGlassIcon input */}
            <div className="px-4 pt-3 pb-2">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" value={searchDraft}
                  onChange={(e) => setSearchDraft(e.target.value)}
                  placeholder="Rechercher par titre ou description..."
                  className="min-h-11 w-full rounded-full border border-[#eee8e0] bg-[#f5f2ee] py-2.5 pl-9 pr-9 text-sm text-[#231f1b] placeholder-[#8a8378] focus:outline-none focus:ring-2 focus:ring-[#fff0e4] transition-all" />
                {searchDraft && (
                  <button type="button"
                    onClick={() => { setSearchDraft(''); setSearchQuery(''); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 active:scale-90">
                    <XCircleIcon className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            {/* Sort + FunnelIcon toggle row */}
            <div className="flex items-center justify-between px-4 pb-3 gap-3">
              <button type="button"
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  showAdvancedFilters || selectedCategories.length > 0 || priceMin || priceMax || dateFrom || dateTo || selectedStatuses.length > 0 || boostedFilter !== 'all' || installmentFilter !== 'all'
                    ? 'border-[#e85d00] bg-[#fff0e4] text-[#e85d00]'
                    : 'border-[#e2dcd2] bg-white text-[#6b6459]'
                }`}>
                <FunnelIcon className="w-3.5 h-3.5" />
                Filtres
                {(selectedCategories.length > 0 || priceMin || priceMax || dateFrom || dateTo || selectedStatuses.length > 0 || boostedFilter !== 'all' || installmentFilter !== 'all') && (
                  <span className="ml-1 w-4 h-4 rounded-full bg-[#e85d00] text-white text-[9px] flex items-center justify-center font-black">!</span>
                )}
                {showAdvancedFilters ? <ChevronUpIcon className="w-3.5 h-3.5" /> : <ChevronDownIcon className="w-3.5 h-3.5" />}
              </button>
              <div className="flex items-center gap-1.5">
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
                  className="min-h-11 rounded-full border border-[#e2dcd2] bg-white px-3 text-xs font-bold text-[#6b6459] focus:outline-none focus:border-[#e85d00]">
                  <option value="date-desc">Récent</option>
                  <option value="date-asc">Ancien</option>
                  <option value="price-desc">Prix ↓</option>
                  <option value="price-asc">Prix ↑</option>
                  <option value="title-asc">Titre A-Z</option>
                </select>
                {/* View toggle */}
                <div className="flex min-h-11 items-center rounded-full bg-[#f5f2ee] p-1">
                  <button type="button" onClick={() => setViewMode('list')}
                    className={`p-1.5 rounded-full transition-all ${viewMode === 'list' ? 'bg-white text-[#e85d00] shadow-sm' : 'text-gray-400'}`}>
                    <ListBulletIcon className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" onClick={() => setViewMode('grid')}
                    className={`p-1.5 rounded-full transition-all ${viewMode === 'grid' ? 'bg-white text-[#e85d00] shadow-sm' : 'text-gray-400'}`}>
                    <Squares2X2Icon className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Advanced Filters (collapsible) */}
            {showAdvancedFilters && (
              <div className="border-t border-gray-100 px-4 pt-3 pb-4 space-y-4">
                {/* Active filter reset */}
                {(searchQuery || selectedCategories.length > 0 || priceMin || priceMax || dateFrom || dateTo || selectedStatuses.length > 0 || boostedFilter !== 'all' || installmentFilter !== 'all') && (
                  <button type="button" onClick={clearAllFilters}
                    className="flex items-center gap-1.5 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 px-3 py-1.5 rounded-full">
                    <XCircleIcon className="w-3.5 h-3.5" /> Réinitialiser les filtres
                  </button>
                )}
                {/* Categories */}
                {availableCategories.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Catégories</p>
                    <div className="flex flex-wrap gap-1.5">
                      {availableCategories.map((cat) => {
                        const isSelected = selectedCategories.includes(cat);
                        const categoryInfo = categoryGroups.flatMap((g) => g.options).find((opt) => opt.value === cat);
                        return (
                          <button key={cat} type="button"
                            onClick={() => isSelected ? setSelectedCategories(selectedCategories.filter((c) => c !== cat)) : setSelectedCategories([...selectedCategories, cat])}
                            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all ${isSelected ? 'bg-[#e85d00] text-white' : 'bg-gray-100 text-gray-600'}`}>
                            {categoryInfo?.label || cat}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {/* Price range */}
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Prix</p>
                  <div className="flex gap-2">
                    <input type="number" value={priceMin} onChange={(e) => setPriceMin(e.target.value)}
                      placeholder="Min" className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#e85d00]" />
                    <input type="number" value={priceMax} onChange={(e) => setPriceMax(e.target.value)}
                      placeholder="Max" className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#e85d00]" />
                  </div>
                </div>
                {/* Date range */}
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Date</p>
                  <div className="flex gap-2">
                    <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                      className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#e85d00]" />
                    <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                      className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#e85d00]" />
                  </div>
                </div>
                {/* Installment filter */}
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Paiement par tranche</p>
                  <div className="flex gap-1.5">
                    {[{ key: 'all', label: 'Tous' }, { key: 'enabled', label: 'Avec tranche' }, { key: 'disabled', label: 'Sans' }].map((opt) => (
                      <button key={opt.key} type="button" onClick={() => setInstallmentFilter(opt.key)}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all ${installmentFilter === opt.key ? 'bg-[#e85d00] text-white' : 'bg-gray-100 text-gray-600'}`}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                {/* CheckIcon filter */}
                <div className="flex gap-2 pt-1 border-t border-gray-100">
                  <input type="text" value={filterName} onChange={(e) => setFilterName(e.target.value)}
                    placeholder="Nom du filtre à sauvegarder..."
                    className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-[#e85d00]" />
                  <button type="button" onClick={saveCurrentFilter}
                    className="flex items-center gap-1 px-3 py-2 rounded-lg bg-gray-900 text-white text-xs font-semibold">
                    <CheckIcon className="w-3 h-3" /> Sauver
                  </button>
                </div>
                {savedFilters.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {savedFilters.map((filter) => (
                      <div key={filter.id} className="flex items-center gap-1 px-2.5 py-1 bg-gray-50 border border-gray-200 rounded-full">
                        <button type="button" onClick={() => loadSavedFilter(filter)}
                          className="text-[11px] font-semibold text-gray-700">{filter.name}</button>
                        <button type="button" onClick={() => deleteSavedFilter(filter.id)} className="text-gray-400 active:text-red-500">
                          <XMarkIcon className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── TAOBAO STATUS TABS (horizontal scroll) ── */}
        {!loading && items.length > 0 && (
          <div className="rounded-2xl border border-[#e2dcd2] bg-white">
            <div className="flex gap-2 overflow-x-auto p-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {Object.entries(STATUS_LABELS).map(([key, label]) => {
                const isActive = statusFilter === key && selectedStatuses.length === 0;
                const count = key === 'all' ? stats.total : stats[key] || 0;
                return (
                  <button key={key} type="button"
                    onClick={() => { setStatusFilter(key); setSelectedStatuses([]); }}
                    className={`flex min-h-11 flex-shrink-0 items-center gap-1.5 rounded-full px-4 text-xs font-bold transition-all active:scale-95 ${
                      isActive ? 'bg-black text-white' : 'bg-[#f5f2ee] text-[#6b6459]'
                    }`}>
                    {label}
                    {count > 0 && (
                      <span className={`text-[10px] font-black ${isActive ? 'text-white/80' : 'text-gray-400'}`}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── ERROR ── */}
        {error && (
          <div className="bg-red-50 border-l-[3px] border-red-500 px-4 py-3 flex items-center gap-3">
            <ExclamationCircleIcon className="w-4 h-4 text-red-600 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* ── EMPTY STATE ── */}
        {!loading && items.length === 0 && (
          <div className="bg-white px-8 py-16 text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-[#fff0e4] flex items-center justify-center mb-4">
              <CubeIcon className="w-8 h-8 text-[#e85d00]" />
            </div>
            <h3 className="text-base font-black text-gray-900 mb-1">Aucune annonce</h3>
            <p className="text-sm text-gray-500 mb-5">Publiez votre première annonce pour commencer à vendre</p>
            <button type="button"
              onClick={() => { setEditingProduct(null); setProductModalOpen(true); }}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#e85d00] text-white font-bold text-sm shadow-sm active:scale-95 transition-transform">
              <PlusIcon className="w-4 h-4" /> Publier une annonce
            </button>
          </div>
        )}

        {/* ── EMPTY FILTERED ── */}
        {!loading && items.length > 0 && visibleItems.length === 0 && (
          <div className="bg-white px-8 py-10 text-center">
            <FunnelIcon className="w-8 h-8 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-600 mb-3">Aucune annonce pour ces filtres</p>
            <button type="button" onClick={clearAllFilters}
              className="text-sm font-bold text-[#e85d00] underline-offset-2 hover:underline">
              Réinitialiser les filtres
            </button>
          </div>
        )}

        {!loading && isRecentlyCreatedHiddenByFilters && recentlyCreatedProduct && (
          <div className="mb-6 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900 shadow-sm">
            <span className="font-semibold">Nouvelle annonce affichée.</span>{' '}
            <span>
              Vos filtres actuels masqueraient normalement "{recentlyCreatedProduct.title || 'ce produit'}". Elle est affichée en tête pour faciliter la vérification.
            </span>
          </div>
        )}

        {/* ── BULK ACTIONS BAR (sticky, Taobao-style) ── */}
        {!loading && paginatedItems.length > 0 && selectedProducts.size > 0 && (
          <div className="bg-[#0a0a0a] text-white px-4 py-2.5 flex items-center justify-between gap-2 flex-wrap">
            <span className="text-sm font-semibold">
              {selectedProducts.size} sélectionné{selectedProducts.size > 1 ? 's' : ''}
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button type="button" onClick={handleBulkEnable} disabled={bulkActionLoading}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-emerald-500 text-white text-xs font-semibold disabled:opacity-50">
                <PowerIcon className="w-3 h-3" /> On
              </button>
              <button type="button" onClick={handleBulkDisable} disabled={bulkActionLoading}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-amber-500 text-white text-xs font-semibold disabled:opacity-50">
                <PowerIcon className="w-3 h-3" /> Off
              </button>
              <button type="button" onClick={handleBulkDelete} disabled={bulkActionLoading}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-red-500 text-white text-xs font-semibold disabled:opacity-50">
                <TrashIcon className="w-3 h-3" /> Suppr.
              </button>
              <button type="button" onClick={handleExportCSV} disabled={bulkActionLoading}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-white/15 border border-white/20 text-white text-xs font-semibold disabled:opacity-50">
                <ArrowDownTrayIcon className="w-3 h-3" /> CSV
              </button>
              <button type="button" onClick={handleExportPDF} disabled={bulkActionLoading}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-white/15 border border-white/20 text-white text-xs font-semibold disabled:opacity-50">
                <DocumentTextIcon className="w-3 h-3" /> PDF
              </button>
              <button type="button" onClick={clearSelection}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-white/15 border border-white/20 text-white text-xs font-semibold">
                <XMarkIcon className="w-3 h-3" /> Annuler
              </button>
            </div>
          </div>
        )}

        {/* ── PRODUCT LIST ── */}
        {!loading && paginatedItems.length > 0 && (
          <>
            {/* Select all bar */}
            <div className="flex items-center justify-between rounded-2xl border border-[#e2dcd2] bg-white px-4 py-3">
              <button type="button" onClick={selectAllProducts}
                className="flex items-center gap-2 text-xs font-semibold text-gray-600 active:text-[#e85d00] transition-colors">
                {selectedProducts.size === paginatedItems.length && paginatedItems.length > 0 ? (
                  <Square2StackIcon className="w-4 h-4 text-[#e85d00]" />
                ) : (
                  <StopIcon className="w-4 h-4 text-gray-400" />
                )}
                {selectedProducts.size === paginatedItems.length && paginatedItems.length > 0 ? 'Tout désélectionner' : 'Tout sélectionner'}
              </button>
              <span className="text-xs text-gray-400">
                {visibleItems.length} annonce{visibleItems.length > 1 ? 's' : ''}
                {selectedProducts.size > 0 && ` · ${selectedProducts.size} sél.`}
              </span>
            </div>

            <div className={viewMode === 'grid' ? 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3' : 'space-y-3'}>
              {paginatedItems.map((product) => {
                const StatusIcon = STATUS_ICONS[product.status] || ClockIcon;
                const statusStyle = STATUS_STYLES[product.status] || STATUS_STYLES.pending;
                const mainImage = Array.isArray(product.images) && product.images.length > 0
                  ? product.images[0]
                  : null;

                const productId = product._id || product.id;
                if (!productId) return null; // Skip products without ID
                
                const isSelected = selectedProducts.has(productId);
                const isTopPerformer = topPerformers.includes(productId);
                const isRecentlyCreated = productId === recentlyCreatedProductId;
                const isInstallmentExpired =
                  product.installmentEnabled === true &&
                  product.installmentEndDate &&
                  new Date(product.installmentEndDate) < new Date();

                // ── TAOBAO LIST ROW ──
                if (viewMode === 'list') {
                  const statusBadgeStyle = {
                    approved: 'bg-emerald-50 text-emerald-700',
                    pending: 'bg-amber-50 text-amber-700',
                    rejected: 'bg-red-50 text-red-600',
                    disabled: 'bg-gray-100 text-gray-500',
                  }[product.status] || 'bg-gray-100 text-gray-600';

                  return (
                    <div key={productId}
                      className={`relative overflow-hidden rounded-2xl border border-[#e2dcd2] bg-white shadow-sm ${
                        isRecentlyCreated ? 'bg-sky-50/30' : isSelected ? 'bg-[#fff8f5]' : ''
                      }`}>

                      {/* Main row */}
                      <div className="flex items-start gap-3 px-4 py-3">
                        {/* Checkbox */}
                        <button type="button"
                          onClick={(e) => { e.stopPropagation(); if (productId) toggleProductSelection(productId); }}
                          className="mt-0.5 flex-shrink-0 active:scale-90 transition-transform"
                          aria-label={isSelected ? 'Désélectionner' : 'Sélectionner'}>
                          {isSelected
                            ? <Square2StackIcon className="w-4.5 h-4.5 text-[#e85d00]" />
                            : <StopIcon className="w-4 h-4 text-gray-300" />}
                        </button>

                        {/* Thumbnail */}
                        <div className="relative w-[88px] h-[88px] flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
                          {mainImage ? (
                            <PreviewableImage src={mainImage} alt={product.title}
                              images={Array.isArray(product.images) && product.images.length > 0 ? product.images : [mainImage]}
                              startIndex={0} openOnClick showHint={false}
                              className="w-full h-full object-cover cursor-zoom-in" loading="lazy" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <PhotoIcon className="w-8 h-8 text-gray-300" />
                            </div>
                          )}
                          {/* Photo count */}
                          {product.images?.length > 1 && (
                            <span className="absolute bottom-1 right-1 bg-black/50 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                              {product.images.length}
                            </span>
                          )}
                          {/* Boosted indicator */}
                          {product.boosted && (
                            <span className="absolute top-1 left-1 bg-[#e85d00] text-white text-[9px] font-black px-1 py-0.5 rounded">
                              ⚡
                            </span>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          {/* Badges row */}
                          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                            <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${statusBadgeStyle}`}>
                              <StatusIcon className="w-2.5 h-2.5" />
                              {STATUS_LABELS[product.status]}
                            </span>
                            {isTopPerformer && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-yellow-50 text-yellow-700">
                                <ArrowTrendingUpIcon className="w-2.5 h-2.5" /> Top
                              </span>
                            )}
                            {isRecentlyCreated && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-50 text-sky-700">
                                Nouveau
                              </span>
                            )}
                          </div>

                          {/* Title */}
                          <h3 className="text-sm font-bold text-gray-900 line-clamp-2 leading-snug mb-1">
                            {product.title}
                          </h3>

                          {/* Price */}
                          <div className="flex items-baseline gap-1.5 mb-1">
                            <span className="text-base font-black text-[#231f1b]">{formatCurrency(product.price)}</span>
                            {product.priceBeforeDiscount && product.priceBeforeDiscount > product.price && (
                              <span className="text-xs text-gray-400 line-through">{formatCurrency(product.priceBeforeDiscount)}</span>
                            )}
                          </div>

                          {/* Meta */}
                          <div className="flex items-center gap-2 text-[11px] text-gray-400 flex-wrap">
                            {product.category && <span className="capitalize">{product.category}</span>}
                            {product.category && product.createdAt && <span>·</span>}
                            {product.createdAt && <span>{formatDate(product.createdAt)}</span>}
                          </div>

                          {/* Installment expired warning */}
                          {isInstallmentExpired && (
                            <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-orange-600 bg-gray-100 rounded px-2 py-1">
                              <ExclamationTriangleIcon className="w-3 h-3 flex-shrink-0" />
                              <span className="font-semibold">Tranche expirée · {formatDate(product.installmentEndDate)}</span>
                              <button type="button"
                                onClick={() => { setEditingProduct(product); setProductModalOpen(true); }}
                                className="ml-auto text-orange-700 font-bold underline-offset-2 hover:underline">
                                Prolonger
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Action row */}
                      <div className="flex gap-2 border-t border-[#eee8e0] px-3 py-3">
                        <Link to={`/seller/products/${product.slug || productId}`}
                          className="flex min-h-11 flex-1 items-center justify-center gap-1 rounded-full bg-black px-4 text-xs font-black text-white transition-colors">
                          <DocumentTextIcon className="w-3.5 h-3.5" /> Détail
                        </Link>
                        <button type="button"
                          onClick={() => { setEditingProduct(product); setProductModalOpen(true); }}
                          className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[#e2dcd2] text-[#6b6459] active:bg-[#f5f2ee] transition-colors" aria-label="Modifier">
                          <PencilIcon className="w-3.5 h-3.5" />
                        </button>
                        <button type="button"
                          onClick={() => setAnalyticsProduct({ id: productId, title: product.title })}
                          className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[#e2dcd2] text-[#6b6459] active:bg-[#f5f2ee] transition-colors" aria-label="Statistiques">
                          <ChartBarIcon className="w-3.5 h-3.5" />
                        </button>
                        {socialCommerceEnabled && product.status === 'approved' && (
                          <button type="button"
                            onClick={() => setShareProduct({ id: productId, title: product.title })}
                            className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[#e2dcd2] text-[#6b6459] active:bg-[#f5f2ee] transition-colors" aria-label="Partager">
                            <ShareIcon className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {product.status !== 'disabled' ? (
                          <button type="button"
                            onClick={() => updateStatus(product.slug || product._id, 'disable')}
                            disabled={updatingId === product._id}
                            className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-red-200 text-red-600 active:bg-red-50 transition-colors disabled:opacity-40" aria-label="Désactiver">
                            <PowerIcon className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button type="button"
                            onClick={() => updateStatus(product.slug || product._id, 'enable')}
                            disabled={updatingId === product._id}
                            className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-emerald-200 text-emerald-700 active:bg-emerald-50 transition-colors disabled:opacity-40" aria-label="Activer">
                            <PowerIcon className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Payment form (pending only) */}
                      {product.status !== 'disabled' && (
                        <div className="px-4 pb-3 border-t border-gray-50 pt-2">
                          <PaymentForm product={product} onSubmitted={() => load({ silent: true })} />
                        </div>
                      )}
                    </div>
                  );
                }

                // Grid View (existing code)
                return (
                  <div
                    key={productId}
                    className={`bg-white rounded-2xl border-2 shadow-sm hover:shadow-sm transition-all duration-300 overflow-hidden relative ${
                      isRecentlyCreated
                        ? 'border-sky-400 ring-2 ring-sky-200'
                        : isSelected
                        ? 'border-neutral-500 ring-2 ring-neutral-200'
                        : isInstallmentExpired
                        ? 'border-orange-400 ring-2 ring-gray-200'
                        : isTopPerformer
                        ? 'border-yellow-400 ring-2 ring-yellow-200'
                        : 'border-gray-100'
                    }`}
                  >
                    <div className="absolute top-3 right-3 z-20 flex flex-col gap-2">
                      {isRecentlyCreated && (
                        <div className="px-2 py-1 rounded-lg bg-sky-500 text-white text-xs font-bold shadow-sm inline-flex items-center gap-1">
                          <SparklesIcon className="w-3 h-3" />
                          Nouveau
                        </div>
                      )}
                      {isTopPerformer && (
                        <div className="px-2 py-1 rounded-lg bg-yellow-400 text-white text-xs font-bold shadow-sm flex items-center gap-1">
                          <ArrowTrendingUpIcon className="w-3 h-3" />
                          Top
                        </div>
                      )}
                    </div>
                    {/* Selection Checkbox */}
                    <div className="absolute top-3 left-3 z-30">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          if (productId) {
                            toggleProductSelection(productId);
                          }
                        }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                        }}
                        className={`p-2.5 rounded-lg transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-neutral-600 text-white hover:bg-neutral-700 shadow-sm'
                            : 'bg-black/60 text-white hover:bg-black/80'
                        }`}
                        style={{ pointerEvents: 'auto' }}
                        aria-label={isSelected ? 'Désélectionner' : 'Sélectionner'}
                      >
                        {isSelected ? (
                          <Square2StackIcon className="w-4 h-4" />
                        ) : (
                          <StopIcon className="w-4 h-4" />
                        )}
                      </button>
                    </div>

                    {/* Product Image - Grid View */}
                    <div className="group relative aspect-square bg-gray-100 overflow-hidden">
                      {mainImage ? (
                        <PreviewableImage
                          src={mainImage}
                          alt={product.title}
                          images={Array.isArray(product.images) && product.images.length > 0 ? product.images : [mainImage]}
                          startIndex={0}
                          openOnClick
                          showHint={false}
                          className="h-full w-full cursor-zoom-in object-cover transition-transform duration-300 group-hover:scale-105"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <PhotoIcon className="w-12 h-12 text-gray-400" />
                        </div>
                      )}
                      {/* Status Badge */}
                      <div className="absolute top-3 right-3 flex flex-col gap-2">
                        <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${statusStyle.badge} text-white shadow-sm`}>
                          <StatusIcon className="w-3.5 h-3.5" />
                          <span className="text-xs font-bold uppercase tracking-wide">
                            {STATUS_LABELS[product.status] || product.status}
                          </span>
                        </div>
                        {/* Boosted Badge */}
                        {product.boosted && (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-500 text-white shadow-sm">
                            <BoltIcon className="w-3.5 h-3.5" />
                            <span className="text-xs font-bold uppercase tracking-wide">Boosté</span>
                          </div>
                        )}
                      </div>
                      {/* Image Count Badge */}
                      {product.images?.length > 1 && (
                        <div className="absolute top-3 left-3">
                          <div className="px-2 py-1 rounded-lg bg-black/50 text-white text-xs font-bold">
                            {product.images.length} photo{product.images.length > 1 ? 's' : ''}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Product Info */}
                    <div className="p-5 space-y-4">
                      {/* Title & Price */}
                      <div>
                        <h3 className="font-bold text-gray-900 line-clamp-2 mb-2 min-h-[2.5rem]">
                          {product.title}
                        </h3>
                        <div className="flex items-baseline gap-2">
                          <span className="text-xl font-black text-[#231f1b]">
                            {formatCurrency(product.price)}
                          </span>
                          {product.priceBeforeDiscount && product.priceBeforeDiscount > product.price && (
                            <span className="text-sm text-gray-400 line-through">
                              {formatCurrency(product.priceBeforeDiscount)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Status Message */}
                      <div className={`rounded-xl border p-3 ${statusStyle.card}`}>
                        <p className="text-xs font-medium leading-relaxed">
                          {STATUS_MESSAGES[product.status] || 'Statut en cours de mise à jour.'}
                        </p>
                      </div>

                      {/* Expired installment warning - Grid View */}
                      {isInstallmentExpired && (
                        <div className="rounded-xl border border-gray-200 bg-gray-100 p-3 flex flex-col gap-2">
                          <div className="flex items-center gap-2">
                            <ExclamationTriangleIcon className="w-4 h-4 text-orange-500 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-orange-800">Tranche expirée</p>
                              <p className="text-xs text-orange-600">Limite : {formatDate(product.installmentEndDate)}</p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => { setEditingProduct(product); setProductModalOpen(true); }}
                              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-1000 hover:bg-orange-600 text-white text-xs font-semibold transition-colors"
                            >
                              <CalendarDaysIcon className="w-3.5 h-3.5" />
                              Prolonger
                            </button>
                            {product.status !== 'disabled' && (
                              <button
                                type="button"
                                onClick={() => updateStatus(product.slug || product._id, 'disable')}
                                disabled={updatingId === product._id}
                                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-semibold transition-colors disabled:opacity-50"
                              >
                                <PowerIcon className="w-3.5 h-3.5" />
                                Désactiver
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Metadata */}
                      <div className="flex items-center gap-4 text-xs text-gray-500 pt-2 border-t border-gray-100">
                        {product.category && (
                          <div className="flex items-center gap-1">
                            <CubeIcon className="w-3 h-3" />
                            <span className="capitalize">{product.category}</span>
                          </div>
                        )}
                        {product.boosted && (
                          <div className="flex items-center gap-1 text-neutral-600 dark:text-neutral-400 font-semibold">
                            <BoltIcon className="w-3 h-3" />
                            <span>Boosté</span>
                          </div>
                        )}
                        {product.createdAt && (
                          <div className="flex items-center gap-1">
                            <CalendarIcon className="w-3 h-3" />
                            <span>{formatDate(product.createdAt)}</span>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex flex-wrap gap-2 pt-2">
                        <Link
                          to={`/my/annonce/${product.slug || productId}`}
                          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-700 text-sm font-semibold hover:bg-gray-50 transition-all"
                        >
                          <DocumentTextIcon className="w-4 h-4" />
                          Detail
                        </Link>
                        {product.status === 'approved' && (
                          <Link
                            to={buildProductPath(product)}
                            {...externalLinkProps}
                            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-700 text-sm font-semibold hover:bg-neutral-100 transition-all"
                          >
                            <EyeIcon className="w-4 h-4" />
                            Voir
                          </Link>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setAnalyticsProduct({ id: productId, title: product.title });
                          }}
                          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-700 text-sm font-semibold hover:bg-neutral-100 transition-all"
                        >
                          <ChartBarIcon className="w-4 h-4" />
                          Analytics
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingProduct(product);
                            setProductModalOpen(true);
                          }}
                          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-700 text-sm font-semibold hover:bg-gray-50 transition-all"
                        >
                          <PencilIcon className="w-4 h-4" />
                          Modifier
                        </button>
                        {product.status !== 'disabled' ? (
                          <button
                            onClick={() => updateStatus(product.slug || product._id, 'disable')}
                            disabled={updatingId === product._id}
                            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm font-semibold hover:bg-red-100 transition-all disabled:opacity-50"
                            type="button"
                          >
                            <PowerIcon className="w-4 h-4" />
                            Désactiver
                          </button>
                        ) : (
                          <button
                            onClick={() => updateStatus(product.slug || product._id, 'enable')}
                            disabled={updatingId === product._id}
                            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 text-sm font-semibold hover:bg-emerald-100 transition-all disabled:opacity-50"
                            type="button"
                          >
                            <PowerIcon className="w-4 h-4" />
                            Réactiver
                          </button>
                        )}
                      </div>

                      {/* Payment Form */}
                      {product.status !== 'disabled' && (
                        <div className="pt-2 border-t border-gray-100">
                          <PaymentForm product={product} onSubmitted={() => load({ silent: true })} />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop pagination */}
            {!isMobile && totalPages > 1 && (
              <div className="mt-6 flex items-center justify-between bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-3.5">
                <p className="text-xs text-gray-500">
                  <span className="font-bold text-gray-900">{currentRangeStart}–{currentRangeEnd}</span> sur <span className="font-bold text-gray-900">{visibleItems.length}</span>
                </p>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1}
                    className="h-8 w-8 flex items-center justify-center rounded-full border border-gray-200 text-gray-600 disabled:opacity-40 active:scale-95 transition-transform">
                    <ArrowLeftIcon className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-semibold text-gray-700">
                    {currentPage} / {totalPages}
                  </span>
                  <button type="button" onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages}
                    className="h-8 w-8 flex items-center justify-center rounded-full border border-gray-200 text-gray-600 disabled:opacity-40 active:scale-95 transition-transform">
                    <ArrowRightIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Mobile load more sentinel */}
            {isMobile && (
              <div ref={mobileLoadMoreRef} className="py-4 flex flex-col items-center gap-2">
                <p className="text-xs text-gray-400">
                  {currentRangeEnd} sur {visibleItems.length} annonce{visibleItems.length > 1 ? 's' : ''}
                </p>
                {hasMoreMobileItems ? (
                  <button type="button"
                    onClick={() => setMobileVisibleCount((prev) => Math.min(prev + MOBILE_ITEMS_BATCH, visibleItems.length))}
                    className="w-40 rounded-full border border-gray-200 bg-white py-2.5 text-sm font-semibold text-gray-600 active:scale-[0.98] transition-transform">
                    Voir plus
                  </button>
                ) : visibleItems.length > MOBILE_ITEMS_BATCH ? (
                  <span className="text-xs text-gray-400">Toutes les annonces affichées</span>
                ) : null}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── MOBILE FAB (floating publish button) ── */}
      {isMobile && sellingEnabled && (
        <button type="button"
          onClick={() => { setEditingProduct(null); setProductModalOpen(true); }}
          className="fixed bottom-24 right-4 z-30 w-14 h-14 rounded-full bg-[#e85d00] text-white shadow-sm flex items-center justify-center active:scale-90 transition-transform"
          style={{ boxShadow: '0 8px 24px rgba(255,106,0,0.45)' }}
          aria-label="Publier une annonce">
          <PlusIcon className="w-6 h-6" />
        </button>
      )}

      {/* Product Form Modal — full-screen on mobile for easier use */}
      <BaseModal
        isOpen={isProductModalOpen}
        onClose={handleModalClose}
        size="full"
        mobileSheet
        fullscreen={isMobile}
        ariaLabel={editingProduct ? 'Modifier une annonce' : 'Publier une annonce'}
        rootClassName={isMobile ? '!p-0 hd-my-flow' : 'hd-my-flow'}
        panelClassName={
          isMobile
            ? 'min-h-0 h-[100dvh] max-h-[100dvh] rounded-none border-0 bg-gray-50 sm:rounded-none'
            : 'sm:max-w-5xl sm:max-h-[90vh] sm:rounded-2xl border-gray-200 bg-gray-50'
        }
      >
            {/* Modal Header */}
            <div className={`hd-my-hero text-white flex-shrink-0 ${isMobile ? 'px-4 py-4 safe-area-top' : 'px-6 py-5'}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`rounded-xl bg-white/20 flex-shrink-0 ${isMobile ? 'p-2.5' : 'p-3'}`}>
                    {editingProduct ? (
                      <PencilIcon className={isMobile ? 'w-5 h-5' : 'w-6 h-6'} />
                    ) : (
                      <PlusIcon className={isMobile ? 'w-5 h-5' : 'w-6 h-6'} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-white/80 uppercase tracking-wide">
                      {editingProduct ? 'Modification' : 'Nouvelle annonce'}
                    </p>
                    <h3 className={`font-bold mt-0.5 truncate ${isMobile ? 'text-lg' : 'text-xl'}`}>
                      {editingProduct ? 'Modifier une annonce' : 'Publier une annonce'}
                    </h3>
                    {isMobile ? (
                      <p className="mt-1 text-[11px] text-white/80">
                        Mobile optimisé: sections repliables, sauvegarde rapide.
                      </p>
                    ) : null}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleModalClose}
                  className={`rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white hover:bg-white/20 active:bg-white/30 transition-all touch-manipulation flex-shrink-0 ${isMobile ? 'min-w-[44px] min-h-[44px] w-11 h-11' : 'h-10 w-10'}`}
                  aria-label="Fermer"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className={`flex-1 overflow-y-auto min-h-0 ${isMobile ? 'p-3 pb-[max(1rem,env(safe-area-inset-bottom,0px))] scroll-pb-44' : 'p-6'}`}>
              {!sellingEnabled && !editingProduct ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  La publication de nouvelles annonces est temporairement désactivée par l’administration.
                </div>
              ) : (
                <ProductForm
                  initialValues={editingProduct}
                  productId={editingProduct?._id}
                  embeddedInModal={isMobile}
                  hideHeader
                  onCancel={handleModalClose}
                  onCreated={(createdProduct) => {
                    revealCreatedProduct(createdProduct);
                    handleModalClose();
                    showToast('Annonce créée avec succès !', { variant: 'success' });
                  }}
                  onUpdated={(updatedProduct) => {
                    revealUpdatedProduct(updatedProduct);
                    handleModalClose();
                    showToast('Annonce modifiée avec succès !', { variant: 'success' });
                  }}
                />
              )}
            </div>
      </BaseModal>

      {analyticsProduct && (
        <ProductAnalytics
          productId={analyticsProduct.id}
          productTitle={analyticsProduct.title}
          onClose={() => setAnalyticsProduct(null)}
        />
      )}

      {shareProduct && (
        <ShareProductModal
          productId={shareProduct.id}
          productTitle={shareProduct.title}
          onClose={() => setShareProduct(null)}
        />
      )}
    </div>
  );
}
