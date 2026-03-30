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
    ? 'border-emerald-300 bg-emerald-50 text-emerald-900 shadow-sm'
    : 'border-slate-300 bg-white text-slate-700 shadow-sm';
  const padding = showLabel ? 'px-2' : 'px-1.5';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border ${padding} py-0.5 text-[11px] font-bold ${style} ${className}`}
      aria-label={label}
      title={!showLabel ? label : undefined}
    >
      <Icon size={12} />
      {showLabel ? <span>{label}</span> : null}
    </span>
  );
}
