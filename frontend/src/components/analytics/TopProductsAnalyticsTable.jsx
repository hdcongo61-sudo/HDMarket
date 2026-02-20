import React from 'react';
import { TrendingUp } from 'lucide-react';

const classLabel = {
  high_potential: 'Haut potentiel',
  high_performer: 'Top performer',
  low_performer: 'Faible performance',
  stable: 'Stable'
};

const classStyle = {
  high_potential: 'bg-amber-50 text-amber-700',
  high_performer: 'bg-emerald-50 text-emerald-700',
  low_performer: 'bg-rose-50 text-rose-700',
  stable: 'bg-slate-100 text-slate-600'
};

export default function TopProductsAnalyticsTable({
  products = [],
  formatCurrency
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-indigo-600" />
        <h3 className="text-sm font-semibold text-gray-900">Produits les plus vus</h3>
      </div>
      {!products.length ? (
        <p className="text-sm text-gray-500">Aucun produit avec vue sur la période.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="py-2 pr-3">Produit</th>
                <th className="py-2 pr-3">Vues</th>
                <th className="py-2 pr-3">Cmd</th>
                <th className="py-2 pr-3">Revenu</th>
                <th className="py-2 pr-3">Conv</th>
                <th className="py-2 pr-3">Score</th>
                <th className="py-2">Classe</th>
              </tr>
            </thead>
            <tbody>
              {products.slice(0, 10).map((item) => (
                <tr key={item.productId || item.title} className="border-b border-gray-50">
                  <td className="py-2.5 pr-3 font-semibold text-gray-800">{item.title}</td>
                  <td className="py-2.5 pr-3 text-gray-700">{item.views}</td>
                  <td className="py-2.5 pr-3 text-gray-700">{item.orders}</td>
                  <td className="py-2.5 pr-3 text-gray-700">{formatCurrency(item.revenue || 0)}</td>
                  <td className="py-2.5 pr-3 text-gray-700">{Number(item.conversionRate || 0).toFixed(2)}%</td>
                  <td className="py-2.5 pr-3 text-gray-700">{Number(item.score || 0).toFixed(2)}</td>
                  <td className="py-2.5">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        classStyle[item.classification] || classStyle.stable
                      }`}
                    >
                      {classLabel[item.classification] || classLabel.stable}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
