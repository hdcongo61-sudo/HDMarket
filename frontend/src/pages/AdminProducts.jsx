import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Shield,
  Search,
  Filter,
  X,
  RefreshCcw,
  ChevronRight,
  ShieldCheck,
  Tag as TagIcon,
  Package,
  CheckCircle,
  Clock,
  AlertCircle,
  TrendingUp,
  BarChart3,
  Settings,
  Eye,
  Image as ImageIcon,
  User,
  Mail,
  Phone,
  Calendar,
  DollarSign,
  ArrowLeft,
  Sparkles
} from 'lucide-react';
import api from '../services/api';
import categoryGroups from '../data/categories';
import AuthContext from '../context/AuthContext';

const STATUS_LABELS = {
  pending: 'En attente',
  approved: 'Validée',
  rejected: 'Rejetée',
  disabled: 'Désactivée'
};

const STATUS_STYLES = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-800',
  disabled: 'bg-gray-100 text-gray-600'
};

const SORT_OPTIONS = [
  { value: 'recent', label: 'Plus récents' },
  { value: 'price_asc', label: 'Prix croissants' },
  { value: 'price_desc', label: 'Prix décroissants' },
  { value: 'discount', label: 'Meilleure remise' }
];

const PER_PAGE = 20;

const formatCurrency = (value) =>
  `${Number(value || 0).toLocaleString('fr-FR')} FCFA`;

const formatDate = (value) =>
  value
    ? new Date(value).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      })
    : '—';

const StatCard = ({ title, value, helper, icon: Icon, highlight, trend }) => {
  const iconColors = highlight
    ? 'from-indigo-500 to-purple-600'
    : 'from-gray-400 to-gray-500';
  
  return (
    <div className={`group relative overflow-hidden rounded-2xl border transition-all duration-300 ${
      highlight
        ? 'border-indigo-200/60 bg-gradient-to-br from-indigo-50/50 via-white to-purple-50/30 shadow-md hover:shadow-lg'
        : 'border-gray-200/60 bg-gradient-to-br from-white to-gray-50/50 shadow-sm hover:shadow-md hover:border-indigo-200/40'
    }`}>
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <p className={`text-xs font-semibold uppercase tracking-wider mb-1 ${highlight ? 'text-indigo-700' : 'text-gray-600'}`}>
              {title}
            </p>
            <p className={`text-3xl font-bold mb-1 ${highlight ? 'bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent' : 'text-gray-900'}`}>
              {value}
            </p>
            {helper && (
              <p className="text-xs text-gray-500 mt-1.5 flex items-center gap-1">
                {trend && (
                  <TrendingUp size={12} className={trend > 0 ? 'text-green-500' : 'text-red-500'} />
                )}
                {helper}
              </p>
            )}
          </div>
          {Icon && (
            <div className={`ml-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${iconColors} text-white shadow-sm transition-transform duration-300 group-hover:scale-110 group-hover:shadow-md`}>
              <Icon size={22} strokeWidth={2.5} />
            </div>
          )}
        </div>
      </div>
      {highlight && (
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/0 via-purple-500/0 to-pink-500/0 transition-opacity duration-300 group-hover:from-indigo-500/5 group-hover:via-purple-500/5 group-hover:to-pink-500/5" />
      )}
    </div>
  );
};

const categoryOptions = categoryGroups.flatMap((group) =>
  group.options.map((option) => ({
    value: option.value,
    label: `${group.label} · ${option.label}`
  }))
);

export default function AdminProducts() {
  const { user } = useContext(AuthContext);
  const isAdminUser = user?.role === 'admin';
  const [products, setProducts] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [certifiedFilter, setCertifiedFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('recent');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [detailMessage, setDetailMessage] = useState('');
  const [detailError, setDetailError] = useState('');
  const [detailBusy, setDetailBusy] = useState(false);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {
        page,
        limit: PER_PAGE,
        sort: sortBy
      };
      if (statusFilter) params.status = statusFilter;
      if (categoryFilter) params.category = categoryFilter;
      if (certifiedFilter) params.certified = certifiedFilter;
      if (searchTerm) params.search = searchTerm.trim();
      const { data } = await api.get('/admin/products', { params });
      setProducts(Array.isArray(data?.items) ? data.items : []);
      setTotalPages(data?.pagination?.pages || 1);
      setTotalProducts(data?.pagination?.total || 0);
      setStats(data?.stats || null);
    } catch (err) {
      console.error('Erreur chargement produits admin', err);
      setError(err?.response?.data?.message || err.message || 'Impossible de charger les produits.');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, categoryFilter, certifiedFilter, searchTerm, sortBy]);

  useEffect(() => {
    const handler = setTimeout(() => {
      fetchProducts();
    }, 250);
    return () => clearTimeout(handler);
  }, [fetchProducts]);

  const resetFilters = () => {
    setStatusFilter('');
    setCategoryFilter('');
    setCertifiedFilter('');
    setSearchTerm('');
    setSortBy('recent');
    setPage(1);
  };

  const handleCertificationToggle = async () => {
    if (!selectedProduct || detailBusy) return;
    setDetailMessage('');
    setDetailError('');
    setDetailBusy(true);
    try {
      const desiredState = !selectedProduct.certified;
      const { data } = await api.patch(`/admin/products/${selectedProduct._id}/certify`, {
        certified: desiredState
      });
      const updatedWithCert = {
        ...selectedProduct,
        certified: data.certified,
        certifiedBy: data.certifiedBy,
        certifiedAt: data.certifiedAt
      };
      setSelectedProduct(updatedWithCert);
      setProducts((prev) =>
        prev.map((item) => (item._id === updatedWithCert._id ? { ...item, ...updatedWithCert } : item))
      );
      setStats((prev) => {
        if (!prev) return prev;
        const certifiedDelta = data.certified ? 1 : -1;
        const uncertifiedDelta = -certifiedDelta;
        return {
          ...prev,
          certifiedCount: Math.max(0, (prev.certifiedCount || 0) + certifiedDelta),
          uncertifiedCount: Math.max(0, (prev.uncertifiedCount || 0) + uncertifiedDelta)
        };
      });
      setDetailMessage(data.certified ? 'Produit certifié.' : 'Certification retirée.');
    } catch (err) {
      console.error('Erreur certification', err);
      setDetailError(err?.response?.data?.message || 'Une erreur est survenue.');
    } finally {
      setDetailBusy(false);
    }
  };

  const statusCards = useMemo(() => {
    if (!stats) return [];
    const countFor = (key) => stats.statusCounts?.[key] || 0;
    return [
      { title: 'En attente', value: countFor('pending') },
      { title: 'Validées', value: countFor('approved') },
      { title: 'Rejetées', value: countFor('rejected') },
      { title: 'Désactivées', value: countFor('disabled') }
    ];
  }, [stats]);

  const topCategories = stats?.topCategories || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50/20">
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between pb-6 border-b border-gray-200/60">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 shadow-lg">
                <Package size={24} className="text-white" strokeWidth={2.5} />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 via-indigo-900 to-purple-900 bg-clip-text text-transparent">
                  Gestion des produits
                </h1>
                <p className="text-sm text-gray-600 mt-1">
                  Visualisez les annonces, filtrez-les et certifiez celles qui respectent la charte HDMarket.
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/admin"
              className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition-all duration-200 hover:bg-gray-50 hover:border-indigo-300 hover:text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              <ArrowLeft size={16} />
              Retour au tableau
            </Link>
            <button
              type="button"
              onClick={fetchProducts}
              className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-700 transition-all duration-200 hover:bg-indigo-100 hover:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              <RefreshCcw size={16} className="transition-transform duration-300 hover:rotate-180" />
              Actualiser
            </button>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard 
            title="Produits total" 
            value={totalProducts} 
            helper={`${totalPages} page(s)`}
            icon={Package}
          />
          <StatCard
            title="Produits certifiés"
            value={stats?.certifiedCount ?? 0}
            helper={`${stats?.uncertifiedCount ?? 0} non certifiés`}
            icon={ShieldCheck}
            highlight
          />
          <StatCard
            title="Certifications en attente"
            value={statusCards[0]?.value || 0}
            helper="Suivre les validations"
            icon={Clock}
          />
          <StatCard
            title="Produits désactivés"
            value={statusCards[3]?.value || 0}
            helper="Vérifier les suspensions"
            icon={AlertCircle}
          />
        </section>

        <section className="rounded-2xl border border-gray-200/60 bg-gradient-to-br from-white to-indigo-50/20 p-6 shadow-sm">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100">
                  <Filter size={20} className="text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Filtres rapides</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Recherchez et filtrez les produits</p>
                </div>
              </div>
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-600 shadow-sm transition-all duration-200 hover:bg-gray-50 hover:border-indigo-300 hover:text-indigo-700"
              >
                <X size={14} />
                Réinitialiser
              </button>
            </div>
            <div className="flex flex-col gap-4">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Rechercher par titre ou description..."
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 pl-11 text-sm shadow-sm transition-all duration-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(1);
                  }}
                  className="rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                >
                  <option value="">Tous les statuts</option>
                  <option value="pending">En attente</option>
                  <option value="approved">Validés</option>
                  <option value="rejected">Rejetés</option>
                  <option value="disabled">Désactivés</option>
                </select>
                <select
                  value={certifiedFilter}
                  onChange={(e) => {
                    setCertifiedFilter(e.target.value);
                    setPage(1);
                  }}
                  className="rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                >
                  <option value="">Tous les produits</option>
                  <option value="true">Certifiés</option>
                  <option value="false">Non certifiés</option>
                </select>
                <select
                  value={categoryFilter}
                  onChange={(e) => {
                    setCategoryFilter(e.target.value);
                    setPage(1);
                  }}
                  className="rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                >
                  <option value="">Toutes les catégories</option>
                  {categoryOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <select
                  value={sortBy}
                  onChange={(e) => {
                    setSortBy(e.target.value);
                    setPage(1);
                  }}
                  className="rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
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
        </section>

        <section className="space-y-4">
          {error && <p className="text-sm text-red-600">{error}</p>}
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, idx) => (
                <div
                  key={idx}
                  className="animate-pulse rounded-2xl border border-gray-100 bg-white px-4 py-5"
                >
                  <div className="h-4 w-2/5 bg-gray-200 mb-3 rounded"></div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="h-8 bg-gray-200 rounded"></div>
                    <div className="h-8 bg-gray-200 rounded"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : products.length ? (
            <>
              <div className="grid grid-cols-1 gap-4">
                {products.map((product) => (
                  <article
                    key={product._id}
                    className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="flex items-start gap-3">
                        <div className="h-20 w-20 rounded-2xl bg-gray-100 overflow-hidden">
                          <img
                            src={product.images?.[0] || '/api/placeholder/120/120'}
                            alt={product.title}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wide text-gray-500">
                            {product.category || '—'}
                          </p>
                          <h3 className="text-lg font-semibold text-gray-900">{product.title}</h3>
                          <p className="text-xs text-gray-500">
                            {product.user?.shopName || product.user?.name || 'Vendeur indisponible'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-right">
                        <div>
                          <p className="text-sm text-gray-500">Prix</p>
                          <p className="text-lg font-semibold text-gray-900">{formatCurrency(product.price)}</p>
                        </div>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            STATUS_STYLES[product.status] || 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {STATUS_LABELS[product.status] || product.status}
                        </span>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-500">
                      {product.certified ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-emerald-600">
                          <ShieldCheck className="w-4 h-4" />
                          Certifié
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-gray-600">
                          <Shield className="w-4 h-4" />
                          Non certifié
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedProduct(product);
                          setDetailMessage('');
                          setDetailError('');
                        }}
                        className="inline-flex items-center gap-2 text-xs font-semibold text-indigo-600 hover:text-indigo-500"
                      >
                        Détails
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-white px-4 py-3 text-xs text-gray-500">
                <span>
                  Page {page} / {totalPages} · {totalProducts} annonce{totalProducts > 1 ? 's' : ''}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    disabled={page <= 1}
                    className="rounded-full border border-gray-200 px-3 py-1 font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Précédent
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={page >= totalPages}
                    className="rounded-full border border-gray-200 px-3 py-1 font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Suivant
                  </button>
                </div>
              </div>
            </>
          ) : (
            <p className="rounded-2xl border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
              Aucun produit ne correspond aux filtres actuels.
            </p>
          )}
        </section>

        {topCategories.length > 0 && (
          <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3 text-xs uppercase tracking-wide text-gray-500">
              <span>Catégories les plus populaires</span>
              <TagIcon className="h-4 w-4 text-indigo-500" />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {topCategories.map((category) => (
                <div key={category.category} className="rounded-2xl border border-gray-100 p-3 text-xs font-semibold text-gray-700">
                  <p className="text-sm text-gray-900">{category.category}</p>
                  <p className="text-xs text-gray-500">{category.count} annonces</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {selectedProduct && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4"
          onClick={() => {
            setSelectedProduct(null);
            setDetailMessage('');
            setDetailError('');
          }}
        >
          <div
            className="w-full max-w-4xl rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-500">Détail produit</p>
                <h2 className="text-lg font-bold text-gray-900">{selectedProduct.title}</h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedProduct(null);
                  setDetailMessage('');
                  setDetailError('');
                }}
                className="text-xs font-semibold uppercase tracking-wide text-gray-500 transition hover:text-gray-900"
              >
                Fermer <X className="inline-block h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-[1fr,1fr]">
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  {(selectedProduct.images || []).slice(0, 3).map((image, index) => (
                    <img
                      key={`modal-img-${index}`}
                      src={image}
                      alt={`${selectedProduct.title} ${index + 1}`}
                      className="h-24 w-full rounded-2xl object-cover border border-gray-200"
                    />
                  ))}
                  {!selectedProduct.images?.length && (
                    <div className="col-span-3 h-24 rounded-2xl border border-gray-200 bg-gray-100" />
                  )}
                </div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {selectedProduct.category}
                </p>
                <p className="text-sm text-gray-600">{selectedProduct.description}</p>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>Prix</span>
                  <span className="text-gray-900 font-semibold">
                    {formatCurrency(selectedProduct.price)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="rounded-full px-3 py-1 text-xs font-semibold">
                    {STATUS_LABELS[selectedProduct.status] || selectedProduct.status}
                  </span>
                  <span className="text-xs text-gray-500">
                    Créé le {formatDate(selectedProduct.createdAt)}
                  </span>
                </div>
                <div className="border-t border-gray-100 pt-3 space-y-2 text-xs text-gray-500">
                  <p>
                    Vendeur: {selectedProduct.user?.shopName || selectedProduct.user?.name || '—'}
                  </p>
                  <p>Email: {selectedProduct.user?.email || '—'}</p>
                  <p>Téléphone: {selectedProduct.user?.phone || '—'}</p>
                </div>
                <div className="border-t border-gray-100 pt-3">
                  {selectedProduct.certified ? (
                    <div className="text-xs text-emerald-700">
                      <span className="flex items-center gap-2 text-emerald-600">
                        <ShieldCheck className="w-4 h-4" />
                        Produit certifié
                      </span>
                      {selectedProduct.certifiedBy ? (
                        <p>
                          Validé par {selectedProduct.certifiedBy.name || 'Admin'} (
                          {selectedProduct.certifiedBy.email || '—'})
                        </p>
                      ) : null}
                      {selectedProduct.certifiedAt ? (
                        <p>Le {formatDate(selectedProduct.certifiedAt)}</p>
                      ) : null}
                    </div>
                  ) : (
                    <div className="text-xs text-gray-500">
                      <span className="flex items-center gap-2">
                        <Shield className="w-4 h-4" />
                        Produit non certifié
                      </span>
                    </div>
                  )}
                </div>
                {isAdminUser && (
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={handleCertificationToggle}
                      disabled={detailBusy}
                      className="w-full rounded-full bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
                    >
                      {selectedProduct.certified ? 'Retirer la certification' : 'Certifier ce produit'}
                    </button>
                    {(detailMessage || detailError) && (
                      <p className={`text-xs ${detailError ? 'text-red-600' : 'text-green-600'}`}>
                        {detailError || detailMessage}
                      </p>
                    )}
                  </div>
                )}
                {selectedProduct.payment && (
                  <div className="border-t border-gray-100 pt-3 text-xs text-gray-500 space-y-1">
                    <p className="font-semibold text-gray-900 text-sm">Paiement</p>
                    <p>Status: {selectedProduct.payment.status}</p>
                    <p>Montant: {formatCurrency(selectedProduct.payment.amount)}</p>
                    <p>Opérateur: {selectedProduct.payment.operator}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
