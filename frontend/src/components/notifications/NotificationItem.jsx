import React, { useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, ChevronDown, Clock3, ExternalLink, Loader2, MoreHorizontal, Pin, Trash2 } from 'lucide-react';
import SwipeActions from './SwipeActions';
import { useAppSettings } from '../../context/AppSettingsContext';
import { resolveUserProfileImage } from '../../utils/userAvatar';

const previewText = (message, max = 120) => {
  const safe = String(message || '').trim();
  if (safe.length <= max) return safe;
  return `${safe.slice(0, max - 1)}…`;
};

const toneClass = (tone = '') => {
  if (tone === 'risk') return 'bg-red-50 text-red-700 border-red-100';
  if (tone === 'delivery') return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  if (tone === 'payment') return 'bg-amber-50 text-amber-700 border-amber-100';
  if (tone === 'boost') return 'bg-gray-100 text-[#e85d00] border-gray-200';
  if (tone === 'shop') return 'bg-sky-50 text-sky-700 border-sky-100';
  if (tone === 'admin') return 'bg-slate-100 text-slate-700 border-slate-200';
  if (tone === 'message') return 'bg-violet-50 text-violet-700 border-violet-100';
  return 'bg-gray-100 text-gray-500 border-gray-200';
};

export default function NotificationItem({
  alert,
  meta,
  timeLabel,
  isUnread,
  isExpanded,
  actions = [],
  onToggleExpand,
  onMarkRead,
  onDelete,
  onNavigateAction,
  markReadPending = false,
  deletePending = false,
  selectionMode = false,
  isSelected = false,
  onToggleSelected,
  onPin,
  onSnooze
}) {
  const { t } = useAppSettings();
  const longPressTimer = useRef(null);
  const didLongPress = useRef(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [navigatingTo, setNavigatingTo] = useState('');

  const avatarLetter = useMemo(() => {
    const name = alert?.actor?.name || alert?.user?.name || '';
    const trimmed = String(name).trim();
    return trimmed ? trimmed.charAt(0).toUpperCase() : '';
  }, [alert?.actor?.name, alert?.user?.name]);
  const actorAvatar = useMemo(
    () => resolveUserProfileImage(alert?.actor || alert?.user || {}),
    [alert?.actor, alert?.user]
  );
  const actorName = useMemo(() => {
    const actor = alert?.actor || alert?.user || {};
    return String(actor?.shopName || actor?.name || alert?.metadata?.actorName || '').trim();
  }, [alert?.actor, alert?.metadata?.actorName, alert?.user]);
  const actorRole = useMemo(() => {
    const actor = alert?.actor || alert?.user || {};
    const role = String(actor?.role || '').toLowerCase();
    const accountType = String(actor?.accountType || '').toLowerCase();
    if (role === 'founder') return 'Founder';
    if (role === 'admin' || role === 'manager') return 'Admin';
    if (accountType === 'shop' || role === 'seller') return 'Boutique';
    return 'Utilisateur';
  }, [alert?.actor, alert?.user]);
  const reminderLabel = useMemo(() => {
    const reminderType = String(alert?.metadata?.reminderType || '').trim();
    if (!reminderType && !String(alert?.type || '').includes('reminder')) return '';
    if (reminderType === 'seller' || reminderType === 'delay_detected') return 'Commande à traiter';
    if (reminderType === 'buyer_confirmation') return 'Confirmation livraison';
    if (reminderType === 'review') return 'Avis à laisser';
    if (reminderType === 'escalation') return 'Escalade admin';
    return 'Rappel';
  }, [alert?.metadata?.reminderType, alert?.type]);
  const deadline = alert?.actionDueAt ? new Date(alert.actionDueAt) : null;
  const deadlineValid = deadline && !Number.isNaN(deadline.getTime());
  const deadlineOverdue = deadlineValid && deadline.getTime() < Date.now();

  const visibleActions = useMemo(() => {
    if (!Array.isArray(actions) || !actions.length) return [];
    return isUnread ? actions.slice(0, 1) : [];
  }, [actions, isExpanded, isUnread]);

  const startLongPress = () => {
    didLongPress.current = false;
    longPressTimer.current = window.setTimeout(() => {
      didLongPress.current = true;
      setMenuOpen(true);
    }, 430);
  };

  const cancelLongPress = () => {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handlePress = () => {
    if (didLongPress.current) {
      didLongPress.current = false;
      return;
    }
    if (isUnread) {
      void onMarkRead?.();
    }
    onToggleExpand?.();
  };

  const handleActionClick = async (to) => {
    if (!to || navigatingTo) return;
    setNavigatingTo(String(to));
    try {
      // Persist the read state before leaving this screen. Immediate navigation
      // can otherwise cancel the request on mobile browsers or external links.
      if (isUnread) {
        await onMarkRead?.();
      }
      await onNavigateAction?.(to);
    } finally {
      setNavigatingTo('');
    }
  };

  return (
    <>
      <SwipeActions canMarkRead={isUnread} onMarkRead={onMarkRead} onDelete={onDelete}>
        {({ isActionsOpen }) => (
          <motion.article
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="py-0"
          >
            <div
              role="button"
              tabIndex={0}
              onClick={handlePress}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  handlePress();
                }
              }}
              onPointerDown={startLongPress}
              onPointerUp={cancelLongPress}
              onPointerLeave={cancelLongPress}
              className={`group relative flex w-full items-start gap-3 overflow-hidden rounded-[16px] border px-3.5 py-3.5 text-left transition duration-200 sm:px-4 ${
                isActionsOpen
                  ? 'border-red-200 bg-white/25'
                  : isUnread
                    ? 'border-orange-200 bg-white'
                    : 'border-[#eee8e0] bg-[#faf8f5] opacity-80'
              }`}
            >
              {selectionMode && (
                <button
                  type="button"
                  aria-label={isSelected ? 'Désélectionner' : 'Sélectionner'}
                  onClick={(event) => { event.stopPropagation(); onToggleSelected?.(); }}
                  className={`absolute right-3 top-3 z-10 h-5 w-5 rounded-md border-2 ${isSelected ? 'border-[#e85d00] bg-[#e85d00]' : 'border-gray-300 bg-white'}`}
                >
                  {isSelected && <CheckCircle2 className="h-4 w-4 text-white" />}
                </button>
              )}
              <div className="relative flex-shrink-0">
                {actorAvatar ? (
                  <img
                    src={actorAvatar}
                    alt={alert?.actor?.name || alert?.user?.name || 'Utilisateur'}
                    className="h-11 w-11 rounded-full object-cover ring-1 ring-black/5"
                  />
                ) : avatarLetter ? (
                  <div className="flex h-11 w-11 items-center justify-center rounded-full border border-orange-100 bg-orange-50 text-sm font-black text-[#e85d00] dark:text-neutral-200">
                    {avatarLetter}
                  </div>
                ) : (
                  <div className={`flex h-11 w-11 items-center justify-center rounded-full border ${toneClass(meta?.tone)}`}>
                    {meta.icon}
                  </div>
                )}
                {isUnread && (
                  <span className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full border-[3px] border-white bg-[#e85d00]" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className={`line-clamp-1 text-[14px] leading-tight dark:text-neutral-100 ${isUnread ? 'font-black text-neutral-950' : 'font-bold text-stone-600'}`}>
                      {meta.title}
                    </p>
                    <div className="hidden">
                      {actorName ? (
                        <span className="inline-flex max-w-full items-center gap-1 text-[11px] font-bold text-neutral-500 dark:text-neutral-400">
                          <span className="truncate">{actorName}</span>
                          <span className="text-neutral-300">•</span>
                          <span>{actorRole}</span>
                        </span>
                      ) : null}
                      {reminderLabel ? (
                        <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-black text-amber-700 ring-1 ring-amber-100">
                          {reminderLabel}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className="whitespace-nowrap text-[11px] font-bold text-neutral-400 dark:text-neutral-500">{timeLabel}</span>
                  </div>
                </div>

                <p className={`mt-1.5 text-[13px] font-medium leading-[1.45] text-[#6b6459] dark:text-neutral-300 ${isUnread ? 'line-clamp-2' : 'line-clamp-1'}`}>
                  {isExpanded ? alert.message : previewText(alert.message)}
                </p>
                {(alert?.product?.image || alert?.pinnedAt || deadlineValid) && (
                  <div className="mt-3 flex items-center gap-2">
                    {alert?.product?.image && <img src={alert.product.image} alt="" className="h-10 w-10 rounded-xl object-cover ring-1 ring-gray-200" />}
                    {alert?.pinnedAt && <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-1 text-[10px] font-black text-[#e85d00]"><Pin className="h-3 w-3" /> Épinglée</span>}
                    {deadlineValid && <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-black ${deadlineOverdue ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{deadlineOverdue ? <AlertTriangle className="h-3 w-3" /> : <Clock3 className="h-3 w-3" />}{deadlineOverdue ? 'Échéance dépassée' : deadline.toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>}
                  </div>
                )}

                <AnimatePresence initial={false}>
                  {(isExpanded || visibleActions.length > 0) && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="mt-2.5 overflow-hidden"
                    >
                      <div className="flex flex-wrap items-center gap-3">
                        {visibleActions.length > 0 ? (
                          <div className="flex flex-wrap items-center gap-2">
                            {visibleActions.map((item, index) => {
                              const isPrimary = index === 0;
                              const isNavigating = navigatingTo === String(item.to || '');
                              return (
                                <motion.button
                                  key={`${alert?._id || 'notification'}-${item.to}-${item.label}`}
                                  type="button"
                                  whileTap={{ scale: 0.97 }}
                                  whileHover={{ y: -1 }}
                                  disabled={Boolean(navigatingTo)}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleActionClick(item.to);
                                  }}
                                  className={`inline-flex min-h-[40px] items-center justify-center gap-2 rounded-full px-4 py-2 text-xs font-black transition disabled:cursor-wait disabled:opacity-70 ${
                                    isPrimary
                                      ? 'bg-neutral-950 text-white'
                                      : 'border border-gray-200 bg-white text-gray-500 shadow-sm hover:bg-gray-100 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:bg-neutral-900'
                                  }`}
                                >
                                  {isNavigating ? (
                                    <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin" />
                                  ) : (
                                    <ExternalLink className="h-4 w-4 flex-shrink-0" />
                                  )}
                                  <span className="truncate">{item.label || t('notifications.view', 'Voir')}</span>
                                  {isUnread && isPrimary ? (
                                    <span className="hidden rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-black sm:inline-flex">
                                      {t('notifications.markAsReadShort', 'Lu')}
                                    </span>
                                  ) : null}
                                </motion.button>
                              );
                            })}
                          </div>
                        ) : null}
                        <div className="flex items-center gap-2">
                          {isUnread ? (
                            <motion.button
                              type="button"
                              whileTap={{ scale: 0.97 }}
                              whileHover={{ y: -1 }}
                              disabled={markReadPending || Boolean(navigatingTo)}
                              onClick={(event) => {
                                event.stopPropagation();
                                onMarkRead?.();
                              }}
                              className="inline-flex min-h-[40px] items-center justify-center gap-2 px-2 text-xs font-bold text-[#8a8378] transition disabled:opacity-60"
                            >
                              {markReadPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                              {markReadPending ? t('common.loading', 'Chargement...') : t('notifications.markAsRead', 'Marquer comme lu')}
                            </motion.button>
                          ) : null}
                          <motion.button
                            type="button"
                            whileTap={{ scale: 0.97 }}
                            whileHover={{ y: -1 }}
                            disabled={deletePending || Boolean(navigatingTo)}
                            onClick={(event) => {
                              event.stopPropagation();
                              onDelete?.();
                            }}
                            className="hidden"
                          >
                            {deletePending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                            {deletePending ? t('common.loading', 'Chargement...') : t('notifications.delete', 'Supprimer')}
                          </motion.button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div
                className={`hidden flex-shrink-0 items-center gap-0.5 pt-0.5 text-neutral-300 transition-opacity duration-150 dark:text-neutral-500 ${
                  isActionsOpen ? 'pointer-events-none opacity-0' : 'opacity-100'
                }`}
              >
                <MoreHorizontal className="h-4 w-4" />
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                />
              </div>
            </div>
          </motion.article>
        )}
      </SwipeActions>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            className="fixed inset-0 z-40 bg-black/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMenuOpen(false)}
          >
            <motion.div
                className="absolute inset-x-4 bottom-4 rounded-2xl border border-gray-200 bg-white p-2 shadow-sm"
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={(event) => event.stopPropagation()}
            >
              {isUnread && (
                <button
                  type="button"
                  onClick={() => {
                    onMarkRead?.();
                    setMenuOpen(false);
                  }}
                  className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-bold text-gray-500 hover:bg-gray-100 dark:text-neutral-200 dark:hover:bg-neutral-800"
                >
                  {t('notifications.markAsRead', 'Marquer comme lu')}
                </button>
              )}
              <button
                type="button"
                onClick={() => { onPin?.(!alert?.pinnedAt); setMenuOpen(false); }}
                className="inline-flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-bold text-gray-700 hover:bg-orange-50"
              >
                <Pin className="h-4 w-4" /> {alert?.pinnedAt ? 'Désépingler' : 'Épingler'}
              </button>
              <button
                type="button"
                onClick={() => { onSnooze?.(); setMenuOpen(false); }}
                className="inline-flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-bold text-gray-700 hover:bg-amber-50"
              >
                <Clock3 className="h-4 w-4" /> Rappeler dans 1 heure
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!deletePending) onDelete?.();
                  setMenuOpen(false);
                }}
                disabled={deletePending}
                className="inline-flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-60 dark:text-neutral-300 dark:hover:bg-neutral-950/40"
              >
                {deletePending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                {t('notifications.delete', 'Supprimer')}
              </button>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="mt-1 w-full rounded-xl px-3 py-2.5 text-left text-sm font-bold text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
              >
                {t('common.cancel', 'Annuler')}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
