import React from 'react';
import { MapPin } from 'lucide-react';

export default function RevenueByCityChart({ data = [], formatCurrency, formatNumber }) {
  const maxRevenue = Math.max(1, ...data.map((item) => Number(item?.revenue || 0)));

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <MapPin className="h-4 w-4 text-indigo-600" />
        <h3 className="text-sm font-semibold text-gray-900">Revenu par ville</h3>
      </div>
      {!data.length ? (
        <p className="text-sm text-gray-500">Aucune vente sur la période.</p>
      ) : (
        <div className="space-y-4">
          {data.slice(0, 8).map((item) => {
            const revenue = Number(item?.revenue || 0);
            const width = Math.max(4, Math.round((revenue / maxRevenue) * 100));
            return (
              <div key={`${item.city}-${item.orders}`} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-gray-800">{item.city || 'Non précisée'}</span>
                  <span className="text-gray-500">
                    {formatCurrency(revenue)} · {formatNumber(item.orders || 0)} cmd
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
                    style={{ width: `${Math.min(width, 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
