import React from 'react';
import { Award, BadgeCheck } from 'lucide-react';

/**
 * SellerLevelBadge — Compact badge showing the seller level.
 * Used on shop profiles, product cards, and seller listings.
 */

const LEVEL_META = {
  diamant: {
    label: 'Diamant',
    bgClass: 'bg-blue-50',
    textClass: 'text-blue-700',
    borderClass: 'border-blue-200',
    ringClass: 'ring-blue-300'
  },
  or: {
    label: 'Or',
    bgClass: 'bg-amber-50',
    textClass: 'text-amber-700',
    borderClass: 'border-amber-200',
    ringClass: 'ring-amber-300'
  },
  avance: {
    label: 'Avancé',
    bgClass: 'bg-gray-50',
    textClass: 'text-gray-700',
    borderClass: 'border-gray-200',
    ringClass: 'ring-gray-300'
  },
  confirme: {
    label: 'Confirmé',
    bgClass: 'bg-green-50',
    textClass: 'text-green-700',
    borderClass: 'border-green-200',
    ringClass: 'ring-green-300'
  },
  debutant: {
    label: 'Débutant',
    bgClass: 'bg-gray-50',
    textClass: 'text-gray-500',
    borderClass: 'border-gray-100',
    ringClass: 'ring-gray-200'
  }
};

export default function SellerLevelBadge({
  level = 'debutant',
  size = 'md',
  showLabel = true,
  verified = false,
  className = ''
}) {
  const meta = LEVEL_META[level] || LEVEL_META.debutant;

  const sizeClasses = size === 'sm'
    ? 'px-1.5 py-0.5 text-[10px] gap-0.5'
    : size === 'lg'
      ? 'px-3 py-1.5 text-sm gap-1.5'
      : 'px-2 py-0.5 text-xs gap-1';

  return (
    <span
      className={`inline-flex items-center rounded-full border font-medium ${meta.bgClass} ${meta.textClass} ${meta.borderClass} ${sizeClasses} ${className}`}
      title={`Niveau ${meta.label}${verified ? ' · Vérifié' : ''}`}
    >
      <Award className="h-3.5 w-3.5" aria-hidden="true" />
      {showLabel && <span>{meta.label}</span>}
      {verified && (
        <BadgeCheck className="ml-0.5 h-3.5 w-3.5" aria-label="Boutique vérifiée" />
      )}
    </span>
  );
}

export { LEVEL_META };
