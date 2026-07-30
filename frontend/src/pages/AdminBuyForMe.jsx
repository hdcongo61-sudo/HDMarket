import React, { useEffect, useState } from 'react';
import { BarChart3, Loader2, Save, Settings2, ShoppingBasket, XCircle } from 'lucide-react';
import api, { getApiErrorMessage } from '../services/api';
import { useToast } from '../context/ToastContext';
import { formatPriceWithStoredSettings as formatCurrency } from '../utils/priceFormatter';

const FIELDS = [
  ['serviceCommissionPercent', 'Commission service (%)'],
  ['minimumCommission', 'Commission minimum (FCFA)'],
  ['maximumCommission', 'Commission maximum (FCFA, 0 = sans plafond)'],
  ['cashAdvanceFee', 'Frais d’avance / retrait (FCFA)'],
  ['minimumBudget', 'Valeur estimée minimale (FCFA)'],
  ['maximumBudget', 'Valeur estimée maximale (FCFA)']
];

export default function AdminBuyForMe() {
  const { showToast } = useToast();
  const [form, setForm] = useState({});
  const [stats, setStats] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [configResult, statsResult, ordersResult] = await Promise.all([api.get('/buy-for-me/admin/config'), api.get('/buy-for-me/admin/stats'), api.get('/buy-for-me/admin/orders', { params: { limit: 30 } })]);
      setForm(configResult.data || {});
      setStats(statsResult.data || null);
      setOrders(Array.isArray(ordersResult.data?.items) ? ordersResult.data.items : []);
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Impossible de charger Acheter Pour Moi.'), { variant: 'error' });
    } finally { setLoading(false); }
  };
  // Initial admin data load.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);
  const save = async () => { setSaving(true); try { const { data } = await api.patch('/buy-for-me/admin/config', { ...form, serviceCommissionPercent: Number(form.serviceCommissionPercent), minimumCommission: Number(form.minimumCommission), maximumCommission: Number(form.maximumCommission), cashAdvanceFee: Number(form.cashAdvanceFee), minimumBudget: Number(form.minimumBudget), maximumBudget: Number(form.maximumBudget) }); setForm(data); showToast('Configuration enregistrée.', { variant: 'success' }); } catch (error) { showToast(getApiErrorMessage(error, 'Configuration invalide.'), { variant: 'error' }); } finally { setSaving(false); } };
  const cancel = async (id) => { const reason = window.prompt('Motif de l’annulation (facultatif)') || ''; try { await api.post(`/buy-for-me/admin/orders/${id}/cancel`, { reason }); showToast('Demande annulée.', { variant: 'success' }); load(); } catch (error) { showToast(getApiErrorMessage(error, 'Annulation impossible.'), { variant: 'error' }); } };

  if (loading) return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="animate-spin text-[#e85d00]" /></div>;
  return <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8"><header><p className="text-xs font-black uppercase tracking-[0.16em] text-[#e85d00]">Service à la demande</p><h1 className="mt-1 text-2xl font-black tracking-tight text-gray-900">Acheter Pour Moi</h1><p className="mt-1 text-sm text-gray-500">Configuration, suivi des demandes et indicateurs commerciaux.</p></header>
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[['Demandes', stats?.totalOrders || 0], ['Revenus HDMarket', formatCurrency(stats?.revenue || 0)], ['Panier moyen', formatCurrency(stats?.averageBasket || 0)], ['Remboursements', formatCurrency(stats?.refundTotal || 0)]].map(([label, value]) => <div key={label} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"><p className="text-xs font-bold text-gray-500">{label}</p><p className="mt-2 text-xl font-black text-gray-900">{value}</p></div>)}</section>
    <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"><div className="flex items-center gap-2"><Settings2 size={18} className="text-[#e85d00]" /><h2 className="text-lg font-black text-gray-900">Règles tarifaires</h2></div><label className="mt-4 flex items-center gap-3 rounded-xl bg-gray-50 p-3 text-sm font-bold text-gray-800"><input type="checkbox" checked={Boolean(form.enabled)} onChange={(event) => setForm((previous) => ({ ...previous, enabled: event.target.checked }))} /> Activer Acheter Pour Moi</label><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{FIELDS.map(([key, label]) => <label key={key} className="text-xs font-black text-gray-600">{label}<input type="number" min="0" value={form[key] ?? ''} onChange={(event) => setForm((previous) => ({ ...previous, [key]: event.target.value }))} className="mt-1.5 min-h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm text-gray-900 outline-none focus:border-[#e85d00]" /></label>)}</div><button type="button" disabled={saving} onClick={save} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#e85d00] px-4 text-sm font-black text-white disabled:opacity-60">{saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Enregistrer</button></section>
    <section className="grid gap-4 lg:grid-cols-2"><div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"><h2 className="flex items-center gap-2 text-lg font-black text-gray-900"><BarChart3 size={18} className="text-[#e85d00]" /> Indicateurs</h2><dl className="mt-4 space-y-3 text-sm"><div className="flex justify-between"><dt className="text-gray-500">Valeur moyenne des achats</dt><dd className="font-black">{formatCurrency(stats?.averageShoppingValue || 0)}</dd></div><div className="flex justify-between"><dt className="text-gray-500">Livraison moyenne</dt><dd className="font-black">{formatCurrency(stats?.averageDeliveryFee || 0)}</dd></div><div className="flex justify-between"><dt className="text-gray-500">Gains livreurs</dt><dd className="font-black">{formatCurrency(stats?.driverEarnings || 0)}</dd></div></dl><h3 className="mt-6 text-xs font-black uppercase tracking-wide text-gray-500">Magasins les plus demandés</h3><div className="mt-2 space-y-2">{(stats?.topStores || []).map((entry) => <p key={entry._id} className="flex justify-between text-sm"><span>{entry._id}</span><strong>{entry.count}</strong></p>) || <p className="text-sm text-gray-400">Aucune donnée.</p>}</div></div><div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"><h2 className="flex items-center gap-2 text-lg font-black text-gray-900"><ShoppingBasket size={18} className="text-[#e85d00]" /> État des demandes</h2><div className="mt-4 grid grid-cols-2 gap-2">{Object.entries(stats?.byStatus || {}).map(([status, count]) => <div key={status} className="rounded-xl bg-gray-50 p-3"><p className="text-[10px] font-black uppercase text-gray-500">{status.replaceAll('_', ' ')}</p><p className="mt-1 text-lg font-black">{count}</p></div>)}</div></div></section>
    <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm"><div className="border-b border-gray-100 p-5"><h2 className="text-lg font-black text-gray-900">Dernières demandes</h2></div><div className="divide-y divide-gray-100">{orders.length ? orders.map((order) => <div key={order._id} className="flex flex-wrap items-center gap-3 p-4"><div className="min-w-0 flex-1"><p className="truncate text-sm font-black text-gray-900">{order.preferredStore || 'Magasin local'} · {order.customerId?.name || 'Client'}</p><p className="mt-1 text-xs text-gray-500">{order.status} · {order.items?.length || 0} article(s) · {formatCurrency(order.pricing?.total || 0)}</p></div><span className="rounded-full bg-gray-100 px-2 py-1 text-[10px] font-black text-gray-600">{order.status}</span>{!['COMPLETED', 'CANCELED', 'FAILED'].includes(order.status) ? <button type="button" onClick={() => cancel(order._id)} className="inline-flex h-9 items-center gap-1 rounded-lg border border-red-200 px-2 text-xs font-black text-red-600"><XCircle size={14} /> Annuler</button> : null}</div>) : <p className="p-6 text-center text-sm text-gray-400">Aucune demande.</p>}</div></section>
  </div>;
}
