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
  SELLER_RESPONDED: 'bg-indigo-100 text-indigo-800',
  UNDER_REVIEW: 'bg-blue-100 text-blue-800',
  RESOLVED_CLIENT: 'bg-emerald-100 text-emerald-800',
  RESOLVED_SELLER: 'bg-green-100 text-green-800',
  REJECTED: 'bg-rose-100 text-rose-800'
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
                className={`h-2.5 w-2.5 rounded-full ${done ? 'bg-indigo-600' : 'bg-gray-300'}`}
                title={step}
              />
              {index < steps.length - 1 && (
                <div className={`h-0.5 flex-1 ${level > index ? 'bg-indigo-500' : 'bg-gray-200'}`} />
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8 text-white" />
          </div>
          <p className="text-gray-500">Vous devez être connecté pour accéder à cette page.</p>
          <Link to="/login" className="mt-4 inline-flex items-center gap-2 text-indigo-600 font-medium">
            <ArrowLeft size={16} />
            Retour à la connexion
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-4xl px-4 py-6 space-y-6">
        <Link
          to="/profile"
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-indigo-600"
        >
          <ArrowLeft size={18} />
          Retour au profil
        </Link>

        <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-3 mb-4">
            <div className="rounded-xl bg-rose-100 p-2">
              <ShieldAlert className="h-5 w-5 text-rose-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Gestion des litiges</h1>
              <p className="text-sm text-gray-500">
                Vous pouvez ouvrir un litige pour une commande livrée dans un délai de {DISPUTE_WINDOW_HOURS}h.
              </p>
            </div>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Commande concernée *</label>
                <select
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm"
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
                <label className="text-sm font-medium text-gray-700">Motif *</label>
                <select
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm"
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
              <label className="flex items-center justify-between text-sm font-medium text-gray-700">
                <span className="inline-flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 text-rose-500" />
                  Description *
                </span>
                <span className="text-xs text-gray-500">
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
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm"
                placeholder="Décrivez précisément le problème (état, article reçu, preuves, etc.)."
                maxLength={MAX_DESCRIPTION}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Preuves (images/PDF, max {MAX_FILES})
              </label>
              <label className="flex cursor-pointer items-center justify-between rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-600 hover:border-indigo-300 hover:bg-indigo-50">
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
                      className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs"
                    >
                      <span className="inline-flex items-center gap-2 truncate">
                        <Paperclip className="h-3.5 w-3.5 text-gray-500" />
                        <span className="truncate">{file.name}</span>
                      </span>
                      <button
                        type="button"
                        className="font-semibold text-rose-600"
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
              <p className="inline-flex items-center gap-2 text-sm text-red-600">
                <AlertTriangle className="h-4 w-4" />
                {submitError}
              </p>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submitLoading}
                className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
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

        <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Historique des litiges</h2>
          {loading ? (
            <p className="text-sm text-gray-500">Chargement…</p>
          ) : listError ? (
            <p className="text-sm text-red-600">{listError}</p>
          ) : disputes.length === 0 ? (
            <p className="text-sm text-gray-500">Aucun litige pour le moment.</p>
          ) : (
            <ul className="space-y-4">
              {disputes.map((dispute) => (
                <li key={dispute._id} className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        Commande #{String(dispute?.orderId?._id || dispute.orderId || '').slice(-6)}
                      </p>
                      <p className="text-xs text-gray-500">
                        Motif: {REASON_OPTIONS.find((r) => r.value === dispute.reason)?.label || dispute.reason}
                      </p>
                      <p className="text-xs text-gray-500">Ouvert le {formatDate(dispute.createdAt)}</p>
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

                  <p className="mt-3 text-sm text-gray-700 whitespace-pre-line">{dispute.description}</p>
                  <div className="mt-2 grid grid-cols-1 gap-1 text-xs text-gray-500 sm:grid-cols-2">
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
                          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700"
                        >
                          <Paperclip className="h-3.5 w-3.5" />
                          {file.originalName || file.filename || 'preuve'}
                        </a>
                      ))}
                    </div>
                  )}

                  {dispute.sellerResponse && (
                    <div className="mt-3 rounded-xl border border-indigo-100 bg-indigo-50 p-3">
                      <p className="text-xs font-semibold text-indigo-700">Réponse vendeur</p>
                      <p className="text-sm text-indigo-900 whitespace-pre-line">{dispute.sellerResponse}</p>
                    </div>
                  )}

                  {dispute.adminDecision && (
                    <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 p-3">
                      <p className="text-xs font-semibold text-emerald-700">Décision admin</p>
                      <p className="text-sm text-emerald-900 whitespace-pre-line">{dispute.adminDecision}</p>
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
