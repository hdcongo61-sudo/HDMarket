import React from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';

const DeltaChip = ({ value }) => {
  const positive = Number(value || 0) >= 0;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
        positive ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
      }`}
    >
      {positive ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
      {positive ? '+' : ''}
      {Number(value || 0).toFixed(2)}%
    </span>
  );
};

const Row = ({ label, current, previous, delta, formatter }) => (
  <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5">
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p className="text-sm font-semibold text-gray-900">
        {formatter(current)} <span className="text-gray-400">vs</span> {formatter(previous)}
      </p>
    </div>
    <DeltaChip value={delta} />
  </div>
);

export default function PeriodComparisonIndicator({
  comparison,
  formatCurrency,
  formatNumber
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold text-gray-900">Comparaison avec la période précédente</h3>
      <div className="space-y-2.5">
        <Row
          label="Revenu"
          current={comparison?.revenue?.current || 0}
          previous={comparison?.revenue?.previous || 0}
          delta={comparison?.revenue?.deltaPercent || 0}
          formatter={formatCurrency}
        />
        <Row
          label="Conversion"
          current={comparison?.conversionRate?.current || 0}
          previous={comparison?.conversionRate?.previous || 0}
          delta={comparison?.conversionRate?.deltaPercent || 0}
          formatter={(value) => `${Number(value || 0).toFixed(2)}%`}
        />
        <Row
          label="Commandes"
          current={comparison?.orders?.current || 0}
          previous={comparison?.orders?.previous || 0}
          delta={comparison?.orders?.deltaPercent || 0}
          formatter={formatNumber}
        />
      </div>
    </div>
  );
}
