import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search,
  Filter,
  X,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Star,
  MapPin,
  DollarSign,
  Tag,
  Store,
  Sparkles,
  RefreshCw,
  Heart,
  TrendingUp,
  CheckCircle
} from 'lucide-react';
import api from '../services/api';
import ProductMasonryGrid from '../components/ProductMasonryGrid';
import ProductCardSkeleton from '../components/ProductCardSkeleton';
import useCategories from '../hooks/useCategories';
import { recordProductView } from '../utils/recentViews';
import { useToast } from '../context/ToastContext';
import { useAppSettings } from '../context/AppSettingsContext';
import NetworkFallbackCard from '../components/ui/NetworkFallbackCard';
import useNetworkProfile from '../hooks/useNetworkProfile';
import { loadOfflineSnapshot, saveOfflineSnapshot } from '../utils/offlineSnapshots';
const PAGE_SIZE = 12;

export default function AdvancedSearch() {
  const { categoryGroups } = useCategories();
  const { showToast } = useToast();
  const { cities, t } = useAppSettings();
  const [searchParams, setSearchParams] = useSearchParams();
  const [offlineSnapshotActive, setOfflineSnapshotActive] = useState(false);
  const {
    rapid3GActive,
    compactProductsPageSize,
    shouldUseOfflineSnapshot,
    offlineBannerText,
    rapid3GBannerText
  } = useNetworkProfile();
  
  // Filter states
  const initialSearchQuery = searchParams.get('q') || searchParams.get('search') || '';
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [searchDraft, setSearchDraft] = useState(initialSearchQuery);
  const [category, setCategory] = useState(searchParams.get('category') || '');
  const [city, setCity] = useState(searchParams.get('city') || '');
  const [condition, setCondition] = useState(searchParams.get('condition') || '');
  const [minPrice, setMinPrice] = useState(searchParams.get('minPrice') || '');
  const [maxPrice, setMaxPrice] = useState(searchParams.get('maxPrice') || '');
  const [certified, setCertified] = useState(searchParams.get('certified') || '');
  const [shopVerified, setShopVerified] = useState(searchParams.get('shopVerified') || '');
  const [hasDiscount, setHasDiscount] = useState(searchParams.get('hasDiscount') === 'true');
  const [minRating, setMinRating] = useState(searchParams.get('minRating') || '');
  const [minFavorites, setMinFavorites] = useState(searchParams.get('minFavorites') || '');
  const [minSales, setMinSales] = useState(searchParams.get('minSales') || '');
  const [sort, setSort] = useState(searchParams.get('sort') || 'new');
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1);
  const loadMoreSentinelRef = useRef(null);
  const infiniteScrollLockRef = useRef(0);

  // UI states
  const [showFilters, setShowFilters] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    basic: true,
    price: false,
    quality: false,
    location: false
  });
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [totalPages, setTotalPages] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const pageSize = compactProductsPageSize || PAGE_SIZE;
  const conditionOptions = [
    { value: 'new', label: t('search.conditionNew', 'Neuf') },
    { value: 'used', label: t('search.conditionUsed', 'Occasion') }
  ];
  const sortOptions = [
    { value: 'new', label: t('search.sortNewest', 'Plus récents') },
    { value: 'price_asc', label: t('search.sortPriceAsc', 'Prix croissant') },
    { value: 'price_desc', label: t('search.sortPriceDesc', 'Prix décroissant') },
    { value: 'discount', label: t('search.sortDiscount', 'Meilleures remises') }
  ];
  const cityOptions = useMemo(() => {
    const dynamicCities = Array.isArray(cities)
      ? cities
          .map((item) => String(typeof item === 'string' ? item : item?.name || '').trim())
          .filter(Boolean)
      : [];
    if (city && !dynamicCities.includes(city)) {
      dynamicCities.push(city);
    }
    return Array.from(new Set(dynamicCities));
  }, [cities, city]);
  const snapshotKey = useMemo(
    () =>
      [
        'advanced-search',
        searchQuery || 'none',
        category || 'all',
        city || 'all',
        condition || 'all',
        minPrice || '0',
        maxPrice || 'max',
        certified || 'all',
        shopVerified || 'all',
        hasDiscount ? 'discount' : 'standard',
        minRating || '0',
        minFavorites || '0',
        minSales || '0',
        sort || 'new'
      ].join(':'),
    [
      searchQuery,
      category,
      city,
      condition,
      minPrice,
      maxPrice,
      certified,
      shopVerified,
      hasDiscount,
      minRating,
      minFavorites,
      minSales,
      sort
    ]
  );

  // Build query params from filters
  const buildQueryParams = useCallback(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (category) params.set('category', category);
    if (city) params.set('city', city);
    if (condition) params.set('condition', condition);
    if (minPrice) params.set('minPrice', minPrice);
    if (maxPrice) params.set('maxPrice', maxPrice);
    if (certified) params.set('certified', certified);
    if (shopVerified) params.set('shopVerified', shopVerified);
    if (hasDiscount) params.set('hasDiscount', 'true');
    if (minRating) params.set('minRating', minRating);
    if (minFavorites) params.set('minFavorites', minFavorites);
    if (minSales) params.set('minSales', minSales);
    if (sort) params.set('sort', sort);
    if (page > 1) params.set('page', String(page));
    return params;
  }, [searchQuery, category, city, condition, minPrice, maxPrice, certified, shopVerified, hasDiscount, minRating, minFavorites, minSales, sort, page]);

  // Update URL when filters change
  useEffect(() => {
    const params = buildQueryParams();
    if (params.toString() === searchParams.toString()) return;
    setSearchParams(params, { replace: true });
  }, [buildQueryParams, searchParams, setSearchParams]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const nextQuery = searchDraft.trim();
      setSearchQuery((current) => (current === nextQuery ? current : nextQuery));
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchDraft]);

  // Fetch products
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = buildQueryParams();
      params.delete('page'); // Don't send page in query string for API
      
      const apiParams = {};
      params.forEach((value, key) => {
        if (key !== 'page') apiParams[key] = value;
      });
      apiParams.page = page;
      apiParams.limit = pageSize;

      const { data } = await api.get('/products/public', { params: apiParams });
      const fetchedItems = Array.isArray(data) ? data : data?.items || [];
      const pagination = data?.pagination || {};
      
      setItems((prev) => (page > 1 ? [...prev, ...fetchedItems] : fetchedItems));
      setTotalResults(pagination.total || fetchedItems.length);
      setTotalPages(Math.max(1, Number(pagination.pages) || 1));
      setOfflineSnapshotActive(false);
    } catch (e) {
      if (shouldUseOfflineSnapshot) {
        const snapshot = await loadOfflineSnapshot(snapshotKey);
        if (snapshot && typeof snapshot === 'object') {
          setItems(Array.isArray(snapshot.items) ? snapshot.items : []);
          setTotalResults(Number(snapshot.totalResults) || 0);
          setTotalPages(Math.max(1, Number(snapshot.totalPages) || 1));
          setOfflineSnapshotActive(true);
          setError('');
          return;
        }
      }
      setError(e.response?.data?.message || e.message || t('search.loadError', 'Impossible de charger les produits.'));
      showToast(t('search.searchError', 'Erreur lors de la recherche'), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [buildQueryParams, page, pageSize, shouldUseOfflineSnapshot, showToast, snapshotKey, t]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return undefined;
    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel) return undefined;
    if (loading || page >= totalPages) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        const now = Date.now();
        if (now - infiniteScrollLockRef.current < 400) return;
        infiniteScrollLockRef.current = now;
        setPage((prev) => Math.min(prev + 1, totalPages));
      },
      { rootMargin: '720px 0px 720px 0px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loading, page, totalPages]);

  useEffect(() => {
    if (!items.length || shouldUseOfflineSnapshot) return;
    saveOfflineSnapshot(snapshotKey, {
      items,
      totalResults,
      totalPages
    });
  }, [items, shouldUseOfflineSnapshot, snapshotKey, totalPages, totalResults]);

  // Count active filters
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (searchQuery) count++;
    if (category) count++;
    if (city) count++;
    if (condition) count++;
    if (minPrice || maxPrice) count++;
    if (certified) count++;
    if (shopVerified) count++;
    if (hasDiscount) count++;
    if (minRating) count++;
    if (minFavorites) count++;
    if (minSales) count++;
    return count;
  }, [searchQuery, category, city, condition, minPrice, maxPrice, certified, shopVerified, hasDiscount, minRating, minFavorites, minSales]);

  // Clear all filters
  const clearAllFilters = () => {
    setSearchQuery('');
    setSearchDraft('');
    setCategory('');
    setCity('');
    setCondition('');
    setMinPrice('');
    setMaxPrice('');
    setCertified('');
    setShopVerified('');
    setHasDiscount(false);
    setMinRating('');
    setMinFavorites('');
    setMinSales('');
    setSort('new');
    setPage(1);
  };

  const submitSearch = (event) => {
    event.preventDefault();
    setSearchQuery(searchDraft.trim());
    setPage(1);
  };

  const activeFilterChips = [
    searchQuery && {
      key: 'query',
      label: `“${searchQuery}”`,
      clear: () => {
        setSearchDraft('');
        setSearchQuery('');
      }
    },
    category && { key: 'category', label: category, clear: () => setCategory('') },
    city && { key: 'city', label: city, clear: () => setCity('') },
    condition && {
      key: 'condition',
      label: conditionOptions.find((item) => item.value === condition)?.label || condition,
      clear: () => setCondition('')
    },
    (minPrice || maxPrice) && {
      key: 'price',
      label: `${minPrice || '0'} – ${maxPrice || '∞'} F`,
      clear: () => {
        setMinPrice('');
        setMaxPrice('');
      }
    },
    shopVerified === 'true' && {
      key: 'verified',
      label: t('search.verifiedShops', 'Boutiques vérifiées'),
      clear: () => setShopVerified('')
    },
    hasDiscount && {
      key: 'discount',
      label: t('search.withDiscount', 'Avec remise'),
      clear: () => setHasDiscount(false)
    }
  ].filter(Boolean);

  // Toggle section
  const toggleSection = (section) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Filter section component
  const FilterSection = ({ title, icon: Icon, section, children }) => {
    const isExpanded = expandedSections[section];
    return (
      <div className="border-b border-gray-200 last:border-b-0">
        <button
          type="button"
          onClick={() => toggleSection(section)}
          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Icon className="w-4 h-4 text-gray-500" />
            <span className="font-semibold text-gray-900">{title}</span>
          </div>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          )}
        </button>
        {isExpanded && <div className="px-4 pb-4 space-y-3">{children}</div>}
      </div>
    );
  };

  return (
    <div className="hd-search-flow hd-products-flow hd-commerce-shell min-h-screen">
      {/* Header */}
      <div className="border-b border-neutral-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <div className="mb-5 flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#fff0e4] text-[#e85d00]">
              <Search className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#e85d00]">HDMarket</p>
              <h1 className="text-2xl font-black tracking-tight text-neutral-950 sm:text-3xl">
                {t('search.title', 'Rechercher sur HDMarket')}
              </h1>
              <p className="mt-1 text-sm font-medium text-neutral-500">
                {t('search.subtitle', 'Produits, boutiques et bonnes affaires, au même endroit.')}
              </p>
            </div>
          </div>

          <form onSubmit={submitSearch} className="flex max-w-4xl gap-2" role="search">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
                value={searchDraft}
                onChange={(event) => setSearchDraft(event.target.value)}
                placeholder={t('search.placeholder', 'Rechercher un produit, une marque ou une boutique…')}
                className="h-[52px] w-full rounded-xl border border-neutral-300 bg-white py-3 pl-12 pr-11 text-sm font-semibold text-neutral-950 outline-none transition focus:border-[#e85d00] focus:ring-4 focus:ring-orange-100"
                autoComplete="off"
                enterKeyHint="search"
            />
              {searchDraft ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchDraft('');
                    setSearchQuery('');
                  }}
                  className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-neutral-950"
                  aria-label={t('search.clearQuery', 'Effacer la recherche')}
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
            <button
              type="submit"
              className="inline-flex h-[52px] shrink-0 items-center justify-center gap-2 rounded-xl bg-black px-5 text-sm font-black text-white transition hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-neutral-300"
            >
              <Search className="h-4 w-4" />
              <span className="hidden sm:inline">{t('search.submit', 'Rechercher')}</span>
            </button>
          </form>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Filters Sidebar */}
          <aside className={`lg:w-80 flex-shrink-0 ${showFilters ? 'block' : 'hidden lg:block'}`}>
            <div className="hd-search-panel rounded-2xl">
              {/* Filters Header */}
              <div className="p-4 border-b border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <SlidersHorizontal className="w-5 h-5" />
                    {t('search.filters', 'Filtres')}
                  </h2>
                  {activeFiltersCount > 0 && (
                    <button
                      type="button"
                      onClick={clearAllFilters}
                      className="text-xs font-bold text-[#B45309] hover:text-[#e85d00]"
                    >
                      {t('search.clearAll', 'Tout effacer')}
                    </button>
                  )}
                </div>
                {activeFiltersCount > 0 && (
                  <p className="text-xs text-gray-500">
                    {t('search.filtersActive', '{count} filtre(s) actif(s)').replace(
                      '{count}',
                      String(activeFiltersCount)
                    )}
                  </p>
                )}
              </div>

              {/* Filter Sections */}
              <div className="max-h-[calc(100vh-200px)] overflow-y-auto">
                {/* Basic Filters */}
                <FilterSection title={t('search.category', 'Catégorie')} icon={Tag} section="basic">
                  <select
                    value={category}
                    onChange={(e) => {
                      setCategory(e.target.value);
                      setPage(1);
                    }}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-neutral-500 focus:border-transparent"
                  >
                    <option value="">{t('search.allCategories', 'Toutes les catégories')}</option>
                    {categoryGroups.map((group) => (
                      <optgroup key={group.id} label={group.label}>
                        {group.options.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </FilterSection>

                {/* Price Range */}
                <FilterSection title={t('search.price', 'Prix')} icon={DollarSign} section="price">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Min
                      </label>
                      <input
                        type="number"
                        value={minPrice}
                        onChange={(e) => {
                          setMinPrice(e.target.value);
                          setPage(1);
                        }}
                        placeholder="0"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-neutral-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Max
                      </label>
                      <input
                        type="number"
                        value={maxPrice}
                        onChange={(e) => {
                          setMaxPrice(e.target.value);
                          setPage(1);
                        }}
                        placeholder="∞"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-neutral-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                </FilterSection>

                {/* Quality Filters */}
                <FilterSection title={t('search.qualityOptions', 'Qualité et options')} icon={Sparkles} section="quality">
                  <div className="space-y-3">
                    {/* Condition */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-2">
                        {t('search.condition', 'État')}
                      </label>
                      <div className="space-y-2">
                        {conditionOptions.map((cond) => (
                          <label key={cond.value} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="condition"
                              value={cond.value}
                              checked={condition === cond.value}
                              onChange={(e) => {
                                setCondition(e.target.value);
                                setPage(1);
                              }}
                              className="w-4 h-4 text-neutral-600 focus:ring-neutral-500"
                            />
                            <span className="text-sm text-gray-700">{cond.label}</span>
                          </label>
                        ))}
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="condition"
                            value=""
                            checked={condition === ''}
                            onChange={() => {
                              setCondition('');
                              setPage(1);
                            }}
                            className="w-4 h-4 text-neutral-600 focus:ring-neutral-500"
                          />
                          <span className="text-sm text-gray-700">{t('search.all', 'Tous')}</span>
                        </label>
                      </div>
                    </div>

                    {/* Certified */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-2">
                        {t('search.certification', 'Certification')}
                      </label>
                      <select
                        value={certified}
                        onChange={(e) => {
                          setCertified(e.target.value);
                          setPage(1);
                        }}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-neutral-500 focus:border-transparent"
                      >
                        <option value="">{t('search.all', 'Tous')}</option>
                        <option value="true">{t('search.certifiedOnly', 'Certifiés uniquement')}</option>
                        <option value="false">{t('search.notCertified', 'Non certifiés')}</option>
                      </select>
                    </div>

                    {/* Shop Verified */}
                    <div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={shopVerified === 'true'}
                          onChange={(e) => {
                            setShopVerified(e.target.checked ? 'true' : '');
                            setPage(1);
                          }}
                          className="w-4 h-4 text-neutral-600 focus:ring-neutral-500 rounded"
                        />
                        <span className="text-sm text-gray-700 flex items-center gap-1">
                          <CheckCircle className="w-4 h-4 text-emerald-500" />
                          {t('search.verifiedOnly', 'Boutiques vérifiées uniquement')}
                        </span>
                      </label>
                    </div>

                    {/* Has Discount */}
                    <div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={hasDiscount}
                          onChange={(e) => {
                            setHasDiscount(e.target.checked);
                            setPage(1);
                          }}
                          className="w-4 h-4 text-neutral-600 focus:ring-neutral-500 rounded"
                        />
                        <span className="text-sm text-gray-700 flex items-center gap-1">
                          <Tag className="w-4 h-4 text-amber-500" />
                          {t('search.withDiscount', 'Avec remise')}
                        </span>
                      </label>
                    </div>

                    {/* Min Rating */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-2">
                        {t('search.minimumRating', 'Note minimum')}
                      </label>
                      <div className="flex items-center gap-2">
                        <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                        <input
                          type="number"
                          min="0"
                          max="5"
                          step="0.5"
                          value={minRating}
                          onChange={(e) => {
                            setMinRating(e.target.value);
                            setPage(1);
                          }}
                          placeholder="0"
                          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-neutral-500 focus:border-transparent"
                        />
                      </div>
                    </div>

                    {/* Min Favorites */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-2">
                        {t('search.minimumFavorites', 'Minimum de favoris')}
                      </label>
                      <div className="flex items-center gap-2">
                        <Heart className="w-4 h-4 text-red-500" />
                        <input
                          type="number"
                          min="0"
                          value={minFavorites}
                          onChange={(e) => {
                            setMinFavorites(e.target.value);
                            setPage(1);
                          }}
                          placeholder="0"
                          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-neutral-500 focus:border-transparent"
                        />
                      </div>
                    </div>

                    {/* Min Sales */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-2">
                        {t('search.minimumSales', 'Minimum de ventes')}
                      </label>
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-emerald-500" />
                        <input
                          type="number"
                          min="0"
                          value={minSales}
                          onChange={(e) => {
                            setMinSales(e.target.value);
                            setPage(1);
                          }}
                          placeholder="0"
                          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-neutral-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                  </div>
                </FilterSection>

                {/* Location */}
                <FilterSection title={t('search.location', 'Localisation')} icon={MapPin} section="location">
                  <select
                    value={city}
                    onChange={(e) => {
                      setCity(e.target.value);
                      setPage(1);
                    }}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-neutral-500 focus:border-transparent"
                  >
                    <option value="">{t('search.allCities', 'Toutes les villes')}</option>
                    {cityOptions.map((cityName) => (
                      <option key={cityName} value={cityName}>
                        {cityName}
                      </option>
                    ))}
                  </select>
                </FilterSection>
              </div>
            </div>
          </aside>

          {/* Results */}
          <main className="flex-1 min-w-0">
            {(offlineSnapshotActive || rapid3GActive) && (
              <section
                className={`mb-4 rounded-2xl border px-4 py-3 text-sm shadow-sm ${
                  offlineSnapshotActive
                    ? 'border-amber-200 bg-amber-50 text-amber-800'
                    : 'border-sky-200 bg-sky-50 text-sky-800'
                }`}
              >
                <p className="font-semibold">
                  {offlineSnapshotActive ? offlineBannerText : rapid3GBannerText}
                </p>
              </section>
            )}
            {/* Results Header */}
            <div className="hd-search-panel mb-6 rounded-2xl p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-lg font-black text-gray-900">
                    {loading
                      ? t('search.searching', 'Recherche en cours…')
                      : t('search.resultsCount', '{count} résultat(s)').replace('{count}', String(totalResults))}
                  </h2>
                  {activeFiltersCount > 0 && (
                    <p className="text-sm text-gray-500 mt-1">
                      {t('search.filtersApplied', '{count} filtre(s) appliqué(s)').replace(
                        '{count}',
                        String(activeFiltersCount)
                      )}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {/* Mobile Filter Toggle */}
                  <button
                    type="button"
                    onClick={() => setShowFilters(!showFilters)}
                    className="hd-soft-button inline-flex items-center gap-2 px-4 py-2 text-sm font-bold lg:hidden"
                  >
                    <Filter className="w-4 h-4" />
                    {t('search.filters', 'Filtres')}
                    {activeFiltersCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700 text-xs font-bold">
                        {activeFiltersCount}
                      </span>
                    )}
                  </button>

                  {/* Sort */}
                  <select
                    value={sort}
                    onChange={(e) => {
                      setSort(e.target.value);
                      setPage(1);
                    }}
                    className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 focus:ring-2 focus:ring-neutral-500 focus:border-transparent"
                  >
                    {sortOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {activeFilterChips.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2 border-t border-neutral-100 pt-4">
                  {activeFilterChips.map((chip) => (
                    <button
                      key={chip.key}
                      type="button"
                      onClick={() => {
                        chip.clear();
                        setPage(1);
                      }}
                      className="inline-flex min-h-9 items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 text-xs font-bold text-orange-900 transition hover:border-[#e85d00] hover:bg-orange-100"
                      aria-label={`${t('search.removeFilter', 'Retirer le filtre')} ${chip.label}`}
                    >
                      {chip.label}
                      <X className="h-3.5 w-3.5" />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            {/* Error */}
            {error && !offlineSnapshotActive && (
              <div className="mb-6">
                <NetworkFallbackCard
                  title={t('search.resultsLoadError', 'Impossible de charger les résultats.')}
                  message={t('search.resultsLoadErrorHint', 'Les résultats mettent plus de temps à charger. Réessayez dans un instant.')}
                  onRetry={fetchProducts}
                  retryLabel={t('search.retry', 'Réessayer')}
                  refreshLabel={t('search.refresh', 'Actualiser la page')}
                />
              </div>
            )}

            {/* Loading */}
            {loading && items.length === 0 ? (
              <ProductCardSkeleton count={10} viewMode="masonry" />
            ) : items.length > 0 ? (
              <>
                {/* Products Grid */}
                <ProductMasonryGrid products={items} onProductClick={recordProductView} />
                {loading && items.length > 0 && (
                  <div className="flex justify-center py-4">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-600 border-t-transparent" />
                  </div>
                )}
                <div ref={loadMoreSentinelRef} className="h-8" aria-hidden="true" />

                {/* Pagination */}
                {page < totalPages && (
                  <div className="mt-4 flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={loading}
                      className="rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-black text-gray-500 shadow-sm active:scale-95 disabled:cursor-wait disabled:opacity-60"
                    >
                      {t('search.loadMore', 'Charger plus')}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
                <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-gray-900 mb-2">{t('search.noResults', 'Aucun résultat')}</h3>
                <p className="text-sm text-gray-500 mb-6">
                  {t('search.noResultsHint', 'Aucun produit ne correspond à vos critères de recherche.')}
                </p>
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="hd-primary-button inline-flex items-center gap-2 px-6 py-3 font-bold"
                >
                  <RefreshCw className="w-4 h-4" />
                  {t('search.resetFilters', 'Réinitialiser les filtres')}
                </button>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
