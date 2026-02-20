import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { formatPriceWithStoredSettings } from "../utils/priceFormatter";
import {
  Ticket,
  Plus,
  RefreshCw,
  CheckCircle,
  XCircle,
  BarChart3,
  Zap,
  Search,
  ShieldCheck
} from 'lucide-react';
import api from '../services/api';

const formatCurrency = (value) => formatPriceWithStoredSettings(value);
const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const toInputDateTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
};

const initialForm = {
  code: '',
  autoGenerate: true,
  codePrefix: '',
  codeLength: 8,
  discountType: 'full_waiver',
  discountValue: 100,
  usageLimit: 10,
  startDate: '',
  endDate: '',
  isActive: true,
  referralTag: '',
  isFlashPromo: false,
  flashDurationHours: ''
};

export default function AdminPromoCodes() {
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [analytics, setAnalytics] = useState(null);
  const [usage, setUsage] = useState([]);
  const [loading, setLoading] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [editingId, setEditingId] = useState('');
  const [form, setForm] = useState(initialForm);

  const isEditing = Boolean(editingId);

  const buildPayload = useCallback(() => {
    const payload = {
      code: form.code?.trim() || undefined,
      autoGenerate: Boolean(form.autoGenerate),
      codePrefix: form.codePrefix?.trim() || undefined,
      codeLength: Number(form.codeLength || 8),
      discountType: form.discountType,
      discountValue:
        form.discountType === 'full_waiver' ? 100 : Math.max(0, Math.min(100, Number(form.discountValue || 0))),
      usageLimit: Math.max(1, Number(form.usageLimit || 1)),
      startDate: form.startDate,
      endDate: form.endDate || null,
      isActive: Boolean(form.isActive),
      referralTag: form.referralTag?.trim() || '',
      isFlashPromo: Boolean(form.isFlashPromo),
      flashDurationHours: form.flashDurationHours ? Number(form.flashDurationHours) : null
    };

    if (isEditing) {
      delete payload.autoGenerate;
      delete payload.codePrefix;
      delete payload.codeLength;
    }

    return payload;
  }, [form, isEditing]);

  const loadPromoCodes = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '20');
      params.set('status', statusFilter);
      if (search.trim()) params.set('search', search.trim());

      const { data } = await api.get(`/admin/promo-codes?${params.toString()}`);
      setItems(Array.isArray(data?.items) ? data.items : []);
      setPagination(data?.pagination || { page: 1, pages: 1, total: 0 });
    } catch (e) {
      setError(e.response?.data?.message || e.message || 'Impossible de charger les codes promo.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const [analyticsRes, usageRes] = await Promise.all([
        api.get('/admin/promo-codes/analytics'),
        api.get('/admin/promo-codes/usage?limit=10')
      ]);
      setAnalytics(analyticsRes.data || null);
      setUsage(Array.isArray(usageRes.data?.items) ? usageRes.data.items : []);
    } catch {
      setAnalytics(null);
      setUsage([]);
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPromoCodes();
  }, [loadPromoCodes]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  const resetForm = () => {
    setEditingId('');
    setForm(initialForm);
  };

  const handleGenerateCode = async () => {
    try {
      const { data } = await api.post('/admin/promo-codes/generate', {
        prefix: form.codePrefix,
        length: Number(form.codeLength || 8)
      });
      setForm((prev) => ({
        ...prev,
        code: data?.code || '',
        autoGenerate: false
      }));
    } catch (e) {
      setError(e.response?.data?.message || e.message || 'Impossible de générer un code.');
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const payload = buildPayload();
      if (isEditing) {
        const { data } = await api.patch(`/admin/promo-codes/${editingId}`, payload);
        setSuccess(data?.message || 'Code promo mis à jour.');
      } else {
        const { data } = await api.post('/admin/promo-codes', payload);
        setSuccess(data?.message || 'Code promo créé.');
      }

      resetForm();
      await Promise.all([loadPromoCodes(), loadAnalytics()]);
    } catch (e) {
      setError(e.response?.data?.message || e.message || 'Impossible d’enregistrer le code promo.');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (item) => {
    setEditingId(item.id || item._id);
    setForm({
      code: item.code || '',
      autoGenerate: false,
      codePrefix: '',
      codeLength: 8,
      discountType: item.discountType || 'full_waiver',
      discountValue: Number(item.discountValue || 100),
      usageLimit: Number(item.usageLimit || 1),
      startDate: toInputDateTime(item.startDate),
      endDate: toInputDateTime(item.endDate),
      isActive: Boolean(item.isActive),
      referralTag: item.referralTag || '',
      isFlashPromo: Boolean(item.isFlashPromo),
      flashDurationHours: item.flashDurationHours || ''
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleStatus = async (item) => {
    try {
      await api.patch(`/admin/promo-codes/${item.id || item._id}/toggle`, {
        isActive: !item.isActive
      });
      await Promise.all([loadPromoCodes(), loadAnalytics()]);
    } catch (e) {
      setError(e.response?.data?.message || e.message || 'Impossible de changer le statut.');
    }
  };

  const overview = analytics?.overview || {};
  const topCodes = useMemo(() => analytics?.topCodes || [], [analytics]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-indigo-50/30">
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-black text-gray-900 flex items-center gap-3">
              <Ticket className="w-8 h-8 text-indigo-600" />
              Codes Promo Commission
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Administration des exonérations de commission (3%) pour validation des produits.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              loadPromoCodes();
              loadAnalytics();
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" />
            Rafraîchir
          </button>
        </header>

        {(error || success) && (
          <div className="space-y-2">
            {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}
            {success && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">{success}</div>}
          </div>
        )}

        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3">
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-500">Total codes</p>
            <p className="text-2xl font-bold text-gray-900">{Number(overview.totalCodes || 0).toLocaleString('fr-FR')}</p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-xs text-emerald-600">Codes actifs</p>
            <p className="text-2xl font-bold text-emerald-700">{Number(overview.activeCodes || 0).toLocaleString('fr-FR')}</p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs text-amber-700">Flash promos</p>
            <p className="text-2xl font-bold text-amber-800">{Number(overview.flashPromoCodes || 0).toLocaleString('fr-FR')}</p>
          </div>
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <p className="text-xs text-blue-700">Utilisations (30j)</p>
            <p className="text-2xl font-bold text-blue-800">{Number(overview.usageLast30Days || 0).toLocaleString('fr-FR')}</p>
          </div>
          <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
            <p className="text-xs text-indigo-700">Commission annulée</p>
            <p className="text-xl font-bold text-indigo-800">{formatCurrency(overview.totalCommissionWaived || 0)}</p>
          </div>
          <div className="rounded-2xl border border-purple-200 bg-purple-50 p-4">
            <p className="text-xs text-purple-700">Acquisition nouveaux vendeurs</p>
            <p className="text-xl font-bold text-purple-800">{Number(overview.newSellerAcquisitionRate || 0).toLocaleString('fr-FR')}%</p>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Plus className="w-5 h-5 text-indigo-600" />
            {isEditing ? 'Modifier le code promo' : 'Créer un code promo'}
          </h2>
          <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600">Code</label>
              <input
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                value={form.code}
                onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
                disabled={!isEditing && form.autoGenerate}
                placeholder="FIRST10"
              />
            </div>

            {!isEditing && (
              <>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600">Préfixe auto</label>
                  <input
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                    value={form.codePrefix}
                    onChange={(e) => setForm((prev) => ({ ...prev, codePrefix: e.target.value.toUpperCase() }))}
                    placeholder="NEW"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600">Longueur auto</label>
                  <input
                    type="number"
                    min={4}
                    max={16}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                    value={form.codeLength}
                    onChange={(e) => setForm((prev) => ({ ...prev, codeLength: e.target.value }))}
                  />
                </div>
                <div className="space-y-1 flex items-end">
                  <button
                    type="button"
                    onClick={handleGenerateCode}
                    className="w-full rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100"
                  >
                    Générer un code
                  </button>
                </div>
              </>
            )}

            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600">Type de réduction</label>
              <select
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                value={form.discountType}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    discountType: e.target.value,
                    discountValue: e.target.value === 'full_waiver' ? 100 : prev.discountValue
                  }))
                }
              >
                <option value="full_waiver">Exonération totale</option>
                <option value="percentage">Réduction (%)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600">Valeur réduction (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                value={form.discountType === 'full_waiver' ? 100 : form.discountValue}
                onChange={(e) => setForm((prev) => ({ ...prev, discountValue: e.target.value }))}
                disabled={form.discountType === 'full_waiver'}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600">Limite d’utilisation</label>
              <input
                type="number"
                min={1}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                value={form.usageLimit}
                onChange={(e) => setForm((prev) => ({ ...prev, usageLimit: e.target.value }))}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600">Début</label>
              <input
                type="datetime-local"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                value={form.startDate}
                onChange={(e) => setForm((prev) => ({ ...prev, startDate: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600">Fin</label>
              <input
                type="datetime-local"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                value={form.endDate}
                onChange={(e) => setForm((prev) => ({ ...prev, endDate: e.target.value }))}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600">Tag referral</label>
              <input
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                value={form.referralTag}
                onChange={(e) => setForm((prev) => ({ ...prev, referralTag: e.target.value }))}
                placeholder="affiliate-camp-2026"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600">Flash promo (heures)</label>
              <input
                type="number"
                min={1}
                max={720}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                value={form.flashDurationHours}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    flashDurationHours: e.target.value,
                    isFlashPromo: Boolean(e.target.value)
                  }))
                }
                placeholder="24"
              />
            </div>

            <div className="md:col-span-2 xl:col-span-4 flex flex-wrap items-center gap-3 pt-2">
              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.autoGenerate}
                  disabled={isEditing}
                  onChange={(e) => setForm((prev) => ({ ...prev, autoGenerate: e.target.checked }))}
                />
                Générer automatiquement le code
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                />
                Actif
              </label>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                <ShieldCheck className="w-4 h-4" />
                {saving ? 'Enregistrement...' : isEditing ? 'Mettre à jour' : 'Créer le code'}
              </button>
              {isEditing && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Annuler
                </button>
              )}
            </div>
          </form>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Search className="w-5 h-5 text-indigo-600" />
              Liste des codes promo
            </h2>
            <div className="flex gap-2">
              <select
                className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">Tous</option>
                <option value="active">Actifs</option>
                <option value="inactive">Inactifs</option>
                <option value="expired">Expirés</option>
                <option value="upcoming">À venir</option>
              </select>
              <input
                className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                placeholder="Rechercher un code"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {loading ? (
            <div className="py-8 text-center text-sm text-gray-500">Chargement des codes promo...</div>
          ) : items.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-500">Aucun code promo trouvé.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-200">
                    <th className="py-2 pr-3">Code</th>
                    <th className="py-2 pr-3">Réduction</th>
                    <th className="py-2 pr-3">Usage</th>
                    <th className="py-2 pr-3">Période</th>
                    <th className="py-2 pr-3">Statut</th>
                    <th className="py-2 pr-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id || item._id} className="border-b border-gray-100">
                      <td className="py-3 pr-3 font-semibold text-gray-900">
                        <div className="flex items-center gap-2">
                          <span>{item.code}</span>
                          {item.isFlashPromo && <Zap className="w-4 h-4 text-amber-500" />}
                        </div>
                        {item.referralTag && <p className="text-xs text-gray-500">{item.referralTag}</p>}
                      </td>
                      <td className="py-3 pr-3">
                        {item.discountType === 'full_waiver'
                          ? 'Exonération totale'
                          : `${Number(item.discountValue || 0).toLocaleString('fr-FR')}%`}
                      </td>
                      <td className="py-3 pr-3">
                        {Number(item.usedCount || 0).toLocaleString('fr-FR')} / {Number(item.usageLimit || 0).toLocaleString('fr-FR')}
                      </td>
                      <td className="py-3 pr-3">
                        <p>{formatDateTime(item.startDate)}</p>
                        <p className="text-xs text-gray-500">au {formatDateTime(item.endDate)}</p>
                      </td>
                      <td className="py-3 pr-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${
                            item.isActive && !item.isExpired
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {item.isActive && !item.isExpired ? (
                            <CheckCircle className="w-3.5 h-3.5" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5" />
                          )}
                          {item.isActive && !item.isExpired ? 'Actif' : 'Inactif'}
                        </span>
                      </td>
                      <td className="py-3 pr-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => startEdit(item)}
                            className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                          >
                            Modifier
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleStatus(item)}
                            className="rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                          >
                            {item.isActive ? 'Désactiver' : 'Activer'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
            <p>
              {Number(pagination.total || 0).toLocaleString('fr-FR')} code(s) promo
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page <= 1}
                className="rounded-lg border border-gray-200 px-3 py-1.5 disabled:opacity-50"
              >
                Précédent
              </button>
              <span>
                Page {page} / {Math.max(1, Number(pagination.pages || 1))}
              </span>
              <button
                type="button"
                onClick={() => setPage((prev) => Math.min(Number(pagination.pages || 1), prev + 1))}
                disabled={page >= Number(pagination.pages || 1)}
                className="rounded-lg border border-gray-200 px-3 py-1.5 disabled:opacity-50"
              >
                Suivant
              </button>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2 mb-3">
              <BarChart3 className="w-5 h-5 text-indigo-600" />
              Top performances
            </h3>
            {analyticsLoading ? (
              <p className="text-sm text-gray-500">Chargement analytics...</p>
            ) : topCodes.length === 0 ? (
              <p className="text-sm text-gray-500">Aucune donnée de performance pour le moment.</p>
            ) : (
              <div className="space-y-3">
                {topCodes.map((row) => (
                  <div key={row.promoCodeId} className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-gray-900">{row.code || 'Code supprimé'}</p>
                      <p className="text-xs text-gray-500">{Number(row.usageRate || 0).toLocaleString('fr-FR')}% utilisé</p>
                    </div>
                    <div className="mt-1 text-xs text-gray-600 flex flex-wrap gap-x-3 gap-y-1">
                      <span>Usages: {Number(row.usageCount || 0).toLocaleString('fr-FR')}</span>
                      <span>Annulé: {formatCurrency(row.commissionDiscounted || 0)}</span>
                      <span>Dernier usage: {formatDateTime(row.lastUsedAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <h3 className="text-base font-bold text-gray-900 mb-3">Dernières utilisations</h3>
            {usage.length === 0 ? (
              <p className="text-sm text-gray-500">Aucune utilisation récente.</p>
            ) : (
              <div className="space-y-3">
                {usage.map((entry) => (
                  <div key={entry._id} className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-gray-900">{entry.promoCode?.code || entry.codeSnapshot}</p>
                      <p className="text-xs text-gray-500">{formatDateTime(entry.createdAt)}</p>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
                      Vendeur: {entry.seller?.name || '—'} • Produit: {entry.product?.title || '—'}
                    </p>
                    <p className="text-xs text-emerald-700 mt-1">
                      Commission annulée: {formatCurrency(entry.discountAmount || 0)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
