import React from 'react';
import { CheckCircle2, Clock3 } from 'lucide-react';

const DEFAULT_STEPS = [
  { key: 'pending_payment', label: 'Paiement en attente' },
  { key: 'paid', label: 'Payé' },
  { key: 'ready_for_delivery', label: 'Prête pour livraison' },
  { key: 'out_for_delivery', label: 'En cours de livraison' },
  { key: 'delivery_proof_submitted', label: 'Preuve soumise' },
  { key: 'confirmed_by_client', label: 'Confirmée client' },
  { key: 'completed', label: 'Terminée' }
];

const LEGACY_ALIAS = {
  pending: 'pending_payment',
  confirmed: 'ready_for_delivery',
  delivering: 'out_for_delivery',
  delivered: 'delivery_proof_submitted'
};

export default function OrderTimeline({ status, steps = DEFAULT_STEPS }) {
  const normalized = LEGACY_ALIAS[status] || status || 'pending_payment';
  const currentIndex = Math.max(
    0,
    steps.findIndex((step) => step.key === normalized)
  );

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-gray-700 mb-3">Timeline commande</p>
      <div className="space-y-3">
        {steps.map((step, index) => {
          const reached = index <= currentIndex;
          const isCurrent = index === currentIndex;
          return (
            <div key={step.key} className="flex items-center gap-3">
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full border ${
                  reached
                    ? 'border-emerald-500 bg-emerald-500 text-white'
                    : 'border-gray-300 bg-white text-gray-400'
                }`}
              >
                {reached ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-medium ${reached ? 'text-gray-900' : 'text-gray-500'}`}>
                  {step.label}
                </span>
                {isCurrent && (
                  <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                    En cours
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
