import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { CreditCard, Package, Truck, ClipboardCheck, CheckCircle2 } from 'lucide-react';

const DELIVERY_STEPS = [
  { key: 'paid', label: 'Payée', hint: 'Paiement confirmé', Icon: CreditCard },
  { key: 'processing', label: 'Préparation', hint: 'Commande en traitement', Icon: Package },
  { key: 'out_for_delivery', label: 'En livraison', hint: 'Le colis est en route', Icon: Truck },
  {
    key: 'delivery_proof_submitted',
    label: 'Preuve soumise',
    hint: 'Preuve de livraison envoyée',
    Icon: ClipboardCheck
  },
  { key: 'completed', label: 'Terminée', hint: 'Commande finalisée', Icon: CheckCircle2 }
];

const INSTALLMENT_STEPS = [
  { key: 'pending_installment', label: 'Validation', hint: 'Vente en attente', Icon: CreditCard },
  { key: 'installment_active', label: 'Tranches actives', hint: 'Paiements en cours', Icon: Package },
  { key: 'out_for_delivery', label: 'En livraison', hint: 'Après paiement complet', Icon: Truck },
  {
    key: 'delivery_proof_submitted',
    label: 'Preuve soumise',
    hint: 'Preuve transmise au client',
    Icon: ClipboardCheck
  },
  { key: 'completed', label: 'Terminée', hint: 'Clôture de commande', Icon: CheckCircle2 }
];

function mapDeliveryStatus(status) {
  const value = String(status || '').toLowerCase();
  if (['completed', 'confirmed_by_client'].includes(value)) return 'completed';
  if (['delivery_proof_submitted', 'delivered'].includes(value)) return 'delivery_proof_submitted';
  if (['out_for_delivery', 'delivering'].includes(value)) return 'out_for_delivery';
  if (['ready_for_delivery', 'confirmed', 'pending'].includes(value)) return 'processing';
  if (value === 'paid') return 'paid';
  return 'paid';
}

function mapInstallmentStatus(status) {
  const value = String(status || '').toLowerCase();
  if (['completed', 'confirmed_by_client'].includes(value)) return 'completed';
  if (['delivery_proof_submitted', 'delivered'].includes(value)) return 'delivery_proof_submitted';
  if (['out_for_delivery', 'delivering'].includes(value)) return 'out_for_delivery';
  if (['installment_active', 'overdue_installment'].includes(value)) return 'installment_active';
  return 'pending_installment';
}

export default function AnimatedOrderTimeline({ status, paymentType = 'full', className = '' }) {
  const isInstallment = paymentType === 'installment';
  const steps = isInstallment ? INSTALLMENT_STEPS : DELIVERY_STEPS;

  const currentIndex = useMemo(() => {
    const mapped = isInstallment ? mapInstallmentStatus(status) : mapDeliveryStatus(status);
    const index = steps.findIndex((step) => step.key === mapped);
    return index < 0 ? 0 : index;
  }, [isInstallment, status, steps]);

  const progress = steps.length > 1 ? (currentIndex / (steps.length - 1)) * 100 : 0;

  return (
    <section
      className={`rounded-2xl border border-neutral-200 bg-white/90 p-4 dark:border-neutral-800 dark:bg-neutral-900/80 ${className}`.trim()}
    >
      <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        Suivi de commande
      </p>
      <div className="relative pl-1">
        <div className="absolute left-3.5 top-1 bottom-1 w-px bg-neutral-200 dark:bg-neutral-700" />
        <motion.div
          className="absolute left-3.5 top-1 w-px bg-indigo-500"
          animate={{ height: `${Math.max(progress, 2)}%` }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          style={{ height: '2%' }}
        />

        <div className="space-y-4">
          {steps.map((step, index) => {
            const done = index < currentIndex;
            const current = index === currentIndex;
            const Icon = done ? CheckCircle2 : step.Icon;
            return (
              <motion.div
                key={step.key}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: index * 0.04 }}
                className="relative flex items-start gap-3"
              >
                <div
                  className={`relative z-10 mt-0.5 flex h-6 w-6 items-center justify-center rounded-full border text-[11px] ${
                    done || current
                      ? 'border-indigo-500 bg-indigo-500 text-white'
                      : 'border-neutral-300 bg-white text-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-500'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {current && (
                    <motion.span
                      className="absolute inset-0 rounded-full border border-indigo-400"
                      initial={{ scale: 1, opacity: 0.6 }}
                      animate={{ scale: 1.6, opacity: 0 }}
                      transition={{ duration: 1.1, repeat: Infinity, ease: 'easeOut' }}
                    />
                  )}
                </div>
                <div>
                  <p
                    className={`text-sm font-medium ${
                      done || current
                        ? 'text-neutral-900 dark:text-neutral-100'
                        : 'text-neutral-500 dark:text-neutral-400'
                    }`}
                  >
                    {step.label}
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">{step.hint}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
