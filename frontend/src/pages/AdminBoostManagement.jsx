import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { formatPriceWithStoredSettings } from "../utils/priceFormatter";
import {
  BarChart3,
  CalendarClock,
  CheckCircle2,
  Loader2,
  Sparkles,
  TrendingUp,
  XCircle
} from 'lucide-react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';

const BOOST_TYPES = [
  'PRODUCT_BOOST',
  'LOCAL_PRODUCT_BOOST',
  'SHOP_BOOST',
  'HOMEPAGE_FEATURED'
];
const CITIES = ['Brazzaville', 'Pointe-Noire', 'Ouesso', 'Oyo'];

const formatCurrency = (value) => formatPriceWithStoredSettings(value);
const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export default function AdminBoostManagement() {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState('pricing');
  const [loading, setLoading] = useState(false);
  const [pricingItems, setPricingItems] = useState([]);
  const [seasonalItems, setSeasonalItems] = useState([]);
  const [requestItems, setRequestItems] = useState([]);
  const [dashboard, setDashboard] = useState(null);

  const [pricingForm, setPricingForm] = useState({
    type: 'PRODUCT_BOOST',
    city: '',
    basePrice: '',
    priceType: 'per_day',
    multiplier: 1,
    isActive: true
  });
  const [seasonalForm, setSeasonalForm] = useState({
    name: '',
    startDate: '',
    endDate: '',
    multiplier: 1.2,
    isActive: true,
    appliesTo: []
  });

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [pricingRes, seasonalRes, requestsRes, revenueRes] = await Promise.all([
        api.get('/admin/boost-pricing'),
        api.get('/admin/seasonal-pricing'),
        api.get('/admin/boost-requests', { params: { page: 1, limit: 30 } }),
        api.get('/admin/boosts/revenue-dashboard')
      ]);
      setPricingItems(Array.isArray(pricingRes?.data?.items) ? pricingRes.data.items : []);
      setSeasonalItems(Array.isArray(seasonalRes?.data?.items) ? seasonalRes.data.items : []);
      setRequestItems(Array.isArray(requestsRes?.data?.items) ? requestsRes.data.items : []);
      setDashboard(revenueRes?.data || null);
    } catch (error) {
      showToast(error.response?.data?.message || 'Impossible de charger la gestion boost.', {
        variant: 'error'
      });
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleSubmitPricing = async (event) => {
    event.preventDefault();
    try {
      await api.post('/admin/boost-pricing', {
        ...pricingForm,
        city: pricingForm.city || null,
        basePrice: Number(pricingForm.basePrice || 0),
        multiplier: Number(pricingForm.multiplier || 1)
      });
      showToast('Tarification boost enregistrée.', { variant: 'success' });
      setPricingForm((prev) => ({ ...prev, basePrice: '' }));
      await loadAll();
    } catch (error) {
      showToast(error.response?.data?.message || 'Erreur de tarification boost.', { variant: 'error' });
    }
  };

  const handleSubmitSeasonal = async (event) => {
    event.preventDefault();
    try {
      await api.post('/admin/seasonal-pricing', {
        ...seasonalForm,
        multiplier: Number(seasonalForm.multiplier || 1),
        appliesTo: seasonalForm.appliesTo
      });
      showToast('Campagne saisonnière créée.', { variant: 'success' });
      setSeasonalForm({
        name: '',
        startDate: '',
        endDate: '',
        multiplier: 1.2,
        isActive: true,
        appliesTo: []
      });
      await loadAll();
    } catch (error) {
      showToast(error.response?.data?.message || 'Impossible de créer la campagne.', {
        variant: 'error'
      });
    }
  };

  const handleRequestStatusUpdate = async (requestId, status) => {
    try {
      const payload = { status };
      if (status === 'REJECTED') {
        // eslint-disable-next-line no-alert
        const reason = window.prompt('Motif de rejet (optionnel)') || '';
        payload.rejectionReason = reason;
      }
      await api.patch(`/admin/boost-requests/${requestId}/status`, payload);
      showToast('Statut de demande mis à jour.', { variant: 'success' });
      await loadAll();
    } catch (error) {
      showToast(error.response?.data?.message || 'Impossible de modifier cette demande.', {
        variant: 'error'
      });
    }
  };

  const topTypes = useMemo(
    () => (Array.isArray(dashboard?.byType) ? dashboard.byType.slice(0, 4) : []),
    [dashboard]
  );
  const pricingHistoryRows = useMemo(() => {
    if (!Array.isArray(pricingItems)) return [];
    return pricingItems
      .flatMap((item) => {
        const snapshots = Array.isArray(item.history) ? item.history : [];
        return snapshots.map((snapshot, index) => ({
          key: `${item.id}-history-${index}`,
          type: item.type,
          city: item.city || 'Global',
          basePrice: Number(snapshot?.basePrice || 0),
          priceType: snapshot?.priceType || '-',
          multiplier: Number(snapshot?.multiplier || 1),
          isActive: Boolean(snapshot?.isActive),
          updatedAt: snapshot?.updatedAt || null,
          updatedByName:
            snapshot?.updatedBy?.name ||
            (typeof snapshot?.updatedBy === 'string' ? snapshot.updatedBy : '-') ||
            '-'
        }));
      })
      .sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
  }, [pricingItems]);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6 space-y-5">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-indigo-600" />
        <h1 className="text-xl font-bold text-gray-900">Boost Management</h1>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          ['pricing', 'Tarification'],
          ['seasonal', 'Saisonnier'],
          ['requests', 'Demandes'],
          ['revenue', 'Revenus']
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
              activeTab === key
                ? 'bg-indigo-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 flex items-center gap-2 text-gray-600">
          <Loader2 className="h-4 w-4 animate-spin" /> Chargement...
        </div>
      ) : (
        <>
          {activeTab === 'pricing' && (
            <section className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
              <h2 className="text-base font-bold text-gray-900">Tarification dynamique</h2>
              <form onSubmit={handleSubmitPricing} className="grid grid-cols-1 md:grid-cols-6 gap-3">
                <select
                  value={pricingForm.type}
                  onChange={(e) => setPricingForm((prev) => ({ ...prev, type: e.target.value }))}
                  className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                >
                  {BOOST_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
                <select
                  value={pricingForm.city}
                  onChange={(e) => setPricingForm((prev) => ({ ...prev, city: e.target.value }))}
                  className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                >
                  <option value="">Global</option>
                  {CITIES.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={0}
                  value={pricingForm.basePrice}
                  onChange={(e) => setPricingForm((prev) => ({ ...prev, basePrice: e.target.value }))}
                  placeholder="Prix de base"
                  className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                />
                <select
                  value={pricingForm.priceType}
                  onChange={(e) => setPricingForm((prev) => ({ ...prev, priceType: e.target.value }))}
                  className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                >
                  <option value="per_day">Par jour</option>
                  <option value="per_week">Par semaine</option>
                  <option value="fixed">Fixe</option>
                </select>
                <input
                  type="number"
                  min={0.1}
                  step="0.1"
                  value={pricingForm.multiplier}
                  onChange={(e) => setPricingForm((prev) => ({ ...prev, multiplier: e.target.value }))}
                  placeholder="Multiplicateur"
                  className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                />
                <button
                  type="submit"
                  className="rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                >
                  Enregistrer
                </button>
              </form>

              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b border-gray-100">
                      <th className="py-2 pr-3">Type</th>
                      <th className="py-2 pr-3">Ville</th>
                      <th className="py-2 pr-3">Prix</th>
                      <th className="py-2 pr-3">Mode</th>
                      <th className="py-2 pr-3">Multiplier</th>
                      <th className="py-2 pr-3">État</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pricingItems.map((item) => (
                      <tr key={item.id} className="border-b border-gray-100">
                        <td className="py-2 pr-3 font-semibold text-gray-900">{item.type}</td>
                        <td className="py-2 pr-3">{item.city || 'Global'}</td>
                        <td className="py-2 pr-3">{formatCurrency(item.basePrice)}</td>
                        <td className="py-2 pr-3">{item.priceType}</td>
                        <td className="py-2 pr-3">x{Number(item.multiplier || 1).toFixed(2)}</td>
                        <td className="py-2 pr-3">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                              item.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {item.isActive ? 'Actif' : 'Inactif'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="pt-4 border-t border-gray-100">
                <h3 className="text-sm font-bold text-gray-900 mb-3">Historique des changements de prix</h3>
                {!pricingHistoryRows.length ? (
                  <p className="text-sm text-gray-500">Aucun historique disponible pour le moment.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-500 border-b border-gray-100">
                          <th className="py-2 pr-3">Type</th>
                          <th className="py-2 pr-3">Ville</th>
                          <th className="py-2 pr-3">Ancien prix</th>
                          <th className="py-2 pr-3">Mode</th>
                          <th className="py-2 pr-3">Multiplier</th>
                          <th className="py-2 pr-3">État</th>
                          <th className="py-2 pr-3">Date</th>
                          <th className="py-2 pr-3">Modifié par</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pricingHistoryRows.map((row) => (
                          <tr key={row.key} className="border-b border-gray-100">
                            <td className="py-2 pr-3 font-semibold text-gray-900">{row.type}</td>
                            <td className="py-2 pr-3">{row.city}</td>
                            <td className="py-2 pr-3">{formatCurrency(row.basePrice)}</td>
                            <td className="py-2 pr-3">{row.priceType}</td>
                            <td className="py-2 pr-3">x{Number(row.multiplier || 1).toFixed(2)}</td>
                            <td className="py-2 pr-3">
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                                  row.isActive
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-gray-100 text-gray-600'
                                }`}
                              >
                                {row.isActive ? 'Actif' : 'Inactif'}
                              </span>
                            </td>
                            <td className="py-2 pr-3">{formatDateTime(row.updatedAt)}</td>
                            <td className="py-2 pr-3">{row.updatedByName}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          )}

          {activeTab === 'seasonal' && (
            <section className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
              <h2 className="text-base font-bold text-gray-900">Campagnes saisonnières</h2>
              <form onSubmit={handleSubmitSeasonal} className="grid grid-cols-1 md:grid-cols-5 gap-3">
                <input
                  value={seasonalForm.name}
                  onChange={(e) => setSeasonalForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Nom de campagne"
                  className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                />
                <input
                  type="date"
                  value={seasonalForm.startDate}
                  onChange={(e) => setSeasonalForm((prev) => ({ ...prev, startDate: e.target.value }))}
                  className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                />
                <input
                  type="date"
                  value={seasonalForm.endDate}
                  onChange={(e) => setSeasonalForm((prev) => ({ ...prev, endDate: e.target.value }))}
                  className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                />
                <input
                  type="number"
                  min={0.1}
                  step="0.1"
                  value={seasonalForm.multiplier}
                  onChange={(e) => setSeasonalForm((prev) => ({ ...prev, multiplier: e.target.value }))}
                  className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                />
                <button
                  type="submit"
                  className="rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                >
                  Ajouter
                </button>
              </form>

              <div className="space-y-2">
                {seasonalItems.map((item) => (
                  <article key={item.id} className="rounded-xl border border-gray-200 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-gray-900">{item.name}</p>
                      <span className="text-xs text-gray-500">
                        x{Number(item.multiplier || 1).toFixed(2)} •{' '}
                        {item.startDate ? new Date(item.startDate).toLocaleDateString('fr-FR') : '-'} →{' '}
                        {item.endDate ? new Date(item.endDate).toLocaleDateString('fr-FR') : '-'}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {activeTab === 'requests' && (
            <section className="rounded-2xl border border-gray-200 bg-white p-5 space-y-3">
              <h2 className="text-base font-bold text-gray-900">Demandes de boost</h2>
              {!requestItems.length ? (
                <p className="text-sm text-gray-500">Aucune demande.</p>
              ) : (
                requestItems.map((item) => (
                  <article key={item.id} className="rounded-xl border border-gray-200 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold text-gray-900">{item.boostType}</p>
                        <p className="text-xs text-gray-500">
                          {item.seller?.shopName || item.seller?.name || 'Vendeur'} • {item.city || 'Global'}
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-indigo-700">{formatCurrency(item.totalPrice)}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-600">
                        {item.status}
                      </span>
                      {item.status === 'PENDING' && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleRequestStatusUpdate(item.id, 'APPROVED')}
                            className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" /> Approuver
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRequestStatusUpdate(item.id, 'REJECTED')}
                            className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-700"
                          >
                            <XCircle className="h-3.5 w-3.5" /> Rejeter
                          </button>
                        </>
                      )}
                    </div>
                    <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-gray-600">
                      <p>
                        Opérateur: <span className="font-semibold text-gray-800">{item.paymentOperator || '-'}</span>
                      </p>
                      <p>
                        Expéditeur: <span className="font-semibold text-gray-800">{item.paymentSenderName || '-'}</span>
                      </p>
                      <p>
                        ID transaction:{' '}
                        <span className="font-semibold font-mono text-gray-800">{item.paymentTransactionId || '-'}</span>
                      </p>
                    </div>
                  </article>
                ))
              )}
            </section>
          )}

          {activeTab === 'revenue' && (
            <section className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <article className="rounded-2xl border border-gray-200 bg-white p-4">
                  <p className="text-xs text-gray-500 uppercase flex items-center gap-1">
                    <TrendingUp className="h-3.5 w-3.5" /> Journalier
                  </p>
                  <p className="text-xl font-bold text-gray-900">{formatCurrency(dashboard?.revenue?.daily?.totalRevenue)}</p>
                </article>
                <article className="rounded-2xl border border-gray-200 bg-white p-4">
                  <p className="text-xs text-gray-500 uppercase flex items-center gap-1">
                    <CalendarClock className="h-3.5 w-3.5" /> Hebdomadaire
                  </p>
                  <p className="text-xl font-bold text-gray-900">{formatCurrency(dashboard?.revenue?.weekly?.totalRevenue)}</p>
                </article>
                <article className="rounded-2xl border border-gray-200 bg-white p-4">
                  <p className="text-xs text-gray-500 uppercase flex items-center gap-1">
                    <BarChart3 className="h-3.5 w-3.5" /> Mensuel
                  </p>
                  <p className="text-xl font-bold text-gray-900">{formatCurrency(dashboard?.revenue?.monthly?.totalRevenue)}</p>
                </article>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <h3 className="text-sm font-bold text-gray-900 mb-3">Revenus par type</h3>
                <div className="space-y-2">
                  {topTypes.map((item) => (
                    <div key={item.boostType} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">{item.boostType}</span>
                      <span className="font-semibold text-gray-900">{formatCurrency(item.revenue)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
