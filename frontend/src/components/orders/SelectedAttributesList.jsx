import React from 'react';
import { normalizeSelectedAttributes } from '../../utils/productAttributes';

export default function SelectedAttributesList({
  selectedAttributes = [],
  compact = false,
  className = '',
  emptyLabel = ''
}) {
  const items = normalizeSelectedAttributes(selectedAttributes);
  if (!items.length) {
    return emptyLabel ? (
      <p className={`text-xs text-gray-500 ${className}`}>{emptyLabel}</p>
    ) : null;
  }

  return (
    <div className={`space-y-1.5 ${className}`}>
      {!compact && (
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-gray-500">
          Options sélectionnées
        </p>
      )}
      <div className={`flex flex-wrap gap-1.5 ${compact ? '' : 'pt-0.5'}`}>
        {items.map((entry) => (
          <span
            key={`${entry.name}:${entry.value}`}
            className={`inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-gray-700 ${
              compact ? 'text-[11px]' : 'text-xs'
            }`}
          >
            <span className="font-semibold">{entry.name}:</span>
            <span>{entry.value}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
