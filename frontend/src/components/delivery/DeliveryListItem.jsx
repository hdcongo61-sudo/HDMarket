import React, { useMemo, useRef, useState } from 'react';
import { Check, Clock3, Package, X } from 'lucide-react';
import LiquidGlassCard from '../ui/liquid-notification';
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
  const canReject = assignmentStatus === 'PENDING' && !rejectDisabled && !actionsDisabled;

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
    <div className="relative overflow-hidden rounded-2xl shadow-sm transition hover:shadow-md">
      <div className="pointer-events-none absolute inset-0 flex">
        <div className="flex flex-1 items-center justify-start soft-card soft-card-green pl-4 text-emerald-700 dark:text-emerald-100">
          <span className="inline-flex items-center gap-1 text-xs font-semibold">
            <Check size={12} /> Swipe to accept
          </span>
        </div>
        <div className="flex flex-1 items-center justify-end soft-card soft-card-red pr-4 text-red-700 dark:text-red-100">
          <span className="inline-flex items-center gap-1 text-xs font-semibold">
            Swipe to reject <X size={12} />
          </span>
        </div>
      </div>

      <LiquidGlassCard
        role="button"
        tabIndex={0}
        onClick={() => onOpen?.(item)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') onOpen?.(item);
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        draggable={false}
        blurIntensity="md"
        glowIntensity="xs"
        shadowIntensity="xs"
        borderRadius="16px"
        style={{ transform: `translateX(${offset}px)` }}
        className="relative z-10 p-4 transition-transform"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-300">#{String(item?.orderId || '').slice(-6)}</p>
            <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{routeText}</p>
            <p className="mt-1 inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-300">
              <Clock3 size={12} /> {getRelativeTime(item?.updatedAt || item?.createdAt)}
            </p>
          </div>
          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusPillClassOf(item)}`}>
            {workflowLabelOf(item)}
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
            <div className="glass-card grid h-12 w-12 place-items-center rounded-xl text-slate-400 dark:text-slate-200">
              <Package size={14} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{firstItem?.name || 'Produit'}</p>
            <p className="text-xs text-slate-500 dark:text-slate-300">Qté {Number(firstItem?.qty || 1)}</p>
          </div>
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-100">{formatCurrency(item?.deliveryPrice, item?.currency)}</p>
        </div>
      </LiquidGlassCard>
    </div>
  );
}
