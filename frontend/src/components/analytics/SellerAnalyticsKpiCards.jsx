import React from 'react';
import { DollarSign, Package, Percent, Wallet } from 'lucide-react';

const Card = ({ icon: Icon, label, value, subtitle, tone = 'indigo' }) => {
  const toneMap = {
    indigo: 'bg-indigo-50 border-indigo-100 text-indigo-700',
    emerald: 'bg-emerald-50 border-emerald-100 text-emerald-700',
    amber: 'bg-amber-50 border-amber-100 text-amber-700',
    rose: 'bg-rose-50 border-rose-100 text-rose-700'
  };
  const classes = toneMap[tone] || toneMap.indigo;

  return (
    <div className={`rounded-2xl border p-4 ${classes}`}>
      <div className="mb-3 inline-flex rounded-xl bg-white p-2 shadow-sm">
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-xs font-semibold uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
      {subtitle ? <p className="mt-1 text-xs text-gray-600">{subtitle}</p> : null}
    </div>
  );
};

export default function SellerAnalyticsKpiCards({
  summary,
  installment,
  formatCurrency,
  formatNumber
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Card
        icon={DollarSign}
        label="Revenu"
        value={formatCurrency(summary?.revenue || 0)}
        subtitle="Période sélectionnée"
        tone="emerald"
      />
      <Card
        icon={Package}
        label="Commandes"
        value={formatNumber(summary?.orders || 0)}
        subtitle={`${formatNumber(summary?.views || 0)} vues produit`}
        tone="indigo"
      />
      <Card
        icon={Percent}
        label="Conversion"
        value={`${Number(summary?.conversionRate || 0).toFixed(2)}%`}
        subtitle="Orders / vues"
        tone="amber"
      />
      <Card
        icon={Wallet}
        label="Tranches"
        value={`${formatCurrency(installment?.amountPaidSoFar || 0)} / ${formatCurrency(
          installment?.remainingAmount || 0
        )}`}
        subtitle={`${formatNumber(installment?.totalInstallmentOrders || 0)} commandes · ${formatNumber(
          installment?.overdueCount || 0
        )} en retard`}
        tone="rose"
      />
    </div>
  );
}
