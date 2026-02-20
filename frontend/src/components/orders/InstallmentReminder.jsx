import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, Clock3, Wallet } from 'lucide-react';
import { formatPriceWithStoredSettings } from '../../utils/priceFormatter';

function defaultFormatCurrency(value) {
  return formatPriceWithStoredSettings(value);
}

function getCountdownLabel(ms) {
  if (!Number.isFinite(ms)) return 'Date indisponible';
  if (ms <= 0) {
    const overdueDays = Math.ceil(Math.abs(ms) / (1000 * 60 * 60 * 24));
    return overdueDays <= 1 ? 'En retard depuis aujourd\'hui' : `En retard de ${overdueDays} jours`;
  }
  const totalHours = Math.floor(ms / (1000 * 60 * 60));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  if (days > 0) return `${days}j ${hours}h`;
  return `${Math.max(hours, 1)}h`;
}

export default function InstallmentReminder({
  plan,
  className = '',
  formatCurrency = defaultFormatCurrency
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const totalAmount = Number(plan?.totalAmount || 0);
  const amountPaid = Number(plan?.amountPaid || 0);
  const remainingAmount = Number(plan?.remainingAmount ?? Math.max(0, totalAmount - amountPaid));
  const nextDueDate = plan?.nextDueDate ? new Date(plan.nextDueDate).getTime() : null;

  const progress = totalAmount > 0 ? Math.max(0, Math.min(100, (amountPaid / totalAmount) * 100)) : 0;

  const urgency = useMemo(() => {
    if (!nextDueDate) {
      return {
        tone: 'safe',
        label: 'Aucune échéance en attente',
        style:
          'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-200 dark:border-emerald-900'
      };
    }

    const diff = nextDueDate - now;
    if (diff < 0) {
      return {
        tone: 'overdue',
        label: getCountdownLabel(diff),
        style:
          'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-200 dark:border-rose-900'
      };
    }

    const days = diff / (1000 * 60 * 60 * 24);
    if (days <= 3) {
      return {
        tone: 'soon',
        label: `Prochaine tranche dans ${getCountdownLabel(diff)}`,
        style:
          'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-200 dark:border-amber-900'
      };
    }

    return {
      tone: 'safe',
      label: `Prochaine tranche dans ${getCountdownLabel(diff)}`,
      style:
        'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-200 dark:border-emerald-900'
    };
  }, [nextDueDate, now]);

  return (
    <section
      className={`rounded-2xl border border-neutral-200 bg-white/90 p-4 dark:border-neutral-800 dark:bg-neutral-900/80 ${className}`.trim()}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-indigo-600 dark:text-indigo-300" />
          <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Rappel de tranche</p>
        </div>
        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${urgency.style}`}>
          {urgency.tone === 'overdue' ? <AlertCircle className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}
          {urgency.tone === 'safe' ? 'Vert' : urgency.tone === 'soon' ? 'Bientot' : 'Retard'}
        </span>
      </div>

      <p className="text-sm text-neutral-700 dark:text-neutral-200">{urgency.label}</p>
      {nextDueDate && (
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          Echeance: {new Date(nextDueDate).toLocaleDateString('fr-FR')}
        </p>
      )}

      <div className="mt-4 space-y-1.5">
        <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
          <span>Progression paiement</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
          <motion.div
            className="h-full rounded-full bg-indigo-600 dark:bg-indigo-400"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
          />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-2.5 dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-neutral-500 dark:text-neutral-400">Paye</p>
          <p className="font-semibold text-neutral-900 dark:text-neutral-100">{formatCurrency(amountPaid)}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-2.5 dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-neutral-500 dark:text-neutral-400">Reste</p>
          <p className="font-semibold text-neutral-900 dark:text-neutral-100">{formatCurrency(remainingAmount)}</p>
        </div>
      </div>
    </section>
  );
}
