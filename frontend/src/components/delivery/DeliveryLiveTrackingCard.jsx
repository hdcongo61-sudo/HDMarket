import React from 'react';
import { Crosshair, MapPinned, Navigation, ShieldCheck, WifiOff } from 'lucide-react';

const STATUS_META = {
  standby: {
    label: 'En attente',
    message: 'Le suivi démarrera automatiquement dès qu’une mission sera en cours.',
    icon: MapPinned,
    classes: 'border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200'
  },
  requesting: {
    label: 'Connexion GPS',
    message: 'Autorisez la position précise pour connecter le suivi en direct.',
    icon: Crosshair,
    classes: 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-200'
  },
  live: {
    label: 'Suivi en direct',
    message: 'Votre position est transmise au suivi de commande du client.',
    icon: Navigation,
    classes: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200'
  },
  denied: {
    label: 'Position refusée',
    message: 'Activez la localisation dans les réglages du navigateur pour reprendre le suivi.',
    icon: ShieldCheck,
    classes: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200'
  },
  unavailable: {
    label: 'GPS indisponible',
    message: 'Cet appareil ou ce navigateur ne fournit pas de position exploitable.',
    icon: Crosshair,
    classes: 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200'
  },
  offline: {
    label: 'Suivi suspendu',
    message: 'La position sera resynchronisée lorsque la connexion reviendra.',
    icon: WifiOff,
    classes: 'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
  },
  disabled: {
    label: 'Suivi désactivé',
    message: 'Le suivi GPS en direct est désactivé dans la configuration de la plateforme.',
    icon: ShieldCheck,
    classes: 'border-slate-200 bg-white text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'
  }
};

const formatSyncTime = (value) => {
  if (!value) return '';
  return new Date(value).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

export default function DeliveryLiveTrackingCard({ tracking, assignment, onOpenAssignment }) {
  const meta = STATUS_META[tracking?.status] || STATUS_META.standby;
  const Icon = meta.icon;
  const orderReference = assignment?.orderId ? `#${String(assignment.orderId).slice(-6).toUpperCase()}` : '';

  return (
    <section className={`rounded-2xl border p-4 shadow-sm ${meta.classes}`} aria-live="polite">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/75 shadow-sm dark:bg-black/20">
          <Icon className={`h-5 w-5 ${tracking?.status === 'live' ? 'animate-pulse' : ''}`} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.15em] opacity-65">Localisation</p>
              <h2 className="mt-0.5 text-sm font-black">{meta.label}</h2>
            </div>
            {orderReference ? (
              <button
                type="button"
                onClick={onOpenAssignment}
                className="rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-black shadow-sm dark:bg-black/20"
              >
                Mission {orderReference}
              </button>
            ) : null}
          </div>
          <p className="mt-1 text-xs font-semibold leading-5 opacity-80">{meta.message}</p>
          {tracking?.status === 'live' ? (
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-bold opacity-75">
              {tracking.lastSentAt ? <span>Synchronisé à {formatSyncTime(tracking.lastSentAt)}</span> : null}
              {Number.isFinite(tracking.accuracy) ? <span>Précision ±{Math.round(tracking.accuracy)} m</span> : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
