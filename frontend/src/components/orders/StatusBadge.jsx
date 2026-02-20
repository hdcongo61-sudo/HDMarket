import React from 'react';
import {
  Clock3,
  CreditCard,
  Package,
  Truck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ClipboardCheck,
  Wallet
} from 'lucide-react';

const STATUS_CONFIG = {
  pending_payment: {
    label: 'Paiement en attente',
    className:
      'bg-neutral-100 text-neutral-700 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:border-neutral-700',
    Icon: Clock3
  },
  paid: {
    label: 'Payée',
    className:
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-900',
    Icon: CreditCard
  },
  ready_for_delivery: {
    label: 'En préparation',
    className:
      'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-900',
    Icon: Package
  },
  out_for_delivery: {
    label: 'En cours de livraison',
    className:
      'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-200 dark:border-sky-900',
    Icon: Truck
  },
  delivery_proof_submitted: {
    label: 'Preuve livrée',
    className:
      'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-200 dark:border-cyan-900',
    Icon: ClipboardCheck
  },
  confirmed_by_client: {
    label: 'Confirmée client',
    className:
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-900',
    Icon: CheckCircle2
  },
  pending_installment: {
    label: 'Validation vente',
    className:
      'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-200 dark:border-violet-900',
    Icon: Wallet
  },
  installment_active: {
    label: 'Tranche active',
    className:
      'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-200 dark:border-indigo-900',
    Icon: CreditCard
  },
  overdue_installment: {
    label: 'Tranche en retard',
    className:
      'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-900',
    Icon: AlertTriangle
  },
  confirmed: {
    label: 'Confirmée',
    className:
      'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-900',
    Icon: Package
  },
  delivering: {
    label: 'En cours de livraison',
    className:
      'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-200 dark:border-sky-900',
    Icon: Truck
  },
  delivered: {
    label: 'Livrée',
    className:
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-900',
    Icon: CheckCircle2
  },
  completed: {
    label: 'Terminée',
    className:
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-900',
    Icon: CheckCircle2
  },
  cancelled: {
    label: 'Annulée',
    className:
      'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-200 dark:border-red-900',
    Icon: XCircle
  }
};

const PAYMENT_BADGE = {
  full: {
    label: 'Paiement complet',
    className:
      'bg-neutral-100 text-neutral-700 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:border-neutral-700'
  },
  installment: {
    label: 'Paiement par tranche',
    className:
      'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-200 dark:border-indigo-900'
  }
};

export default function StatusBadge({ status, paymentType, className = '', compact = false }) {
  if (paymentType) {
    const cfg = PAYMENT_BADGE[paymentType] || PAYMENT_BADGE.full;
    return (
      <span
        className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${cfg.className} ${className}`.trim()}
      >
        {cfg.label}
      </span>
    );
  }

  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending_payment;
  const Icon = cfg.Icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${cfg.className} ${className}`.trim()}
    >
      {!compact && <Icon className="h-3.5 w-3.5" />}
      {cfg.label}
    </span>
  );
}
