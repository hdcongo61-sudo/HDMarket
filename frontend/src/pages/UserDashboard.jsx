import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
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
  Tag
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
import categoryGroups from '../data/categories';
import storage from '../utils/storage';

const ITEMS_PER_PAGE = 12;

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

const formatCurrency = (value) => `${Number(value || 0).toLocaleString('fr-FR')} FCFA`;

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
  const { user } = useContext(AuthContext);
  const { showToast } = useToast();
  const externalLinkProps = useDesktopExternalLink();
  const isMobile = useIsMobile(768);
  const isShopUser = user?.accountType === 'shop';
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isProductModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
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
  const [savedFilters, setSavedFilters] = useState([]);
  const [filterName, setFilterName] = useState('');
  const [analyticsProduct, setAnalyticsProduct] = useState(null);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  const [promoAnalytics, setPromoAnalytics] = useState(null);
  const [promoAnalyticsLoading, setPromoAnalyticsLoading] = useState(false);
  const [promoCodes, setPromoCodes] = useState([]);
  const [promoCodesLoading, setPromoCodesLoading] = useState(false);
  const [promoCodeStatusFilter, setPromoCodeStatusFilter] = useState('active');
  const [promoForm, setPromoForm] = useState(buildDefaultPromoForm);
  const [promoSubmitting, setPromoSubmitting] = useState(false);

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
      await Promise.all([loadPromoCodes(promoCodeStatusFilter), load()]);
    } catch (e) {
      showToast(e.response?.data?.message || 'Impossible de créer le code promo.', { variant: 'error' });
    } finally {
      setPromoSubmitting(false);
    }
  };

  const handleTogglePromoCode = async (promoItem) => {
    if (!promoItem?.id) return;
    try {
      await api.patch(`/marketplace-promo-codes/my/${promoItem.id}/toggle`, {
        isActive: !promoItem.isActive
      });
      showToast(!promoItem.isActive ? 'Code promo activé.' : 'Code promo désactivé.', { variant: 'success' });
      await Promise.all([loadPromoCodes(promoCodeStatusFilter), load()]);
    } catch (e) {
      showToast(e.response?.data?.message || 'Impossible de modifier ce code promo.', { variant: 'error' });
    }
  };

  const load = async () => {
    setLoading(true);
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
      setCurrentPage(1);
    } catch (e) {
      setError(e.response?.data?.message || e.message || 'Impossible de charger vos annonces.');
      showToast(e.response?.data?.message || e.message || 'Erreur de chargement', { variant: 'error' });
    } finally {
      setLoading(false);
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

  // Pagination
  const totalPages = filteredItems.length ? Math.ceil(filteredItems.length / ITEMS_PER_PAGE) : 1;
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredItems.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredItems, currentPage]);

  const currentRangeStart = filteredItems.length ? (currentPage - 1) * ITEMS_PER_PAGE + 1 : 0;
  const currentRangeEnd = Math.min(filteredItems.length, currentPage * ITEMS_PER_PAGE);

  const goToPage = (page) => {
    const nextPage = Math.min(Math.max(page, 1), totalPages);
    setCurrentPage(nextPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    setCurrentPage(1);
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
    if (!confirm(`Réactiver ${selectedProducts.size} produit(s) ?`)) return;

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
    if (!confirm(`Désactiver ${selectedProducts.size} produit(s) ?`)) return;

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
    if (!confirm(`Supprimer définitivement ${selectedProducts.size} produit(s) ? Cette action est irréversible.`)) return;

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
    const csvHeaders = ['Titre', 'Prix (FCFA)', 'Catégorie', 'Statut', 'Date de création'];
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
                <th>Prix (FCFA)</th>
                <th>Catégorie</th>
                <th>Statut</th>
                <th>Date de création</th>
              </tr>
            </thead>
            <tbody>
              ${selectedItems.map((product) => `
                <tr>
                  <td>${product.title || ''}</td>
                  <td>${formatCurrency(product.price || 0)}</td>
                  <td>${product.category || ''}</td>
                  <td>${STATUS_LABELS[product.status] || product.status}</td>
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
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="space-y-8">
            <div className="space-y-4">
              <div className="h-8 bg-gray-200 rounded-xl w-64 animate-pulse"></div>
              <div className="h-4 bg-gray-200 rounded-lg w-96 animate-pulse"></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-32 bg-white rounded-2xl border border-gray-100 animate-pulse"></div>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-64 bg-white rounded-2xl border border-gray-100 animate-pulse"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Section */}
      <div className="bg-indigo-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-white/20 backdrop-blur-sm">
                  <Package className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white/80 uppercase tracking-wide">Mes annonces</p>
                  <h1 className="text-3xl font-bold">Gestion de mes produits</h1>
                </div>
              </div>
              <p className="text-white/90 text-sm max-w-2xl">
                Gérez vos annonces, suivez leur statut et publiez de nouveaux produits pour atteindre plus d'acheteurs.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={load}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/20 transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Actualiser
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingProduct(null);
                  setProductModalOpen(true);
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-white text-indigo-600 px-4 py-2.5 text-sm font-semibold hover:bg-white/90 transition-all shadow-lg"
              >
                <Plus className="w-4 h-4" />
                Publier une annonce
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 pb-12">
        {/* Statistics Cards */}
        {!loading && stats.total > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-xl bg-indigo-600">
                  <Package className="w-5 h-5 text-white" />
                </div>
                <span className="text-2xl font-bold text-gray-900">{stats.total}</span>
              </div>
              <p className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Total annonces</p>
              <p className="text-xs text-gray-500 mt-1">Toutes vos annonces</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-xl bg-emerald-600">
                  <CheckCircle className="w-5 h-5 text-white" />
                </div>
                <span className="text-2xl font-bold text-gray-900">{stats.approved}</span>
              </div>
              <p className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Approuvées</p>
              <p className="text-xs text-gray-500 mt-1">Annonces actives</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-xl bg-amber-600">
                  <Clock className="w-5 h-5 text-white" />
                </div>
                <span className="text-2xl font-bold text-gray-900">{stats.pending}</span>
              </div>
              <p className="text-sm font-semibold text-gray-700 uppercase tracking-wide">En attente</p>
              <p className="text-xs text-gray-500 mt-1">En cours de validation</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-xl bg-purple-600">
                  <DollarSign className="w-5 h-5 text-white" />
                </div>
                <span className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalValue)}</span>
              </div>
              <p className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Valeur totale</p>
              <p className="text-xs text-gray-500 mt-1">Valeur de vos annonces</p>
            </div>
          </div>
        )}

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
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4">
                <p className="text-sm font-semibold text-indigo-900">Classement promo du mois</p>
                <p className="text-sm text-indigo-700">
                  Position #{promoAnalytics.gamification.rank} sur {promoAnalytics.gamification.totalParticipants || 0} boutiques.
                </p>
              </div>
            ) : null}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 rounded-xl bg-indigo-600">
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
                  <div className="p-3 rounded-xl bg-rose-600">
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

        {!loading && isShopUser && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-8 space-y-5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Gestion des codes promo</h3>
                <p className="text-sm text-gray-500">
                  Créez des promos pour toute la boutique ou pour un produit spécifique.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <label htmlFor="promo-status-filter" className="text-xs font-semibold text-gray-500">
                  Filtre
                </label>
                <select
                  id="promo-status-filter"
                  value={promoCodeStatusFilter}
                  onChange={(e) => setPromoCodeStatusFilter(e.target.value)}
                  className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                >
                  <option value="active">Actifs</option>
                  <option value="all">Tous</option>
                  <option value="inactive">Inactifs</option>
                  <option value="expired">Expirés</option>
                  <option value="upcoming">À venir</option>
                </select>
              </div>
            </div>

            <form onSubmit={handleCreatePromoCode} className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                <input
                  type="text"
                  value={promoForm.code}
                  onChange={(e) => setPromoForm((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
                  placeholder="Code (ex: FIRST10)"
                  className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                  required
                />
                <select
                  value={promoForm.appliesTo}
                  onChange={(e) => setPromoForm((prev) => ({ ...prev, appliesTo: e.target.value, productId: '' }))}
                  className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                >
                  <option value="boutique">Toute la boutique</option>
                  <option value="product">Produit spécifique</option>
                </select>
                <select
                  value={promoForm.discountType}
                  onChange={(e) => setPromoForm((prev) => ({ ...prev, discountType: e.target.value }))}
                  className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                >
                  <option value="percentage">Pourcentage</option>
                  <option value="fixed">Montant fixe (FCFA)</option>
                </select>
                <input
                  type="number"
                  min="1"
                  value={promoForm.discountValue}
                  onChange={(e) => setPromoForm((prev) => ({ ...prev, discountValue: e.target.value }))}
                  placeholder={promoForm.discountType === 'percentage' ? 'Ex: 20 (%)' : 'Ex: 5000 FCFA'}
                  className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                  required
                />
                <input
                  type="number"
                  min="1"
                  value={promoForm.usageLimit}
                  onChange={(e) => setPromoForm((prev) => ({ ...prev, usageLimit: e.target.value }))}
                  placeholder="Limite d'utilisation"
                  className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                  required
                />
                <input
                  type="date"
                  value={promoForm.startDate}
                  onChange={(e) => setPromoForm((prev) => ({ ...prev, startDate: e.target.value }))}
                  className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                  required
                />
                <input
                  type="date"
                  value={promoForm.endDate}
                  onChange={(e) => setPromoForm((prev) => ({ ...prev, endDate: e.target.value }))}
                  className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                  required
                />
                {promoForm.appliesTo === 'product' ? (
                  <select
                    value={promoForm.productId}
                    onChange={(e) => setPromoForm((prev) => ({ ...prev, productId: e.target.value }))}
                    className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                    required
                  >
                    <option value="">Sélectionner un produit</option>
                    {promoEligibleProducts.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.title}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600">
                    <Tag className="w-4 h-4 text-indigo-600" />
                    Promo appliquée à tous vos produits
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between">
                <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={promoForm.isActive}
                    onChange={(e) => setPromoForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                    className="rounded border-gray-300"
                  />
                  Activer immédiatement
                </label>
                <button
                  type="submit"
                  disabled={promoSubmitting}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                  {promoSubmitting ? 'Création...' : 'Créer le code promo'}
                </button>
              </div>
            </form>

            <div className="space-y-2">
              {promoCodesLoading ? (
                <p className="text-sm text-gray-500">Chargement des codes promo...</p>
              ) : promoCodes.length === 0 ? (
                <p className="text-sm text-gray-500">Aucun code promo pour ce filtre.</p>
              ) : (
                promoCodes.map((promo) => (
                  <div key={promo.id} className="rounded-xl border border-gray-200 px-4 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">{promo.code}</p>
                      <p className="text-xs text-gray-500">
                        {promo.appliesTo === 'boutique' ? 'Boutique' : 'Produit'} ·
                        {' '}
                        {promo.discountType === 'percentage'
                          ? `${Number(promo.discountValue || 0).toLocaleString('fr-FR')}%`
                          : `${formatCurrency(promo.discountValue || 0)}`}
                        {' · '}
                        Utilisation: {promo.usedCount} / {promo.usageLimit}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatDate(promo.startDate)} → {formatDate(promo.endDate)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleTogglePromoCode(promo)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                        promo.isActive
                          ? 'bg-red-50 text-red-700 border border-red-200'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}
                    >
                      {promo.isActive ? 'Désactiver' : 'Activer'}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Advanced Search & Filters Panel */}
        {!loading && items.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-8">
            {/* Search Bar */}
            <div className="mb-6">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchDraft}
                  onChange={(e) => setSearchDraft(e.target.value)}
                  placeholder="Rechercher par titre ou description..."
                  className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
                {searchDraft && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchDraft('');
                      setSearchQuery('');
                    }}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>

            {/* Filter Toggle & Sort */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200 text-sm font-semibold text-gray-700 transition-all"
                >
                  <Filter className="w-4 h-4" />
                  Filtres avancés
                  {showAdvancedFilters ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>
                {(searchQuery ||
                  selectedCategories.length > 0 ||
                  priceMin ||
                  priceMax ||
                  dateFrom ||
                  dateTo ||
                  selectedStatuses.length > 0 ||
                  boostedFilter !== 'all' ||
                  installmentFilter !== 'all') && (
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-sm font-semibold text-red-700 transition-all"
                  >
                    <XCircle className="w-4 h-4" />
                    Réinitialiser
                  </button>
                )}
                
                {/* View Mode Toggle */}
                <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 border border-gray-200 dark:border-gray-700">
                  <button
                    type="button"
                    onClick={() => setViewMode('grid')}
                    className={`p-2 rounded-lg transition-all ${
                      viewMode === 'grid'
                        ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                    title="Vue grille"
                  >
                    <Grid3x3 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('list')}
                    className={`p-2 rounded-lg transition-all ${
                      viewMode === 'list'
                        ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                    title="Vue liste"
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-sm font-semibold text-gray-700">Trier par:</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-4 py-2 rounded-xl bg-gray-50 border border-gray-200 text-sm font-semibold text-gray-700 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                >
                  <option value="date-desc">Date (récent)</option>
                  <option value="date-asc">Date (ancien)</option>
                  <option value="price-desc">Prix (décroissant)</option>
                  <option value="price-asc">Prix (croissant)</option>
                  <option value="title-asc">Titre (A-Z)</option>
                  <option value="title-desc">Titre (Z-A)</option>
                  <option value="status-asc">Statut (A-Z)</option>
                  <option value="status-desc">Statut (Z-A)</option>
                </select>
              </div>
            </div>

            {/* Advanced Filters Panel */}
            {showAdvancedFilters && (
              <div className="border-t border-gray-200 pt-6 space-y-6">
                {/* Categories Filter */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Catégories
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {availableCategories.map((cat) => {
                      const isSelected = selectedCategories.includes(cat);
                      const categoryInfo = categoryGroups
                        .flatMap((g) => g.options)
                        .find((opt) => opt.value === cat);
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setSelectedCategories(selectedCategories.filter((c) => c !== cat));
                            } else {
                              setSelectedCategories([...selectedCategories, cat]);
                            }
                          }}
                          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                            isSelected
                              ? 'bg-indigo-600 text-white shadow-lg'
                              : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'
                          }`}
                        >
                          {categoryInfo?.label || cat}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Price Range */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Plage de prix (FCFA)
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <input
                        type="number"
                        value={priceMin}
                        onChange={(e) => setPriceMin(e.target.value)}
                        placeholder="Prix minimum"
                        className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                      />
                    </div>
                    <div>
                      <input
                        type="number"
                        value={priceMax}
                        onChange={(e) => setPriceMax(e.target.value)}
                        placeholder="Prix maximum"
                        className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* Date Range */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Plage de dates
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Du</label>
                      <input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Au</label>
                      <input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* Multiple Status Selection */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Statuts (sélection multiple)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(STATUS_LABELS)
                      .filter(([key]) => key !== 'all')
                      .map(([key, label]) => {
                        const isSelected = selectedStatuses.includes(key);
                        const Icon = STATUS_ICONS[key];
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                setSelectedStatuses(selectedStatuses.filter((s) => s !== key));
                                if (selectedStatuses.length === 1) {
                                  setStatusFilter('all');
                                }
                              } else {
                                setSelectedStatuses([...selectedStatuses, key]);
                                setStatusFilter('custom');
                              }
                            }}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                              isSelected
                                ? 'bg-indigo-600 text-white shadow-lg'
                                : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                            <span>{label}</span>
                          </button>
                        );
                      })}
                  </div>
                </div>

                {/* Installment Filter */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Paiement par tranche
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { key: 'all', label: 'Tous les produits' },
                      { key: 'enabled', label: 'Tranche activée' },
                      { key: 'disabled', label: 'Sans tranche' }
                    ].map((option) => {
                      const isSelected = installmentFilter === option.key;
                      return (
                        <button
                          key={option.key}
                          type="button"
                          onClick={() => setInstallmentFilter(option.key)}
                          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                            isSelected
                              ? 'bg-indigo-600 text-white shadow-lg'
                              : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'
                          }`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Save Filter */}
                <div className="border-t border-gray-200 pt-4">
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      value={filterName}
                      onChange={(e) => setFilterName(e.target.value)}
                      placeholder="Nom du filtre..."
                      className="flex-1 px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    />
                    <button
                      type="button"
                      onClick={saveCurrentFilter}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-all"
                    >
                      <Save className="w-4 h-4" />
                      Sauvegarder
                    </button>
                  </div>
                  {savedFilters.length > 0 && (
                    <div className="mt-4">
                      <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                        Filtres sauvegardés
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {savedFilters.map((filter) => (
                          <div
                            key={filter.id}
                            className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl"
                          >
                            <button
                              type="button"
                              onClick={() => loadSavedFilter(filter)}
                              className="text-sm font-semibold text-gray-700 hover:text-indigo-600 transition-colors"
                            >
                              {filter.name}
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteSavedFilter(filter.id)}
                              className="text-gray-400 hover:text-red-600 transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Status Tabs */}
        {!loading && items.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-8">
            <div className="flex flex-wrap gap-2">
              {Object.entries(STATUS_LABELS).map(([key, label]) => {
                const isActive = statusFilter === key && selectedStatuses.length === 0;
                const count = key === 'all' ? stats.total : stats[key] || 0;
                const Icon = key !== 'all' ? STATUS_ICONS[key] : Package;
                
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setStatusFilter(key);
                      setSelectedStatuses([]);
                    }}
                    className={`group relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-lg scale-105'
                        : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'
                    }`}
                  >
                    {key !== 'all' && <Icon className="w-4 h-4" />}
                    <span>{label}</span>
                    {count > 0 && (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-indigo-100 text-indigo-700'
                      }`}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 mb-8">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-bold text-red-800 mb-1">Erreur de chargement</h3>
                <p className="text-sm text-red-600">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && items.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
            <div className="mx-auto w-20 h-20 rounded-2xl bg-indigo-100 flex items-center justify-center mb-4">
              <Package className="w-10 h-10 text-indigo-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Aucune annonce</h3>
            <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">
              Commencez à vendre en publiant votre première annonce. C'est simple, rapide et gratuit !
            </p>
            <button
              type="button"
              onClick={() => {
                setEditingProduct(null);
                setProductModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 shadow-lg hover:shadow-xl transition-all"
            >
              <Plus className="w-4 h-4" />
              Publier ma première annonce
            </button>
          </div>
        )}

        {/* Empty State - Filtered */}
        {!loading && items.length > 0 && filteredItems.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
            <div className="mx-auto w-20 h-20 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
              <Filter className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Aucun résultat trouvé</h3>
            <p className="text-sm text-gray-500 mb-6">
              Aucune annonce ne correspond à vos critères de recherche et filtrage.
            </p>
            <button
              type="button"
              onClick={clearAllFilters}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border-2 border-indigo-200 bg-white text-indigo-600 font-semibold hover:bg-indigo-50 transition-all"
            >
              Réinitialiser les filtres
            </button>
          </div>
        )}

        {/* Bulk Actions Toolbar */}
        {!loading && paginatedItems.length > 0 && selectedProducts.size > 0 && (
          <div className="bg-indigo-600 text-white rounded-2xl border border-indigo-700 shadow-lg p-4 mb-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <CheckSquare className="w-5 h-5" />
                <span className="font-semibold">
                  {selectedProducts.size} produit{selectedProducts.size > 1 ? 's' : ''} sélectionné{selectedProducts.size > 1 ? 's' : ''}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleBulkEnable}
                  disabled={bulkActionLoading}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 text-white font-semibold hover:bg-emerald-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Power className="w-4 h-4" />
                  Réactiver
                </button>
                <button
                  type="button"
                  onClick={handleBulkDisable}
                  disabled={bulkActionLoading}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 text-white font-semibold hover:bg-amber-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <PowerOff className="w-4 h-4" />
                  Désactiver
                </button>
                <button
                  type="button"
                  onClick={handleBulkDelete}
                  disabled={bulkActionLoading}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-4 h-4" />
                  Supprimer
                </button>
                <button
                  type="button"
                  onClick={handleExportCSV}
                  disabled={bulkActionLoading}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 text-white font-semibold hover:bg-white/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Download className="w-4 h-4" />
                  CSV
                </button>
                <button
                  type="button"
                  onClick={handleExportPDF}
                  disabled={bulkActionLoading}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 text-white font-semibold hover:bg-white/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FileText className="w-4 h-4" />
                  PDF
                </button>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 text-white font-semibold hover:bg-white/20 transition-all"
                >
                  <X className="w-4 h-4" />
                  Annuler
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Products Grid */}
        {!loading && paginatedItems.length > 0 && (
          <>
            {/* Selection Mode Toggle and Select All */}
            <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center gap-4">
                {/* Selection Mode Toggle */}
                <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 p-1">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectionMode('single');
                      setSelectedProducts(new Set());
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      selectionMode === 'single'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                    title="Sélection unique"
                  >
                    Un seul
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectionMode('multiple');
                      setSelectedProducts(new Set());
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      selectionMode === 'multiple'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                    title="Sélection multiple"
                  >
                    Plusieurs
                  </button>
                </div>

                {/* Select All Button (only in multiple mode) */}
                {selectionMode === 'multiple' && (
                  <button
                    type="button"
                    onClick={selectAllProducts}
                    className="flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-indigo-600 transition-colors"
                  >
                    {selectedProducts.size === paginatedItems.length ? (
                      <CheckSquare className="w-5 h-5 text-indigo-600" />
                    ) : (
                      <Square className="w-5 h-5 text-gray-400" />
                    )}
                    <span>
                      {selectedProducts.size === paginatedItems.length
                        ? 'Tout désélectionner'
                        : `Tout sélectionner (${paginatedItems.length})`}
                    </span>
                  </button>
                )}
              </div>

              {selectedProducts.size > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">
                    {selectedProducts.size} produit{selectedProducts.size > 1 ? 's' : ''} sélectionné{selectedProducts.size > 1 ? 's' : ''}
                    {selectionMode === 'multiple' && ` sur ${paginatedItems.length}`}
                  </span>
                </div>
              )}
            </div>

            <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'space-y-4'}>
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

                if (viewMode === 'list') {
                  // List View
                  return (
                    <div
                      key={productId}
                      className={`bg-white rounded-xl border-2 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden relative ${
                        isSelected
                          ? 'border-indigo-500 ring-2 ring-indigo-200'
                          : isTopPerformer
                          ? 'border-yellow-400 ring-2 ring-yellow-200'
                          : 'border-gray-100'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row gap-4 p-4">
                        {/* Selection Checkbox */}
                        <div className="absolute top-4 left-4 z-30">
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
                            className={`p-2 rounded-lg backdrop-blur-sm transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg'
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

                        {isTopPerformer && (
                          <div className="absolute top-4 right-4 z-20">
                            <div className="px-2 py-1 rounded-lg bg-gradient-to-r from-yellow-400 to-yellow-500 text-white text-xs font-bold shadow-lg flex items-center gap-1">
                              <TrendingUp className="w-3 h-3" />
                              Top
                            </div>
                          </div>
                        )}

                        {/* Product Image - List View */}
                        <div className="relative w-full sm:w-48 h-48 bg-gray-100 overflow-hidden rounded-lg flex-shrink-0">
                          {mainImage ? (
                            <img
                              src={mainImage}
                              alt={product.title}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ImageIcon className="w-12 h-12 text-gray-400" />
                            </div>
                          )}
                      {/* Status Badge */}
                      <div className="absolute top-2 right-2 flex flex-col gap-2">
                        <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg ${statusStyle.badge} text-white shadow-lg backdrop-blur-sm`}>
                          <StatusIcon className="w-3 h-3" />
                          <span className="text-xs font-bold uppercase tracking-wide">
                            {STATUS_LABELS[product.status] || product.status}
                          </span>
                        </div>
                        {/* Boosted Badge */}
                        {product.boosted && (
                          <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg backdrop-blur-sm">
                            <Zap className="w-3 h-3" />
                            <span className="text-xs font-bold uppercase tracking-wide">Boosté</span>
                          </div>
                        )}
                      </div>
                      {/* Image Count Badge */}
                          {product.images?.length > 1 && (
                            <div className="absolute top-2 left-2">
                              <div className="px-2 py-1 rounded-lg bg-black/50 backdrop-blur-sm text-white text-xs font-bold">
                                {product.images.length} photo{product.images.length > 1 ? 's' : ''}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Product Info - List View */}
                        <div className="flex-1 flex flex-col gap-3 pt-8 sm:pt-0">
                          <div className="flex-1">
                            <h3 className="font-bold text-lg text-gray-900 mb-2 line-clamp-2">
                              {product.title}
                            </h3>
                            <div className="flex items-baseline gap-2 mb-3">
                              <span className="text-2xl font-black text-indigo-600">
                                {formatCurrency(product.price)}
                              </span>
                              {product.priceBeforeDiscount && product.priceBeforeDiscount > product.price && (
                                <span className="text-sm text-gray-400 line-through">
                                  {formatCurrency(product.priceBeforeDiscount)}
                                </span>
                              )}
                            </div>
                            <div className={`rounded-lg border p-2 mb-3 ${statusStyle.card}`}>
                              <p className="text-xs font-medium leading-relaxed">
                                {STATUS_MESSAGES[product.status] || 'Statut en cours de mise à jour.'}
                              </p>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
                              {product.category && (
                                <div className="flex items-center gap-1">
                                  <Package className="w-3 h-3" />
                                  <span className="capitalize">{product.category}</span>
                                </div>
                              )}
                              {product.boosted && (
                                <div className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-semibold">
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
                          </div>

                          {/* Actions - List View */}
                          <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                            {product.status === 'approved' && (
                              <Link
                                to={buildProductPath(product)}
                                {...externalLinkProps}
                                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 text-sm font-semibold hover:bg-indigo-100 transition-all"
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
                              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-purple-200 bg-purple-50 text-purple-700 text-sm font-semibold hover:bg-purple-100 transition-all"
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
                              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white text-gray-700 text-sm font-semibold hover:bg-gray-50 transition-all"
                            >
                              <Edit className="w-4 h-4" />
                              Modifier
                            </button>
                            {product.status !== 'disabled' ? (
                              <button
                                onClick={() => updateStatus(product.slug || product._id, 'disable')}
                                disabled={updatingId === product._id}
                                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm font-semibold hover:bg-red-100 transition-all disabled:opacity-50"
                                type="button"
                              >
                                <PowerOff className="w-4 h-4" />
                                Désactiver
                              </button>
                            ) : (
                              <button
                                onClick={() => updateStatus(product.slug || product._id, 'enable')}
                                disabled={updatingId === product._id}
                                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 text-sm font-semibold hover:bg-emerald-100 transition-all disabled:opacity-50"
                                type="button"
                              >
                                <Power className="w-4 h-4" />
                                Réactiver
                              </button>
                            )}
                          </div>

                          {/* Payment Form - List View */}
                          {product.status !== 'disabled' && (
                            <div className="pt-2 border-t border-gray-100">
                              <PaymentForm product={product} onSubmitted={load} />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                }

                // Grid View (existing code)
                return (
                  <div
                    key={productId}
                    className={`bg-white rounded-2xl border-2 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden relative ${
                      isSelected
                        ? 'border-indigo-500 ring-2 ring-indigo-200'
                        : isTopPerformer
                        ? 'border-yellow-400 ring-2 ring-yellow-200'
                        : 'border-gray-100'
                    }`}
                  >
                    {isTopPerformer && (
                      <div className="absolute top-3 right-3 z-20">
                        <div className="px-2 py-1 rounded-lg bg-gradient-to-r from-yellow-400 to-yellow-500 text-white text-xs font-bold shadow-lg flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" />
                          Top
                        </div>
                      </div>
                    )}
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
                            ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg'
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
                    <div className="relative aspect-square bg-gray-100 overflow-hidden">
                      {mainImage ? (
                        <img
                          src={mainImage}
                          alt={product.title}
                          className="w-full h-full object-cover"
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
                          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg backdrop-blur-sm">
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
                          <span className="text-xl font-black text-indigo-600">
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

                      {/* Metadata */}
                      <div className="flex items-center gap-4 text-xs text-gray-500 pt-2 border-t border-gray-100">
                        {product.category && (
                          <div className="flex items-center gap-1">
                            <Package className="w-3 h-3" />
                            <span className="capitalize">{product.category}</span>
                          </div>
                        )}
                        {product.boosted && (
                          <div className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-semibold">
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
                        {product.status === 'approved' && (
                          <Link
                            to={buildProductPath(product)}
                            {...externalLinkProps}
                            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 text-sm font-semibold hover:bg-indigo-100 transition-all"
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
                          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-purple-200 bg-purple-50 text-purple-700 text-sm font-semibold hover:bg-purple-100 transition-all"
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
                          <PaymentForm product={product} onSubmitted={load} />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-between bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <p className="text-sm text-gray-600">
                  Affichage <span className="font-bold text-gray-900">{currentRangeStart}</span> -{' '}
                  <span className="font-bold text-gray-900">{currentRangeEnd}</span> sur{' '}
                  <span className="font-bold text-gray-900">{filteredItems.length}</span> annonce{filteredItems.length > 1 ? 's' : ''}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all inline-flex items-center gap-2"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Précédent
                  </button>
                  <div className="flex items-center gap-2 px-4">
                    <span className="text-sm font-medium text-gray-700">
                      Page <span className="font-bold text-gray-900">{currentPage}</span> sur{' '}
                      <span className="font-bold text-gray-900">{totalPages}</span>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all inline-flex items-center gap-2"
                  >
                    Suivant
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Product Form Modal — full-screen on mobile for easier use */}
      {isProductModalOpen && (
        <div className={`fixed inset-0 z-50 flex ${isMobile ? 'flex-col' : 'items-center justify-center px-4 py-6'}`}>
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-md transition-opacity"
            onClick={handleModalClose}
            aria-hidden
          />
          <div
            className={`relative flex flex-col bg-white shadow-2xl overflow-hidden ${isMobile ? 'w-full h-full max-h-full rounded-none border-0' : 'w-full max-w-5xl rounded-3xl border border-gray-100 max-h-[90vh]'}`}
            onClick={(event) => event.stopPropagation()}
          >
            {/* Modal Header */}
            <div className={`bg-indigo-600 text-white flex-shrink-0 ${isMobile ? 'px-4 py-4 safe-area-top' : 'px-6 py-5'}`}>
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
            <div className={`flex-1 overflow-y-auto min-h-0 ${isMobile ? 'p-4' : 'p-6'}`}>
              <ProductForm
                initialValues={editingProduct}
                productId={editingProduct?._id}
                onCreated={() => {
                  load();
                  handleModalClose();
                  showToast('Annonce créée avec succès !', { variant: 'success' });
                }}
                onUpdated={() => {
                  load();
                  handleModalClose();
                  showToast('Annonce modifiée avec succès !', { variant: 'success' });
                }}
              />
            </div>
          </div>
        </div>
      )}

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
