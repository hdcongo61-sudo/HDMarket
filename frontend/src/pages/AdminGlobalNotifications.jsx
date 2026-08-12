import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Eye,
  Loader2,
  Megaphone,
  MousePointerClick,
  RefreshCw,
  Users,
  XCircle
} from 'lucide-react';
import api from '../services/api';
import { useAppSettings } from '../context/AppSettingsContext';
import { formatPriceWithStoredSettings as formatCurrency } from '../utils/priceFormatter';

const STATUS_TONES = {
  PENDING: 'bg-amber-50 text-amber-700',
  SENT: 'bg-emerald-50 text-emerald-700',
  REJECTED: 'bg-red-50 text-red-700'
};

const STATUS_LABELS = {
  PENDING: 'En attente',
  SENT: 'Diffusée',
  REJECTED: 'Rejetée'
};

const formatDate = (value) =>
  value
    ? new Date(value).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    : '—';

export default function AdminGlobalNotifications() {
  const { cities } = useAppSettings();
  const [searchParams] = useSearchParams();
  const highlightedId = searchParams.get('requestId') || '';

  const [items, setItems] = useState([]);
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actioningId, setActioningId] = useState('');

  const [pricingItems, setPricingItems] = useState([]);
  const [pricingCity, setPricingCity] = useState('');
  const [pricingValue, setPricingValue] = useState('');
  const [pricingSaving, setPricingSaving] = useState(false);
  const [pricingError, setPricingError] = useState('');

  const cityOptions = useMemo(() => {
    const names = Array.isArray(cities) ? cities.map((item) => String(item?.name || '').trim()).filter(Boolean) : [];
    return Array.from(new Set(names));
  }, [cities]);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/global-notifications/admin/requests', {
        params: { status: statusFilter || undefined, limit: 50 }
      });
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Impossible de charger les demandes.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  const loadPricing = useCallback(async () => {
    try {
      const { data } = await api.get('/global-notifications/admin/pricing');
      setPricingItems(Array.isArray(data?.items) ? data.items : []);
    } catch {
      // Non-blocking — the pending queue is the priority view.
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  useEffect(() => {
    loadPricing();
  }, [loadPricing]);

  const savePricing = async (event) => {
    event.preventDefault();
    setPricingSaving(true);
    setPricingError('');
    try {
      await api.post('/global-notifications/admin/pricing', {
        city: pricingCity || null,
        price: Number(pricingValue)
      });
      setPricingValue('');
      await loadPricing();
    } catch (requestError) {
      setPricingError(requestError?.response?.data?.message || 'Impossible d’enregistrer ce tarif.');
    } finally {
      setPricingSaving(false);
    }
  };

  const handleSend = async (id) => {
    setActioningId(id);
    try {
      await api.post(`/global-notifications/admin/requests/${id}/send`);
      await loadRequests();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Impossible de diffuser cette notification.');
    } finally {
      setActioningId('');
    }
  };

  const handleReject = async (id) => {
    const rejectionReason = window.prompt('Motif du rejet (optionnel) :', '') || '';
    setActioningId(id);
    try {
      await api.post(`/global-notifications/admin/requests/${id}/reject`, { rejectionReason });
      await loadRequests();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Impossible de rejeter cette demande.');
    } finally {
      setActioningId('');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 px-3 py-4 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="flex flex-col gap-4 rounded-2xl border border-gray-100 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link to="/admin" className="mb-2 inline-flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-gray-900">
              <ArrowLeft className="h-4 w-4" />
              Admin
            </Link>
            <h1 className="text-2xl font-black text-slate-950">Notifications globales sponsorisées</h1>
            <p className="mt-1 text-sm text-gray-500">
              Le paiement PawaPay est déjà confirmé — validez le contenu puis diffusez, ou rejetez.
            </p>
          </div>
          <button
            type="button"
            onClick={loadRequests}
            disabled={loading}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 text-sm font-bold text-gray-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
        </header>

        <section className="rounded-2xl border border-gray-100 bg-white p-4">
          <p className="mb-3 text-xs font-bold uppercase text-gray-400">Tarification (déterminée par l’admin)</p>
          <form onSubmit={savePricing} className="flex flex-wrap items-end gap-3">
            <label className="space-y-1">
              <span className="text-xs font-semibold text-gray-500">Ville</span>
              <select
                value={pricingCity}
                onChange={(e) => setPricingCity(e.target.value)}
                className="ui-input rounded-xl px-3 py-2 text-sm"
              >
                <option value="">Toutes les villes (national)</option>
                {cityOptions.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-gray-500">Prix (FCFA)</span>
              <input
                type="number"
                min={0}
                required
                value={pricingValue}
                onChange={(e) => setPricingValue(e.target.value)}
                className="ui-input w-32 rounded-xl px-3 py-2 text-sm"
              />
            </label>
            <button
              type="submit"
              disabled={pricingSaving}
              className="inline-flex min-h-10 items-center rounded-xl bg-[#0b6b4f] px-4 text-sm font-bold text-white disabled:opacity-50"
            >
              {pricingSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enregistrer'}
            </button>
          </form>
          {pricingError && <p className="mt-2 text-xs font-semibold text-red-600">{pricingError}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {pricingItems.map((item) => (
              <span key={item._id} className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1.5 text-xs font-bold text-gray-700">
                {item.city || 'National'} · {formatCurrency(item.price)}
              </span>
            ))}
            {!pricingItems.length && <p className="text-sm text-gray-400">Aucun tarif configuré pour l’instant.</p>}
          </div>
        </section>

        <section className="flex flex-wrap gap-2">
          {['PENDING', 'SENT', 'REJECTED', ''].map((status) => (
            <button
              key={status || 'ALL'}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`rounded-full px-3.5 py-2 text-xs font-bold transition ${
                statusFilter === status ? 'bg-black text-white' : 'border border-gray-200 bg-white text-gray-600'
              }`}
            >
              {status ? STATUS_LABELS[status] : 'Toutes'}
            </button>
          ))}
        </section>

        {error ? (
          <p className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</p>
        ) : null}

        <section className="space-y-3">
          {loading ? (
            <p className="rounded-2xl border border-gray-100 bg-white p-6 text-center text-sm text-gray-500">Chargement…</p>
          ) : !items.length ? (
            <p className="rounded-2xl border border-dashed border-gray-200 bg-white p-6 text-center text-sm text-gray-500">Aucune demande.</p>
          ) : (
            items.map((item) => (
              <article
                key={item.id}
                className={`rounded-2xl border bg-white p-4 shadow-sm ${
                  String(item.id) === highlightedId ? 'border-[#e85d00] ring-2 ring-[#e85d00]/30' : 'border-gray-100'
                }`}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 gap-3">
                    {item.image?.url && (
                      <img src={item.image.url} alt={item.title} className="h-16 w-16 shrink-0 rounded-xl object-cover" />
                    )}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${STATUS_TONES[item.status] || 'bg-gray-100 text-gray-600'}`}>
                          {STATUS_LABELS[item.status] || item.status}
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                          <Clock3 className="h-3 w-3" /> {formatDate(item.createdAt)}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-sm font-black text-slate-950">{item.title}</p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-gray-600">{item.message}</p>
                      <p className="mt-1 text-xs text-gray-500">
                        {item.seller?.shopName || item.seller?.name || 'Vendeur'} · {item.seller?.phone || '—'}
                        {item.product?.title ? ` · Produit: ${item.product.title}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-sm font-black text-slate-950">{formatCurrency(item.price)}</span>
                    <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                      <Megaphone className="h-3 w-3" /> {item.audienceCity || 'Toutes villes'} · {item.audienceGender}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                      <Users className="h-3 w-3" /> ~{item.estimatedReach || 0} au moment de la demande
                    </span>
                  </div>
                </div>

                {item.status === 'SENT' && (
                  <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-center">
                    <div>
                      <p className="text-[11px] font-bold uppercase text-emerald-700">Objectif atteint</p>
                      <p className="text-base font-black text-emerald-900">{item.matchedCount || 0}</p>
                    </div>
                    <div>
                      <p className="flex items-center justify-center gap-1 text-[11px] font-bold uppercase text-emerald-700"><Eye className="h-3 w-3" />Ouvertes</p>
                      <p className="text-base font-black text-emerald-900">{item.stats?.opened || 0}</p>
                    </div>
                    <div>
                      <p className="flex items-center justify-center gap-1 text-[11px] font-bold uppercase text-emerald-700"><MousePointerClick className="h-3 w-3" />Clics</p>
                      <p className="text-base font-black text-emerald-900">{item.stats?.clicked || 0}</p>
                    </div>
                  </div>
                )}

                {item.rejectionReason && (
                  <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-2.5 py-2 text-xs text-red-700">Motif rejet: {item.rejectionReason}</p>
                )}

                {item.status === 'PENDING' && (
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleSend(item.id)}
                      disabled={actioningId === item.id}
                      className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#0b6b4f] text-sm font-bold text-white disabled:opacity-50"
                    >
                      {actioningId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      Confirmer et diffuser
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReject(item.id)}
                      disabled={actioningId === item.id}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-200 px-4 text-sm font-bold text-red-700 disabled:opacity-50"
                    >
                      <XCircle className="h-4 w-4" />
                      Rejeter
                    </button>
                  </div>
                )}
              </article>
            ))
          )}
        </section>
      </div>
    </div>
  );
}
