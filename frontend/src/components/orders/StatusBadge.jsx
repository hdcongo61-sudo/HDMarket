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
      'bg-neutral-100 text-neutral-800 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-100 dark:border-neutral-700',
    Icon: CreditCard
  },
  ready_for_pickup: {
    label: 'Prête à récupérer',
    className:
      'bg-neutral-100 text-neutral-800 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-100 dark:border-neutral-700',
    Icon: Package
  },
  picked_up_confirmed: {
    label: 'Retrait confirmé',
    className:
      'bg-neutral-100 text-neutral-800 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-100 dark:border-neutral-700',
    Icon: CheckCircle2
  },
  ready_for_delivery: {
    label: 'En préparation',
    className:
      'bg-neutral-100 text-neutral-800 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-100 dark:border-neutral-700',
    Icon: Package
  },
  out_for_delivery: {
    label: 'En cours de livraison',
    className:
      'bg-neutral-100 text-neutral-800 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-100 dark:border-neutral-700',
    Icon: Truck
  },
  delivery_proof_submitted: {
    label: 'Preuve livrée',
    className:
      'bg-neutral-100 text-neutral-800 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-100 dark:border-neutral-700',
    Icon: ClipboardCheck
  },
  confirmed_by_client: {
    label: 'Confirmée client',
    className:
      'bg-neutral-100 text-neutral-800 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-100 dark:border-neutral-700',
    Icon: CheckCircle2
  },
  pending_installment: {
    label: 'Validation vente',
    className:
      'bg-neutral-100 text-neutral-800 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-100 dark:border-neutral-700',
    Icon: Wallet
  },
  installment_active: {
    label: 'Tranche active',
    className:
      'bg-neutral-100 text-neutral-800 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-100 dark:border-neutral-700',
    Icon: CreditCard
  },
  overdue_installment: {
    label: 'Tranche en retard',
    className:
      'bg-neutral-100 text-neutral-800 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-100 dark:border-neutral-700',
    Icon: AlertTriangle
  },
  confirmed: {
    label: 'Confirmée',
    className:
      'bg-neutral-100 text-neutral-800 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-100 dark:border-neutral-700',
    Icon: Package
  },
  delivering: {
    label: 'En cours de livraison',
    className:
      'bg-neutral-100 text-neutral-800 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-100 dark:border-neutral-700',
    Icon: Truck
  },
  delivered: {
    label: 'Livrée',
    className:
      'bg-neutral-100 text-neutral-800 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-100 dark:border-neutral-700',
    Icon: CheckCircle2
  },
  completed: {
    label: 'Terminée',
    className:
      'bg-neutral-100 text-neutral-800 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-100 dark:border-neutral-700',
    Icon: CheckCircle2
  },
  cancelled: {
    label: 'Annulée',
    className:
      'bg-neutral-100 text-neutral-800 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-100 dark:border-neutral-700',
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
      'bg-neutral-100 text-neutral-700 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:border-neutral-700'
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
  const iconMotionClass =
    status === 'pending_payment' || status === 'pending_installment'
      ? 'status-pending-dot'
      : status === 'out_for_delivery' || status === 'delivering'
        ? 'status-delivery-icon'
        : status === 'completed' || status === 'delivered' || status === 'picked_up_confirmed'
          ? 'status-completed-icon'
          : '';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${cfg.className} ${className}`.trim()}
    >
      {!compact && <Icon className={`h-3.5 w-3.5 ${iconMotionClass}`.trim()} />}
      {cfg.label}
    </span>
  );
}
