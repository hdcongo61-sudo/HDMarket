import React, { useState } from 'react';
import { ArrowPathIcon, ChatBubbleLeftEllipsisIcon, ChevronDownIcon, CloudArrowUpIcon, CloudIcon, SignalIcon, TruckIcon, WifiIcon } from '@heroicons/react/24/outline';
import useNetworkProfile from '../../hooks/useNetworkProfile';
import useOfflineQueueStats from '../../hooks/useOfflineQueueStats';
import GlassCard from '../ui/GlassCard';

export default function AppOfflineDiagnosticsCard({
  title = 'Mise à jour locale',
  className = '',
  collapsibleOnMobile = false,
  defaultExpanded = false
}) {
  const { offline, rapid3GActive, effectiveType, saveData } = useNetworkProfile();
  const { counts: queueStats, total: totalQueued, loading, reload } = useOfflineQueueStats();
  const [mobileExpanded, setMobileExpanded] = useState(Boolean(defaultExpanded));
  const networkLabel = offline
    ? 'Hors ligne'
    : rapid3GActive
    ? `Rapide 3G${effectiveType ? ` • ${effectiveType}` : ''}`
    : saveData
    ? 'Économie de données'
    : effectiveType
    ? `En ligne • ${effectiveType}`
    : 'En ligne';
  const queueSummary =
    totalQueued > 0
      ? `${totalQueued} action${totalQueued > 1 ? 's' : ''} en attente`
      : 'Aucune attente locale';

  const fullCard = (
    <GlassCard variant="glass" className="overflow-hidden rounded-2xl p-4 sm:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-900/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white dark:bg-white/10 dark:text-slate-100">
            <SignalIcon className="h-3 w-3" />
            Appareil actuel
          </div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h3>
          <p className="max-w-2xl text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            Réseau courant et actions locales en attente sur cet appareil uniquement.
          </p>
        </div>

        <div className="grid flex-1 grid-cols-2 gap-2 xl:grid-cols-4">
          <div className="col-span-2 rounded-2xl border border-slate-200/70 bg-white/70 px-3 py-3 dark:border-slate-700/70 dark:bg-slate-900/50 xl:col-span-1">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
              {offline ? <WifiIcon className="h-3.5 w-3.5" /> : rapid3GActive ? <CloudIcon className="h-3.5 w-3.5" /> : <WifiIcon className="h-3.5 w-3.5" />}
              Réseau
            </div>
            <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">{networkLabel}</p>
          </div>
          <div className="min-w-0 rounded-2xl border border-slate-200/70 bg-white/70 px-3 py-3 dark:border-slate-700/70 dark:bg-slate-900/50">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
              <CloudArrowUpIcon className="h-3.5 w-3.5" />
              Statuts
            </div>
            <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
              {queueStats.orderStatus} en attente
            </p>
          </div>
          <div className="min-w-0 rounded-2xl border border-slate-200/70 bg-white/70 px-3 py-3 dark:border-slate-700/70 dark:bg-slate-900/50">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
              <ChatBubbleLeftEllipsisIcon className="h-3.5 w-3.5" />
              Messages
            </div>
            <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
              {queueStats.chat} en attente
            </p>
          </div>
          <div className="min-w-0 rounded-2xl border border-slate-200/70 bg-white/70 px-3 py-3 dark:border-slate-700/70 dark:bg-slate-900/50">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
              <TruckIcon className="h-3.5 w-3.5" />
              Logistique
            </div>
            <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
              {queueStats.adminDelivery} en attente
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 border-t border-slate-200/70 pt-4 text-xs text-slate-600 dark:border-slate-700/70 dark:text-slate-300 sm:flex-row sm:items-center sm:justify-between">
        <span>
          {totalQueued > 0
            ? `${totalQueued} action(s) locales seront rejouées au retour réseau.`
            : 'Aucune action locale en attente.'}
        </span>
        <button
          type="button"
          onClick={reload}
          className="inline-flex min-h-[40px] w-full items-center justify-center gap-2 rounded-2xl border border-slate-200/80 px-3 py-1.5 font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800 sm:w-auto"
        >
          <ArrowPathIcon className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Vérifier
        </button>
      </div>
    </GlassCard>
  );

  if (!collapsibleOnMobile) {
    return <div className={className}>{fullCard}</div>;
  }

  return (
    <div className={className}>
      <div className="md:hidden">
        <GlassCard variant="glass" className="rounded-2xl p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-300">
                <SignalIcon className="h-3 w-3" />
                Diagnostic local
              </div>
              <p className="mt-1 truncate text-sm font-semibold text-slate-900 dark:text-white">{networkLabel}</p>
              <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">{queueSummary}</p>
            </div>
            <button
              type="button"
              onClick={() => setMobileExpanded((current) => !current)}
              className="inline-flex min-h-[40px] shrink-0 items-center gap-2 rounded-2xl border border-slate-200/80 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              {mobileExpanded ? 'Masquer' : 'Voir'}
              <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform ${mobileExpanded ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </GlassCard>
      </div>

      <div className={`${mobileExpanded ? 'block' : 'hidden'} md:block`}>
        <div className="mt-3 md:mt-0">{fullCard}</div>
      </div>
    </div>
  );
}
