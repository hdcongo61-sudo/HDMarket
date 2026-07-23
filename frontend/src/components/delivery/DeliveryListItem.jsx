import React, { useMemo, useRef, useState } from 'react';
import { Check, Clock3, Package, X } from 'lucide-react';
import {
  formatCurrency,
  getRelativeTime,
  normalizeFileUrl,
  statusPillClassOf,
  workflowLabelOf
} from '../../utils/deliveryUi';

const SWIPE_MAX = 96;
const SWIPE_TRIGGER = 70;

export default function DeliveryListItem({
  item,
  onOpen,
  onAccept,
  onReject,
  acceptDisabled = false,
  rejectDisabled = false,
  actionsDisabled = false
}) {
  const touchStartRef = useRef(0);
  const [offset, setOffset] = useState(0);
  const [swiping, setSwiping] = useState(false);

  const assignmentStatus = String(item?.assignmentStatus || '').toUpperCase();
  const canAccept = assignmentStatus === 'PENDING' && !acceptDisabled && !actionsDisabled;
  const canReject = !item?.claimable && assignmentStatus === 'PENDING' && !rejectDisabled && !actionsDisabled;

  const firstItem = Array.isArray(item?.itemsSnapshot) ? item.itemsSnapshot[0] : null;
  const routeText = useMemo(
    () => `${item?.pickup?.communeName || 'Pickup'} → ${item?.dropoff?.communeName || item?.buyer?.commune || 'Dropoff'}`,
    [item?.pickup?.communeName, item?.dropoff?.communeName, item?.buyer?.commune]
  );

  const onTouchStart = (event) => {
    if (!(canAccept || canReject)) return;
    touchStartRef.current = event.touches?.[0]?.clientX || 0;
    setSwiping(true);
  };

  const onTouchMove = (event) => {
    if (!swiping || !(canAccept || canReject)) return;
    const currentX = event.touches?.[0]?.clientX || 0;
    const delta = currentX - touchStartRef.current;
    const clamped = Math.max(-SWIPE_MAX, Math.min(SWIPE_MAX, delta));
    setOffset(clamped);
  };

  const onTouchEnd = () => {
    if (!swiping) return;
    if (offset >= SWIPE_TRIGGER && canAccept) {
      onAccept?.(item);
    } else if (offset <= -SWIPE_TRIGGER && canReject) {
      onReject?.(item);
    }
    setOffset(0);
    setSwiping(false);
  };

  return (
    <div className="relative overflow-hidden rounded-2xl shadow-sm">
      <div className="pointer-events-none absolute inset-0 flex">
        <div className="flex flex-1 items-center justify-start bg-emerald-50 pl-4 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
          <span className="inline-flex items-center gap-1 text-xs font-semibold">
            <Check size={12} /> {item?.claimable ? 'Glisser pour prendre' : 'Glisser pour accepter'}
          </span>
        </div>
        <div className="flex flex-1 items-center justify-end bg-rose-50 pr-4 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
          <span className="inline-flex items-center gap-1 text-xs font-semibold">
            {item?.claimable ? 'Utilisez le bouton' : 'Glisser pour refuser'} <X size={12} />
          </span>
        </div>
      </div>

      <div
        role={item?.claimable ? 'group' : 'button'}
        tabIndex={item?.claimable ? -1 : 0}
        onClick={() => !item?.claimable && onOpen?.(item)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !item?.claimable) onOpen?.(item);
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        style={{ transform: `translateX(${offset}px)` }}
        className="relative z-10 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition-transform dark:border-neutral-800 dark:bg-neutral-950"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">#{String(item?.orderId || '').slice(-6)}</p>
            <p className="mt-1 text-sm font-black text-gray-900 dark:text-white">{routeText}</p>
            <p className="mt-1 inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
              <Clock3 size={12} /> {getRelativeTime(item?.updatedAt || item?.createdAt)}
            </p>
          </div>
          <span className={`inline-flex rounded px-2.5 py-1 text-xs font-semibold ${statusPillClassOf(item)}`}>
            {item?.claimable ? 'Disponible' : workflowLabelOf(item)}
          </span>
        </div>

        <div className="mt-3 flex items-center gap-3">
          {firstItem?.imageUrl ? (
            <img
              src={normalizeFileUrl(firstItem.imageUrl)}
              alt={firstItem?.name || 'Produit'}
              className="h-12 w-12 rounded-xl object-cover"
              loading="lazy"
            />
          ) : (
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-gray-50 text-gray-400 dark:bg-neutral-900 dark:text-gray-500">
              <Package size={14} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{firstItem?.name || 'Produit'}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Qté {Number(firstItem?.qty || 1)}</p>
          </div>
          <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">{formatCurrency(item?.deliveryPrice, item?.currency)}</p>
        </div>

        {item?.claimable ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onAccept?.(item);
            }}
            disabled={!canAccept}
            className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#FF6A00] px-4 text-sm font-black text-white shadow-sm disabled:opacity-60"
          >
            <Check size={15} /> Prendre cette livraison
          </button>
        ) : null}
      </div>
    </div>
  );
}
