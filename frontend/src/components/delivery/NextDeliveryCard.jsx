import React from 'react';
import { ArrowRightIcon, CubeIcon, MapIcon } from '@heroicons/react/24/outline';
import {
  formatCurrency,
  normalizeFileUrl,
  statusPillClassOf,
  workflowLabelOf
} from '../../utils/deliveryUi';

export default function NextDeliveryCard({
  assignment = null,
  title = 'Prochaine livraison',
  primaryLabel = '',
  secondaryLabel = '',
  onPrimary,
  onSecondary,
  primaryDisabled = false,
  secondaryDisabled = false
}) {
  if (!assignment?._id) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
        <p className="text-[11px] font-black uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400">{title}</p>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">Aucune livraison prioritaire pour le moment.</p>
      </div>
    );
  }

  const firstItem = Array.isArray(assignment.itemsSnapshot) ? assignment.itemsSnapshot[0] : null;
  const productName = firstItem?.name || 'Article';
  const productQty = Number(firstItem?.qty || 1);
  const routeSummary = `${assignment?.pickup?.communeName || 'Pickup'} → ${
    assignment?.dropoff?.communeName || assignment?.buyer?.commune || 'Dropoff'
  }`;

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400">{title}</p>
          <p className="mt-1 text-lg font-black tracking-tight text-gray-900 dark:text-white">{routeSummary}</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Frais: {formatCurrency(assignment.deliveryPrice, assignment.currency)}</p>
        </div>
        <span className={`inline-flex rounded px-2.5 py-1 text-xs font-semibold ${statusPillClassOf(assignment)}`}>
          {workflowLabelOf(assignment)}
        </span>
      </div>

      <div className="mt-3 rounded-xl border border-gray-100 bg-gray-50 p-3 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex items-center gap-3">
          {assignment?.kind === 'PARCEL' ? (
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-white text-[#FF6A00] dark:bg-neutral-950">
              <CubeIcon className="h-4 w-4" />
            </div>
          ) : firstItem?.imageUrl ? (
            <img
              src={normalizeFileUrl(firstItem.imageUrl)}
              alt={productName}
              className="h-12 w-12 rounded-xl object-cover"
              loading="lazy"
            />
          ) : (
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-white text-gray-400 dark:bg-neutral-950 dark:text-gray-500">
              <CubeIcon className="h-4 w-4" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            {assignment?.kind === 'PARCEL' ? (
              <>
                <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                  {assignment?.parcelDescription || 'Colis à livrer'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Course à la demande</p>
              </>
            ) : (
              <>
                <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{productName}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Qté {productQty}</p>
              </>
            )}
          </div>
          <MapIcon className="text-gray-400 h-[15px] w-[15px]" />
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onPrimary}
          disabled={primaryDisabled}
          className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-[#FF6A00] px-4 text-sm font-black text-white transition active:scale-[0.98] disabled:opacity-60"
        >
          {primaryLabel || 'Ouvrir'}
          <ArrowRightIcon className="h-3.5 w-3.5" />
        </button>
        {secondaryLabel ? (
          <button
            type="button"
            onClick={onSecondary}
            disabled={secondaryDisabled}
            className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-black text-gray-700 transition active:scale-[0.98] disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-950 dark:text-gray-200"
          >
            {secondaryLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
