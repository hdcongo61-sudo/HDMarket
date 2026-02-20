import React, { useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ExternalLink, MoreHorizontal } from 'lucide-react';
import SwipeActions from './SwipeActions';
import { useAppSettings } from '../../context/AppSettingsContext';

const previewText = (message, max = 120) => {
  const safe = String(message || '').trim();
  if (safe.length <= max) return safe;
  return `${safe.slice(0, max - 1)}…`;
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
  onNavigateAction
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
      <SwipeActions
        canMarkRead={isUnread}
        onMarkRead={onMarkRead}
        onDelete={onDelete}
      >
        <motion.article
          layout
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="py-3"
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
            className="group relative flex items-start gap-3 rounded-2xl px-1 py-1.5 text-left transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-900/70"
          >
            <div className="relative mt-0.5 flex-shrink-0">
              {avatarLetter ? (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 text-sm font-semibold text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
                  {avatarLetter}
                </div>
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                  {meta.icon}
                </div>
              )}
              {isUnread && (
                <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-blue-500" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-neutral-950 dark:text-neutral-100">
                    {meta.title}
                  </p>
                  <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                    {timeLabel}
                  </p>
                </div>
                {isUnread && (
                  <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-blue-700 dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-300">
                    {t('notifications.newBadge', 'New')}
                  </span>
                )}
              </div>

              <p className="mt-2 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
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
                      <button
                        key={`${alert?._id || 'notification'}-${item.to}-${item.label}`}
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onNavigateAction?.(item.to);
                        }}
                        className="inline-flex items-center gap-1 rounded-full border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        {item.label || t('notifications.view', 'Voir')}
                      </button>
                    ))}
                    {isUnread ? (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onMarkRead?.();
                        }}
                        className="inline-flex items-center gap-1 rounded-full border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 transition hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                      >
                        {t('notifications.markAsRead', 'Marquer comme lu')}
                      </button>
                    ) : null}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="flex flex-shrink-0 items-center gap-1 pt-0.5 text-neutral-400 dark:text-neutral-500">
              <MoreHorizontal className="h-4 w-4" />
              <ChevronDown
                className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              />
            </div>
          </div>
        </motion.article>
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
              className="absolute inset-x-4 bottom-4 rounded-2xl border border-neutral-200 bg-white p-2 shadow-xl dark:border-neutral-700 dark:bg-neutral-900"
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
                  className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-neutral-800 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800"
                >
                  {t('notifications.markAsRead', 'Marquer comme lu')}
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  onDelete?.();
                  setMenuOpen(false);
                }}
                className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/40"
              >
                {t('notifications.delete', 'Supprimer')}
              </button>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="mt-1 w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
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
