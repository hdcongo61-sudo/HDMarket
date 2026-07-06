import React from 'react';
import { CheckCircle, Lock, Receipt, Store, Truck } from 'lucide-react';

const clamp = (value) => Math.max(0, Math.min(100, Number(value) || 0));

const ProgressBar = ({ value, locked = false }) => (
  <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-neutral-800">
    <div
      className={`h-full rounded-full transition-[width] duration-700 ${locked ? 'bg-gray-300' : 'bg-gradient-to-r from-[#FFB000] to-[#FF6A00]'}`}
      style={{ width: `${clamp(value)}%` }}
    />
  </div>
);

export default function InstallmentOrderTracking({ order, isPickup = false }) {
  const schedule = Array.isArray(order?.installmentPlan?.schedule) ? order.installmentPlan.schedule : [];
  const paidCount = schedule.filter((entry) => ['paid', 'waived'].includes(String(entry?.status || ''))).length;
  const paymentComplete = schedule.length > 0 && paidCount === schedule.length && String(order?.status || '') === 'completed';
  const paymentPercent = schedule.length ? Math.round((paidCount / schedule.length) * 100) : Number(order?.installmentProgress?.percent || 0);
  const saleStatus = String(order?.installmentSaleStatus || 'confirmed').toLowerCase();
  const proofSubmitted = ['submitted', 'verified'].includes(String(order?.deliveryStatus || '').toLowerCase());
  const fulfilmentIndex = ['delivered', 'picked_up_confirmed'].includes(saleStatus)
    ? 3
    : proofSubmitted || saleStatus === 'delivery_proof_submitted'
      ? 2
      : ['delivering', 'ready_for_pickup'].includes(saleStatus)
        ? 1
        : 0;
  const fulfilmentPercent = !paymentComplete ? 0 : (fulfilmentIndex / 3) * 100;
  const fulfilmentSteps = isPickup
    ? ['Préparation', 'Prêt à récupérer', 'Preuve retrait', 'Récupéré']
    : ['Préparation', 'En livraison', 'Preuve livraison', 'Livrée'];
  const FulfilmentIcon = isPickup ? Store : Truck;

  return (
    <div className="space-y-3 bg-white px-5 pb-4 pt-4 dark:bg-neutral-950 sm:px-7">
      <section className="rounded-2xl border border-orange-200 bg-orange-50/60 p-4 dark:border-orange-900/50 dark:bg-orange-950/20">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-gray-800 dark:text-gray-100"><Receipt className="h-4 w-4 text-[#FF6A00]" /> Suivi des tranches</p>
          <span className="text-xs font-black text-[#FF6A00]">{paidCount}/{schedule.length || 0} payée{paidCount > 1 ? 's' : ''}</span>
        </div>
        <ProgressBar value={paymentPercent} />
        <p className="mt-2 text-xs font-semibold text-gray-600 dark:text-gray-300">
          {paymentComplete ? 'Toutes les tranches sont réglées.' : `Paiement en cours — ${clamp(paymentPercent)}% réglé.`}
        </p>
      </section>
      <section className={`rounded-2xl border p-4 ${paymentComplete ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-950/20' : 'border-gray-200 bg-gray-50 dark:border-neutral-800 dark:bg-neutral-900'}`}>
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-gray-800 dark:text-gray-100">
            {paymentComplete ? <FulfilmentIcon className="h-4 w-4 text-emerald-600" /> : <Lock className="h-4 w-4 text-gray-400" />}
            {isPickup ? 'Suivi — Passer récupérer' : 'Suivi de livraison'}
          </p>
          <span className={`text-xs font-black ${paymentComplete ? 'text-emerald-700' : 'text-gray-500'}`}>{paymentComplete ? `Étape ${fulfilmentIndex + 1}/4` : 'En attente du paiement'}</span>
        </div>
        <ProgressBar value={fulfilmentPercent} locked={!paymentComplete} />
        <div className="mt-2 flex justify-between gap-1">
          {fulfilmentSteps.map((step, index) => <span key={step} className={`flex-1 text-[9px] font-bold uppercase ${index === 0 ? 'text-left' : index === 3 ? 'text-right' : 'text-center'} ${index === fulfilmentIndex && paymentComplete ? 'text-emerald-700' : 'text-gray-400'}`}>{step}</span>)}
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300">
          {paymentComplete ? <CheckCircle className="h-3.5 w-3.5 text-emerald-600" /> : <Lock className="h-3.5 w-3.5" />}
          {paymentComplete
            ? isPickup ? 'Le suivi du retrait est maintenant actif.' : 'Le suivi de livraison est maintenant actif.'
            : isPickup ? 'Le retrait commencera après le paiement de toutes les tranches.' : 'La livraison commencera après le paiement de toutes les tranches.'}
        </p>
      </section>
    </div>
  );
}
