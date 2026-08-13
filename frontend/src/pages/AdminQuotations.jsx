import React, { useCallback, useEffect, useState } from 'react';
import { BarChart3, FileText, Package, Percent, RefreshCw, Store, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { formatQuotationDate, getQuotationStatus, quotationBuyerName, quotationMoney, quotationShopName } from '../utils/quotationUtils';

const filters = [['ALL', 'Tous'], ['PENDING', 'En attente'], ['COUNTERED', 'Contre-offres'], ['ACCEPTED', 'Acceptés'], ['REJECTED', 'Refusés'], ['EXPIRED', 'Expirés'], ['ORDER_CREATED', 'Commandes']];

export default function AdminQuotations() {
  const [filter, setFilter] = useState('ALL');
  const [rows, setRows] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [listResponse, analyticsResponse] = await Promise.all([
        api.get('/quotations/admin', { params: filter === 'ALL' ? {} : { status: filter } }),
        api.get('/quotations/admin/analytics')
      ]);
      setRows(Array.isArray(listResponse.data?.items) ? listResponse.data.items : []);
      setAnalytics(analyticsResponse.data || {});
    } catch (requestError) { setError(requestError.response?.data?.message || 'Impossible de charger la gestion des devis.'); }
    finally { setLoading(false); }
  }, [filter]);
  useEffect(() => { load(); }, [load]);
  const metrics = [
    ['Demandes', analytics?.requests || 0, FileText],
    ['Conversion', `${Number(analytics?.conversionRate || 0).toFixed(1)} %`, TrendingUp],
    ['Remise moyenne', `${Number(analytics?.averageDiscount || 0).toFixed(1)} %`, Percent],
    ['Revenu devis', quotationMoney(analytics?.revenue || 0), BarChart3]
  ];
  return <main className="min-h-screen bg-[#f5f2ee] p-4 text-[#231f1b] sm:p-6 lg:p-8 dark:bg-neutral-950 dark:text-white"><div className="mx-auto max-w-7xl">
    <header className="flex items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.16em] text-[#e85d00]">Administration</p><h1 className="mt-1 text-2xl font-black sm:text-4xl">Gestion des devis</h1><p className="mt-1 text-sm text-[#797166]">Performance, négociations et commandes générées.</p></div><button onClick={load} className="grid h-11 w-11 place-items-center rounded-full border border-[#ded6ca] bg-white dark:border-neutral-800 dark:bg-neutral-900" aria-label="Actualiser"><RefreshCw className="h-4 w-4" /></button></header>
    <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">{metrics.map(([label, value, Icon]) => <article key={label} className="rounded-3xl border border-[#e2dcd2] bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#fff0e4] text-[#e85d00]"><Icon className="h-5 w-5" /></span><p className="mt-4 text-2xl font-black">{value}</p><p className="text-xs font-bold text-[#8a8378]">{label}</p></article>)}</section>
    <section className="mt-4 grid gap-4 lg:grid-cols-2"><article className="rounded-3xl border border-[#e2dcd2] bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"><h2 className="font-black">Produits les plus négociés</h2><div className="mt-3 space-y-2">{(analytics?.topProducts || []).slice(0, 5).map((item, index) => <div className="flex items-center gap-3 rounded-xl bg-[#f8f5f0] p-2.5 dark:bg-neutral-950" key={item._id}><span className="grid h-8 w-8 place-items-center rounded-lg bg-white text-xs font-black dark:bg-neutral-900">{index + 1}</span><Package className="h-4 w-4 text-[#e85d00]" /><span className="min-w-0 flex-1 truncate text-sm font-bold">{item.title || 'Produit supprimé'}</span><strong className="text-xs">{item.requests} devis</strong></div>)}</div></article><article className="rounded-3xl border border-[#e2dcd2] bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"><h2 className="font-black">Vendeurs les plus actifs</h2><div className="mt-3 space-y-2">{(analytics?.topSellers || []).slice(0, 5).map((item, index) => <div className="flex items-center gap-3 rounded-xl bg-[#f8f5f0] p-2.5 dark:bg-neutral-950" key={item._id}><span className="grid h-8 w-8 place-items-center rounded-lg bg-white text-xs font-black dark:bg-neutral-900">{index + 1}</span><Store className="h-4 w-4 text-[#e85d00]" /><span className="min-w-0 flex-1 truncate text-sm font-bold">{item.name || 'Vendeur'}</span><strong className="text-xs">{item.orders}/{item.requests} commandes</strong></div>)}</div></article></section>
    <nav className="mt-6 flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none]">{filters.map(([value, label]) => <button key={value} onClick={() => setFilter(value)} className={`min-h-10 shrink-0 rounded-full px-4 text-xs font-black ${filter === value ? 'bg-[#231f1b] text-white dark:bg-white dark:text-black' : 'border border-[#ded6ca] bg-white text-[#6b6459] dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300'}`}>{label}</button>)}</nav>
    {error ? <p className="mt-4 rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p> : null}
    <section className="mt-4 overflow-hidden rounded-3xl border border-[#e2dcd2] bg-white dark:border-neutral-800 dark:bg-neutral-900">{loading ? <div className="h-64 animate-pulse bg-white dark:bg-neutral-900" /> : !rows.length ? <p className="p-12 text-center font-bold text-[#8a8378]">Aucun devis dans cette vue.</p> : <div className="divide-y divide-[#eee8df] dark:divide-neutral-800">{rows.map((quotation) => { const status = getQuotationStatus(quotation.status); return <article key={quotation._id} className="grid gap-3 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-center"><div><p className="text-xs font-bold text-[#8a8378]">Acheteur</p><p className="font-black">{quotationBuyerName(quotation)}</p><p className="text-xs text-[#8a8378]">{formatQuotationDate(quotation.createdAt, true)}</p></div><div><p className="text-xs font-bold text-[#8a8378]">Boutique · {quotation.itemCount} produit{quotation.itemCount > 1 ? 's' : ''}</p><p className="font-black">{quotationShopName(quotation)}</p><p className="text-xs">{quotationMoney(quotation.originalSubtotal)} → <strong className="text-[#e85d00]">{quotation.quotedSubtotal ? quotationMoney(quotation.quotedSubtotal) : 'En attente'}</strong></p></div><div className="flex items-center gap-2"><span className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${status.className}`}>{status.label}</span>{quotation.order?._id ? <Link to={`/admin/orders?orderId=${quotation.order._id}`} className="rounded-xl border border-[#ded6ca] px-3 py-2 text-xs font-black">Commande</Link> : null}</div></article>; })}</div>}</section>
  </div></main>;
}
