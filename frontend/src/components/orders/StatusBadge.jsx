import React from 'react';
const STATUS_CONFIG = {
  pending_payment: {
    label: 'Paiement en attente',
    className: 'bg-[#fff0e4] text-[#c2410c]',
    dotClassName: 'bg-[#e85d00]'
  },
  paid: {
    label: 'Payée',
    className: 'bg-[#eff6ff] text-[#1d4ed8]', dotClassName: 'bg-blue-500'
  },
  ready_for_pickup: {
    label: 'Prête au retrait',
    className: 'bg-[#eff6ff] text-[#1d4ed8]', dotClassName: 'bg-blue-500'
  },
  picked_up_confirmed: {
    label: 'Retrait confirmé',
    className: 'bg-[#ecfdf5] text-[#047857]', dotClassName: 'bg-emerald-500'
  },
  ready_for_delivery: {
    label: 'En préparation',
    className: 'bg-[#eff6ff] text-[#1d4ed8]', dotClassName: 'bg-blue-500'
  },
  out_for_delivery: {
    label: 'En cours de livraison',
    className: 'bg-[#eff6ff] text-[#1d4ed8]', dotClassName: 'bg-blue-500'
  },
  delivery_proof_submitted: {
    label: 'Preuve livrée',
    className: 'bg-[#fff0e4] text-[#c2410c]', dotClassName: 'bg-[#e85d00]'
  },
  confirmed_by_client: {
    label: 'Confirmée client',
    className: 'bg-[#ecfdf5] text-[#047857]', dotClassName: 'bg-emerald-500'
  },
  pending_installment: {
    label: 'Validation vente',
    className: 'bg-[#fff0e4] text-[#c2410c]', dotClassName: 'bg-[#e85d00]'
  },
  installment_active: {
    label: 'Tranche active',
    className: 'bg-[#eff6ff] text-[#1d4ed8]', dotClassName: 'bg-blue-500'
  },
  overdue_installment: {
    label: 'Tranche en retard',
    className: 'bg-red-50 text-red-700', dotClassName: 'bg-red-500'
  },
  confirmed: {
    label: 'Confirmée',
    className: 'bg-[#eff6ff] text-[#1d4ed8]', dotClassName: 'bg-blue-500'
  },
  delivering: {
    label: 'En cours de livraison',
    className: 'bg-[#eff6ff] text-[#1d4ed8]', dotClassName: 'bg-blue-500'
  },
  delivered: {
    label: 'Livrée',
    className: 'bg-[#ecfdf5] text-[#047857]', dotClassName: 'bg-emerald-500'
  },
  completed: {
    label: 'Terminée',
    className: 'bg-[#ecfdf5] text-[#047857]', dotClassName: 'bg-emerald-500'
  },
  cancelled: {
    label: 'Annulée',
    className: 'bg-red-50 text-red-700', dotClassName: 'bg-red-500'
  }
};

const PAYMENT_BADGE = {
  full: {
    label: 'Paiement complet',
    className:
      'bg-[#eff6ff] text-[#1d4ed8]'
  },
  installment: {
    label: 'Paiement par tranche',
    className:
      'bg-[#fff0e4] text-[#c2410c]'
  }
};

export default function StatusBadge({ status, paymentType, className = '' }) {
  if (paymentType) {
    const cfg = PAYMENT_BADGE[paymentType] || PAYMENT_BADGE.full;
    return (
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${cfg.className} ${className}`.trim()}
      >
        {cfg.label}
      </span>
    );
  }

  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending_payment;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${cfg.className} ${className}`.trim()}
    >
      <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${cfg.dotClassName}`} />
      {cfg.label}
    </span>
  );
}
