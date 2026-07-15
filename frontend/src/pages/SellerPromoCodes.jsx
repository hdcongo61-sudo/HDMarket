import React, { useCallback, useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Tag, Plus, Trash2, Copy, RefreshCw, Power, PowerOff,
  Search, Calendar, Percent, Hash, TrendingUp, BarChart3,
  Clock, CheckCircle, XCircle, AlertCircle, Sparkles
} from 'lucide-react';
import api from '../services/api';
import { getProductCardImageUrl } from '../utils/productImageUrl';
import AuthContext from '../context/AuthContext';
import { useAppSettings } from '../context/AppSettingsContext';
import { useToast } from '../context/ToastContext';

const FILTERS = [
  { key: 'active', label: 'Actifs', icon: CheckCircle, color: 'text-green-600' },
  { key: 'inactive', label: 'Inactifs', icon: XCircle, color: 'text-gray-500' },
  { key: 'all', label: 'Tous', icon: Hash, color: 'text-blue-600' },
  { key: 'expired', label: 'Expirés', icon: Clock, color: 'text-red-500' }
];

const STAT_CARD = ({ label, value, icon: Icon, color }) => (
  <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
    <div className="flex items-center justify-between">
      <span className="text-xs font-semibold text-gray-500">{label}</span>
      <div className={`rounded-lg p-1.5 ${color}`}>
        <Icon size={14} className="text-white" />
      </div>
    </div>
    <p className="mt-2 text-xl font-black text-gray-900">{value}</p>
  </div>
);

export default function SellerPromoCodes() {
  const { user } = useContext(AuthContext);
  const { formatPrice, t } = useAppSettings();
  const { showToast } = useToast();

  const isShopUser = user?.accountType === 'shop';

  // ── State ──
  const [filter, setFilter] = useState('active');
  const [promos, setPromos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState(null);
  const [toggleId, setToggleId] = useState('');
  const [deletingId, setDeletingId] = useState('');
  const [duplicatingId, setDuplicatingId] = useState('');

  // Create form
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    code: '', appliesTo: 'boutique', productId: '',
    discountType: 'percentage', discountValue: '',
    usageLimit: '10', startDate: '', endDate: '', isActive: true
  });
  const [submitting, setSubmitting] = useState(false);
  const [products, setProducts] = useState([]);

  // ── Load ──
  const loadPromos = useCallback(async () => {
    if (!isShopUser) return;
    setLoading(true);
    try {
      const { data } = await api.get('/marketplace-promo-codes/my', {
        params: { page: 1, limit: 50, status: filter }
      });
      setPromos(data?.items || []);
    } catch (err) {
      console.warn('[SellerPromoCodes] Load promos failed:', err?.message || err);
      setPromos([]);
    } finally {
      setLoading(false);
    }
  }, [isShopUser, filter]);

  const loadAnalytics = useCallback(async () => {
    if (!isShopUser) return;
    try {
      const { data } = await api.get('/marketplace-promo-codes/my/analytics');
      setAnalytics(data);
    } catch (err) { console.warn('[SellerPromoCodes] Analytics failed:', err?.message || err); /* ignore */ }
  }, [isShopUser]);

  const loadProducts = async () => {
    try {
      const { data } = await api.get('/products', { params: { limit: 200 } });
      setProducts(Array.isArray(data) ? data : []);
    } catch (err) { console.warn('[SellerPromoCodes] Load products failed:', err?.message || err); setProducts([]); }
  };

  useEffect(() => { loadPromos(); loadAnalytics(); }, [loadPromos, loadAnalytics]);

  // ── Actions ──
  const handleCreate = async (e) => {
    e.preventDefault();
    if (!isShopUser) return;
    const start = new Date(form.startDate);
    const end = new Date(form.endDate);
    if (!start.getTime() || !end.getTime()) return showToast('Dates requises.', { variant: 'error' });
    if (end <= start) return showToast('La date de fin doit être après la date de début.', { variant: 'error' });
    if (form.appliesTo === 'product' && !form.productId) return showToast('Sélectionnez un produit.', { variant: 'error' });

    setSubmitting(true);
    try {
      await api.post('/marketplace-promo-codes/my', {
        code: form.code.trim().toUpperCase(),
        appliesTo: form.appliesTo,
        productId: form.appliesTo === 'product' ? form.productId : null,
        discountType: form.discountType,
        discountValue: Number(form.discountValue || 0),
        usageLimit: Number(form.usageLimit || 1),
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        isActive: form.isActive
      });
      showToast('Code promo créé !', { variant: 'success' });
      setForm({ code: '', appliesTo: 'boutique', productId: '', discountType: 'percentage', discountValue: '', usageLimit: '10', startDate: '', endDate: '', isActive: true });
      setShowForm(false);
      loadPromos();
      loadAnalytics();
    } catch (err) {
      showToast(err?.response?.data?.message || 'Erreur création.', { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (promo) => {
    if (toggleId === promo.id) return;
    setToggleId(promo.id);
    const prev = [...promos];
    setPromos(prev.map(p => p.id === promo.id ? { ...p, isActive: !p.isActive } : p));
    try {
      await api.patch(`/marketplace-promo-codes/my/${promo.id}/toggle`, { isActive: !promo.isActive });
      showToast(promo.isActive ? 'Désactivé.' : 'Activé.', { variant: 'success' });
      loadPromos();
    } catch (err) {
      setPromos(prev);
      showToast(err?.response?.data?.message || 'Erreur.', { variant: 'error' });
    } finally {
      setToggleId('');
    }
  };

  const handleDelete = async (promo) => {
    if (deletingId) return;
    setDeletingId(promo.id);
    try {
      await api.delete(`/marketplace-promo-codes/my/${promo.id}`);
      setPromos(prev => prev.filter(p => p.id !== promo.id));
      showToast('Supprimé.', { variant: 'success' });
      loadAnalytics();
    } catch (err) {
      showToast(err?.response?.data?.message || 'Erreur suppression.', { variant: 'error' });
    } finally {
      setDeletingId('');
    }
  };

  const handleDuplicate = async (promo) => {
    if (duplicatingId) return;
    setDuplicatingId(promo.id);
    try {
      setForm({
        code: promo.code + '2',
        appliesTo: promo.appliesTo || 'boutique',
        productId: promo.productId || '',
        discountType: promo.discountType || 'percentage',
        discountValue: String(promo.discountValue || ''),
        usageLimit: String(promo.usageLimit || 10),
        startDate: new Date().toISOString().slice(0, 16),
        endDate: new Date(Date.now() + 30*86400000).toISOString().slice(0, 16),
        isActive: false
      });
      setShowForm(true);
      showToast('Formulaire pré-rempli — modifiez et créez.', { variant: 'info' });
    } finally {
      setDuplicatingId('');
    }
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

  if (!isShopUser) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-gray-500">Réservé aux boutiques.</p>
      </div>
    );
  }

  return (
    <div className="hd-profile-flow min-h-screen">
      {/* Header */}
      <header className="ui-glass-header border-b border-purple-100">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link to="/my" className="ui-btn-ghost inline-flex h-10 w-10 items-center justify-center">
            <ArrowLeft size={18} />
          </Link>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-500">
              <Tag size={16} className="text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold">Codes promo</h1>
              <p className="text-xs text-gray-500">{promos.length} codes</p>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl px-4 pb-20 pt-4 space-y-4">
        {/* ── Analytics ── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <STAT_CARD label="Actifs" value={analytics?.activeCount || promos.filter(p => p.isActive).length} icon={CheckCircle} color="bg-green-500" />
          <STAT_CARD label="Utilisations" value={analytics?.totalUsage || promos.reduce((s, p) => s + (p.usedCount || 0), 0)} icon={TrendingUp} color="bg-blue-500" />
          <STAT_CARD label="Total codes" value={promos.length} icon={Hash} color="bg-purple-500" />
          <STAT_CARD label="Expirés" value={analytics?.expiredCount || promos.filter(p => new Date(p.endDate) < new Date()).length} icon={Clock} color="bg-red-500" />
        </div>

        {/* ── Actions bar ── */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => { loadProducts(); setShowForm(!showForm); }}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition ${
              showForm ? 'bg-gray-200 text-gray-700' : 'bg-purple-500 text-white hover:bg-purple-600'
            }`}
          >
            <Plus size={14} />
            {showForm ? 'Annuler' : 'Créer un code'}
          </button>

          {/* Filter pills */}
          {FILTERS.map((f) => {
            const Icon = f.icon;
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  filter === f.key
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Icon size={12} />
                {f.label}
              </button>
            );
          })}
        </div>

        {/* ── Creation form ── */}
        {showForm && (
          <form onSubmit={handleCreate} className="rounded-2xl border border-purple-100 bg-gradient-to-br from-purple-50/30 to-white p-4 space-y-3">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Sparkles size={14} className="text-purple-500" />
              Nouveau code promo
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs font-semibold text-gray-600">Code</label>
                <input
                  value={form.code}
                  onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                  placeholder="ex: ETE2026"
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-mono uppercase"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600">Type remise</label>
                <select value={form.discountType} onChange={e => setForm(p => ({ ...p, discountType: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm">
                  <option value="percentage">Pourcentage (%)</option>
                  <option value="full_waiver">Livraison offerte</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600">
                  {form.discountType === 'percentage' ? 'Remise (%)' : 'Montant max'}
                </label>
                <input
                  type="number"
                  value={form.discountValue}
                  onChange={e => setForm(p => ({ ...p, discountValue: e.target.value }))}
                  placeholder={form.discountType === 'percentage' ? 'ex: 15' : 'ex: 5000'}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600">Utilisations max</label>
                <input
                  type="number"
                  value={form.usageLimit}
                  onChange={e => setForm(p => ({ ...p, usageLimit: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
                  min="1"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600">Appliquer à</label>
                <select value={form.appliesTo} onChange={e => setForm(p => ({ ...p, appliesTo: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm">
                  <option value="boutique">Toute la boutique</option>
                  <option value="product">Un produit spécifique</option>
                </select>
              </div>

              {form.appliesTo === 'product' && (
                <div>
                  <label className="text-xs font-semibold text-gray-600">Produit</label>
                  <select
                    value={form.productId}
                    onChange={e => setForm(p => ({ ...p, productId: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
                    required
                  >
                    <option value="">Sélectionner...</option>
                    {products.map(p => (
                      <option key={p._id || p.id} value={p._id || p.id}>{p.title}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-gray-600">Début</label>
                <input type="datetime-local" value={form.startDate} onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm" required />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600">Fin</label>
                <input type="datetime-local" value={form.endDate} onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm" required />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-2 text-xs text-gray-600">
                <input type="checkbox" checked={form.isActive} onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))}
                  className="rounded" />
                Activer immédiatement
              </label>
              <button type="submit" disabled={submitting}
                className="ml-auto rounded-xl bg-purple-500 px-4 py-2 text-xs font-bold text-white hover:bg-purple-600 disabled:opacity-50">
                {submitting ? 'Création...' : 'Créer le code promo'}
              </button>
            </div>
          </form>
        )}

        {/* ── Promo list ── */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-gray-100" />
            ))}
          </div>
        ) : promos.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center">
            <Tag size={48} className="mb-4 text-gray-300" />
            <p className="text-sm font-medium text-gray-600">Aucun code promo</p>
            <p className="mt-1 text-xs text-gray-400">Créez votre premier code pour attirer plus de clients.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {promos.map((promo) => {
              const isExpired = new Date(promo.endDate) < new Date();
              const isActive = promo.isActive && !isExpired;
              return (
                <div key={promo.id}
                  className={`rounded-2xl border p-4 transition ${
                    isActive ? 'border-purple-200 bg-white shadow-sm' :
                    isExpired ? 'border-red-100 bg-red-50/30' : 'border-gray-100 bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-base font-black text-purple-700">{promo.code}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          isActive ? 'bg-green-100 text-green-700' :
                          isExpired ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {isActive ? 'Actif' : isExpired ? 'Expiré' : 'Inactif'}
                        </span>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          {promo.discountType === 'percentage' ? <Percent size={12} /> : <Tag size={12} />}
                          {promo.discountType === 'percentage'
                            ? `${promo.discountValue}% de remise`
                            : 'Livraison offerte'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Hash size={12} />
                          {promo.usedCount || 0} / {promo.usageLimit} utilisations
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar size={12} />
                          {formatDate(promo.startDate)} → {formatDate(promo.endDate)}
                        </span>
                      </div>

                      <div className="mt-2 flex items-center gap-2">
                        {promo.appliesTo === 'product' && promo.product ? (
                          <>
                            {promo.product.images?.[0] && (
                              <img
                                src={getProductCardImageUrl(promo.product.images[0])}
                                alt={promo.product.title || ''}
                                className="h-10 w-10 rounded-lg object-cover border border-gray-100"
                                loading="lazy"
                              />
                            )}
                            <span className="text-xs text-gray-500 truncate max-w-[180px]">
                              📦 {promo.product.title || 'Produit'}
                            </span>
                          </>
                        ) : (
                          <span className="text-xs text-gray-400">🏪 Toute la boutique</span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex shrink-0 items-center gap-1">
                      <button onClick={() => handleToggle(promo)} disabled={toggleId === promo.id}
                        className={`rounded-lg p-2 transition ${
                          promo.isActive ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'
                        } disabled:opacity-50`}
                        title={promo.isActive ? 'Désactiver' : 'Activer'}
                      >
                        {toggleId === promo.id ? <RefreshCw size={14} className="animate-spin" /> :
                         promo.isActive ? <PowerOff size={14} /> : <Power size={14} />}
                      </button>
                      <button onClick={() => handleDuplicate(promo)} disabled={duplicatingId === promo.id}
                        className="rounded-lg p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 transition disabled:opacity-50"
                        title="Dupliquer">
                        {duplicatingId === promo.id ? <RefreshCw size={14} className="animate-spin" /> : <Copy size={14} />}
                      </button>
                      <button onClick={() => handleDelete(promo)} disabled={deletingId === promo.id}
                        className="rounded-lg p-2 bg-red-50 text-red-500 hover:bg-red-100 transition disabled:opacity-50"
                        title="Supprimer">
                        {deletingId === promo.id ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
