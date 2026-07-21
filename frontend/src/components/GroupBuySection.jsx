import React, { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Share2, PartyPopper } from 'lucide-react';
import api, { getApiErrorMessage } from '../services/api';
import AuthContext from '../context/AuthContext';
import CartContext from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { formatPriceWithStoredSettings as formatCurrency } from '../utils/priceFormatter';

/**
 * "Achat groupé" — PDP dual-CTA section. Starting a team or joining one is
 * a free reservation; the group price only unlocks at checkout once the
 * team is full (see groupBuyService for why — no auto-charge system here).
 */
export default function GroupBuySection({ productId, enabled }) {
  const { user } = useContext(AuthContext);
  const { addItem } = useContext(CartContext);
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [groupBuys, setGroupBuys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = () => {
    if (!productId) return;
    api
      .get(`/group-buys/product/${productId}`)
      .then(({ data }) => setGroupBuys(Array.isArray(data?.items) ? data.items : []))
      .catch(() => setGroupBuys([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  if (!enabled || loading) return null;

  const myId = user?._id || user?.id;
  const activeTeam = groupBuys.find((gb) =>
    gb.members.some((member) => String(member.userId?._id || member.userId) === String(myId))
  ) || groupBuys[0];

  const handleStart = async () => {
    if (!user) return navigate('/login');
    setBusy(true);
    try {
      const { data } = await api.post('/group-buys', { productId });
      showToast('Équipe créée ! Partagez le lien pour la remplir.', { variant: 'success' });
      setGroupBuys((prev) => [data, ...prev]);
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Impossible de démarrer un achat groupé.'), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = async (groupBuyId) => {
    if (!user) return navigate('/login');
    setBusy(true);
    try {
      const { data } = await api.post(`/group-buys/${groupBuyId}/join`);
      showToast(
        data.status === 'filled' ? 'Équipe complète ! Prix débloqué.' : 'Vous avez rejoint l’équipe.',
        { variant: 'success' }
      );
      load();
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Impossible de rejoindre cette équipe.'), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const handleFinalize = async (groupBuyId) => {
    setBusy(true);
    try {
      await addItem(productId, 1);
      navigate('/checkout', { state: { groupBuyId } });
    } catch {
      showToast('Impossible d’ajouter le produit au panier.', { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const handleShare = (groupBuy) => {
    const link = `${window.location.origin}/product/${productId}?groupBuy=${groupBuy._id}`;
    const message = `Rejoins mon achat groupé sur HDMarket : ${formatCurrency(groupBuy.groupPrice)} au lieu de ${formatCurrency(groupBuy.originalPrice)} ! ${link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  };

  if (!activeTeam) {
    return (
      <div className="rounded-2xl border border-[#e85d00]/30 bg-[#fff7f0] p-4">
        <div className="flex items-center gap-2">
          <Users size={18} className="text-[#e85d00]" />
          <h3 className="text-sm font-black text-gray-900">Achat groupé disponible</h3>
        </div>
        <p className="mt-1.5 text-xs text-gray-600">
          Formez une équipe et débloquez un prix réduit pour tout le monde.
        </p>
        <button
          type="button"
          onClick={handleStart}
          disabled={busy}
          className="mt-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#e85d00] px-4 text-sm font-black text-white disabled:opacity-50"
        >
          <Users size={16} /> Démarrer une équipe
        </button>
      </div>
    );
  }

  const isMember = activeTeam.members.some(
    (member) => String(member.userId?._id || member.userId) === String(myId)
  );
  const isFilled = activeTeam.status === 'filled';
  const remaining = Math.max(0, activeTeam.targetSize - activeTeam.members.length);
  const progressPct = Math.min(100, Math.round((activeTeam.members.length / activeTeam.targetSize) * 100));

  return (
    <div className="rounded-2xl border border-[#e85d00]/30 bg-[#fff7f0] p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {isFilled ? (
            <PartyPopper size={18} className="text-[#e85d00]" />
          ) : (
            <Users size={18} className="text-[#e85d00]" />
          )}
          <h3 className="text-sm font-black text-gray-900">
            {isFilled ? 'Équipe complète !' : 'Achat groupé en cours'}
          </h3>
        </div>
        <span className="text-lg font-black text-[#e85d00]">{formatCurrency(activeTeam.groupPrice)}</span>
      </div>

      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
        <div
          className="h-full rounded-full bg-[#e85d00] transition-all"
          style={{ width: `${progressPct}%` }}
        />
      </div>
      <p className="mt-1.5 text-xs font-bold text-gray-600">
        {activeTeam.members.length}/{activeTeam.targetSize}
        {!isFilled && remaining > 0 ? ` — il manque ${remaining} acheteur${remaining > 1 ? 's' : ''}` : ''}
      </p>

      <div className="mt-3 flex gap-2">
        {isFilled && isMember ? (
          <button
            type="button"
            onClick={() => handleFinalize(activeTeam._id)}
            disabled={busy}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-[#e85d00] px-4 text-sm font-black text-white disabled:opacity-50"
          >
            Finaliser au prix groupé
          </button>
        ) : !isMember && !isFilled ? (
          <button
            type="button"
            onClick={() => handleJoin(activeTeam._id)}
            disabled={busy}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-[#e85d00] px-4 text-sm font-black text-white disabled:opacity-50"
          >
            Rejoindre l’équipe
          </button>
        ) : (
          <p className="flex-1 text-xs font-semibold text-gray-500">
            {isFilled ? 'Équipe complète.' : 'Vous êtes dans l’équipe. Partagez pour la remplir plus vite !'}
          </p>
        )}
        {!isFilled && (
          <button
            type="button"
            onClick={() => handleShare(activeTeam)}
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#e85d00] px-3 text-[#e85d00]"
            aria-label="Partager"
          >
            <Share2 size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
