import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
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
  Save,
  Trash2,
  Heart,
  TrendingUp,
  CheckCircle
} from 'lucide-react';
import api from '../services/api';
import ProductCard from '../components/ProductCard';
import { allCategoryOptions } from '../data/categories';
import categoryGroups from '../data/categories';
import { recordProductView } from '../utils/recentViews';
import { useToast } from '../context/ToastContext';
import { useAppSettings } from '../context/AppSettingsContext';
const CONDITIONS = [
  { value: 'new', label: 'Neuf' },
  { value: 'used', label: 'Occasion' }
];
const SORT_OPTIONS = [
  { value: 'new', label: 'Plus récents' },
  { value: 'price_asc', label: 'Prix croissant' },
  { value: 'price_desc', label: 'Prix décroissant' },
  { value: 'discount', label: 'Meilleures remises' }
];

const PAGE_SIZE = 12;

export default function AdvancedSearch() {
  const { showToast } = useToast();
  const { cities } = useAppSettings();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
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
  const cityOptions = useMemo(
    () =>
      Array.isArray(cities) && cities.length
        ? cities.map((item) => item.name).filter(Boolean)
        : ['Brazzaville', 'Pointe-Noire', 'Ouesso', 'Oyo'],
    [cities]
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
    setSearchParams(params, { replace: true });
  }, [buildQueryParams, setSearchParams]);

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
      apiParams.limit = PAGE_SIZE;

      const { data } = await api.get('/products/public', { params: apiParams });
      const fetchedItems = Array.isArray(data) ? data : data?.items || [];
      const pagination = data?.pagination || {};
      
      setItems(fetchedItems);
      setTotalResults(pagination.total || fetchedItems.length);
      setTotalPages(Math.max(1, Number(pagination.pages) || 1));
    } catch (e) {
      setError(e.response?.data?.message || e.message || 'Impossible de charger les produits.');
      showToast('Erreur lors de la recherche', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [buildQueryParams, page, showToast]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-indigo-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 rounded-xl bg-white/20 backdrop-blur-sm">
              <Search className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Recherche avancée</h1>
              <p className="text-white/90 text-sm mt-1">
                Trouvez exactement ce que vous cherchez avec nos filtres avancés
              </p>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Rechercher un produit..."
              className="w-full pl-12 pr-4 py-4 rounded-xl bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/50 shadow-lg"
            />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Filters Sidebar */}
          <aside className={`lg:w-80 flex-shrink-0 ${showFilters ? 'block' : 'hidden lg:block'}`}>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm sticky top-4">
              {/* Filters Header */}
              <div className="p-4 border-b border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <SlidersHorizontal className="w-5 h-5" />
                    Filtres
                  </h2>
                  {activeFiltersCount > 0 && (
                    <button
                      type="button"
                      onClick={clearAllFilters}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                    >
                      Tout effacer
                    </button>
                  )}
                </div>
                {activeFiltersCount > 0 && (
                  <p className="text-xs text-gray-500">
                    {activeFiltersCount} filtre{activeFiltersCount > 1 ? 's' : ''} actif{activeFiltersCount > 1 ? 's' : ''}
                  </p>
                )}
              </div>

              {/* Filter Sections */}
              <div className="max-h-[calc(100vh-200px)] overflow-y-auto">
                {/* Basic Filters */}
                <FilterSection title="Catégorie" icon={Tag} section="basic">
                  <select
                    value={category}
                    onChange={(e) => {
                      setCategory(e.target.value);
                      setPage(1);
                    }}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="">Toutes les catégories</option>
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
                <FilterSection title="Prix" icon={DollarSign} section="price">
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
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
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
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                </FilterSection>

                {/* Quality Filters */}
                <FilterSection title="Qualité & Options" icon={Sparkles} section="quality">
                  <div className="space-y-3">
                    {/* Condition */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-2">
                        État
                      </label>
                      <div className="space-y-2">
                        {CONDITIONS.map((cond) => (
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
                              className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
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
                            className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="text-sm text-gray-700">Tous</span>
                        </label>
                      </div>
                    </div>

                    {/* Certified */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-2">
                        Certification
                      </label>
                      <select
                        value={certified}
                        onChange={(e) => {
                          setCertified(e.target.value);
                          setPage(1);
                        }}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      >
                        <option value="">Tous</option>
                        <option value="true">Certifiés uniquement</option>
                        <option value="false">Non certifiés</option>
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
                          className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 rounded"
                        />
                        <span className="text-sm text-gray-700 flex items-center gap-1">
                          <CheckCircle className="w-4 h-4 text-emerald-500" />
                          Boutiques vérifiées uniquement
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
                          className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 rounded"
                        />
                        <span className="text-sm text-gray-700 flex items-center gap-1">
                          <Tag className="w-4 h-4 text-amber-500" />
                          Avec remise
                        </span>
                      </label>
                    </div>

                    {/* Min Rating */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-2">
                        Note minimum
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
                          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                      </div>
                    </div>

                    {/* Min Favorites */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-2">
                        Minimum de favoris
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
                          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                      </div>
                    </div>

                    {/* Min Sales */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-2">
                        Minimum de ventes
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
                          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                  </div>
                </FilterSection>

                {/* Location */}
                <FilterSection title="Localisation" icon={MapPin} section="location">
                  <select
                    value={city}
                    onChange={(e) => {
                      setCity(e.target.value);
                      setPage(1);
                    }}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="">Toutes les villes</option>
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
            {/* Results Header */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">
                    {loading ? 'Recherche en cours...' : `${totalResults} résultat${totalResults > 1 ? 's' : ''}`}
                  </h2>
                  {activeFiltersCount > 0 && (
                    <p className="text-sm text-gray-500 mt-1">
                      {activeFiltersCount} filtre{activeFiltersCount > 1 ? 's' : ''} appliqué{activeFiltersCount > 1 ? 's' : ''}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {/* Mobile Filter Toggle */}
                  <button
                    type="button"
                    onClick={() => setShowFilters(!showFilters)}
                    className="lg:hidden inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    <Filter className="w-4 h-4" />
                    Filtres
                    {activeFiltersCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold">
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
                    className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    {SORT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Loading */}
            {loading && items.length === 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 animate-pulse">
                    <div className="h-48 bg-gray-200 rounded-xl mb-4" />
                    <div className="h-4 bg-gray-200 rounded mb-2" />
                    <div className="h-4 bg-gray-200 rounded w-2/3" />
                  </div>
                ))}
              </div>
            ) : items.length > 0 ? (
              <>
                {/* Products Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {items.map((product) => (
                    <ProductCard
                      key={product._id}
                      p={product}
                      onProductClick={recordProductView}
                    />
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="mt-8 flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Précédent
                    </button>
                    <span className="px-4 py-2 text-sm text-gray-600">
                      Page {page} sur {totalPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                      className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Suivant
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
                <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-gray-900 mb-2">Aucun résultat</h3>
                <p className="text-sm text-gray-500 mb-6">
                  Aucun produit ne correspond à vos critères de recherche.
                </p>
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Réinitialiser les filtres
                </button>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
