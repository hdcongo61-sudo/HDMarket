import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { formatPriceWithStoredSettings } from "../utils/priceFormatter";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Gavel,
  Paperclip,
  RefreshCw,
  ShieldAlert
} from 'lucide-react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';

const STATUS_OPTIONS = [
  { value: '', label: 'Tous' },
  { value: 'OPEN', label: 'Ouverts' },
  { value: 'SELLER_RESPONDED', label: 'Réponse vendeur' },
  { value: 'UNDER_REVIEW', label: 'En revue' },
  { value: 'RESOLVED_CLIENT', label: 'Résolus client' },
  { value: 'RESOLVED_SELLER', label: 'Résolus vendeur' },
  { value: 'REJECTED', label: 'Rejetés' }
];

const STATUS_STYLES = {
  OPEN: 'bg-amber-100 text-amber-800',
  SELLER_RESPONDED: 'bg-indigo-100 text-indigo-800',
  UNDER_REVIEW: 'bg-blue-100 text-blue-800',
  RESOLVED_CLIENT: 'bg-emerald-100 text-emerald-800',
  RESOLVED_SELLER: 'bg-green-100 text-green-800',
  REJECTED: 'bg-rose-100 text-rose-800'
};

const STATUS_LABELS = Object.fromEntries(STATUS_OPTIONS.filter((o) => o.value).map((o) => [o.value, o.label]));

const RESOLUTION_OPTIONS = [
  { value: 'refund_full', label: 'Remboursement total', favor: 'client' },
  { value: 'refund_partial', label: 'Remboursement partiel', favor: 'client' },
  { value: 'compensation', label: 'Compensation', favor: 'client' },
  { value: 'reject', label: 'Rejet', favor: 'seller' }
];

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const money = (value) => formatPriceWithStoredSettings(value);

const reasonLabel = (reason) => {
  if (reason === 'wrong_item') return 'Article incorrect';
  if (reason === 'damaged_item') return 'Article endommagé';
  if (reason === 'not_received') return 'Non reçu';
  return 'Autre';
};

export default function AdminComplaints() {
  const { showToast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('OPEN');
  const [query, setQuery] = useState('');
  const [refreshingDeadlines, setRefreshingDeadlines] = useState(false);
  const [actioningId, setActioningId] = useState('');
  const [decisionDrafts, setDecisionDrafts] = useState({});

  const filesBase = useMemo(() => {
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
    return apiBase.replace(/\/api\/?$/, '');
  }, []);

  const normalizeUrl = useCallback(
    (url) => {
      if (!url) return '';
      const cleaned = String(url).replace(/\\/g, '/');
      if (/^https?:\/\//i.test(cleaned)) return cleaned;
      return `${filesBase}/${cleaned.replace(/^\/+/, '')}`;
    },
    [filesBase]
  );

  const normalizeDispute = useCallback(
    (dispute) => ({
      ...dispute,
      proofImages: (dispute?.proofImages || []).map((file) => ({
        ...file,
        url: normalizeUrl(file?.url || file?.path || '')
      })),
      sellerProofImages: (dispute?.sellerProofImages || []).map((file) => ({
        ...file,
        url: normalizeUrl(file?.url || file?.path || '')
      }))
    }),
    [normalizeUrl]
  );

  const loadDisputes = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (query.trim()) params.q = query.trim();
      const { data } = await api.get('/disputes/admin', { params });
      const list = Array.isArray(data) ? data : [];
      setItems(list.map(normalizeDispute));
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Erreur chargement litiges.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [normalizeDispute, query, statusFilter]);

  useEffect(() => {
    loadDisputes();
  }, [loadDisputes]);

  const triggerDeadlineCheck = async () => {
    setRefreshingDeadlines(true);
    try {
      await api.post('/disputes/admin/deadline-check');
      await loadDisputes();
      showToast('Vérification des deadlines effectuée.', { variant: 'success' });
    } catch (err) {
      showToast(err.response?.data?.message || 'Impossible de vérifier les deadlines.', {
        variant: 'error'
      });
    } finally {
      setRefreshingDeadlines(false);
    }
  };

  const getDraft = (id) =>
    decisionDrafts[id] || { resolutionType: 'refund_full', favor: 'client', adminDecision: '' };

  const setDraft = (id, patch) => {
    setDecisionDrafts((prev) => ({
      ...prev,
      [id]: { ...getDraft(id), ...patch }
    }));
  };

  const applyDecision = async (id) => {
    const draft = getDraft(id);
    if (!draft.adminDecision || draft.adminDecision.trim().length < 5) {
      showToast('Décision admin trop courte.', { variant: 'error' });
      return;
    }
    setActioningId(id);
    try {
      await api.patch(`/disputes/admin/${id}/decision`, {
        resolutionType: draft.resolutionType,
        favor: draft.favor,
        adminDecision: draft.adminDecision.trim()
      });
      showToast('Litige résolu.', { variant: 'success' });
      await loadDisputes();
    } catch (err) {
      showToast(err.response?.data?.message || 'Impossible de résoudre ce litige.', {
        variant: 'error'
      });
    } finally {
      setActioningId('');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50/20 lg:min-h-0 lg:bg-transparent">
      <div className="mx-auto max-w-7xl px-4 py-8 space-y-6 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-indigo-600 p-3 text-white">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Arbitrage des litiges</h1>
              <p className="text-sm text-gray-500">Gestion complète des réclamations post-livraison.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={triggerDeadlineCheck}
              disabled={refreshingDeadlines}
              className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700"
            >
              <Clock3 className={`h-4 w-4 ${refreshingDeadlines ? 'animate-spin' : ''}`} />
              Vérifier deadlines
            </button>
            <button
              type="button"
              onClick={loadDisputes}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Actualiser
            </button>
          </div>
        </header>

        <section className="rounded-2xl border border-gray-200/60 bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-[220px_1fr]">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value || 'all'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher (adresse, ville, paiement...)"
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
            />
          </div>
        </section>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 inline-flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-12 flex justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-gray-500">Aucun litige pour ce filtre.</p>
        ) : (
          <ul className="space-y-4">
            {items.map((item) => {
              const draft = getDraft(item._id);
              const isClosed = ['RESOLVED_CLIENT', 'RESOLVED_SELLER', 'REJECTED'].includes(item.status);
              return (
                <li key={item._id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        Litige #{String(item._id).slice(-6)} · Cmd #{String(item?.orderId?._id || '').slice(-6)}
                      </p>
                      <p className="text-xs text-gray-500">
                        Ouvert le {formatDate(item.createdAt)} · Motif: {reasonLabel(item.reason)}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                        STATUS_STYLES[item.status] || 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {STATUS_LABELS[item.status] || item.status}
                    </span>
                  </div>

                  <div className="mt-3 grid gap-3 text-sm md:grid-cols-3">
                    <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                      <p className="text-xs font-semibold text-gray-600 mb-1">Client</p>
                      <p className="font-medium text-gray-900">{item?.clientId?.name || '—'}</p>
                      <p className="text-xs text-gray-600">{item?.clientId?.email || '—'}</p>
                      <p className="text-xs text-gray-600">{item?.clientId?.phone || '—'}</p>
                    </div>
                    <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                      <p className="text-xs font-semibold text-gray-600 mb-1">Vendeur</p>
                      <p className="font-medium text-gray-900">
                        {item?.sellerId?.shopName || item?.sellerId?.name || '—'}
                      </p>
                      <p className="text-xs text-gray-600">{item?.sellerId?.email || '—'}</p>
                      <p className="text-xs text-gray-600">{item?.sellerId?.phone || '—'}</p>
                    </div>
                    <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                      <p className="text-xs font-semibold text-gray-600 mb-1">Commande / Paiement</p>
                      <p className="text-xs text-gray-700">Statut: {item?.orderId?.status || '—'}</p>
                      <p className="text-xs text-gray-700">Total: {money(item?.orderId?.totalAmount)}</p>
                      <p className="text-xs text-gray-700">Payé: {money(item?.orderId?.paidAmount)}</p>
                      <p className="text-xs text-gray-700">Reste: {money(item?.orderId?.remainingAmount)}</p>
                      <p className="text-xs text-gray-700">
                        Paiement: {item?.orderId?.paymentName || '—'} ({item?.orderId?.paymentTransactionCode || '—'})
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 rounded-xl border border-gray-100 bg-gray-50 p-3 text-sm text-gray-700">
                    <p className="text-xs font-semibold text-gray-600 mb-1">Livraison</p>
                    <p>
                      {item?.orderId?.deliveryAddress || '—'} · {item?.orderId?.deliveryCity || '—'}
                    </p>
                    <p className="text-xs text-gray-500">Livré le: {formatDate(item?.orderId?.deliveredAt)}</p>
                    <p className="text-xs text-gray-500">Deadline vendeur: {formatDate(item?.sellerDeadline)}</p>
                  </div>

                  <div className="mt-3">
                    <p className="text-xs font-semibold text-gray-600 mb-1">Description client</p>
                    <p className="text-sm text-gray-700 whitespace-pre-line">{item.description}</p>
                  </div>

                  {item.proofImages?.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {item.proofImages.map((file, index) => (
                        <a
                          key={`${item._id}-cp-${index}`}
                          href={file.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs text-gray-700"
                        >
                          <Paperclip className="h-3.5 w-3.5" />
                          {file.originalName || file.filename || 'preuve client'}
                        </a>
                      ))}
                    </div>
                  )}

                  {item.sellerResponse && (
                    <div className="mt-3 rounded-xl border border-indigo-100 bg-indigo-50 p-3">
                      <p className="text-xs font-semibold text-indigo-700">Réponse vendeur</p>
                      <p className="text-sm text-indigo-900 whitespace-pre-line">{item.sellerResponse}</p>
                    </div>
                  )}

                  {item.sellerProofImages?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {item.sellerProofImages.map((file, index) => (
                        <a
                          key={`${item._id}-sp-${index}`}
                          href={file.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-xs text-indigo-700"
                        >
                          <Paperclip className="h-3.5 w-3.5" />
                          {file.originalName || file.filename || 'preuve vendeur'}
                        </a>
                      ))}
                    </div>
                  )}

                  <div className="mt-3 rounded-xl border border-gray-100 bg-gray-50 p-3 text-xs text-gray-600">
                    Chat commande: {Number(item?.chatSummary?.count || 0)} message(s) · Dernier message:{' '}
                    {formatDate(item?.chatSummary?.lastMessageAt)}
                  </div>

                  {item.adminDecision && (
                    <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 p-3">
                      <p className="text-xs font-semibold text-emerald-700">Décision admin</p>
                      <p className="text-sm text-emerald-900 whitespace-pre-line">{item.adminDecision}</p>
                      {item.resolutionType && (
                        <p className="text-xs text-emerald-700 mt-1">
                          Type: {RESOLUTION_OPTIONS.find((r) => r.value === item.resolutionType)?.label || item.resolutionType}
                        </p>
                      )}
                      {item.resolvedAt && (
                        <p className="inline-flex items-center gap-1 text-xs text-emerald-700 mt-1">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Clôturé le {formatDate(item.resolvedAt)}
                        </p>
                      )}
                    </div>
                  )}

                  {!isClosed && (
                    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
                      <p className="inline-flex items-center gap-2 text-xs font-semibold text-amber-700 mb-2">
                        <Gavel className="h-4 w-4" />
                        Décision admin
                      </p>
                      <div className="grid gap-2 md:grid-cols-[220px_180px_1fr]">
                        <select
                          value={draft.resolutionType}
                          onChange={(e) => {
                            const nextType = e.target.value;
                            const defaultFavor =
                              RESOLUTION_OPTIONS.find((opt) => opt.value === nextType)?.favor || 'client';
                            setDraft(item._id, { resolutionType: nextType, favor: defaultFavor });
                          }}
                          className="rounded-lg border border-amber-200 bg-white px-2.5 py-2 text-xs"
                        >
                          {RESOLUTION_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <select
                          value={draft.favor}
                          onChange={(e) => setDraft(item._id, { favor: e.target.value })}
                          className="rounded-lg border border-amber-200 bg-white px-2.5 py-2 text-xs"
                        >
                          <option value="client">Faveur client</option>
                          <option value="seller">Faveur vendeur</option>
                        </select>
                        <textarea
                          rows={2}
                          value={draft.adminDecision}
                          onChange={(e) => setDraft(item._id, { adminDecision: e.target.value })}
                          placeholder="Décision détaillée..."
                          className="rounded-lg border border-amber-200 bg-white px-2.5 py-2 text-xs"
                        />
                      </div>
                      <div className="mt-2 flex justify-end">
                        <button
                          type="button"
                          onClick={() => applyDecision(item._id)}
                          disabled={actioningId === item._id}
                          className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
                        >
                          {actioningId === item._id ? (
                            <>
                              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                              Traitement...
                            </>
                          ) : (
                            <>
                              <Gavel className="h-3.5 w-3.5" />
                              Valider la décision
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
