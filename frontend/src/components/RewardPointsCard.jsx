import React, { useEffect, useState } from 'react';
import { Gift, Flame, Loader2 } from 'lucide-react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';

/**
 * HDPoints widget for the Wallet page: balance, daily check-in with streak,
 * and a short recent-transactions list.
 */
export default function RewardPointsCard() {
  const { showToast } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);

  const load = () => {
    api
      .get('/rewards/me')
      .then(({ data: response }) => setData(response))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleCheckIn = async () => {
    if (checkingIn) return;
    setCheckingIn(true);
    try {
      const { data: result } = await api.post('/rewards/checkin');
      if (result?.alreadyCheckedIn) {
        showToast('Déjà fait aujourd’hui, revenez demain !', { variant: 'info' });
      } else {
        showToast(`+${result.pointsAwarded} HDPoints ! Série de ${result.streak} jours.`, { variant: 'success' });
      }
      load();
    } catch {
      showToast('Impossible de faire le check-in.', { variant: 'error' });
    } finally {
      setCheckingIn(false);
    }
  };

  if (loading || !data?.enabled) return null;

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#fff0e4] text-[#e85d00]">
            <Gift size={20} />
          </span>
          <div>
            <p className="text-[11px] font-bold uppercase text-gray-400">HDPoints</p>
            <p className="text-lg font-black text-neutral-950">{data.balance.toLocaleString('fr-FR')} pts</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleCheckIn}
          disabled={checkingIn || data.checkedInToday}
          className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full px-4 text-xs font-black transition ${
            data.checkedInToday
              ? 'bg-gray-100 text-gray-400'
              : 'bg-[#e85d00] text-white active:scale-95'
          }`}
        >
          {checkingIn ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Flame size={14} />
          )}
          {data.checkedInToday ? `Série ${data.checkinStreak}j` : 'Check-in du jour'}
        </button>
      </div>

      {data.transactions?.length > 0 && (
        <div className="border-t border-gray-100 p-3">
          <ul className="space-y-1.5">
            {data.transactions.slice(0, 5).map((txn, index) => (
              <li key={index} className="flex items-center justify-between text-xs">
                <span className="truncate text-gray-500">{txn.note || txn.reason}</span>
                <span className={`shrink-0 font-bold ${txn.points >= 0 ? 'text-emerald-600' : 'text-gray-500'}`}>
                  {txn.points >= 0 ? '+' : ''}
                  {txn.points}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
