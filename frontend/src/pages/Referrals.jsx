import React, { useContext, useEffect, useState } from 'react';
import { Gift, Share2, Copy, Users } from 'lucide-react';
import api from '../services/api';
import AuthContext from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { formatPriceWithStoredSettings as formatCurrency } from '../utils/priceFormatter';
import GlassHeader from '../components/orders/GlassHeader';

export default function Referrals() {
  const { user } = useContext(AuthContext);
  const { showToast } = useToast();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    api
      .get('/referrals/me')
      .then(({ data }) => setSummary(data))
      .catch(() => setSummary(null))
      .finally(() => setLoading(false));
  }, [user]);

  const shareLink = summary?.referralCode
    ? `${window.location.origin}/r/${summary.referralCode}`
    : '';
  const shareMessage = summary?.referralCode
    ? `Rejoins HDMarket avec mon code ${summary.referralCode} et on reçoit tous les deux ${formatCurrency(summary.rewardXaf)} après ta première commande livrée ! ${shareLink}`
    : '';

  const handleCopy = () => {
    if (!shareLink) return;
    navigator.clipboard?.writeText(shareMessage);
    showToast('Lien copié !', { variant: 'success' });
  };

  if (!user) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10 text-center">
        <p className="text-sm text-gray-500">Connectez-vous pour accéder à votre programme de parrainage.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf8f5]">
      <GlassHeader title="Parrainage" subtitle="Invite tes amis" backTo="/profile" />

      <div className="mx-auto max-w-lg space-y-4 px-4 py-5">
        {loading ? (
          <p className="text-center text-sm text-gray-400">Chargement…</p>
        ) : !summary?.enabled ? (
          <div className="rounded-2xl border border-gray-100 bg-white p-6 text-center shadow-sm">
            <Gift className="mx-auto h-8 w-8 text-gray-300" />
            <p className="mt-3 text-sm text-gray-500">
              Le programme de parrainage n’est pas encore activé.
            </p>
          </div>
        ) : (
          <>
            <div className="rounded-2xl bg-[#e85d00] p-5 text-white shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wide text-white/80">Ton code</p>
              <p className="mt-1 text-3xl font-black tracking-[0.15em]">{summary.referralCode}</p>
              <p className="mt-3 text-sm text-white/90">
                Vous recevez chacun {formatCurrency(summary.rewardXaf)} dès que votre filleul reçoit sa première commande.
              </p>
              <div className="mt-4 flex gap-2">
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(shareMessage)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-white px-4 text-sm font-black text-[#e85d00]"
                >
                  <Share2 size={16} /> Partager sur WhatsApp
                </a>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/40 px-4 text-sm font-bold text-white"
                  aria-label="Copier le lien"
                >
                  <Copy size={16} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-gray-100 bg-white p-3 text-center shadow-sm">
                <p className="text-2xl font-black text-neutral-950">{summary.referredCount}</p>
                <p className="text-xs text-gray-500">Filleuls inscrits</p>
              </div>
              <div className="rounded-xl border border-gray-100 bg-white p-3 text-center shadow-sm">
                <p className="text-2xl font-black text-emerald-700">{summary.rewardedCount}</p>
                <p className="text-xs text-gray-500">Récompenses reçues</p>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-black text-gray-900">
                <Users size={16} /> Tes filleuls
              </h3>
              {summary.referredUsers.length === 0 ? (
                <p className="text-xs text-gray-400">Aucun filleul pour le moment.</p>
              ) : (
                <ul className="space-y-2">
                  {summary.referredUsers.map((entry, index) => (
                    <li key={index} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">{entry.name}</span>
                      <span className={`text-[11px] font-bold ${entry.rewardGranted ? 'text-emerald-600' : 'text-gray-400'}`}>
                        {entry.rewardGranted ? 'Récompensé' : 'En attente'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
