import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3, Landmark, RefreshCw, ShieldCheck, Smartphone, WalletCards } from 'lucide-react';
import AuthContext from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../services/api';
import { formatPriceWithStoredSettings } from '../utils/priceFormatter';

const LABELS = {
  HELD: 'Délai de sécurité', WAITING_ACCOUNT: 'Compte requis', READY: 'Prêt au versement',
  PROCESSING: 'En traitement', PAID: 'Versé', FAILED: 'Échec', BLOCKED: 'Suspendu',
  CANCELLED: 'Annulé', CREATED: 'Créé', ENQUEUED: 'En attente opérateur',
  COMPLETED: 'Versé', NEEDS_ATTENTION: 'Vérification requise'
};
const COLORS = {
  PAID: 'bg-emerald-100 text-emerald-800', COMPLETED: 'bg-emerald-100 text-emerald-800',
  READY: 'bg-blue-100 text-blue-800', PROCESSING: 'bg-amber-100 text-amber-800',
  ENQUEUED: 'bg-amber-100 text-amber-800', HELD: 'bg-neutral-100 text-neutral-700',
  WAITING_ACCOUNT: 'bg-orange-100 text-orange-800', FAILED: 'bg-red-100 text-red-800',
  BLOCKED: 'bg-red-100 text-red-800', NEEDS_ATTENTION: 'bg-red-100 text-red-800'
};
const date = (value) => value
  ? new Date(value).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })
  : '—';
const badge = (status) => `rounded-full px-2.5 py-1 text-[11px] font-bold ${COLORS[status] || 'bg-neutral-100 text-neutral-700'}`;

export default function SellerSettlements() {
  const { user } = useContext(AuthContext);
  const { showToast } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState(user?.phone || '');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/users/profile/settlements', { headers: { 'x-skip-cache': '1' } });
      setData(response.data);
      if (response.data?.payoutAccount?.phoneNumber) setPhoneNumber(response.data.payoutAccount.phoneNumber);
    } catch (error) {
      showToast(error.response?.data?.message || 'Impossible de charger les versements.', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { void load(); }, [load]);

  const saveAccount = async () => {
    setSaving(true);
    try {
      const response = await api.put('/users/profile/payout-account', { phoneNumber });
      showToast(response.data?.message || 'Compte Mobile Money vérifié.', { variant: 'success' });
      await load();
    } catch (error) {
      showToast(error.response?.data?.message || 'Impossible de vérifier ce compte.', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const summary = useMemo(() => {
    const rows = data?.summary || {};
    return {
      waiting: ['held', 'waiting_account', 'ready', 'blocked'].reduce((sum, key) => sum + Number(rows[key]?.amount || 0), 0),
      processing: Number(rows.processing?.amount || 0),
      paid: Number(rows.paid?.amount || 0)
    };
  }, [data]);
  const account = data?.payoutAccount || {};
  const providerName = account.provider === 'MTN_MOMO_COG' ? 'MTN MoMo' : account.provider === 'AIRTEL_COG' ? 'Airtel Money' : '';

  return (
    <main className="mx-auto min-h-screen max-w-6xl bg-[#f7f7f5] px-4 py-6 pb-28 sm:px-6">
      <header className="mb-5 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#e85d00]">Finances boutique</p>
          <h1 className="mt-1 text-2xl font-black text-neutral-950">Versements des ventes</h1>
          <p className="mt-1 max-w-2xl text-sm text-neutral-600">Après la livraison et le délai de contestation, HDMarket déduit la commission puis PawaPay envoie automatiquement le solde sur votre Mobile Money.</p>
        </div>
        <button type="button" onClick={load} disabled={loading} className="rounded-full border border-neutral-200 bg-white p-3 shadow-sm disabled:opacity-50" aria-label="Actualiser">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          { label: 'À venir', value: summary.waiting, icon: Clock3 },
          { label: 'En cours PawaPay', value: summary.processing, icon: RefreshCw },
          { label: 'Déjà versé', value: summary.paid, icon: CheckCircle2 }
        ].map(({ label, value, icon: Icon }) => (
          <article key={label} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
            <Icon className="h-5 w-5 text-[#e85d00]" />
            <p className="mt-3 text-xs font-bold uppercase tracking-wide text-neutral-500">{label}</p>
            <p className="mt-1 text-xl font-black text-neutral-950">{formatPriceWithStoredSettings(value)}</p>
          </article>
        ))}
      </section>

      <section className="mt-4 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="rounded-xl bg-orange-50 p-2 text-[#e85d00]"><Smartphone className="h-5 w-5" /></span>
          <div><h2 className="font-black text-neutral-950">Compte de réception</h2><p className="text-xs text-neutral-500">Le numéro doit être celui déjà vérifié dans votre profil.</p></div>
        </div>
        {account.verifiedAt ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
            <div><p className="flex items-center gap-1.5 text-sm font-black text-emerald-900"><ShieldCheck className="h-4 w-4" /> {providerName}</p><p className="mt-1 text-sm text-emerald-800">{account.phoneNumber}</p></div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-emerald-700">Opérateur confirmé par PawaPay</span>
          </div>
        ) : (
          <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">
            <input value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} inputMode="tel" placeholder="+242 06 000 00 00" className="rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-[#e85d00] focus:ring-2 focus:ring-orange-100" />
            <button type="button" onClick={saveAccount} disabled={saving || !phoneNumber.trim()} className="rounded-xl bg-[#101828] px-5 py-3 text-sm font-black text-white disabled:opacity-50">{saving ? 'Vérification…' : 'Vérifier le compte'}</button>
          </div>
        )}
      </section>

      <section className="mt-4 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2"><WalletCards className="h-5 w-5 text-[#e85d00]" /><h2 className="font-black text-neutral-950">Ventes à régler</h2></div>
        {!data?.settlements?.length ? <p className="rounded-xl bg-neutral-50 p-5 text-center text-sm text-neutral-500">Aucun règlement pour le moment.</p> : (
          <div className="space-y-2">{data.settlements.map((item) => (
            <article key={item._id} className="rounded-xl border border-neutral-200 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div><p className="text-sm font-black text-neutral-900">Commande #{String(item.order?._id || item.order || '').slice(-6)}</p><p className="mt-1 text-xs text-neutral-500">Libération: {date(item.releaseAt)}</p></div>
                <span className={badge(item.status)}>{LABELS[item.status] || item.status}</span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <div><p className="text-neutral-500">Brut</p><p className="font-bold">{formatPriceWithStoredSettings(item.grossAmount)}</p></div>
                <div><p className="text-neutral-500">Commission</p><p className="font-bold">− {formatPriceWithStoredSettings(item.commissionAmount)}</p></div>
                <div><p className="text-neutral-500">Net</p><p className="font-black text-emerald-700">{formatPriceWithStoredSettings(item.netAmount)}</p></div>
              </div>
              {item.failureReason && <p className="mt-2 text-xs font-semibold text-red-700">{item.failureReason}</p>}
            </article>
          ))}</div>
        )}
      </section>

      <section className="mt-4 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2"><Landmark className="h-5 w-5 text-[#e85d00]" /><h2 className="font-black text-neutral-950">Historique PawaPay</h2></div>
        {!data?.payouts?.length ? <p className="text-sm text-neutral-500">Aucun versement envoyé.</p> : data.payouts.map((payout) => (
          <div key={payout._id} className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 py-3 first:border-t-0">
            <div><p className="text-sm font-black">{formatPriceWithStoredSettings(payout.amount)}</p><p className="text-xs text-neutral-500">{date(payout.createdAt)} · {String(payout.payoutId).slice(0, 8)}</p></div>
            <span className={badge(payout.status)}>{LABELS[payout.status] || payout.status}</span>
          </div>
        ))}
      </section>
    </main>
  );
}
