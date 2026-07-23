import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, RefreshCw, WalletCards } from 'lucide-react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { formatPriceWithStoredSettings } from '../utils/priceFormatter';

const label = {
  CREATED: 'Créé', PROCESSING: 'En traitement', ENQUEUED: 'En attente opérateur',
  COMPLETED: 'Versé', FAILED: 'Échec', NEEDS_ATTENTION: 'À vérifier', CANCELLED: 'Annulé'
};

export default function AdminSellerPayouts() {
  const { showToast } = useToast();
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/payments/pawapay/payouts');
      setPayouts(data?.payouts || []);
    } catch (error) {
      showToast(error.response?.data?.message || 'Impossible de charger les versements.', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { void load(); }, [load]);

  const retry = async (payoutId) => {
    setRetrying(payoutId);
    try {
      await api.post(`/payments/pawapay/payouts/${encodeURIComponent(payoutId)}/retry`);
      showToast('Nouvelle tentative programmée.', { variant: 'success' });
      await load();
    } catch (error) {
      showToast(error.response?.data?.message || 'Impossible de relancer ce versement.', { variant: 'error' });
    } finally {
      setRetrying('');
    }
  };

  const refresh = async (payoutId) => {
    setRetrying(payoutId);
    try {
      await api.post(`/payments/pawapay/payouts/${encodeURIComponent(payoutId)}/refresh`);
      showToast('Statut PawaPay actualisé.', { variant: 'success' });
      await load();
    } catch (error) {
      showToast(error.response?.data?.message || 'Impossible de vérifier ce versement.', { variant: 'error' });
    } finally {
      setRetrying('');
    }
  };

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <header className="flex items-start justify-between gap-3">
        <div><p className="text-xs font-black uppercase tracking-wider text-[#e85d00]">PawaPay</p><h1 className="text-2xl font-black text-neutral-950">Versements vendeurs</h1><p className="text-sm text-neutral-500">Suivi des fonds envoyés aux propriétaires des produits.</p></div>
        <button type="button" onClick={load} className="rounded-full border bg-white p-3" aria-label="Actualiser"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
      </header>
      {!payouts.length && !loading ? (
        <div className="rounded-2xl border bg-white p-8 text-center text-sm text-neutral-500">Aucun versement vendeur.</div>
      ) : (
        <div className="space-y-3">
          {payouts.map((payout) => (
            <article key={payout._id} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex gap-3">
                  <span className="rounded-xl bg-orange-50 p-2 text-[#e85d00]"><WalletCards className="h-5 w-5" /></span>
                  <div>
                    <p className="font-black text-neutral-950">{payout.seller?.shopName || payout.seller?.name || 'Boutique'}</p>
                    <p className="text-xs text-neutral-500">{payout.provider} · {payout.phoneNumber}</p>
                    <p className="mt-1 text-xs text-neutral-500">Réf. {payout.payoutId}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black">{formatPriceWithStoredSettings(payout.amount)}</p>
                  <p className={`mt-1 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${payout.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' : payout.status === 'FAILED' || payout.status === 'NEEDS_ATTENTION' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>
                    {payout.status === 'COMPLETED' ? <CheckCircle2 className="h-3.5 w-3.5" /> : payout.status === 'FAILED' ? <AlertCircle className="h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5" />}
                    {label[payout.status] || payout.status}
                  </p>
                </div>
              </div>
              {payout.failureReason && <p className="mt-3 rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-800">{payout.failureReason?.failureMessage || payout.failureReason?.message || payout.failureReason?.failureCode || String(payout.failureReason)}</p>}
              {payout.status === 'FAILED' && (
                <div className="mt-3 flex justify-end"><button type="button" onClick={() => retry(payout.payoutId)} disabled={retrying === payout.payoutId} className="rounded-lg bg-neutral-950 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{retrying === payout.payoutId ? 'Relance…' : 'Relancer le versement'}</button></div>
              )}
              {['PROCESSING', 'ENQUEUED', 'NEEDS_ATTENTION'].includes(payout.status) && (
                <div className="mt-3 flex justify-end"><button type="button" onClick={() => refresh(payout.payoutId)} disabled={retrying === payout.payoutId} className="rounded-lg border border-neutral-300 px-3 py-2 text-xs font-bold disabled:opacity-50">{retrying === payout.payoutId ? 'Vérification…' : 'Vérifier chez PawaPay'}</button></div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
