import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Clock3, LockKeyhole, ShieldAlert, WalletCards } from 'lucide-react';
import { formatPriceWithStoredSettings } from '../../utils/priceFormatter';

const META = {
  WAITING_PAYMENT: { label: 'Paiement en attente', tone: 'amber', icon: Clock3 },
  IN_ESCROW: { label: 'Fonds protégés', tone: 'blue', icon: LockKeyhole },
  DELIVERED: { label: 'Livraison enregistrée', tone: 'blue', icon: WalletCards },
  WAITING_BUYER_CONFIRMATION: { label: 'Confirmation acheteur attendue', tone: 'orange', icon: Clock3 },
  ON_HOLD: { label: 'Fonds bloqués — litige', tone: 'red', icon: ShieldAlert },
  RELEASED: { label: 'Fonds libérés au vendeur', tone: 'green', icon: CheckCircle2 },
  REFUNDED: { label: 'Fonds remboursés', tone: 'slate', icon: CheckCircle2 }
};

const TONES = {
  amber: 'border-amber-200 bg-amber-50 text-amber-900',
  blue: 'border-sky-200 bg-sky-50 text-sky-950',
  orange: 'border-orange-200 bg-orange-50 text-orange-950',
  red: 'border-red-200 bg-red-50 text-red-950',
  green: 'border-emerald-200 bg-emerald-50 text-emerald-950',
  slate: 'border-slate-200 bg-slate-50 text-slate-900'
};

const countdownText = (target, now) => {
  const remaining = Math.max(0, new Date(target).getTime() - now);
  const totalSeconds = Math.floor(remaining / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

export default function EscrowStatusCard({ order, role = 'buyer', onConfirm, confirming = false, compact = false }) {
  const [now, setNow] = useState(Date.now());
  const status = String(order?.escrowStatus || '');
  const isEscrowOrder =
    String(order?.paymentSource || '').toLowerCase() === 'pawapay' && Number(order?.paidAmount || 0) > 0;
  const waiting = status === 'WAITING_BUYER_CONFIRMATION';

  useEffect(() => {
    if (!waiting || !order?.autoReleaseAt) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [order?.autoReleaseAt, waiting]);

  const countdown = useMemo(
    () => (waiting && order?.autoReleaseAt ? countdownText(order.autoReleaseAt, now) : ''),
    [now, order?.autoReleaseAt, waiting]
  );
  if (!isEscrowOrder) return null;

  const meta = META[status] || META.IN_ESCROW;
  const Icon = meta.icon;
  const amount = Number(order?.escrowAmount || order?.paidAmount || 0);

  if (compact) {
    return (
      <div className={`mx-3.5 mt-3 flex items-center justify-between gap-3 rounded-xl border px-3 py-2 ${TONES[meta.tone]}`}>
        <span className="inline-flex min-w-0 items-center gap-2 text-[11px] font-black">
          <Icon className="h-4 w-4 shrink-0" />
          <span className="truncate">{meta.label}</span>
        </span>
        <span className="shrink-0 text-[11px] font-black">
          {countdown || formatPriceWithStoredSettings(amount)}
        </span>
      </div>
    );
  }

  return (
    <section className={`rounded-2xl border p-4 shadow-sm ${TONES[meta.tone]}`}>
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/80">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.13em] opacity-70">Protection HDMarket</p>
              <h2 className="mt-0.5 text-base font-black">{meta.label}</h2>
            </div>
            <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-black">
              {formatPriceWithStoredSettings(amount)}
            </span>
          </div>
          <p className="mt-2 text-xs font-semibold leading-5 opacity-80">
            {status === 'IN_ESCROW' && 'Le montant payé est conservé par HDMarket jusqu’à la fin de la commande.'}
            {waiting && (role === 'buyer'
              ? 'Confirmez la réception ou signalez un problème avant la libération automatique.'
              : 'Le client peut confirmer ou ouvrir un litige avant la libération automatique.')}
            {status === 'ON_HOLD' && 'Aucun versement vendeur ne sera exécuté avant la décision sur le litige.'}
            {status === 'RELEASED' && 'La protection est terminée et le versement vendeur peut être traité.'}
            {status === 'REFUNDED' && 'Le remboursement du montant protégé a été confirmé.'}
          </p>
          {countdown ? (
            <div className="mt-3 flex items-center justify-between rounded-xl bg-white/75 px-3 py-2">
              <span className="text-xs font-bold">Libération automatique dans</span>
              <span className="font-mono text-base font-black tabular-nums">{countdown}</span>
            </div>
          ) : null}
          {role === 'buyer' && waiting ? (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onConfirm}
                disabled={confirming}
                className="min-h-11 rounded-xl bg-emerald-600 px-3 text-xs font-black text-white disabled:opacity-60"
              >
                {confirming ? 'Confirmation…' : 'Confirmer la réception'}
              </button>
              <Link
                to={`/reclamations?orderId=${encodeURIComponent(String(order?._id || ''))}`}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-current bg-white/70 px-3 text-center text-xs font-black"
              >
                Signaler un problème
              </Link>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
