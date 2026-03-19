import React from 'react';
import { CloudOff, MessageSquareMore, RefreshCw, Signal, Truck, UploadCloud, Wifi, WifiOff } from 'lucide-react';
import useNetworkProfile from '../../hooks/useNetworkProfile';
import useOfflineQueueStats from '../../hooks/useOfflineQueueStats';
import GlassCard from '../ui/GlassCard';

export default function AppOfflineDiagnosticsCard({ title = 'Mise à jour locale', className = '' }) {
  const { offline, rapid3GActive, effectiveType, saveData } = useNetworkProfile();
  const { counts: queueStats, total: totalQueued, loading, reload } = useOfflineQueueStats();
  const networkLabel = offline
    ? 'Hors ligne'
    : rapid3GActive
    ? `Rapide 3G${effectiveType ? ` • ${effectiveType}` : ''}`
    : saveData
    ? 'Économie de données'
    : effectiveType
    ? `En ligne • ${effectiveType}`
    : 'En ligne';

  return (
    <GlassCard variant="glass" className={`rounded-2xl p-4 ${className}`.trim()}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-900/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white dark:bg-white/10 dark:text-slate-100">
            <Signal size={12} />
            Appareil actuel
          </div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
          <p className="text-xs text-slate-600 dark:text-slate-300">
            Réseau courant et actions locales en attente sur cet appareil uniquement.
          </p>
        </div>

        <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200/70 bg-white/70 px-3 py-3 dark:border-slate-700/70 dark:bg-slate-900/50">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
              {offline ? <WifiOff size={14} /> : rapid3GActive ? <CloudOff size={14} /> : <Wifi size={14} />}
              Réseau
            </div>
            <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">{networkLabel}</p>
          </div>
          <div className="rounded-2xl border border-slate-200/70 bg-white/70 px-3 py-3 dark:border-slate-700/70 dark:bg-slate-900/50">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
              <UploadCloud size={14} />
              Statuts
            </div>
            <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
              {queueStats.orderStatus} en attente
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200/70 bg-white/70 px-3 py-3 dark:border-slate-700/70 dark:bg-slate-900/50">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
              <MessageSquareMore size={14} />
              Messages
            </div>
            <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
              {queueStats.chat} en attente
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200/70 bg-white/70 px-3 py-3 dark:border-slate-700/70 dark:bg-slate-900/50">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
              <Truck size={14} />
              Logistique
            </div>
            <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
              {queueStats.adminDelivery} en attente
            </p>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/70 pt-3 text-xs text-slate-600 dark:border-slate-700/70 dark:text-slate-300">
        <span>
          {totalQueued > 0
            ? `${totalQueued} action(s) locales seront rejouées au retour réseau.`
            : 'Aucune action locale en attente.'}
        </span>
        <button
          type="button"
          onClick={reload}
          className="inline-flex min-h-[36px] items-center gap-2 rounded-xl border border-slate-200/80 px-3 py-1.5 font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Vérifier
        </button>
      </div>
    </GlassCard>
  );
}
