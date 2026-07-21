import React, { useEffect, useState } from 'react';
import { Gift } from 'lucide-react';
import api from '../services/api';
import { formatPriceWithStoredSettings as formatCurrency } from '../utils/priceFormatter';

/**
 * "Utiliser mes points" checkout option. Single-seller carts only (matches
 * the backend constraint in userCheckoutOrder — points redemption doesn't
 * yet split across multiple seller orders).
 */
export default function RewardPointsRedeemBox({ orderSubtotal, singleSeller, onChange }) {
  const [data, setData] = useState(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    api
      .get('/rewards/me')
      .then(({ data: response }) => setData(response))
      .catch(() => setData(null));
  }, []);

  const maxByCap = Math.floor((orderSubtotal * (data?.maxOrderPercent || 0)) / 100 / Math.max(1, data?.conversionXaf || 1));
  const maxPoints = Math.max(0, Math.min(data?.balance || 0, maxByCap));
  const xafValue = maxPoints * Number(data?.conversionXaf || 1);

  useEffect(() => {
    onChange?.(enabled ? maxPoints : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, maxPoints]);

  if (!singleSeller || !data?.enabled || maxPoints <= 0) return null;

  return (
    <label className="flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border border-gray-100 bg-white px-3.5 py-2.5">
      <input
        type="checkbox"
        checked={enabled}
        onChange={(event) => setEnabled(event.target.checked)}
        className="h-5 w-5 shrink-0 accent-[#e85d00]"
      />
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <Gift size={16} className="shrink-0 text-[#e85d00]" />
        <span className="min-w-0 flex-1 text-sm font-bold text-gray-800">
          Utiliser mes points ({maxPoints.toLocaleString('fr-FR')} pts)
        </span>
      </span>
      <span className="shrink-0 text-sm font-black text-emerald-700">-{formatCurrency(xafValue)}</span>
    </label>
  );
}
