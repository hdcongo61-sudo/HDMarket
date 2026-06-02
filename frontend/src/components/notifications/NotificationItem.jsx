import React, { useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ExternalLink, Loader2, MoreHorizontal, Trash2 } from 'lucide-react';
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
  if (tone === 'boost') return 'bg-orange-50 text-[#ff6a00] border-orange-100';
  if (tone === 'shop') return 'bg-sky-50 text-sky-700 border-sky-100';
  if (tone === 'admin') return 'bg-slate-100 text-slate-700 border-slate-200';
  if (tone === 'message') return 'bg-violet-50 text-violet-700 border-violet-100';
  return 'bg-orange-50 text-[#9a4a00] border-orange-100';
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
  deletePending = false
}) {
  const { t } = useAppSettings();
  const longPressTimer = useRef(null);
  const didLongPress = useRef(false);
  const [menuOpen, setMenuOpen] = useState(false);

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

  const visibleActions = useMemo(() => {
    if (!Array.isArray(actions) || !actions.length) return [];
    return isExpanded ? actions : actions.slice(0, 1);
  }, [actions, isExpanded]);

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
    onToggleExpand?.();
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
              className={`group relative flex w-full items-start gap-3 rounded-[22px] border px-3.5 py-3.5 text-left shadow-[0_10px_26px_rgba(117,75,36,0.07)] transition-all hover:scale-[1.002] ${
                isUnread
                  ? 'border-orange-200 bg-white'
                  : 'border-orange-100/80 bg-white/88'
              }`}
            >
              {isUnread ? (
                <span className="absolute left-0 top-5 h-9 w-1 rounded-r-full bg-[#ff6a00]" />
              ) : null}
              <div className="relative mt-0.5 flex-shrink-0">
                {actorAvatar ? (
                  <img
                    src={actorAvatar}
                    alt={alert?.actor?.name || alert?.user?.name || 'Utilisateur'}
                    className="h-11 w-11 rounded-[17px] object-cover ring-2 ring-orange-50"
                  />
                ) : avatarLetter ? (
                  <div className="flex h-11 w-11 items-center justify-center rounded-[17px] border border-orange-100 bg-orange-50 text-sm font-black text-[#ff6a00] dark:text-neutral-200">
                    {avatarLetter}
                  </div>
                ) : (
                  <div className={`flex h-11 w-11 items-center justify-center rounded-[17px] border ${toneClass(meta?.tone)}`}>
                    {meta.icon}
                  </div>
                )}
                {isUnread && (
                  <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-[#ff6a00]" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-[14px] font-black leading-tight text-neutral-950 dark:text-neutral-100">
                      {meta.title}
                    </p>
                    <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5">
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-black ${toneClass(meta?.tone)}`}>
                        {String(alert?.type || 'info').replaceAll('_', ' ')}
                      </span>
                      {actorName ? (
                        <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-black text-neutral-600 ring-1 ring-orange-100 dark:bg-neutral-900 dark:text-neutral-300 dark:ring-neutral-800">
                          <span className="truncate">{actorName}</span>
                          <span className="text-neutral-400">· {actorRole}</span>
                        </span>
                      ) : null}
                      {reminderLabel ? (
                        <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-black text-amber-700 ring-1 ring-amber-100">
                          {reminderLabel}
                        </span>
                      ) : null}
                      <span className="text-[11px] font-bold text-neutral-400 dark:text-neutral-500">
                        {timeLabel}
                      </span>
                    </div>
                  </div>
                  {isUnread && (
                    <span className="rounded-full bg-[#ff6a00] px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white">
                      {t('notifications.newBadge', 'New')}
                    </span>
                  )}
                </div>

                <p className="mt-2 text-[13px] font-medium leading-relaxed text-neutral-700 dark:text-neutral-300">
                  {isExpanded ? alert.message : previewText(alert.message)}
                </p>

                <AnimatePresence initial={false}>
                  {(isExpanded || visibleActions.length > 0) && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="mt-3 flex flex-wrap items-center gap-2 overflow-hidden"
                    >
                      {visibleActions.map((item) => (
                        <motion.button
                          key={`${alert?._id || 'notification'}-${item.to}-${item.label}`}
                          type="button"
                          whileTap={{ scale: 0.96 }}
                          whileHover={{ y: -1 }}
                          onClick={(event) => {
                            event.stopPropagation();
                            onNavigateAction?.(item.to);
                          }}
                          className="inline-flex min-h-[34px] items-center gap-1 rounded-full bg-[#ff6a00] px-3 py-1.5 text-xs font-black text-white shadow-[0_10px_22px_rgba(255,106,0,0.22)] transition duration-200 hover:bg-[#f45f00]"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          {item.label || t('notifications.view', 'Voir')}
                        </motion.button>
                      ))}
                      {isUnread ? (
                        <motion.button
                          type="button"
                          whileTap={{ scale: 0.96 }}
                          whileHover={{ y: -1 }}
                          disabled={markReadPending}
                          onClick={(event) => {
                            event.stopPropagation();
                            onMarkRead?.();
                          }}
                          className="inline-flex min-h-[34px] items-center gap-1 rounded-full border border-orange-100 bg-orange-50 px-3 py-1.5 text-xs font-bold text-[#9a4a00] transition duration-200 hover:bg-orange-100 disabled:opacity-60 dark:text-neutral-300"
                        >
                          {markReadPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                          {markReadPending ? t('common.loading', 'Chargement...') : t('notifications.markAsRead', 'Marquer comme lu')}
                        </motion.button>
                      ) : null}
                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.96 }}
                        whileHover={{ y: -1 }}
                        disabled={deletePending}
                        onClick={(event) => {
                          event.stopPropagation();
                          onDelete?.();
                        }}
                        className="inline-flex min-h-[34px] items-center gap-1 rounded-full bg-red-50 px-3 py-1.5 text-xs font-black text-red-600 ring-1 ring-red-100 transition duration-200 hover:bg-red-100 disabled:opacity-60"
                      >
                        {deletePending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        {deletePending ? t('common.loading', 'Chargement...') : t('notifications.delete', 'Supprimer')}
                      </motion.button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div
                className={`flex flex-shrink-0 items-center gap-1 pt-0.5 text-neutral-400 transition-opacity duration-150 dark:text-neutral-500 ${
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
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMenuOpen(false)}
          >
            <motion.div
                className="absolute inset-x-4 bottom-4 rounded-[24px] border border-orange-100 bg-white p-2 shadow-xl"
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
                  className="w-full rounded-[18px] px-3 py-2.5 text-left text-sm font-bold text-[#9a4a00] hover:bg-orange-50 dark:text-neutral-200 dark:hover:bg-neutral-800"
                >
                  {t('notifications.markAsRead', 'Marquer comme lu')}
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  if (!deletePending) onDelete?.();
                  setMenuOpen(false);
                }}
                disabled={deletePending}
                className="inline-flex w-full items-center gap-2 rounded-[18px] px-3 py-2.5 text-left text-sm font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-60 dark:text-neutral-300 dark:hover:bg-neutral-950/40"
              >
                {deletePending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                {t('notifications.delete', 'Supprimer')}
              </button>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="mt-1 w-full rounded-[18px] px-3 py-2.5 text-left text-sm font-bold text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
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
