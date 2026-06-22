import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatPriceWithStoredSettings } from "../utils/priceFormatter";
import {
  Package,
  Plus,
  Edit,
  Eye,
  Power,
  PowerOff,
  Clock,
  CheckCircle,
  X,
  AlertCircle,
  TrendingUp,
  DollarSign,
  Image as ImageIcon,
  Calendar,
  ArrowLeft,
  ArrowRight,
  Filter,
  RefreshCw,
  CheckSquare,
  Square,
  Trash2,
  Download,
  FileText,
  Search,
  ChevronDown,
  ChevronUp,
  Save,
  XCircle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  BarChart3,
  Award,
  Grid3x3,
  List,
  Zap,
  Sparkles,
  Tag,
  AlertTriangle,
  CalendarClock,
  ShieldCheck,
  Wallet
} from 'lucide-react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import AuthContext from '../context/AuthContext';
import PaymentForm from '../components/PaymentForm';
import ProductForm from '../components/ProductForm';
import ProductAnalytics from '../components/ProductAnalytics';
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
  pending: Clock,
  approved: CheckCircle,
  rejected: X,
  disabled: PowerOff
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

const buildDefaultPromoForm = () => ({
  code: '',
  appliesTo: 'boutique',
  productId: '',
  discountType: 'percentage',
  discountValue: '',
  usageLimit: '10',
  startDate: '',
  endDate: '',
  isActive: true
});

export default function UserDashboard() {
  const { categoryGroups } = useCategories();
  const { user } = useContext(AuthContext);
  const { showToast } = useToast();
  const { getRuntimeValue } = useAppSettings();
  const externalLinkProps = useDesktopExternalLink();
  const isMobile = useIsMobile(768);
  const isShopUser = user?.accountType === 'shop';
  const sellingEnabled = normalizeSettingBoolean(getRuntimeValue('enable_selling', true), true);
  const [items, setItems] = useState([]);
  const mobileLoadMoreRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isProductModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [mobileVisibleCount, setMobileVisibleCount] = useState(MOBILE_ITEMS_BATCH);
  const [statusFilter, setStatusFilter] = useState('all');
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
  const [showPromoSection, setShowPromoSection] = useState(false);
  const [savedFilters, setSavedFilters] = useState([]);
  const [filterName, setFilterName] = useState('');
  const [analyticsProduct, setAnalyticsProduct] = useState(null);
  const [viewMode, setViewMode] = useState('list'); // 'grid' or 'list'
  const [promoAnalytics, setPromoAnalytics] = useState(null);
  const [promoAnalyticsLoading, setPromoAnalyticsLoading] = useState(false);
  const [promoCodes, setPromoCodes] = useState([]);
  const [promoCodesLoading, setPromoCodesLoading] = useState(false);
  const [promoCodeStatusFilter, setPromoCodeStatusFilter] = useState('active');
  const [promoForm, setPromoForm] = useState(buildDefaultPromoForm);
  const [promoSubmitting, setPromoSubmitting] = useState(false);
  const [promoToggleLoadingId, setPromoToggleLoadingId] = useState('');
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

  const loadPromoCodes = async (status = promoCodeStatusFilter) => {
    if (!isShopUser) {
      setPromoCodes([]);
      return;
    }
    setPromoCodesLoading(true);
    try {
      const { data } = await api.get('/marketplace-promo-codes/my', {
        params: { page: 1, limit: 20, status }
      });
      setPromoCodes(Array.isArray(data?.items) ? data.items : []);
    } catch (e) {
      const statusCode = e?.response?.status;
      if (statusCode !== 403) {
        showToast(e.response?.data?.message || 'Impossible de charger les codes promo.', { variant: 'error' });
      }
      setPromoCodes([]);
    } finally {
      setPromoCodesLoading(false);
    }
  };

  const handleCreatePromoCode = async (event) => {
    event.preventDefault();
    if (!isShopUser) return;
    const startDate = promoForm.startDate ? new Date(promoForm.startDate) : null;
    const endDate = promoForm.endDate ? new Date(promoForm.endDate) : null;
    if (!startDate || Number.isNaN(startDate.getTime()) || !endDate || Number.isNaN(endDate.getTime())) {
      showToast('Veuillez renseigner les dates de début et fin.', { variant: 'error' });
      return;
    }
    if (endDate <= startDate) {
      showToast('La date de fin doit être postérieure à la date de début.', { variant: 'error' });
      return;
    }
    if (promoForm.appliesTo === 'product' && !promoForm.productId) {
      showToast('Veuillez sélectionner un produit pour un code produit.', { variant: 'error' });
      return;
    }

    setPromoSubmitting(true);
    try {
      await api.post('/marketplace-promo-codes/my', {
        code: promoForm.code.trim().toUpperCase(),
        appliesTo: promoForm.appliesTo,
        productId: promoForm.appliesTo === 'product' ? promoForm.productId : null,
        discountType: promoForm.discountType,
        discountValue: Number(promoForm.discountValue || 0),
        usageLimit: Number(promoForm.usageLimit || 1),
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        isActive: Boolean(promoForm.isActive)
      });
      showToast('Code promo créé avec succès.', { variant: 'success' });
      setPromoForm(buildDefaultPromoForm());
      await Promise.all([loadPromoCodes(promoCodeStatusFilter), load({ silent: true })]);
    } catch (e) {
      showToast(e.response?.data?.message || 'Impossible de créer le code promo.', { variant: 'error' });
    } finally {
      setPromoSubmitting(false);
    }
  };

  const handleTogglePromoCode = async (promoItem) => {
    if (!promoItem?.id) return;
    if (promoToggleLoadingId === promoItem.id) return;
    const nextIsActive = !promoItem.isActive;
    const previousPromoCodes = promoCodes;
    setPromoToggleLoadingId(promoItem.id);

    setPromoCodes((prev) => {
      const updated = prev.map((item) =>
        item.id === promoItem.id ? { ...item, isActive: nextIsActive } : item
      );

      if (promoCodeStatusFilter === 'active') {
        return updated.filter((item) => Boolean(item.isActive));
      }
      if (promoCodeStatusFilter === 'inactive') {
        return updated.filter((item) => !item.isActive);
      }
      return updated;
    });

    try {
      await api.patch(`/marketplace-promo-codes/my/${promoItem.id}/toggle`, {
        isActive: nextIsActive
      });
      showToast(nextIsActive ? 'Code promo activé.' : 'Code promo désactivé.', { variant: 'success' });
      await Promise.all([loadPromoCodes(promoCodeStatusFilter), load({ silent: true })]);
    } catch (e) {
      setPromoCodes(previousPromoCodes);
      showToast(e.response?.data?.message || 'Impossible de modifier ce code promo.', { variant: 'error' });
    } finally {
      setPromoToggleLoadingId('');
    }
  };

  const load = async (options = {}) => {
    const silent = Boolean(options?.silent);
    if (!silent) {
      setLoading(true);
    }
    setError('');
    if (isShopUser) {
      setPromoAnalyticsLoading(true);
    }
    try {
      const requests = [api.get('/products')];
      if (isShopUser) {
        requests.push(api.get('/marketplace-promo-codes/my/analytics'));
      }
      const [productsResult, promoResult] = await Promise.allSettled(requests);

      if (productsResult.status === 'fulfilled') {
        const data = productsResult.value?.data;
        setItems(Array.isArray(data) ? data : []);
      } else {
        const productError = productsResult.reason;
        throw productError;
      }

      if (isShopUser) {
        if (promoResult?.status === 'fulfilled') {
          setPromoAnalytics(promoResult.value?.data || null);
        } else {
          setPromoAnalytics(null);
        }
      } else {
        setPromoAnalytics(null);
      }
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
      if (isShopUser) {
        setPromoAnalyticsLoading(false);
      }
    }
  };

  useEffect(() => {
    load();
    loadSavedFilters();
  }, [isShopUser]);

  useEffect(() => {
    if (!isShopUser) return;
    loadPromoCodes(promoCodeStatusFilter);
  }, [isShopUser, promoCodeStatusFilter]);

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

  // Save current filter state
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

  // Filter items by all criteria
  const filteredItems = useMemo(() => {
    let filtered = [...items];

    // Search by title and description
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.title?.toLowerCase().includes(query) ||
          p.description?.toLowerCase().includes(query)
      );
    }

    // Filter by categories
    if (selectedCategories.length > 0) {
      filtered = filtered.filter((p) => selectedCategories.includes(p.category));
    }

    // Filter by price range
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

    // Filter by date range
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

    // Filter by status (multiple statuses or single status filter)
    if (selectedStatuses.length > 0) {
      filtered = filtered.filter((p) => selectedStatuses.includes(p.status));
    } else if (statusFilter !== 'all' && statusFilter !== 'custom') {
      filtered = filtered.filter((p) => p.status === statusFilter);
    }

    // Filter by boosted status
    if (boostedFilter === 'boosted') {
      filtered = filtered.filter((p) => p.boosted === true);
    } else if (boostedFilter === 'non-boosted') {
      filtered = filtered.filter((p) => p.boosted !== true);
    }

    // Filter by installment availability
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

  if (loading && items.length === 0) {
    return (
      <div className="hd-my-flow min-h-screen bg-[#f5f5f5] dark:bg-neutral-950">
        {/* Skeleton header */}
        <div className="sticky top-0 z-30 bg-white border-b border-gray-100 px-4 py-3">
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
    <div className="hd-my-flow min-h-screen bg-[#f5f5f5] dark:bg-neutral-950">

      {/* ── TAOBAO STICKY HEADER ── */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-100 dark:border-neutral-800 dark:bg-neutral-950">
        <div className="flex items-center justify-between gap-2 px-4 py-3"
          style={{ paddingTop: 'calc(env(safe-area-inset-top,0px) + 10px)' }}>
          <div className="min-w-0">
            <h1 className="text-[15px] font-black text-gray-900 dark:text-white leading-tight">Mes annonces</h1>
            <p className="text-[11px] text-gray-400 leading-tight mt-0.5">
              {stats.total > 0
                ? `${stats.total} annonce${stats.total > 1 ? 's' : ''} · ${stats.approved} active${stats.approved > 1 ? 's' : ''}`
                : 'Aucune annonce pour l\'instant'}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button type="button" onClick={load} disabled={loading}
              className="h-9 w-9 flex items-center justify-center rounded-full bg-gray-100 text-gray-600 active:scale-95 transition-transform disabled:opacity-50 dark:bg-neutral-800 dark:text-neutral-300"
              aria-label="Actualiser">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            {sellingEnabled ? (
              <button type="button"
                onClick={() => { setEditingProduct(null); setProductModalOpen(true); }}
                className="flex items-center gap-1.5 pl-3 pr-4 py-2 rounded-full bg-[#FF6A00] text-white text-sm font-bold shadow-sm active:scale-95 transition-transform">
                <Plus className="w-4 h-4" />
                Publier
              </button>
            ) : (
              <span className="flex items-center gap-1 px-3 py-2 rounded-full bg-gray-100 text-gray-400 text-xs font-semibold">
                <AlertTriangle className="w-3.5 h-3.5" /> Désactivé
              </span>
            )}
          </div>
        </div>
      </header>

      {/* ── INLINE KPI STRIP ── */}
      {!loading && stats.total > 0 && (
        <section className="bg-white">
          <div className="flex divide-x divide-gray-100">
            <button type="button" onClick={() => { setStatusFilter('all'); setSelectedStatuses([]); }}
              className="flex-1 flex flex-col items-center py-3 gap-0.5 active:bg-gray-50 transition-colors">
              <span className="text-[22px] font-black text-gray-900 leading-tight">{stats.total}</span>
              <span className="text-[11px] text-gray-500">Total</span>
            </button>
            <button type="button" onClick={() => { setStatusFilter('approved'); setSelectedStatuses([]); }}
              className="flex-1 flex flex-col items-center py-3 gap-0.5 active:bg-gray-50 transition-colors">
              <span className="text-[22px] font-black text-emerald-600 leading-tight">{stats.approved}</span>
              <span className="text-[11px] text-gray-500">Actives</span>
            </button>
            <button type="button" onClick={() => { setStatusFilter('pending'); setSelectedStatuses([]); }}
              className="flex-1 flex flex-col items-center py-3 gap-0.5 active:bg-gray-50 transition-colors">
              <span className="text-[22px] font-black text-amber-500 leading-tight">{stats.pending}</span>
              <span className="text-[11px] text-gray-500">Attente</span>
            </button>
            <button type="button" onClick={() => {}}
              className="flex-1 flex flex-col items-center py-3 gap-0.5 active:bg-gray-50 transition-colors">
              <span className="text-[14px] font-black text-[#FF6A00] leading-tight">{formatCurrency(stats.totalValue)}</span>
              <span className="text-[11px] text-gray-500">Valeur</span>
            </button>
          </div>
        </section>
      )}

      {/* ── QUICK SHORTCUTS ROW ── */}
      <section className="bg-white border-t border-gray-50">
        <div className="flex gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {[
            { to: '/wallet', icon: Wallet, label: 'Portefeuille', color: 'text-emerald-600' },
            { to: '/seller/boosts', icon: Sparkles, label: 'Boosts', color: 'text-[#FF6A00]' },
            { to: '/seller/analytics', icon: BarChart3, label: 'Analytics', color: 'text-blue-600' },
            { to: '/orders', icon: Package, label: 'Commandes', color: 'text-purple-600' },
            ...(isShopUser ? [{ to: '/seller/promo-codes', icon: Tag, label: 'Codes promo', color: 'text-pink-600' }] : []),
          ].map(({ to, icon: Icon, label, color }) => (
            <Link key={to} to={to}
              className="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-gray-50 border border-gray-200 text-xs font-semibold text-gray-700 active:bg-gray-100 transition-colors">
              <Icon className={`w-3.5 h-3.5 ${color}`} />
              {label}
            </Link>
          ))}
        </div>
      </section>

      <div className="h-2 bg-[#f5f5f5]" />

      <div className="pb-32 lg:pb-12">

        {!loading && (promoAnalyticsLoading || promoAnalytics) && (
          <div className="space-y-4 mb-8">
            {promoAnalytics?.gamification?.isMostGenerousOfMonth ? (
              <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 via-yellow-50 to-amber-50 p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center">
                    <Award className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-amber-900">Badge vendeur</p>
                    <p className="text-base font-bold text-amber-800">Boutique la plus généreuse du mois</p>
                  </div>
                </div>
              </div>
            ) : promoAnalytics?.gamification?.rank ? (
              <div className="rounded-2xl border border-neutral-100 bg-neutral-50/60 p-4">
                <p className="text-sm font-semibold text-neutral-900">Classement promo du mois</p>
                <p className="text-sm text-neutral-700">
                  Position #{promoAnalytics.gamification.rank} sur {promoAnalytics.gamification.totalParticipants || 0} boutiques.
                </p>
              </div>
            ) : null}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 rounded-xl bg-neutral-600">
                    <DollarSign className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-2xl font-bold text-gray-900">
                    {formatCurrency(promoAnalytics?.metrics?.promoRevenueTotal || 0)}
                  </span>
                </div>
                <p className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Revenus via promo</p>
                <p className="text-xs text-gray-500 mt-1">Chiffre d’affaires des commandes promo</p>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 rounded-xl bg-emerald-600">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-2xl font-bold text-gray-900">
                    {Number(promoAnalytics?.metrics?.clientsAcquiredViaPromo || 0).toLocaleString('fr-FR')}
                  </span>
                </div>
                <p className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Clients acquis</p>
                <p className="text-xs text-gray-500 mt-1">Première commande obtenue via promo</p>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 rounded-xl bg-neutral-600">
                    <TrendingUp className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-2xl font-bold text-gray-900">
                    {Number(promoAnalytics?.metrics?.conversionRate || 0).toLocaleString('fr-FR')}%
                  </span>
                </div>
                <p className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Taux conversion</p>
                <p className="text-xs text-gray-500 mt-1">Part des commandes avec code promo</p>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 rounded-xl bg-amber-600">
                    <BarChart3 className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-2xl font-bold text-gray-900">
                    {Number(promoAnalytics?.metrics?.promoOrders || 0).toLocaleString('fr-FR')}
                  </span>
                </div>
                <p className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Commandes promo</p>
                <p className="text-xs text-gray-500 mt-1">
                  Sur {Number(promoAnalytics?.metrics?.totalOrders || 0).toLocaleString('fr-FR')} commandes
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── ASSISTANT BANNER (compact) ── */}
        {!loading && !isShopUser && (assistantAssignment || assistantInvites.length > 0) && (
          <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-[#fff0e4] flex items-center justify-center flex-shrink-0">
                <ShieldCheck className="w-4 h-4 text-[#FF6A00]" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-gray-900 truncate">Assistant boutique</p>
                <p className="text-[11px] text-gray-500 truncate">
                  {assistantAssignment
                    ? `Workspace: ${assistantAssignment.shop?.shopName || assistantAssignment.shop?.name || 'boutique'}`
                    : `${assistantInvites.length} invitation${assistantInvites.length > 1 ? 's' : ''} en attente`}
                </p>
              </div>
            </div>
            <Link to="/seller/assistant/workspace"
              className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#FF6A00] text-white text-xs font-bold active:scale-95 transition-transform">
              {assistantAssignment ? 'Ouvrir' : 'Voir'}
            </Link>
          </div>
        )}
        {!loading && isShopUser && (
          <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-[#fff0e4] flex items-center justify-center flex-shrink-0">
                <ShieldCheck className="w-4 h-4 text-[#FF6A00]" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-gray-900">Assistant boutique</p>
                <p className="text-[11px] text-gray-500">Déléguez la gestion de votre boutique</p>
              </div>
            </div>
            <Link to="/seller/assistant"
              className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#FF6A00] text-white text-xs font-bold active:scale-95 transition-transform">
              Gérer
            </Link>
          </div>
        )}

        {/* ── CODES PROMO (collapsible Taobao card) ── */}
        {!loading && isShopUser && (
          <div className="bg-white border-b border-gray-100">
            {/* Header row — always visible, tap to expand */}
            <button type="button"
              onClick={() => {
                setShowPromoSection((prev) => !prev);
                if (!showPromoSection) loadPromoCodes(promoCodeStatusFilter);
              }}
              className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-gray-50 transition-colors">
              <div className="w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center flex-shrink-0">
                <Tag className="w-4 h-4 text-purple-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900">Codes promo</p>
                <p className="text-[11px] text-gray-400">
                  {promoCodes.length > 0
                    ? `${promoCodes.filter((p) => p.isActive).length} actif${promoCodes.filter((p) => p.isActive).length > 1 ? 's' : ''} · ${promoCodes.length} total`
                    : 'Créez des réductions pour votre boutique'}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Link to="/seller/promo-codes"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-50 border border-purple-200 text-purple-700 text-[11px] font-bold active:scale-95 transition-transform">
                  Gérer
                </Link>
                {showPromoSection
                  ? <ChevronUp className="w-4 h-4 text-gray-400" />
                  : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </div>
            </button>

            {/* Expanded content */}
            {showPromoSection && (
              <div className="border-t border-gray-100">

                {/* ── Quick create form ── */}
                <form onSubmit={handleCreatePromoCode} className="px-4 py-3 space-y-2.5 bg-gray-50/60 border-b border-gray-100">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Nouveau code</p>

                  {/* Row 1: Code + Type scope */}
                  <div className="grid grid-cols-2 gap-2">
                    <input type="text" value={promoForm.code}
                      onChange={(e) => setPromoForm((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
                      placeholder="Code (ex: SUMMER20)"
                      className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:border-[#FF6A00] uppercase placeholder-normal"
                      required />
                    <select value={promoForm.appliesTo}
                      onChange={(e) => setPromoForm((prev) => ({ ...prev, appliesTo: e.target.value, productId: '' }))}
                      className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:border-[#FF6A00]">
                      <option value="boutique">Toute la boutique</option>
                      <option value="product">Produit spécifique</option>
                    </select>
                  </div>

                  {/* Row 2: Discount type + value + usage limit */}
                  <div className="grid grid-cols-3 gap-2">
                    <select value={promoForm.discountType}
                      onChange={(e) => setPromoForm((prev) => ({ ...prev, discountType: e.target.value }))}
                      className="rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm focus:outline-none focus:border-[#FF6A00]">
                      <option value="percentage">%</option>
                      <option value="fixed">Fixe</option>
                    </select>
                    <input type="number" min="1" value={promoForm.discountValue}
                      onChange={(e) => setPromoForm((prev) => ({ ...prev, discountValue: e.target.value }))}
                      placeholder={promoForm.discountType === 'percentage' ? 'Ex: 20' : 'Ex: 5000'}
                      className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:border-[#FF6A00]"
                      required />
                    <input type="number" min="1" value={promoForm.usageLimit}
                      onChange={(e) => setPromoForm((prev) => ({ ...prev, usageLimit: e.target.value }))}
                      placeholder="Limite"
                      className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:border-[#FF6A00]"
                      required />
                  </div>

                  {/* Row 3: Date range */}
                  <div className="grid grid-cols-2 gap-2">
                    <input type="date" value={promoForm.startDate}
                      onChange={(e) => setPromoForm((prev) => ({ ...prev, startDate: e.target.value }))}
                      className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:border-[#FF6A00]"
                      required />
                    <input type="date" value={promoForm.endDate}
                      onChange={(e) => setPromoForm((prev) => ({ ...prev, endDate: e.target.value }))}
                      className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:border-[#FF6A00]"
                      required />
                  </div>

                  {/* Product selector (only when product scope) */}
                  {promoForm.appliesTo === 'product' && (
                    <select value={promoForm.productId}
                      onChange={(e) => setPromoForm((prev) => ({ ...prev, productId: e.target.value }))}
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:border-[#FF6A00]"
                      required>
                      <option value="">Sélectionner un produit approuvé</option>
                      {promoEligibleProducts.map((p) => (
                        <option key={p.id} value={p.id}>{p.title}</option>
                      ))}
                    </select>
                  )}

                  {/* Footer: activate toggle + submit */}
                  <div className="flex items-center justify-between pt-0.5">
                    <label className="inline-flex items-center gap-2 text-xs font-semibold text-gray-600 cursor-pointer">
                      <input type="checkbox" checked={promoForm.isActive}
                        onChange={(e) => setPromoForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                        className="rounded border-gray-300 accent-[#FF6A00]" />
                      Activer immédiatement
                    </label>
                    <button type="submit" disabled={promoSubmitting}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#FF6A00] text-white text-xs font-bold disabled:opacity-60 active:scale-95 transition-transform">
                      {promoSubmitting ? <><RefreshCw className="w-3 h-3 animate-spin" /> Création...</> : <><Plus className="w-3 h-3" /> Créer</>}
                    </button>
                  </div>
                </form>

                {/* ── Codes list ── */}
                <div className="px-4 py-2.5">
                  {/* Filter pills */}
                  <div className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden mb-2.5">
                    {[
                      { value: 'active', label: 'Actifs' },
                      { value: 'all', label: 'Tous' },
                      { value: 'inactive', label: 'Inactifs' },
                      { value: 'expired', label: 'Expirés' },
                      { value: 'upcoming', label: 'À venir' },
                    ].map((opt) => (
                      <button key={opt.value} type="button"
                        onClick={() => { setPromoCodeStatusFilter(opt.value); loadPromoCodes(opt.value); }}
                        className={`flex-shrink-0 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all ${
                          promoCodeStatusFilter === opt.value ? 'bg-[#FF6A00] text-white' : 'bg-gray-100 text-gray-600'
                        }`}>
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {/* Codes rows */}
                  {promoCodesLoading ? (
                    <div className="space-y-2 py-2">
                      {[1, 2].map((i) => (
                        <div key={i} className="flex items-center gap-3 py-2">
                          <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
                          <div className="flex-1 h-3 bg-gray-100 rounded animate-pulse" />
                          <div className="h-6 w-16 bg-gray-200 rounded-full animate-pulse" />
                        </div>
                      ))}
                    </div>
                  ) : promoCodes.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-4">Aucun code pour ce filtre.</p>
                  ) : (
                    <div className="space-y-0 divide-y divide-gray-50">
                      {promoCodes.map((promo) => (
                        <div key={promo.id} className="flex items-center gap-3 py-2.5">
                          {/* Status dot */}
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${promo.isActive ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-black text-gray-900 tracking-wide">{promo.code}</span>
                              <span className="text-[11px] text-gray-500">
                                {promo.discountType === 'percentage'
                                  ? `${Number(promo.discountValue || 0)}%`
                                  : formatCurrency(promo.discountValue || 0)}
                                {' · '}
                                {promo.appliesTo === 'boutique' ? 'Boutique' : 'Produit'}
                              </span>
                            </div>
                            <p className="text-[11px] text-gray-400">
                              {promo.usedCount}/{promo.usageLimit} utilisations
                              {' · '}
                              {formatDate(promo.startDate)} → {formatDate(promo.endDate)}
                            </p>
                          </div>
                          {/* Toggle button */}
                          <button type="button"
                            onClick={() => handleTogglePromoCode(promo)}
                            disabled={promoToggleLoadingId === promo.id}
                            className={`flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all disabled:opacity-50 ${
                              promo.isActive
                                ? 'bg-red-50 text-red-600 border border-red-200'
                                : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                            }`}>
                            {promoToggleLoadingId === promo.id
                              ? <RefreshCw className="w-3 h-3 animate-spin" />
                              : promo.isActive ? 'Désact.' : 'Activer'}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TAOBAO SEARCH + FILTER BAR ── */}
        {!loading && items.length > 0 && (
          <div className="bg-white">
            {/* Search input */}
            <div className="px-4 pt-3 pb-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" value={searchDraft}
                  onChange={(e) => setSearchDraft(e.target.value)}
                  placeholder="Rechercher par titre ou description..."
                  className="w-full pl-9 pr-9 py-2.5 bg-gray-100 rounded-full text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FF6A00]/30 transition-all" />
                {searchDraft && (
                  <button type="button"
                    onClick={() => { setSearchDraft(''); setSearchQuery(''); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 active:scale-90">
                    <XCircle className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            {/* Sort + Filter toggle row */}
            <div className="flex items-center justify-between px-4 pb-3 gap-3">
              <button type="button"
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  showAdvancedFilters || selectedCategories.length > 0 || priceMin || priceMax || dateFrom || dateTo || selectedStatuses.length > 0 || boostedFilter !== 'all' || installmentFilter !== 'all'
                    ? 'border-[#FF6A00] bg-[#fff0e4] text-[#FF6A00]'
                    : 'border-gray-200 bg-gray-50 text-gray-600'
                }`}>
                <Filter className="w-3.5 h-3.5" />
                Filtres
                {(selectedCategories.length > 0 || priceMin || priceMax || dateFrom || dateTo || selectedStatuses.length > 0 || boostedFilter !== 'all' || installmentFilter !== 'all') && (
                  <span className="ml-1 w-4 h-4 rounded-full bg-[#FF6A00] text-white text-[9px] flex items-center justify-center font-black">!</span>
                )}
                {showAdvancedFilters ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
              <div className="flex items-center gap-1.5">
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
                  className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-full px-2.5 py-1.5 focus:outline-none focus:border-[#FF6A00]">
                  <option value="date-desc">Récent</option>
                  <option value="date-asc">Ancien</option>
                  <option value="price-desc">Prix ↓</option>
                  <option value="price-asc">Prix ↑</option>
                  <option value="title-asc">Titre A-Z</option>
                </select>
                {/* View toggle */}
                <div className="flex items-center bg-gray-100 rounded-full p-0.5">
                  <button type="button" onClick={() => setViewMode('list')}
                    className={`p-1.5 rounded-full transition-all ${viewMode === 'list' ? 'bg-white text-[#FF6A00] shadow-sm' : 'text-gray-400'}`}>
                    <List className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" onClick={() => setViewMode('grid')}
                    className={`p-1.5 rounded-full transition-all ${viewMode === 'grid' ? 'bg-white text-[#FF6A00] shadow-sm' : 'text-gray-400'}`}>
                    <Grid3x3 className="w-3.5 h-3.5" />
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
                    <XCircle className="w-3.5 h-3.5" /> Réinitialiser les filtres
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
                            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all ${isSelected ? 'bg-[#FF6A00] text-white' : 'bg-gray-100 text-gray-600'}`}>
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
                      placeholder="Min" className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#FF6A00]" />
                    <input type="number" value={priceMax} onChange={(e) => setPriceMax(e.target.value)}
                      placeholder="Max" className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#FF6A00]" />
                  </div>
                </div>
                {/* Date range */}
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Date</p>
                  <div className="flex gap-2">
                    <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                      className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#FF6A00]" />
                    <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                      className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#FF6A00]" />
                  </div>
                </div>
                {/* Installment filter */}
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Paiement par tranche</p>
                  <div className="flex gap-1.5">
                    {[{ key: 'all', label: 'Tous' }, { key: 'enabled', label: 'Avec tranche' }, { key: 'disabled', label: 'Sans' }].map((opt) => (
                      <button key={opt.key} type="button" onClick={() => setInstallmentFilter(opt.key)}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all ${installmentFilter === opt.key ? 'bg-[#FF6A00] text-white' : 'bg-gray-100 text-gray-600'}`}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Save filter */}
                <div className="flex gap-2 pt-1 border-t border-gray-100">
                  <input type="text" value={filterName} onChange={(e) => setFilterName(e.target.value)}
                    placeholder="Nom du filtre à sauvegarder..."
                    className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-[#FF6A00]" />
                  <button type="button" onClick={saveCurrentFilter}
                    className="flex items-center gap-1 px-3 py-2 rounded-lg bg-gray-900 text-white text-xs font-semibold">
                    <Save className="w-3 h-3" /> Sauver
                  </button>
                </div>
                {savedFilters.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {savedFilters.map((filter) => (
                      <div key={filter.id} className="flex items-center gap-1 px-2.5 py-1 bg-gray-50 border border-gray-200 rounded-full">
                        <button type="button" onClick={() => loadSavedFilter(filter)}
                          className="text-[11px] font-semibold text-gray-700">{filter.name}</button>
                        <button type="button" onClick={() => deleteSavedFilter(filter.id)} className="text-gray-400 active:text-red-500">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── TAOBAO STATUS TABS (horizontal scroll, sticky) ── */}
        {!loading && items.length > 0 && (
          <div className="sticky top-[52px] z-20 bg-white border-b border-gray-100">
            <div className="flex overflow-x-auto px-4 gap-2 py-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {Object.entries(STATUS_LABELS).map(([key, label]) => {
                const isActive = statusFilter === key && selectedStatuses.length === 0;
                const count = key === 'all' ? stats.total : stats[key] || 0;
                return (
                  <button key={key} type="button"
                    onClick={() => { setStatusFilter(key); setSelectedStatuses([]); }}
                    className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all active:scale-95 ${
                      isActive ? 'bg-[#FF6A00] text-white shadow-sm' : 'bg-gray-100 text-gray-600'
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
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* ── EMPTY STATE ── */}
        {!loading && items.length === 0 && (
          <div className="bg-white px-8 py-16 text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-[#fff0e4] flex items-center justify-center mb-4">
              <Package className="w-8 h-8 text-[#FF6A00]" />
            </div>
            <h3 className="text-base font-black text-gray-900 mb-1">Aucune annonce</h3>
            <p className="text-sm text-gray-500 mb-5">Publiez votre première annonce pour commencer à vendre</p>
            <button type="button"
              onClick={() => { setEditingProduct(null); setProductModalOpen(true); }}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#FF6A00] text-white font-bold text-sm shadow-sm active:scale-95 transition-transform">
              <Plus className="w-4 h-4" /> Publier une annonce
            </button>
          </div>
        )}

        {/* ── EMPTY FILTERED ── */}
        {!loading && items.length > 0 && visibleItems.length === 0 && (
          <div className="bg-white px-8 py-10 text-center">
            <Filter className="w-8 h-8 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-600 mb-3">Aucune annonce pour ces filtres</p>
            <button type="button" onClick={clearAllFilters}
              className="text-sm font-bold text-[#FF6A00] underline-offset-2 hover:underline">
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
          <div className="sticky top-[88px] z-20 bg-[#0a0a0a] text-white px-4 py-2.5 flex items-center justify-between gap-2 flex-wrap">
            <span className="text-sm font-semibold">
              {selectedProducts.size} sélectionné{selectedProducts.size > 1 ? 's' : ''}
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button type="button" onClick={handleBulkEnable} disabled={bulkActionLoading}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-emerald-500 text-white text-xs font-semibold disabled:opacity-50">
                <Power className="w-3 h-3" /> On
              </button>
              <button type="button" onClick={handleBulkDisable} disabled={bulkActionLoading}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-amber-500 text-white text-xs font-semibold disabled:opacity-50">
                <PowerOff className="w-3 h-3" /> Off
              </button>
              <button type="button" onClick={handleBulkDelete} disabled={bulkActionLoading}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-red-500 text-white text-xs font-semibold disabled:opacity-50">
                <Trash2 className="w-3 h-3" /> Suppr.
              </button>
              <button type="button" onClick={handleExportCSV} disabled={bulkActionLoading}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-white/15 border border-white/20 text-white text-xs font-semibold disabled:opacity-50">
                <Download className="w-3 h-3" /> CSV
              </button>
              <button type="button" onClick={handleExportPDF} disabled={bulkActionLoading}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-white/15 border border-white/20 text-white text-xs font-semibold disabled:opacity-50">
                <FileText className="w-3 h-3" /> PDF
              </button>
              <button type="button" onClick={clearSelection}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-white/15 border border-white/20 text-white text-xs font-semibold">
                <X className="w-3 h-3" /> Annuler
              </button>
            </div>
          </div>
        )}

        {/* ── PRODUCT LIST ── */}
        {!loading && paginatedItems.length > 0 && (
          <>
            {/* Select all bar */}
            <div className="bg-white border-b border-gray-100 px-4 py-2.5 flex items-center justify-between">
              <button type="button" onClick={selectAllProducts}
                className="flex items-center gap-2 text-xs font-semibold text-gray-600 active:text-[#FF6A00] transition-colors">
                {selectedProducts.size === paginatedItems.length && paginatedItems.length > 0 ? (
                  <CheckSquare className="w-4 h-4 text-[#FF6A00]" />
                ) : (
                  <Square className="w-4 h-4 text-gray-400" />
                )}
                {selectedProducts.size === paginatedItems.length && paginatedItems.length > 0 ? 'Tout désélectionner' : 'Tout sélectionner'}
              </button>
              <span className="text-xs text-gray-400">
                {visibleItems.length} annonce{visibleItems.length > 1 ? 's' : ''}
                {selectedProducts.size > 0 && ` · ${selectedProducts.size} sél.`}
              </span>
            </div>

            <div className={viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4' : 'divide-y divide-gray-50 bg-white'}>
              {paginatedItems.map((product) => {
                const StatusIcon = STATUS_ICONS[product.status] || Clock;
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
                  const statusBorderColor = {
                    approved: 'border-l-emerald-500',
                    pending: 'border-l-amber-400',
                    rejected: 'border-l-red-500',
                    disabled: 'border-l-gray-300',
                  }[product.status] || 'border-l-gray-200';

                  const statusBadgeStyle = {
                    approved: 'bg-emerald-50 text-emerald-700',
                    pending: 'bg-amber-50 text-amber-700',
                    rejected: 'bg-red-50 text-red-600',
                    disabled: 'bg-gray-100 text-gray-500',
                  }[product.status] || 'bg-gray-100 text-gray-600';

                  return (
                    <div key={productId}
                      className={`bg-white border-l-[3px] ${statusBorderColor} relative ${
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
                            ? <CheckSquare className="w-4.5 h-4.5 text-[#FF6A00]" />
                            : <Square className="w-4 h-4 text-gray-300" />}
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
                              <ImageIcon className="w-8 h-8 text-gray-300" />
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
                            <span className="absolute top-1 left-1 bg-[#FF6A00] text-white text-[9px] font-black px-1 py-0.5 rounded">
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
                                <TrendingUp className="w-2.5 h-2.5" /> Top
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
                            <span className="text-base font-black text-[#FF6A00]">{formatCurrency(product.price)}</span>
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
                              <AlertTriangle className="w-3 h-3 flex-shrink-0" />
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
                      <div className="flex divide-x divide-gray-100 border-t border-gray-50">
                        <Link to={`/my/annonce/${product.slug || productId}`}
                          className="flex-1 flex items-center justify-center gap-1 py-2.5 text-xs font-semibold text-gray-600 active:bg-gray-50 transition-colors">
                          <FileText className="w-3.5 h-3.5" /> Détail
                        </Link>
                        <button type="button"
                          onClick={() => { setEditingProduct(product); setProductModalOpen(true); }}
                          className="flex-1 flex items-center justify-center gap-1 py-2.5 text-xs font-semibold text-gray-600 active:bg-gray-50 transition-colors">
                          <Edit className="w-3.5 h-3.5" /> Modifier
                        </button>
                        {product.status === 'approved' && (
                          <Link to={buildProductPath(product)} {...externalLinkProps}
                            className="flex-1 flex items-center justify-center gap-1 py-2.5 text-xs font-semibold text-gray-600 active:bg-gray-50 transition-colors">
                            <Eye className="w-3.5 h-3.5" /> Voir
                          </Link>
                        )}
                        <button type="button"
                          onClick={() => setAnalyticsProduct({ id: productId, title: product.title })}
                          className="flex-1 flex items-center justify-center gap-1 py-2.5 text-xs font-semibold text-gray-600 active:bg-gray-50 transition-colors">
                          <BarChart3 className="w-3.5 h-3.5" /> Stats
                        </button>
                        {product.status !== 'disabled' ? (
                          <button type="button"
                            onClick={() => updateStatus(product.slug || product._id, 'disable')}
                            disabled={updatingId === product._id}
                            className="flex-1 flex items-center justify-center gap-1 py-2.5 text-xs font-semibold text-red-500 active:bg-red-50 transition-colors disabled:opacity-40">
                            <PowerOff className="w-3.5 h-3.5" /> Off
                          </button>
                        ) : (
                          <button type="button"
                            onClick={() => updateStatus(product.slug || product._id, 'enable')}
                            disabled={updatingId === product._id}
                            className="flex-1 flex items-center justify-center gap-1 py-2.5 text-xs font-semibold text-emerald-600 active:bg-emerald-50 transition-colors disabled:opacity-40">
                            <Power className="w-3.5 h-3.5" /> On
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
                    className={`bg-white rounded-2xl border-2 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden relative ${
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
                        <div className="px-2 py-1 rounded-lg bg-sky-500 text-white text-xs font-bold shadow-lg inline-flex items-center gap-1">
                          <Sparkles className="w-3 h-3" />
                          Nouveau
                        </div>
                      )}
                      {isTopPerformer && (
                        <div className="px-2 py-1 rounded-lg bg-gradient-to-r from-yellow-400 to-yellow-500 text-white text-xs font-bold shadow-lg flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" />
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
                        className={`p-2.5 rounded-lg backdrop-blur-sm transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-neutral-600 text-white hover:bg-neutral-700 shadow-lg'
                            : 'bg-black/60 text-white hover:bg-black/80'
                        }`}
                        style={{ pointerEvents: 'auto' }}
                        aria-label={isSelected ? 'Désélectionner' : 'Sélectionner'}
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4" />
                        ) : (
                          <Square className="w-4 h-4" />
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
                          <ImageIcon className="w-12 h-12 text-gray-400" />
                        </div>
                      )}
                      {/* Status Badge */}
                      <div className="absolute top-3 right-3 flex flex-col gap-2">
                        <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${statusStyle.badge} text-white shadow-lg backdrop-blur-sm`}>
                          <StatusIcon className="w-3.5 h-3.5" />
                          <span className="text-xs font-bold uppercase tracking-wide">
                            {STATUS_LABELS[product.status] || product.status}
                          </span>
                        </div>
                        {/* Boosted Badge */}
                        {product.boosted && (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-neutral-500 to-neutral-600 text-white shadow-lg backdrop-blur-sm">
                            <Zap className="w-3.5 h-3.5" />
                            <span className="text-xs font-bold uppercase tracking-wide">Boosté</span>
                          </div>
                        )}
                      </div>
                      {/* Image Count Badge */}
                      {product.images?.length > 1 && (
                        <div className="absolute top-3 left-3">
                          <div className="px-2 py-1 rounded-lg bg-black/50 backdrop-blur-sm text-white text-xs font-bold">
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
                          <span className="text-xl font-black text-neutral-600">
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
                            <AlertTriangle className="w-4 h-4 text-orange-500 shrink-0" />
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
                              <CalendarClock className="w-3.5 h-3.5" />
                              Prolonger
                            </button>
                            {product.status !== 'disabled' && (
                              <button
                                type="button"
                                onClick={() => updateStatus(product.slug || product._id, 'disable')}
                                disabled={updatingId === product._id}
                                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-semibold transition-colors disabled:opacity-50"
                              >
                                <PowerOff className="w-3.5 h-3.5" />
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
                            <Package className="w-3 h-3" />
                            <span className="capitalize">{product.category}</span>
                          </div>
                        )}
                        {product.boosted && (
                          <div className="flex items-center gap-1 text-neutral-600 dark:text-neutral-400 font-semibold">
                            <Zap className="w-3 h-3" />
                            <span>Boosté</span>
                          </div>
                        )}
                        {product.createdAt && (
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
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
                          <FileText className="w-4 h-4" />
                          Detail
                        </Link>
                        {product.status === 'approved' && (
                          <Link
                            to={buildProductPath(product)}
                            {...externalLinkProps}
                            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-700 text-sm font-semibold hover:bg-neutral-100 transition-all"
                          >
                            <Eye className="w-4 h-4" />
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
                          <BarChart3 className="w-4 h-4" />
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
                          <Edit className="w-4 h-4" />
                          Modifier
                        </button>
                        {product.status !== 'disabled' ? (
                          <button
                            onClick={() => updateStatus(product.slug || product._id, 'disable')}
                            disabled={updatingId === product._id}
                            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm font-semibold hover:bg-red-100 transition-all disabled:opacity-50"
                            type="button"
                          >
                            <PowerOff className="w-4 h-4" />
                            Désactiver
                          </button>
                        ) : (
                          <button
                            onClick={() => updateStatus(product.slug || product._id, 'enable')}
                            disabled={updatingId === product._id}
                            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 text-sm font-semibold hover:bg-emerald-100 transition-all disabled:opacity-50"
                            type="button"
                          >
                            <Power className="w-4 h-4" />
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
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-semibold text-gray-700">
                    {currentPage} / {totalPages}
                  </span>
                  <button type="button" onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages}
                    className="h-8 w-8 flex items-center justify-center rounded-full border border-gray-200 text-gray-600 disabled:opacity-40 active:scale-95 transition-transform">
                    <ArrowRight className="w-4 h-4" />
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
          className="fixed bottom-24 right-4 z-30 w-14 h-14 rounded-full bg-[#FF6A00] text-white shadow-xl flex items-center justify-center active:scale-90 transition-transform"
          style={{ boxShadow: '0 8px 24px rgba(255,106,0,0.45)' }}
          aria-label="Publier une annonce">
          <Plus className="w-6 h-6" />
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
            : 'sm:max-w-5xl sm:max-h-[90vh] sm:rounded-3xl border-gray-200 bg-gray-50'
        }
      >
            {/* Modal Header */}
            <div className={`hd-my-hero text-white flex-shrink-0 ${isMobile ? 'px-4 py-4 safe-area-top' : 'px-6 py-5'}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`rounded-xl bg-white/20 backdrop-blur-sm flex-shrink-0 ${isMobile ? 'p-2.5' : 'p-3'}`}>
                    {editingProduct ? (
                      <Edit className={isMobile ? 'w-5 h-5' : 'w-6 h-6'} />
                    ) : (
                      <Plus className={isMobile ? 'w-5 h-5' : 'w-6 h-6'} />
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
                  className={`rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white hover:bg-white/20 active:bg-white/30 transition-all touch-manipulation flex-shrink-0 ${isMobile ? 'min-w-[44px] min-h-[44px] w-11 h-11' : 'h-10 w-10'}`}
                  aria-label="Fermer"
                >
                  <X size={20} />
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
    </div>
  );
}
