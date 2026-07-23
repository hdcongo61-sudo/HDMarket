import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { formatPriceWithStoredSettings } from "../utils/priceFormatter";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Gavel,
  Paperclip,
  RefreshCw,
  Search,
  ShieldAlert
} from 'lucide-react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { AdminCommandHero, AdminSegmentedControl } from '../components/admin/AdminCommandSurface';

const STATUS_OPTIONS = [
  { value: '', label: 'Tous', icon: ShieldAlert },
  { value: 'OPEN', label: 'Ouverts', icon: AlertCircle },
  { value: 'SELLER_RESPONDED', label: 'Réponse vendeur', icon: Clock3 },
  { value: 'UNDER_REVIEW', label: 'En revue', icon: Gavel },
  { value: 'RESOLVED_CLIENT', label: 'Résolus client', icon: CheckCircle2 },
  { value: 'RESOLVED_SELLER', label: 'Résolus vendeur', icon: CheckCircle2 },
  { value: 'REJECTED', label: 'Rejetés', icon: ShieldAlert }
];

const STATUS_STYLES = {
  OPEN: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300',
  SELLER_RESPONDED: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200',
  UNDER_REVIEW: 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300',
  RESOLVED_CLIENT: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300',
  RESOLVED_SELLER: 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-300',
  REJECTED: 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300'
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

const getDeliveryProofLabel = (order = {}) =>
  String(order?.deliveryMode || '').toUpperCase() === 'PICKUP'
    ? 'Preuves de retrait boutique'
    : 'Preuves de livraison';

export default function AdminComplaints() {
  const { showToast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('OPEN');
  const [queryDraft, setQueryDraft] = useState('');
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
    (dispute) => {
      const order = dispute?.orderId || {};
      return {
        ...dispute,
        orderId: order
          ? {
              ...order,
              deliveryProofImages: (order?.deliveryProofImages || []).map((file) => ({
                ...file,
                url: normalizeUrl(file?.url || file?.path || '')
              })),
              clientSignatureImage: order?.clientSignatureImage || ''
            }
          : order,
        proofImages: (dispute?.proofImages || []).map((file) => ({
          ...file,
          url: normalizeUrl(file?.url || file?.path || '')
        })),
        sellerProofImages: (dispute?.sellerProofImages || []).map((file) => ({
          ...file,
          url: normalizeUrl(file?.url || file?.path || '')
        }))
      };
    },
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

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setQuery(queryDraft.trim());
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [queryDraft]);

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
    decisionDrafts[id] || { resolutionType: 'refund_full', resolutionAmount: '', favor: 'client', adminDecision: '' };

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
    if (
      ['refund_partial', 'compensation'].includes(draft.resolutionType) &&
      (!Number.isFinite(Number(draft.resolutionAmount)) || Number(draft.resolutionAmount) <= 0)
    ) {
      showToast('Indiquez un montant de remboursement valide.', { variant: 'error' });
      return;
    }
    setActioningId(id);
    try {
      await api.patch(`/disputes/admin/${id}/decision`, {
        resolutionType: draft.resolutionType,
        resolutionAmount: ['refund_partial', 'compensation'].includes(draft.resolutionType)
          ? Number(draft.resolutionAmount)
          : undefined,
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

  const refreshRefund = async (refundId) => {
    if (!refundId) return;
    setActioningId(`refund-${refundId}`);
    try {
      await api.post(`/payments/pawapay/refunds/${encodeURIComponent(refundId)}/refresh`);
      showToast('Statut du remboursement actualisé.', { variant: 'success' });
      await loadDisputes();
    } catch (err) {
      showToast(err.response?.data?.message || 'Impossible d’actualiser le remboursement.', {
        variant: 'error'
      });
    } finally {
      setActioningId('');
    }
  };

  const activeCount = items.filter((item) => !['RESOLVED_CLIENT', 'RESOLVED_SELLER', 'REJECTED'].includes(item.status)).length;
  const reviewCount = items.filter((item) => item.status === 'UNDER_REVIEW' || item.status === 'SELLER_RESPONDED').length;
  const closedCount = items.filter((item) => ['RESOLVED_CLIENT', 'RESOLVED_SELLER', 'REJECTED'].includes(item.status)).length;
  const statusOptions = STATUS_OPTIONS.map((option) => ({
    ...option,
    count: option.value ? items.filter((item) => item.status === option.value).length : items.length
  }));

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-950 dark:bg-neutral-950 dark:text-white lg:min-h-0">
      <div className="mx-auto max-w-7xl space-y-4 px-3 py-4 sm:px-4 sm:py-6 lg:px-8">
        <AdminCommandHero
          eyebrow="Support commerce"
          title="Réclamations & litiges"
          subtitle="Arbitrez les réclamations post-livraison avec les preuves client, la réponse vendeur, les messages de commande et une décision admin traçable."
          meta={query ? `Recherche active: ${query}` : 'File opérationnelle support'}
          metrics={[
            { label: 'Affichés', value: loading ? '...' : items.length, help: STATUS_LABELS[statusFilter] || 'Tous statuts', icon: ShieldAlert },
            { label: 'Actifs', value: activeCount, help: 'À traiter', icon: AlertCircle },
            { label: 'En revue', value: reviewCount, help: 'Vendeur/admin', icon: Gavel },
            { label: 'Clôturés', value: closedCount, help: 'Décisions rendues', icon: CheckCircle2 }
          ]}
          actions={[
            {
              label: 'Deadlines',
              description: 'Vérifier les réponses vendeur',
              icon: Clock3,
              tone: 'amber',
              loading: refreshingDeadlines,
              onClick: triggerDeadlineCheck
            },
            {
              label: 'Actualiser',
              description: 'Recharger les litiges',
              icon: RefreshCw,
              tone: 'dark',
              loading,
              onClick: loadDisputes
            }
          ]}
        />

        <section className="rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center">
            <AdminSegmentedControl
              className="border-0 bg-transparent p-0 shadow-none"
              options={statusOptions}
              value={statusFilter}
              onChange={(value) => setStatusFilter(value)}
            />
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
                value={queryDraft}
                onChange={(e) => setQueryDraft(e.target.value)}
              placeholder="Rechercher (adresse, ville, paiement...)"
                className="min-h-[46px] w-full rounded-2xl border border-neutral-200 bg-neutral-50 pl-10 pr-3 text-sm font-medium outline-none transition focus:border-neutral-400 focus:bg-white dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
            />
            </div>
          </div>
        </section>

        {error && (
          <div className="inline-flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid gap-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-48 animate-pulse rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-center shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-neutral-100 text-neutral-500 dark:bg-neutral-900 dark:text-neutral-300">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <p className="mt-3 text-sm font-bold text-neutral-950 dark:text-white">Aucun litige pour ce filtre</p>
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">La file support est vide ou la recherche ne retourne aucun résultat.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => {
              const draft = getDraft(item._id);
              const isClosed = ['RESOLVED_CLIENT', 'RESOLVED_SELLER', 'REJECTED'].includes(item.status);
              return (
                <li key={item._id} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-neutral-800 dark:bg-neutral-950">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold text-neutral-950 dark:text-white">
                        Litige #{String(item._id).slice(-6)} · Cmd #{String(item?.orderId?._id || '').slice(-6)}
                      </p>
                      <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                        Ouvert le {formatDate(item.createdAt)} · Motif: {reasonLabel(item.reason)}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-[11px] font-bold ${
                        STATUS_STYLES[item.status] || 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200'
                      }`}
                    >
                      {STATUS_LABELS[item.status] || item.status}
                    </span>
                  </div>

                  <div className="mt-3 grid gap-3 text-sm md:grid-cols-3">
                    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900/70">
                      <p className="mb-1 text-xs font-bold text-neutral-500 dark:text-neutral-400">Client</p>
                      <p className="font-semibold text-neutral-950 dark:text-white">{item?.clientId?.name || '—'}</p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">{item?.clientId?.email || '—'}</p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">{item?.clientId?.phone || '—'}</p>
                    </div>
                    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900/70">
                      <p className="mb-1 text-xs font-bold text-neutral-500 dark:text-neutral-400">Vendeur</p>
                      <p className="font-semibold text-neutral-950 dark:text-white">
                        {item?.sellerId?.shopName || item?.sellerId?.name || '—'}
                      </p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">{item?.sellerId?.email || '—'}</p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">{item?.sellerId?.phone || '—'}</p>
                    </div>
                    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900/70">
                      <p className="mb-1 text-xs font-bold text-neutral-500 dark:text-neutral-400">Commande / Paiement</p>
                      <p className="text-xs text-neutral-600 dark:text-neutral-300">Statut: {item?.orderId?.status || '—'}</p>
                      <p className="text-xs text-neutral-600 dark:text-neutral-300">Total: {money(item?.orderId?.totalAmount)}</p>
                      <p className="text-xs text-neutral-600 dark:text-neutral-300">Payé: {money(item?.orderId?.paidAmount)}</p>
                      <p className="text-xs text-neutral-600 dark:text-neutral-300">Reste: {money(item?.orderId?.remainingAmount)}</p>
                      <p className="text-xs text-neutral-600 dark:text-neutral-300">
                        Paiement: {item?.orderId?.paymentName || '—'} ({item?.orderId?.paymentTransactionCode || '—'})
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900/70 dark:text-neutral-300">
                    <p className="mb-1 text-xs font-bold text-neutral-500 dark:text-neutral-400">Livraison</p>
                    <p>
                      {item?.orderId?.deliveryAddress || '—'} · {item?.orderId?.deliveryCity || '—'}
                    </p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">Livré le: {formatDate(item?.orderId?.deliveredAt)}</p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">Preuve soumise le: {formatDate(item?.orderId?.deliverySubmittedAt)}</p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">Deadline vendeur: {formatDate(item?.sellerDeadline)}</p>
                  </div>

                  {(
                    item?.orderId?.deliveryProofImages?.length > 0 ||
                    item?.orderId?.clientSignatureImage ||
                    item?.orderId?.deliveryNote
                  ) && (
                    <div className="mt-3 rounded-2xl border border-sky-100 bg-sky-50/70 p-3 dark:border-sky-900/40 dark:bg-sky-950/20">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-black uppercase tracking-wide text-sky-800 dark:text-sky-200">
                          {getDeliveryProofLabel(item.orderId)}
                        </p>
                        <p className="text-[11px] font-semibold text-sky-700 dark:text-sky-300">
                          Signature: {item?.orderId?.clientSignatureImage ? 'présente' : 'absente'}
                        </p>
                      </div>
                      {item?.orderId?.deliveryProofImages?.length > 0 && (
                        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
                          {item.orderId.deliveryProofImages.map((file, index) => (
                            <a
                              key={`${item._id}-delivery-proof-${index}`}
                              href={file.url}
                              target="_blank"
                              rel="noreferrer"
                              className="group overflow-hidden rounded-xl border border-white bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-sky-900/40 dark:bg-neutral-950"
                            >
                              <img
                                src={file.url}
                                alt={`Preuve ${index + 1}`}
                                className="h-24 w-full object-cover"
                                loading="lazy"
                              />
                              <span className="block truncate px-2 py-1.5 text-[10px] font-bold text-sky-800 dark:text-sky-200">
                                Photo {index + 1}
                              </span>
                            </a>
                          ))}
                        </div>
                      )}
                      {item?.orderId?.clientSignatureImage && (
                        <a
                          href={item.orderId.clientSignatureImage}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-3 block overflow-hidden rounded-xl border border-white bg-white p-2 shadow-sm dark:border-sky-900/40 dark:bg-neutral-950"
                        >
                          <p className="mb-2 text-[11px] font-bold text-sky-800 dark:text-sky-200">Signature client</p>
                          <img
                            src={item.orderId.clientSignatureImage}
                            alt="Signature client"
                            className="max-h-32 w-full object-contain"
                            loading="lazy"
                          />
                        </a>
                      )}
                      {item?.orderId?.deliveryNote && (
                        <p className="mt-3 rounded-xl bg-white/80 p-2 text-xs font-semibold text-sky-900 dark:bg-neutral-950 dark:text-sky-100">
                          Note: {item.orderId.deliveryNote}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="mt-3">
                    <p className="mb-1 text-xs font-bold text-neutral-500 dark:text-neutral-400">Description client</p>
                    <p className="whitespace-pre-line text-sm leading-6 text-neutral-700 dark:text-neutral-300">{item.description}</p>
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
                    <div className="mt-3 rounded-xl border border-neutral-100 bg-neutral-50 p-3">
                      <p className="text-xs font-semibold text-neutral-700">Réponse vendeur</p>
                      <p className="text-sm text-neutral-900 whitespace-pre-line">{item.sellerResponse}</p>
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
                          className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-xs text-neutral-700"
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
                      {Number(item.resolutionAmount || 0) > 0 && (
                        <p className="mt-1 text-xs font-semibold text-emerald-800">
                          Montant: {money(item.resolutionAmount)}
                        </p>
                      )}
                      {item?.orderId?.refundStatus && item.orderId.refundStatus !== 'none' && (
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-emerald-800">
                          <span>
                            PawaPay: {item.orderId.refundStatus === 'processed' ? 'confirmé' : item.orderId.refundStatus === 'failed' ? 'échec' : 'en cours'}
                          </span>
                          {item.orderId.refundId && (
                            <button
                              type="button"
                              onClick={() => refreshRefund(item.orderId.refundId)}
                              disabled={actioningId === `refund-${item.orderId.refundId}`}
                              className="rounded-lg border border-emerald-300 bg-white px-2 py-1 font-semibold disabled:opacity-50"
                            >
                              {actioningId === `refund-${item.orderId.refundId}` ? 'Vérification...' : 'Vérifier chez PawaPay'}
                            </button>
                          )}
                        </div>
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
                      {['refund_partial', 'compensation'].includes(draft.resolutionType) && (
                        <label className="mt-2 block text-xs font-semibold text-amber-900">
                          Montant à rembourser (FCFA)
                          <input
                            type="number"
                            min="1"
                            max={Number(item?.orderId?.paidAmount || item?.orderId?.totalAmount || 0)}
                            value={draft.resolutionAmount}
                            onChange={(e) => setDraft(item._id, { resolutionAmount: e.target.value })}
                            className="mt-1 w-full rounded-lg border border-amber-200 bg-white px-2.5 py-2 text-xs md:max-w-xs"
                            required
                          />
                        </label>
                      )}
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
