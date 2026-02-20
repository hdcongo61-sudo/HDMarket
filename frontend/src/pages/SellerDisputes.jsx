import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Clock3, MessageSquare, Paperclip, RefreshCw, ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { formatPriceWithStoredSettings } from "../utils/priceFormatter";

const STATUS_OPTIONS = [
  { value: '', label: 'Tous' },
  { value: 'OPEN', label: 'Ouverts' },
  { value: 'SELLER_RESPONDED', label: 'Réponse envoyée' },
  { value: 'UNDER_REVIEW', label: 'En revue admin' }
];

const STATUS_LABELS = {
  OPEN: 'Ouvert',
  SELLER_RESPONDED: 'Réponse envoyée',
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

export default function SellerDisputes() {
  const { showToast } = useToast();
  const [statusFilter, setStatusFilter] = useState('OPEN');
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [forms, setForms] = useState({});
  const [sendingId, setSendingId] = useState('');

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

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = statusFilter ? { status: statusFilter } : {};
      const { data } = await api.get('/disputes/seller', { params });
      const list = Array.isArray(data) ? data : [];
      setItems(
        list.map((item) => ({
          ...item,
          proofImages: (item?.proofImages || []).map((f) => ({ ...f, url: normalizeUrl(f?.url || f?.path || '') })),
          sellerProofImages: (item?.sellerProofImages || []).map((f) => ({
            ...f,
            url: normalizeUrl(f?.url || f?.path || '')
          }))
        }))
      );
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Erreur chargement litiges vendeur.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [normalizeUrl, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const getForm = (id) => forms[id] || { sellerResponse: '', files: [] };
  const setForm = (id, next) =>
    setForms((prev) => ({ ...prev, [id]: { ...getForm(id), ...next } }));

  const onFileChange = (id, event) => {
    const selected = Array.from(event.target.files || []);
    const current = getForm(id).files;
    const remaining = Math.max(0, 5 - current.length);
    setForm(id, { files: [...current, ...selected.slice(0, remaining)] });
    event.target.value = '';
  };

  const removeFile = (id, index) => {
    const current = getForm(id).files;
    setForm(id, { files: current.filter((_, i) => i !== index) });
  };

  const submitResponse = async (disputeId) => {
    const form = getForm(disputeId);
    if (!form.sellerResponse.trim() && form.files.length === 0) {
      showToast('Ajoutez une réponse ou une preuve.', { variant: 'error' });
      return;
    }
    setSendingId(disputeId);
    try {
      const payload = new FormData();
      payload.append('sellerResponse', form.sellerResponse.trim());
      form.files.forEach((file) => payload.append('sellerProofImages', file));
      await api.patch(`/disputes/${disputeId}/seller-response`, payload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      showToast('Réponse envoyée.', { variant: 'success' });
      setForm(disputeId, { sellerResponse: '', files: [] });
      await load();
    } catch (err) {
      showToast(err.response?.data?.message || 'Impossible d’envoyer la réponse.', {
        variant: 'error'
      });
    } finally {
      setSendingId('');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-6xl px-4 py-6 space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-indigo-600 p-2.5 text-white">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Litiges vendeurs</h1>
              <p className="text-sm text-gray-500">Répondez aux litiges dans le délai imparti.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value || 'all'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={load}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Actualiser
            </button>
          </div>
        </header>

        {error && <p className="text-sm text-rose-600">{error}</p>}

        {loading ? (
          <div className="py-10 flex justify-center">
            <div className="h-9 w-9 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-gray-500">Aucun litige pour ce filtre.</p>
        ) : (
          <ul className="space-y-4">
            {items.map((item) => {
              const form = getForm(item._id);
              const isOpen = item.status === 'OPEN';
              return (
                <li key={item._id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        Litige #{String(item._id).slice(-6)} · Cmd #{String(item?.orderId?._id || '').slice(-6)}
                      </p>
                      <p className="text-xs text-gray-500">
                        Client: {item?.clientId?.name || '—'} · {item?.clientId?.phone || '—'}
                      </p>
                      <p className="text-xs text-gray-500">
                        Total: {money(item?.orderId?.totalAmount)} · Livraison: {item?.orderId?.deliveryCity || '—'}
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

                  <p className="mt-2 text-sm text-gray-700 whitespace-pre-line">{item.description}</p>
                  <p className="mt-2 text-xs text-gray-500 inline-flex items-center gap-1">
                    <Clock3 className="h-3.5 w-3.5" />
                    Deadline réponse: {formatDate(item.sellerDeadline)}
                  </p>

                  {item.proofImages?.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {item.proofImages.map((file, index) => (
                        <a
                          key={`${item._id}-proof-client-${index}`}
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
                      <p className="text-xs font-semibold text-indigo-700">Votre réponse</p>
                      <p className="text-sm text-indigo-900 whitespace-pre-line">{item.sellerResponse}</p>
                    </div>
                  )}

                  {item.sellerProofImages?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {item.sellerProofImages.map((file, index) => (
                        <a
                          key={`${item._id}-proof-seller-${index}`}
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

                  {isOpen && (
                    <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50 p-3">
                      <p className="text-xs font-semibold text-indigo-700 mb-2 inline-flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" />
                        Répondre au litige
                      </p>
                      <textarea
                        rows={3}
                        value={form.sellerResponse}
                        onChange={(e) => setForm(item._id, { sellerResponse: e.target.value })}
                        placeholder="Détaillez votre version et fournissez les éléments de preuve."
                        className="w-full rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm"
                      />
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-indigo-200 bg-white px-3 py-2 text-xs text-indigo-700">
                          <Paperclip className="h-3.5 w-3.5" />
                          Ajouter des preuves ({form.files.length}/5)
                          <input
                            type="file"
                            accept="image/*,.pdf"
                            multiple
                            className="hidden"
                            onChange={(e) => onFileChange(item._id, e)}
                          />
                        </label>
                        {form.files.map((file, index) => (
                          <button
                            key={`${file.name}-${index}`}
                            type="button"
                            onClick={() => removeFile(item._id, index)}
                            className="rounded-lg bg-white px-2 py-1 text-[11px] text-gray-700 border border-gray-200"
                          >
                            {file.name} ✕
                          </button>
                        ))}
                      </div>
                      <div className="mt-2 flex justify-end">
                        <button
                          type="button"
                          onClick={() => submitResponse(item._id)}
                          disabled={sendingId === item._id}
                          className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                        >
                          {sendingId === item._id ? 'Envoi...' : 'Envoyer la réponse'}
                        </button>
                      </div>
                    </div>
                  )}

                  {item?.orderId?._id && (
                    <div className="mt-3">
                      <Link
                        to={`/seller/orders/detail/${item.orderId._id}`}
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-500"
                      >
                        Voir la commande complète
                      </Link>
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
