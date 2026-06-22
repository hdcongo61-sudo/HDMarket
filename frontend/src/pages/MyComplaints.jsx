import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { formatPriceWithStoredSettings } from "../utils/priceFormatter";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  FileText,
  MessageCircle,
  Paperclip,
  ShieldAlert,
  Upload,
  User
} from 'lucide-react';
import AuthContext from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../services/api';

const DISPUTE_WINDOW_HOURS = Number(import.meta.env.VITE_DISPUTE_WINDOW_HOURS || 72);
const MAX_DESCRIPTION = 2000;
const MAX_FILES = 5;

const REASON_OPTIONS = [
  { value: 'wrong_item', label: 'Article incorrect' },
  { value: 'damaged_item', label: 'Article endommagé' },
  { value: 'not_received', label: 'Non reçu' },
  { value: 'other', label: 'Autre' }
];

const STATUS_LABELS = {
  OPEN: 'Ouvert',
  SELLER_RESPONDED: 'Réponse vendeur',
  UNDER_REVIEW: 'En revue admin',
  RESOLVED_CLIENT: 'Résolu client',
  RESOLVED_SELLER: 'Résolu vendeur',
  REJECTED: 'Rejeté'
};

const STATUS_STYLES = {
  OPEN: 'bg-amber-100 text-amber-800',
  SELLER_RESPONDED: 'bg-neutral-100 text-neutral-800',
  UNDER_REVIEW: 'bg-neutral-100 text-neutral-800',
  RESOLVED_CLIENT: 'bg-emerald-100 text-emerald-800',
  RESOLVED_SELLER: 'bg-green-100 text-green-800',
  REJECTED: 'bg-neutral-100 text-neutral-800'
};

const RESOLUTION_LABELS = {
  refund_full: 'Remboursement total',
  refund_partial: 'Remboursement partiel',
  compensation: 'Compensation',
  reject: 'Rejet'
};

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

const amount = (value) => formatPriceWithStoredSettings(value);

const timelineLevel = (status) => {
  if (status === 'OPEN') return 0;
  if (status === 'SELLER_RESPONDED') return 1;
  if (status === 'UNDER_REVIEW') return 2;
  return 3;
};

const DisputeTimeline = ({ status }) => {
  const level = timelineLevel(status);
  const steps = ['Soumis', 'Réponse vendeur', 'Revue admin', 'Résolution'];

  return (
    <div className="mt-3">
      <div className="flex items-center gap-2">
        {steps.map((step, index) => {
          const done = level >= index;
          return (
            <React.Fragment key={step}>
              <div
                className={`h-2.5 w-2.5 rounded-full ${done ? 'bg-[#FF6A00]' : 'bg-orange-100'}`}
                title={step}
              />
              {index < steps.length - 1 && (
                <div className={`h-0.5 flex-1 ${level > index ? 'bg-[#FF6A00]' : 'bg-orange-100'}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>
      <div className="mt-1 grid grid-cols-4 gap-2 text-[11px] text-gray-500">
        {steps.map((step) => (
          <span key={step} className="truncate">
            {step}
          </span>
        ))}
      </div>
    </div>
  );
};

export default function MyComplaints() {
  const location = useLocation();
  const { user } = useContext(AuthContext);
  const { showToast } = useToast();
  const [disputes, setDisputes] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState('');

  const [orderId, setOrderId] = useState('');
  const [reason, setReason] = useState('wrong_item');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState([]);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');

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
    (item) => ({
      ...item,
      proofImages: (Array.isArray(item?.proofImages) ? item.proofImages : []).map((f) => ({
        ...f,
        url: normalizeUrl(f?.url || f?.path || '')
      })),
      sellerProofImages: (Array.isArray(item?.sellerProofImages) ? item.sellerProofImages : []).map((f) => ({
        ...f,
        url: normalizeUrl(f?.url || f?.path || '')
      }))
    }),
    [normalizeUrl]
  );

  const loadDisputes = useCallback(async () => {
    setLoading(true);
    setListError('');
    try {
      const { data } = await api.get('/disputes/me');
      const list = Array.isArray(data) ? data : [];
      setDisputes(list.map(normalizeDispute));
    } catch (err) {
      setListError(err.response?.data?.message || err.message || 'Impossible de charger vos litiges.');
      setDisputes([]);
    } finally {
      setLoading(false);
    }
  }, [normalizeDispute]);

  const loadEligibleOrders = useCallback(async () => {
    try {
      const [proofSubmittedRes, deliveredRes, completedRes] = await Promise.allSettled([
        api.get('/orders', { params: { status: 'delivery_proof_submitted', limit: 50, page: 1 } }),
        api.get('/orders', { params: { status: 'delivered', limit: 50, page: 1 } }),
        api.get('/orders', { params: { status: 'completed', limit: 50, page: 1 } })
      ]);
      const proofSubmitted =
        proofSubmittedRes.status === 'fulfilled' && Array.isArray(proofSubmittedRes.value?.data?.items)
          ? proofSubmittedRes.value.data.items
          : [];
      const delivered =
        deliveredRes.status === 'fulfilled' && Array.isArray(deliveredRes.value?.data?.items)
          ? deliveredRes.value.data.items
          : [];
      const completed =
        completedRes.status === 'fulfilled' && Array.isArray(completedRes.value?.data?.items)
          ? completedRes.value.data.items
          : [];
      const map = new Map();
      [...proofSubmitted, ...delivered, ...completed].forEach((order) => {
        if (order?._id) map.set(order._id, order);
      });
      setOrders(Array.from(map.values()));
    } catch (err) {
      setOrders([]);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    loadDisputes();
    loadEligibleOrders();
  }, [loadDisputes, loadEligibleOrders, user]);

  useEffect(() => {
    const params = new URLSearchParams(location.search || '');
    const orderFromQuery = params.get('orderId');
    if (orderFromQuery && !orderId) {
      setOrderId(orderFromQuery);
    }
  }, [location.search, orderId]);

  const onFilesChange = (event) => {
    const selected = Array.from(event.target.files || []);
    if (!selected.length) return;
    const remaining = Math.max(0, MAX_FILES - files.length);
    const accepted = selected.slice(0, remaining);
    setFiles((prev) => [...prev, ...accepted]);
    event.target.value = '';
    setSubmitError('');
  };

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const submit = async (event) => {
    event.preventDefault();
    setSubmitError('');
    if (!orderId) {
      setSubmitError('Sélectionnez une commande livrée.');
      return;
    }
    if (!description.trim() || description.trim().length < 10) {
      setSubmitError('La description doit contenir au moins 10 caractères.');
      return;
    }

    setSubmitLoading(true);
    try {
      const payload = new FormData();
      payload.append('orderId', orderId);
      payload.append('reason', reason);
      payload.append('description', description.trim());
      files.forEach((file) => payload.append('proofImages', file));
      await api.post('/disputes', payload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      showToast('Litige créé avec succès.', { variant: 'success' });
      setOrderId('');
      setReason('wrong_item');
      setDescription('');
      setFiles([]);
      await loadDisputes();
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Impossible de créer le litige.';
      setSubmitError(message);
      showToast(message, { variant: 'error' });
    } finally {
      setSubmitLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="hd-products-flow flex min-h-screen items-center justify-center bg-[#f6f2ec] px-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-[0_14px_34px_rgba(117,75,36,0.08)]">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 text-[#FF6A00]">
            <User className="h-8 w-8" />
          </div>
          <p className="text-sm font-semibold text-gray-600">Vous devez être connecté pour accéder à cette page.</p>
          <Link to="/login" className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-[#FF6A00] px-5 text-sm font-black text-white">
            <ArrowLeft size={16} />
            Retour à la connexion
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="hd-products-flow min-h-screen bg-[#f6f2ec] text-gray-900">
      <div className="mx-auto max-w-5xl space-y-4 px-3 py-4 pb-24 sm:px-5 sm:py-6">
        <Link
          to="/profile"
          className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-gray-200 bg-white px-4 text-sm font-black text-gray-500 shadow-sm transition active:scale-95"
        >
          <ArrowLeft size={18} />
          Retour au profil
        </Link>

        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_14px_34px_rgba(117,75,36,0.08)]">
          <div className="hd-products-hero p-5 text-white sm:p-6">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/16 px-3 py-1.5 ring-1 ring-white/20">
                <ShieldAlert className="h-5 w-5" />
              <span className="text-xs font-black uppercase tracking-wide">Support commande</span>
            </div>
            <div>
                <h1 className="mt-3 text-2xl font-black tracking-tight text-white sm:text-3xl">Réclamations</h1>
                <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-white/86">
                Vous pouvez ouvrir un litige pour une commande livrée dans un délai de {DISPUTE_WINDOW_HOURS}h.
              </p>
            </div>
          </div>

          <form onSubmit={submit} className="space-y-4 p-5 sm:p-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-black text-gray-800">Commande concernée *</label>
                <select
                  className="min-h-[52px] w-full rounded-xl border border-gray-200 bg-gray-100/35 px-3 text-sm font-semibold outline-none transition focus:border-[#FF6A00] focus:bg-white focus:ring-4 focus:ring-gray-200"
                  value={orderId}
                  onChange={(e) => {
                    setOrderId(e.target.value);
                    setSubmitError('');
                  }}
                  disabled={submitLoading}
                  required
                >
                  <option value="">Sélectionnez une commande livrée</option>
                  {orders.map((order) => (
                    <option key={order._id} value={order._id}>
                      #{String(order._id).slice(-6)} · {amount(order.totalAmount)} · {formatDate(order.deliveredAt || order.createdAt)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-black text-gray-800">Motif *</label>
                <select
                  className="min-h-[52px] w-full rounded-xl border border-gray-200 bg-gray-100/35 px-3 text-sm font-semibold outline-none transition focus:border-[#FF6A00] focus:bg-white focus:ring-4 focus:ring-gray-200"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  disabled={submitLoading}
                >
                  {REASON_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="flex items-center justify-between text-sm font-black text-gray-800">
                <span className="inline-flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 text-[#FF6A00]" />
                  Description *
                </span>
                <span className="text-xs font-bold text-gray-500">
                  {description.length}/{MAX_DESCRIPTION}
                </span>
              </label>
              <textarea
                rows={5}
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value.slice(0, MAX_DESCRIPTION));
                  setSubmitError('');
                }}
                className="w-full rounded-xl border border-gray-200 bg-gray-100/35 px-4 py-3 text-sm font-semibold outline-none transition focus:border-[#FF6A00] focus:bg-white focus:ring-4 focus:ring-gray-200"
                placeholder="Décrivez précisément le problème (état, article reçu, preuves, etc.)."
                maxLength={MAX_DESCRIPTION}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-black text-gray-800">
                Preuves (images/PDF, max {MAX_FILES})
              </label>
              <label className="flex min-h-[56px] cursor-pointer items-center justify-between rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 text-sm font-bold text-gray-500 transition hover:bg-gray-100">
                <span className="inline-flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  Ajouter des preuves
                </span>
                <span className="text-xs text-gray-500">{files.length}/{MAX_FILES}</span>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  multiple
                  onChange={onFilesChange}
                  className="hidden"
                  disabled={submitLoading || files.length >= MAX_FILES}
                />
              </label>

              {files.length > 0 && (
                <div className="space-y-2">
                  {files.map((file, index) => (
                    <div
                      key={`${file.name}-${index}`}
                      className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold"
                    >
                      <span className="inline-flex items-center gap-2 truncate">
                        <Paperclip className="h-3.5 w-3.5 text-[#FF6A00]" />
                        <span className="truncate">{file.name}</span>
                      </span>
                      <button
                        type="button"
                        className="font-black text-[#FF6A00]"
                        onClick={() => removeFile(index)}
                        disabled={submitLoading}
                      >
                        Retirer
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {submitError && (
              <p className="inline-flex items-center gap-2 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700 ring-1 ring-red-100">
                <AlertTriangle className="h-4 w-4" />
                {submitError}
              </p>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submitLoading}
                className="hd-primary-button inline-flex min-h-[50px] items-center gap-2 rounded-full px-6 text-sm font-black disabled:opacity-60"
              >
                {submitLoading ? (
                  <>
                    <Clock3 className="h-4 w-4 animate-spin" />
                    Envoi...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4" />
                    Ouvrir le litige
                  </>
                )}
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-[0_14px_34px_rgba(117,75,36,0.08)] sm:p-6">
          <div className="mb-4">
            <p className="text-xs font-black uppercase tracking-wide text-[#FF6A00]">Suivi</p>
            <h2 className="mt-1 text-xl font-black text-gray-900">Historique des réclamations</h2>
          </div>
          {loading ? (
            <p className="rounded-2xl bg-gray-100/50 p-4 text-sm font-bold text-gray-500">Chargement…</p>
          ) : listError ? (
            <p className="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700 ring-1 ring-red-100">{listError}</p>
          ) : disputes.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-gray-200 bg-gray-100/35 p-5 text-sm font-semibold text-gray-500">Aucun litige pour le moment.</p>
          ) : (
            <ul className="space-y-4">
              {disputes.map((dispute) => (
                <li key={dispute._id} className="rounded-2xl border border-gray-200 bg-gray-100/30 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-gray-900">
                        Commande #{String(dispute?.orderId?._id || dispute.orderId || '').slice(-6)}
                      </p>
                      <p className="text-xs font-semibold text-gray-500">
                        Motif: {REASON_OPTIONS.find((r) => r.value === dispute.reason)?.label || dispute.reason}
                      </p>
                      <p className="text-xs font-semibold text-gray-500">Ouvert le {formatDate(dispute.createdAt)}</p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                        STATUS_STYLES[dispute.status] || 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {STATUS_LABELS[dispute.status] || dispute.status}
                    </span>
                  </div>

                  <DisputeTimeline status={dispute.status} />

                  <p className="mt-3 whitespace-pre-line text-sm font-semibold leading-6 text-gray-700">{dispute.description}</p>
                  <div className="mt-2 grid grid-cols-1 gap-1 text-xs font-semibold text-gray-500 sm:grid-cols-2">
                    <p>Total commande: {amount(dispute?.orderId?.totalAmount)}</p>
                    <p>Ville livraison: {dispute?.orderId?.deliveryCity || '—'}</p>
                    <p>Deadline réponse vendeur: {formatDate(dispute.sellerDeadline)}</p>
                    <p>Fenêtre litige jusqu’au: {formatDate(dispute.disputeWindowEndsAt)}</p>
                  </div>

                  {dispute.proofImages?.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {dispute.proofImages.map((file, index) => (
                        <a
                          key={`${dispute._id}-proof-${index}`}
                          href={file.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-500"
                        >
                          <Paperclip className="h-3.5 w-3.5" />
                          {file.originalName || file.filename || 'preuve'}
                        </a>
                      ))}
                    </div>
                  )}

                  {dispute.sellerResponse && (
                    <div className="mt-3 rounded-2xl border border-gray-200 bg-white p-3">
                      <p className="text-xs font-black text-gray-500">Réponse vendeur</p>
                      <p className="whitespace-pre-line text-sm font-semibold text-gray-800">{dispute.sellerResponse}</p>
                    </div>
                  )}

                  {dispute.adminDecision && (
                    <div className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-3">
                      <p className="text-xs font-black text-emerald-700">Décision admin</p>
                      <p className="whitespace-pre-line text-sm font-semibold text-emerald-900">{dispute.adminDecision}</p>
                      {dispute.resolutionType && (
                        <p className="mt-1 text-xs text-emerald-700">
                          Type: {RESOLUTION_LABELS[dispute.resolutionType] || dispute.resolutionType}
                        </p>
                      )}
                    </div>
                  )}

                  {dispute.resolvedAt && (
                    <p className="mt-2 inline-flex items-center gap-1 text-xs text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Clôturé le {formatDate(dispute.resolvedAt)}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
