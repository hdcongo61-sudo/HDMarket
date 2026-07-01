import React, { useCallback, useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import AuthContext from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { formatPriceWithStoredSettings } from '../utils/priceFormatter';
import { Users, ArrowLeft, Check, X, Clock, Wallet, CreditCard, RefreshCw } from 'lucide-react';

const formatCurrency = (value) => formatPriceWithStoredSettings(value);

const STATUS_LABELS = {
  pending: { label: 'En attente', className: 'bg-amber-100 text-amber-800' },
  accepted: { label: 'Réglée', className: 'bg-emerald-100 text-emerald-700' },
  self_paid: { label: 'Réglée par vous', className: 'bg-emerald-100 text-emerald-700' },
  declined: { label: 'Refusée', className: 'bg-rose-100 text-rose-700' },
  expired: { label: 'Expirée', className: 'bg-gray-100 text-gray-600' },
  cancelled: { label: 'Annulée', className: 'bg-gray-100 text-gray-600' }
};

function StatusPill({ status }) {
  const meta = STATUS_LABELS[status] || STATUS_LABELS.pending;
  return (
    <span className={`inline-flex items-center rounded px-2.5 py-1 text-[11px] font-black ${meta.className}`}>
      {meta.label}
    </span>
  );
}

export default function Sponsorships() {
  const { user } = useContext(AuthContext);
  const { showToast } = useToast();
  const [tab, setTab] = useState('incoming');
  const [incoming, setIncoming] = useState([]);
  const [sent, setSent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [payForm, setPayForm] = useState({}); // groupId -> { open, method, payerName, transactionCode }
  const [sentForm, setSentForm] = useState({}); // groupId -> { mode: 'pay'|'retry', method, payerName, transactionCode, phone }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [inc, snt] = await Promise.all([
        api.get('/orders/sponsor/incoming'),
        api.get('/orders/sponsor/sent')
      ]);
      setIncoming(Array.isArray(inc.data?.requests) ? inc.data.requests : []);
      setSent(Array.isArray(snt.data?.requests) ? snt.data.requests : []);
    } catch {
      showToast('Impossible de charger les demandes.', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const setForm = (groupId, patch) =>
    setPayForm((prev) => ({ ...prev, [groupId]: { ...(prev[groupId] || {}), ...patch } }));

  const respond = async (groupId, action, payload = {}) => {
    setBusyId(groupId);
    try {
      const { data } = await api.post(`/orders/sponsor/${groupId}/respond`, { action, ...payload });
      showToast(data?.message || 'Fait.', { variant: 'success' });
      await load();
    } catch (err) {
      showToast(err.response?.data?.message || 'Action impossible.', { variant: 'error' });
    } finally {
      setBusyId('');
    }
  };

  const cancel = async (groupId) => {
    setBusyId(groupId);
    try {
      await api.post(`/orders/sponsor/${groupId}/cancel`);
      showToast('Demande annulée.', { variant: 'success' });
      await load();
    } catch (err) {
      showToast(err.response?.data?.message || 'Action impossible.', { variant: 'error' });
    } finally {
      setBusyId('');
    }
  };

  const updateSentForm = (groupId, patch) =>
    setSentForm((prev) => ({ ...prev, [groupId]: { ...(prev[groupId] || {}), ...patch } }));

  const paySelf = async (groupId) => {
    const form = sentForm[groupId] || {};
    const method = form.method || 'mobile_money';
    setBusyId(groupId);
    try {
      let payload = { paymentMode: 'wallet' };
      if (method === 'mobile_money') {
        const code = String(form.transactionCode || '').replace(/\D/g, '');
        if (!String(form.payerName || '').trim() || code.length !== 10) {
          showToast('Nom et code de transaction (10 chiffres) requis.', { variant: 'error' });
          setBusyId('');
          return;
        }
        payload = { paymentMode: 'mobile_money', payerName: form.payerName.trim(), transactionCode: code };
      }
      const { data } = await api.post(`/orders/sponsor/${groupId}/pay-self`, payload);
      showToast(data?.message || 'Commande réglée.', { variant: 'success' });
      await load();
    } catch (err) {
      showToast(err.response?.data?.message || 'Paiement impossible.', { variant: 'error' });
    } finally {
      setBusyId('');
    }
  };

  const retry = async (groupId) => {
    const form = sentForm[groupId] || {};
    const phone = String(form.phone || '').trim();
    if (phone.length < 5) {
      showToast('Renseignez le numéro du proche.', { variant: 'error' });
      return;
    }
    setBusyId(groupId);
    try {
      const { data } = await api.post(`/orders/sponsor/${groupId}/retry`, { phone, payerPhone: phone });
      showToast(data?.message || 'Nouvelle demande envoyée.', { variant: 'success' });
      await load();
    } catch (err) {
      showToast(err.response?.data?.message || 'Nouvelle tentative impossible.', { variant: 'error' });
    } finally {
      setBusyId('');
    }
  };

  const submitPayment = (groupId) => {
    const form = payForm[groupId] || {};
    const method = form.method || 'mobile_money';
    if (method === 'mobile_money') {
      const code = String(form.transactionCode || '').replace(/\D/g, '');
      if (!String(form.payerName || '').trim() || code.length !== 10) {
        showToast('Nom et code de transaction (10 chiffres) requis.', { variant: 'error' });
        return;
      }
      respond(groupId, 'accept', {
        paymentMode: 'mobile_money',
        payerName: form.payerName.trim(),
        transactionCode: code
      });
    } else {
      respond(groupId, 'accept', { paymentMode: 'wallet' });
    }
  };

  const renderIncoming = (req) => {
    const form = payForm[req.requestGroupId] || {};
    const isPending = req.status === 'pending';
    const busy = busyId === req.requestGroupId;
    return (
      <div key={req.requestGroupId} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-black text-gray-900">
              {req.requester?.name || 'Un utilisateur'} vous demande de régler
            </p>
            <p className="mt-0.5 text-xs text-gray-500">
              {req.orderCount} commande{req.orderCount > 1 ? 's' : ''} • {formatCurrency(req.totalAmount)}
            </p>
            {req.message ? (
              <p className="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-xs italic text-gray-600">« {req.message} »</p>
            ) : null}
          </div>
          <StatusPill status={req.status} />
        </div>

        {isPending && !form.open && (
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => setForm(req.requestGroupId, { open: true, method: 'mobile_money' })}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#FF6A00] px-3 py-2.5 text-sm font-black text-white disabled:opacity-60"
            >
              <Check size={16} /> Approuver &amp; payer
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => respond(req.requestGroupId, 'decline')}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-black text-gray-700 disabled:opacity-60"
            >
              <X size={16} /> Refuser
            </button>
          </div>
        )}

        {isPending && form.open && (
          <div className="mt-3 space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setForm(req.requestGroupId, { method: 'mobile_money' })}
                className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-black ${
                  (form.method || 'mobile_money') === 'mobile_money' ? 'bg-[#FF6A00] text-white' : 'bg-white text-gray-600'
                }`}
              >
                <CreditCard size={14} /> Mobile Money
              </button>
              <button
                type="button"
                onClick={() => setForm(req.requestGroupId, { method: 'wallet' })}
                className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-black ${
                  form.method === 'wallet' ? 'bg-emerald-600 text-white' : 'bg-white text-gray-600'
                }`}
              >
                <Wallet size={14} /> Portefeuille
              </button>
            </div>
            {(form.method || 'mobile_money') === 'mobile_money' ? (
              <>
                <input
                  type="text"
                  value={form.payerName || ''}
                  onChange={(e) => setForm(req.requestGroupId, { payerName: e.target.value })}
                  placeholder="Nom du payeur"
                  className="min-h-[44px] w-full rounded-lg border border-gray-200 bg-white px-3 text-sm"
                />
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={10}
                  value={form.transactionCode || ''}
                  onChange={(e) => setForm(req.requestGroupId, { transactionCode: e.target.value })}
                  placeholder="Code transaction (10 chiffres)"
                  className="min-h-[44px] w-full rounded-lg border border-gray-200 bg-white px-3 text-sm"
                />
              </>
            ) : (
              <p className="text-xs font-semibold text-emerald-700">
                {formatCurrency(req.totalAmount)} seront débités de votre portefeuille HDMarket.
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => submitPayment(req.requestGroupId)}
                className="inline-flex flex-1 items-center justify-center rounded-lg bg-[#FF6A00] px-3 py-2.5 text-sm font-black text-white disabled:opacity-60"
              >
                {busy ? 'Traitement…' : 'Payer maintenant'}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setForm(req.requestGroupId, { open: false })}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm font-black text-gray-600"
              >
                Annuler
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderSent = (req) => {
    const gid = req.requestGroupId;
    const busy = busyId === gid;
    const form = sentForm[gid] || {};
    const canRetry = Boolean(req.canRetry);
    const isDeclinedOrExpired = req.status === 'declined' || req.status === 'expired';
    return (
      <div key={gid} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-black text-gray-900">
              Demande à {req.payer?.name || 'un proche'}
            </p>
            <p className="mt-0.5 text-xs text-gray-500">
              {req.orderCount} commande{req.orderCount > 1 ? 's' : ''} • {formatCurrency(req.totalAmount)}
            </p>
            {req.attemptCount > 1 ? (
              <p className="mt-0.5 text-[11px] font-semibold text-gray-400">Tentative {req.attemptCount}/2</p>
            ) : null}
          </div>
          <StatusPill status={req.status} />
        </div>

        {req.status === 'pending' && (
          <button
            type="button"
            disabled={busy}
            onClick={() => cancel(gid)}
            className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-black text-gray-700 disabled:opacity-60"
          >
            <X size={14} /> Annuler la demande
          </button>
        )}

        {isDeclinedOrExpired && !form.mode && (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => updateSentForm(gid, { mode: 'pay', method: 'mobile_money' })}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#FF6A00] px-3 py-2.5 text-sm font-black text-white disabled:opacity-60"
            >
              <CreditCard size={16} /> Payer moi-même
            </button>
            {canRetry && (
              <button
                type="button"
                disabled={busy}
                onClick={() => updateSentForm(gid, { mode: 'retry' })}
                className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-black text-gray-700 disabled:opacity-60"
              >
                <RefreshCw size={16} /> Réessayer
              </button>
            )}
          </div>
        )}

        {isDeclinedOrExpired && form.mode === 'retry' && (
          <div className="mt-3 space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-3">
            <input
              type="tel"
              inputMode="tel"
              value={form.phone || ''}
              onChange={(e) => updateSentForm(gid, { phone: e.target.value })}
              placeholder="Numéro d'un autre proche"
              className="min-h-[44px] w-full rounded-lg border border-gray-200 bg-white px-3 text-sm"
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => retry(gid)}
                className="inline-flex flex-1 items-center justify-center rounded-lg bg-[#FF6A00] px-3 py-2.5 text-sm font-black text-white disabled:opacity-60"
              >
                {busy ? 'Envoi…' : 'Renvoyer la demande'}
              </button>
              <button
                type="button"
                onClick={() => updateSentForm(gid, { mode: undefined })}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm font-black text-gray-600"
              >
                Annuler
              </button>
            </div>
          </div>
        )}

        {isDeclinedOrExpired && form.mode === 'pay' && (
          <div className="mt-3 space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => updateSentForm(gid, { method: 'mobile_money' })}
                className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-black ${
                  (form.method || 'mobile_money') === 'mobile_money' ? 'bg-[#FF6A00] text-white' : 'bg-white text-gray-600'
                }`}
              >
                <CreditCard size={14} /> Mobile Money
              </button>
              <button
                type="button"
                onClick={() => updateSentForm(gid, { method: 'wallet' })}
                className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-black ${
                  form.method === 'wallet' ? 'bg-emerald-600 text-white' : 'bg-white text-gray-600'
                }`}
              >
                <Wallet size={14} /> Portefeuille
              </button>
            </div>
            {(form.method || 'mobile_money') === 'mobile_money' ? (
              <>
                <input
                  type="text"
                  value={form.payerName || ''}
                  onChange={(e) => updateSentForm(gid, { payerName: e.target.value })}
                  placeholder="Nom du payeur"
                  className="min-h-[44px] w-full rounded-lg border border-gray-200 bg-white px-3 text-sm"
                />
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={10}
                  value={form.transactionCode || ''}
                  onChange={(e) => updateSentForm(gid, { transactionCode: e.target.value })}
                  placeholder="Code transaction (10 chiffres)"
                  className="min-h-[44px] w-full rounded-lg border border-gray-200 bg-white px-3 text-sm"
                />
              </>
            ) : (
              <p className="text-xs font-semibold text-emerald-700">
                {formatCurrency(req.totalAmount)} seront débités de votre portefeuille HDMarket.
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => paySelf(gid)}
                className="inline-flex flex-1 items-center justify-center rounded-lg bg-[#FF6A00] px-3 py-2.5 text-sm font-black text-white disabled:opacity-60"
              >
                {busy ? 'Traitement…' : 'Payer maintenant'}
              </button>
              <button
                type="button"
                onClick={() => updateSentForm(gid, { mode: undefined })}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm font-black text-gray-600"
              >
                Annuler
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const list = tab === 'incoming' ? incoming : sent;

  return (
    <div className="min-h-screen bg-[#f5f5f5] pb-16 dark:bg-neutral-950">
      <header className="sticky top-0 z-30 border-b border-gray-100 bg-white/95 backdrop-blur-xl dark:border-neutral-800 dark:bg-neutral-950">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <Link to="/orders" className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-800">
            <ArrowLeft size={18} />
          </Link>
          <div className="flex items-center gap-2">
            <Users size={18} className="text-[#FF6A00]" />
            <h1 className="text-base font-black text-gray-900">Paiement par un proche</h1>
          </div>
        </div>
        <div className="mx-auto flex max-w-2xl gap-2 px-4 pb-3">
          <button
            type="button"
            onClick={() => setTab('incoming')}
            className={`rounded-full px-4 py-1.5 text-xs font-black ${tab === 'incoming' ? 'bg-[#FF6A00] text-white' : 'bg-gray-100 text-gray-600'}`}
          >
            À régler
          </button>
          <button
            type="button"
            onClick={() => setTab('sent')}
            className={`rounded-full px-4 py-1.5 text-xs font-black ${tab === 'sent' ? 'bg-[#FF6A00] text-white' : 'bg-gray-100 text-gray-600'}`}
          >
            Mes demandes
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-3 px-4 py-4">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm font-semibold text-gray-500">
            <Clock size={16} className="animate-pulse" /> Chargement…
          </div>
        ) : list.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white py-16 text-center text-sm font-semibold text-gray-500">
            {tab === 'incoming' ? 'Aucune demande à régler.' : 'Aucune demande envoyée.'}
          </div>
        ) : (
          list.map((req) => (tab === 'incoming' ? renderIncoming(req) : renderSent(req)))
        )}
      </main>
    </div>
  );
}
