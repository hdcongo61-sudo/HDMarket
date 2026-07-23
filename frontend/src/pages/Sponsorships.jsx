import React, { useCallback, useEffect, useState } from 'react';
import api from '../services/api';
import { useAppSettings } from '../context/AppSettingsContext';
import { useToast } from '../context/ToastContext';
import { formatPriceWithStoredSettings as formatCurrency } from '../utils/priceFormatter';
import { getSponsorshipStatusMeta } from '../utils/sponsorship';
import GlassHeader from '../components/orders/GlassHeader';
import BaseModal from '../components/modals/BaseModal';
import PawaPayButton from '../components/PawaPayButton';
import { Check, X, Clock, Wallet, CreditCard, RefreshCw, MessageCircle } from 'lucide-react';

const normalizeSettingBoolean = (value, fallback = false) => {
  if (typeof value === 'boolean') return value;
  if (value == null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on', 'oui'].includes(String(value).trim().toLowerCase());
};

const formatExpiry = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

function StatusPill({ status }) {
  const meta = getSponsorshipStatusMeta(status);
  return (
    <span className={`inline-flex items-center rounded px-2.5 py-1 text-[11px] font-black ${meta.pillClassName}`}>
      {meta.label}
    </span>
  );
}

// Payment form shared by the designated-payer "approve & pay" flow and the
// requester "pay myself" flow. The payer picks a method (Mobile Money /
// portefeuille, when enabled) and, in Mobile Money, how much to régler:
// the 25% acompte or the full amount.
function GroupPaymentForm({ totalAmount, depositAmount, walletEnabled = true, instructions = '', busy, onSubmit, onCancel }) {
  const { showToast } = useToast();
  // Deposit only makes sense when it is a real partial amount.
  const hasDepositOption = Number(depositAmount) > 0 && Number(depositAmount) < Number(totalAmount);
  const [method, setMethod] = useState('mobile_money');
  const [paymentOption, setPaymentOption] = useState(hasDepositOption ? 'deposit' : 'full');
  const [payerName, setPayerName] = useState('');
  const [transactionCode, setTransactionCode] = useState('');

  const amountToPay =
    method === 'wallet' || paymentOption === 'full' ? Number(totalAmount) : Number(depositAmount);

  const submit = () => {
    if (method === 'wallet') {
      onSubmit({ paymentMode: 'wallet' });
      return;
    }
    const code = transactionCode.replace(/\D/g, '');
    if (!payerName.trim() || code.length !== 10) {
      showToast('Nom et code de transaction (10 chiffres) requis.', { variant: 'error' });
      return;
    }
    onSubmit({
      paymentMode: 'mobile_money',
      paymentOption,
      payerName: payerName.trim(),
      transactionCode: code
    });
  };

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMethod('mobile_money')}
          className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-black ${
            method === 'mobile_money' ? 'bg-[#e85d00] text-white' : 'bg-white text-gray-600'
          }`}
        >
          <CreditCard size={14} /> Mobile Money
        </button>
        {walletEnabled && (
          <button
            type="button"
            onClick={() => setMethod('wallet')}
            className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-black ${
              method === 'wallet' ? 'bg-emerald-600 text-white' : 'bg-white text-gray-600'
            }`}
          >
            <Wallet size={14} /> Portefeuille
          </button>
        )}
      </div>
      {method === 'mobile_money' ? (
        <>
          {hasDepositOption && (
            <div className="space-y-2">
              {[
                {
                  id: 'deposit',
                  label: 'Acompte (25%)',
                  amount: depositAmount,
                  hint: 'Le solde sera réglé à la livraison.'
                },
                {
                  id: 'full',
                  label: 'Paiement intégral',
                  amount: totalAmount,
                  hint: 'La commande est soldée immédiatement.'
                }
              ].map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setPaymentOption(option.id)}
                  className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left ${
                    paymentOption === option.id
                      ? 'border-[#e85d00] bg-orange-50'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <span>
                    <span className="block text-xs font-black text-gray-900">{option.label}</span>
                    <span className="block text-[11px] font-semibold text-gray-500">{option.hint}</span>
                  </span>
                  <span className="text-sm font-black text-[#e85d00]">{formatCurrency(option.amount)}</span>
                </button>
              ))}
            </div>
          )}
          <p className="rounded-lg bg-white px-3 py-2 text-xs font-black text-gray-900">
            Montant à envoyer : <span className="text-[#e85d00]">{formatCurrency(amountToPay)}</span>
          </p>
          {instructions ? (
            <p className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-[11px] font-semibold leading-relaxed text-blue-800">
              {instructions}
            </p>
          ) : null}
          <input
            type="text"
            value={payerName}
            onChange={(e) => setPayerName(e.target.value)}
            placeholder="Nom du payeur"
            className="min-h-[44px] w-full rounded-lg border border-gray-200 bg-white px-3 text-sm"
          />
          <input
            type="text"
            inputMode="numeric"
            maxLength={10}
            value={transactionCode}
            onChange={(e) => setTransactionCode(e.target.value)}
            placeholder="Code transaction (10 chiffres)"
            className="min-h-[44px] w-full rounded-lg border border-gray-200 bg-white px-3 text-sm"
          />
        </>
      ) : (
        <p className="text-xs font-semibold text-emerald-700">
          {formatCurrency(totalAmount)} seront débités de votre portefeuille HDMarket.
        </p>
      )}
      {walletEnabled && amountToPay >= 10 && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <p className="mb-2 text-xs font-black text-emerald-900">Payer sans recopier de code</p>
          <PawaPayButton
            amount={amountToPay}
            purpose="CHECKOUT_FUNDING"
            returnPath="/sponsorships"
            label="Continuer avec PawaPay"
          />
          <p className="mt-2 text-[11px] font-semibold text-emerald-800">
            Revenez ici puis choisissez « Portefeuille » pour terminer.
          </p>
        </div>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={submit}
          className={`inline-flex flex-1 items-center justify-center rounded-lg px-3 py-2.5 text-sm font-black text-white disabled:opacity-60 ${
            method === 'wallet' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-[#e85d00]'
          }`}
        >
          {busy ? 'Traitement…' : `Payer ${formatCurrency(amountToPay)}`}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onCancel}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm font-black text-gray-600"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}

export default function Sponsorships() {
  const { showToast } = useToast();
  const { getRuntimeValue } = useAppSettings();
  const walletEnabled =
    normalizeSettingBoolean(getRuntimeValue('enable_wallet_payment', false), false) &&
    normalizeSettingBoolean(getRuntimeValue('enable_digital_wallet', false), false);
  const paymentInstructions = String(
    getRuntimeValue('pay_for_other_payment_instructions', '') || ''
  ).trim();
  const [tab, setTab] = useState('incoming');
  const [incoming, setIncoming] = useState([]);
  const [sent, setSent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  // Only one form is open at a time: kind is 'accept' (payer), 'pay' or 'retry' (requester).
  const [activeForm, setActiveForm] = useState(null); // { gid, kind } | null
  const [retryPhone, setRetryPhone] = useState('');
  // Decline (payer) and cancel (requester) permanently cancel the orders — confirm first.
  const [confirmAction, setConfirmAction] = useState(null); // { gid, kind: 'decline' | 'cancel' } | null

  const load = useCallback(
    async (which = 'both') => {
      setLoading(true);
      try {
        const [inc, snt] = await Promise.all([
          which !== 'sent' ? api.get('/orders/sponsor/incoming') : null,
          which !== 'incoming' ? api.get('/orders/sponsor/sent') : null
        ]);
        if (inc) setIncoming(Array.isArray(inc.data?.requests) ? inc.data.requests : []);
        if (snt) setSent(Array.isArray(snt.data?.requests) ? snt.data.requests : []);
      } catch {
        showToast('Impossible de charger les demandes.', { variant: 'error' });
      } finally {
        setLoading(false);
      }
    },
    [showToast]
  );

  useEffect(() => {
    load();
  }, [load]);

  const openForm = (gid, kind) => {
    setRetryPhone('');
    setActiveForm({ gid, kind });
  };

  const runAction = async (groupId, whichList, request, fallbackError) => {
    setBusyId(groupId);
    try {
      const { data } = await request();
      showToast(data?.message || 'Fait.', { variant: 'success' });
      setActiveForm(null);
      await load(whichList);
    } catch (err) {
      showToast(err.response?.data?.message || fallbackError, { variant: 'error' });
    } finally {
      setBusyId('');
    }
  };

  const respond = (groupId, action, payload = {}) =>
    runAction(
      groupId,
      'incoming',
      () => api.post(`/orders/sponsor/${groupId}/respond`, { action, ...payload }),
      'Action impossible.'
    );

  const cancel = (groupId) =>
    runAction(groupId, 'sent', () => api.post(`/orders/sponsor/${groupId}/cancel`), 'Action impossible.');

  const paySelf = (groupId, payload) =>
    runAction(
      groupId,
      'sent',
      () => api.post(`/orders/sponsor/${groupId}/pay-self`, payload),
      'Paiement impossible.'
    );

  const confirmDestructive = () => {
    if (!confirmAction) return;
    const { gid, kind } = confirmAction;
    setConfirmAction(null);
    if (kind === 'decline') respond(gid, 'decline');
    else cancel(gid);
  };

  const shareOnWhatsApp = (req) => {
    const message = encodeURIComponent(
      `Bonjour ${req.payer?.name || ''}, je t'ai envoyé une demande de paiement de ${formatCurrency(
        req.totalAmount
      )} sur HDMarket. Ouvre l'application pour la régler : ${window.location.origin}/sponsorships`.trim()
    );
    window.open(`https://wa.me/?text=${message}`, '_blank', 'noopener');
  };

  const retry = (groupId) => {
    const phone = retryPhone.trim();
    if (phone.length < 5) {
      showToast('Renseignez le numéro du proche.', { variant: 'error' });
      return;
    }
    return runAction(
      groupId,
      'sent',
      () => api.post(`/orders/sponsor/${groupId}/retry`, { payerPhone: phone }),
      'Nouvelle tentative impossible.'
    );
  };

  const renderIncoming = (req) => {
    const gid = req.requestGroupId;
    const isPending = req.status === 'pending';
    const busy = busyId === gid;
    const formOpen = activeForm?.gid === gid && activeForm.kind === 'accept';
    return (
      <div key={gid} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-black text-gray-900">
              {req.requester?.name || 'Un utilisateur'} vous demande de régler
            </p>
            <p className="mt-0.5 text-xs text-gray-500">
              {req.orderCount} commande{req.orderCount > 1 ? 's' : ''} • {formatCurrency(req.totalAmount)}
            </p>
            {req.productTitles?.length ? (
              <p className="mt-0.5 truncate text-xs font-semibold text-gray-600">
                {req.productTitles.join(', ')}
                {req.orderCount > req.productTitles.length ? '…' : ''}
              </p>
            ) : null}
            {isPending && req.expiresAt ? (
              <p className="mt-0.5 text-[11px] font-semibold text-amber-600">
                Expire le {formatExpiry(req.expiresAt)}
              </p>
            ) : null}
            {req.message ? (
              <p className="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-xs italic text-gray-600">« {req.message} »</p>
            ) : null}
          </div>
          <StatusPill status={req.status} />
        </div>

        {isPending && !formOpen && (
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => openForm(gid, 'accept')}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#e85d00] px-3 py-2.5 text-sm font-black text-white disabled:opacity-60"
            >
              <Check size={16} /> Approuver &amp; payer
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirmAction({ gid, kind: 'decline' })}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-black text-gray-700 disabled:opacity-60"
            >
              <X size={16} /> Refuser
            </button>
          </div>
        )}

        {isPending && formOpen && (
          <GroupPaymentForm
            totalAmount={req.totalAmount}
            depositAmount={req.depositAmount}
            walletEnabled={walletEnabled}
            instructions={paymentInstructions}
            busy={busy}
            onSubmit={(payload) => respond(gid, 'accept', payload)}
            onCancel={() => setActiveForm(null)}
          />
        )}
      </div>
    );
  };

  const renderSent = (req) => {
    const gid = req.requestGroupId;
    const busy = busyId === gid;
    const formKind = activeForm?.gid === gid ? activeForm.kind : null;
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
            {req.productTitles?.length ? (
              <p className="mt-0.5 truncate text-xs font-semibold text-gray-600">
                {req.productTitles.join(', ')}
                {req.orderCount > req.productTitles.length ? '…' : ''}
              </p>
            ) : null}
            {req.status === 'pending' && req.expiresAt ? (
              <p className="mt-0.5 text-[11px] font-semibold text-amber-600">
                Expire le {formatExpiry(req.expiresAt)}
              </p>
            ) : null}
            {req.attemptCount > 1 ? (
              <p className="mt-0.5 text-[11px] font-semibold text-gray-400">
                Tentative {req.attemptCount}/{req.maxAttempts || 2}
              </p>
            ) : null}
          </div>
          <StatusPill status={req.status} />
        </div>

        {req.status === 'pending' && (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => shareOnWhatsApp(req)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white"
            >
              <MessageCircle size={14} /> Relancer sur WhatsApp
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirmAction({ gid, kind: 'cancel' })}
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-black text-gray-700 disabled:opacity-60"
            >
              <X size={14} /> Annuler la demande
            </button>
          </div>
        )}

        {isDeclinedOrExpired && !formKind && (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => openForm(gid, 'pay')}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#e85d00] px-3 py-2.5 text-sm font-black text-white disabled:opacity-60"
            >
              <CreditCard size={16} /> Payer moi-même
            </button>
            {Boolean(req.canRetry) && (
              <button
                type="button"
                disabled={busy}
                onClick={() => openForm(gid, 'retry')}
                className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-black text-gray-700 disabled:opacity-60"
              >
                <RefreshCw size={16} /> Réessayer
              </button>
            )}
          </div>
        )}

        {isDeclinedOrExpired && formKind === 'retry' && (
          <div className="mt-3 space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-3">
            <input
              type="tel"
              inputMode="tel"
              value={retryPhone}
              onChange={(e) => setRetryPhone(e.target.value)}
              placeholder="Numéro d'un autre proche"
              className="min-h-[44px] w-full rounded-lg border border-gray-200 bg-white px-3 text-sm"
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => retry(gid)}
                className="inline-flex flex-1 items-center justify-center rounded-lg bg-[#e85d00] px-3 py-2.5 text-sm font-black text-white disabled:opacity-60"
              >
                {busy ? 'Envoi…' : 'Renvoyer la demande'}
              </button>
              <button
                type="button"
                onClick={() => setActiveForm(null)}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm font-black text-gray-600"
              >
                Annuler
              </button>
            </div>
          </div>
        )}

        {isDeclinedOrExpired && formKind === 'pay' && (
          <GroupPaymentForm
            totalAmount={req.totalAmount}
            depositAmount={req.depositAmount}
            walletEnabled={walletEnabled}
            instructions={paymentInstructions}
            busy={busy}
            onSubmit={(payload) => paySelf(gid, payload)}
            onCancel={() => setActiveForm(null)}
          />
        )}
      </div>
    );
  };

  const list = tab === 'incoming' ? incoming : sent;

  return (
    <div className="min-h-screen bg-[#f5f5f5] pb-16 dark:bg-neutral-950">
      <GlassHeader title="Paiement par un proche" subtitle="Demandes reçues et envoyées" backTo="/orders" />

      <main className="mx-auto max-w-2xl space-y-3 px-4 py-4">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTab('incoming')}
            className={`rounded-full px-4 py-1.5 text-xs font-black ${tab === 'incoming' ? 'bg-[#e85d00] text-white' : 'bg-gray-100 text-gray-600'}`}
          >
            À régler
          </button>
          <button
            type="button"
            onClick={() => setTab('sent')}
            className={`rounded-full px-4 py-1.5 text-xs font-black ${tab === 'sent' ? 'bg-[#e85d00] text-white' : 'bg-gray-100 text-gray-600'}`}
          >
            Mes demandes
          </button>
        </div>

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

      <BaseModal
        isOpen={Boolean(confirmAction)}
        onClose={() => setConfirmAction(null)}
        size="sm"
        ariaLabel="Confirmation"
      >
        <div className="space-y-3 p-5">
          <h2 className="text-base font-black text-gray-900 dark:text-neutral-100">
            {confirmAction?.kind === 'decline' ? 'Refuser la demande ?' : 'Annuler la demande ?'}
          </h2>
          <p className="text-sm font-semibold text-gray-600 dark:text-neutral-400">
            {confirmAction?.kind === 'decline'
              ? 'La commande sera annulée. Votre proche pourra la payer lui-même ou solliciter quelqu’un d’autre.'
              : 'La demande envoyée à votre proche sera annulée, ainsi que la commande associée.'}
          </p>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={confirmDestructive}
              className="inline-flex flex-1 items-center justify-center rounded-xl bg-rose-600 px-3 py-2.5 text-sm font-black text-white"
            >
              {confirmAction?.kind === 'decline' ? 'Refuser' : 'Annuler la demande'}
            </button>
            <button
              type="button"
              onClick={() => setConfirmAction(null)}
              className="inline-flex flex-1 items-center justify-center rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-black text-gray-700"
            >
              Retour
            </button>
          </div>
        </div>
      </BaseModal>
    </div>
  );
}
