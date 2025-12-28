import React from 'react';
import { ShieldCheck, Shield } from 'lucide-react';

export default function VerifiedBadge({
  verified,
  showLabel = true,
  className = '',
  verifiedLabel = 'Boutique vérifiée',
  unverifiedLabel = 'Boutique non vérifiée'
}) {
  const Icon = verified ? ShieldCheck : Shield;
  const label = verified ? verifiedLabel : unverifiedLabel;
  const style = verified
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : 'border-gray-200 bg-gray-100 text-gray-500';
  const padding = showLabel ? 'px-2' : 'px-1.5';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border ${padding} py-0.5 text-[11px] font-semibold ${style} ${className}`}
      aria-label={label}
      title={!showLabel ? label : undefined}
    >
      <Icon size={12} />
      {showLabel ? <span>{label}</span> : null}
    </span>
  );
}
