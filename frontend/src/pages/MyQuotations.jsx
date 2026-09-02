import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeftIcon, BuildingStorefrontIcon, CalendarDaysIcon, ChatBubbleLeftIcon, CheckIcon, ChevronRightIcon, CubeIcon, DocumentTextIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../services/api';
import SelectedAttributesList from '../components/orders/SelectedAttributesList';
import { createIdempotencyKey } from '../utils/idempotency';
import {
  formatQuotationDate,
  getQuotationStatus,
  quotationMoney,
  quotationSavings,
  quotationShopName
} from '../utils/quotationUtils';

const tabs = [
  ['ALL', 'Tous'], ['PENDING', 'En attente'], ['COUNTERED', 'Contre-offres'],
  ['ACCEPTED', 'Acceptés'], ['REJECTED', 'Refusés'], ['EXPIRED', 'Expirés']
];

export default function MyQuotations() {
  const navigate = useNavigate();
  const { quotationId } = useParams();
  const [activeTab, setActiveTab] = useState('ALL');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/quotations/mine', { params: activeTab === 'ALL' ? {} : { status: activeTab } });
      setRows(Array.isArray(data?.items) ? data.items : []);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Impossible de charger vos devis.');
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!quotationId || loading) return;
    document.getElementById(`quotation-${quotationId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [loading, quotationId]);

  const totalPending = useMemo(() => rows.filter((row) => ['PENDING', 'COUNTERED'].includes(row.status)).length, [rows]);

  const mutate = async (quotation, action) => {
    setWorkingId(quotation._id);
    setError('');
    try {
      if (action === 'accept') {
        await api.post(`/quotations/${quotation._id}/accept-counter`, {}, { headers: { 'Idempotency-Key': createIdempotencyKey('quote-accept') } });
        navigate(`/quotations/${quotation._id}/checkout`);
      } else {
        await api.post(`/quotations/${quotation._id}/reject`, {}, { headers: { 'Idempotency-Key': createIdempotencyKey('quote-reject') } });
        await load();
      }
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Cette action n’a pas pu être effectuée.');
    } finally {
      setWorkingId('');
    }
  };

  const messageSeller = (quotation) => {
    const item = quotation.items?.[0];
    navigate('/orders/messages', { state: { startConversation: {
      sellerId: quotation.seller?._id,
      sellerName: quotationShopName(quotation),
      productId: item?.product?._id,
      productTitle: item?.snapshot?.title || item?.product?.title,
      productImage: item?.snapshot?.image || item?.product?.images?.[0],
      productSlug: item?.snapshot?.slug || item?.product?.slug
    } } });
  };

  return (
    <main className="min-h-screen bg-[#f6f3ee] px-3 pb-28 pt-4 text-[#231f1b] sm:px-6 lg:py-10 dark:bg-neutral-950 dark:text-white">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-start gap-3">
          <Link to="/orders" className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[#ded6ca] bg-white dark:border-neutral-800 dark:bg-neutral-900"><ArrowLeftIcon className="h-5 w-5" /></Link>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#e85d00]">Achats négociés</p>
            <h1 className="mt-1 text-2xl font-black sm:text-4xl">Mes devis</h1>
            <p className="mt-1 text-sm font-medium text-[#797166]">Suivez les propositions et commandez sans modifier le prix public.</p>
          </div>
          {totalPending ? <span className="rounded-full bg-[#e85d00] px-3 py-1.5 text-xs font-black text-white">{totalPending} actif{totalPending > 1 ? 's' : ''}</span> : null}
        </header>

        <nav className="mt-6 flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none]" aria-label="Statuts des devis">
          {tabs.map(([value, label]) => <button key={value} type="button" onClick={() => setActiveTab(value)} className={`min-h-10 shrink-0 rounded-full px-4 text-xs font-black ${activeTab === value ? 'bg-[#231f1b] text-white dark:bg-white dark:text-black' : 'border border-[#ded6ca] bg-white text-[#6b6459] dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300'}`}>{label}</button>)}
        </nav>

        {error ? <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p> : null}
        {loading ? <div className="mt-5 space-y-3" aria-label="Chargement des devis">{[1, 2, 3].map((key) => <div key={key} className="h-44 animate-pulse rounded-3xl bg-white dark:bg-neutral-900" />)}</div> : null}
        {!loading && !rows.length ? (
          <section className="mt-8 rounded-3xl border border-[#e2dcd2] bg-white px-6 py-14 text-center dark:border-neutral-800 dark:bg-neutral-900">
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[#fff0e4] text-[#e85d00]"><DocumentTextIcon className="h-7 w-7" /></span>
            <h2 className="mt-5 text-xl font-black">Aucun devis ici</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm text-[#797166]">Ouvrez un produit éligible et choisissez « Demander un devis ».</p>
            <Link to="/products" className="mt-6 inline-flex min-h-12 items-center justify-center rounded-xl bg-[#e85d00] px-6 text-sm font-black text-white">Explorer les produits</Link>
          </section>
        ) : null}

        <section className="mt-5 space-y-4">
          {rows.map((quotation) => {
            const status = getQuotationStatus(quotation.status);
            const hasOffer = Number(quotation.quotedSubtotal || 0) > 0;
            const saving = quotationSavings(quotation);
            const busy = workingId === quotation._id;
            return (
              <article id={`quotation-${quotation._id}`} key={quotation._id} className={`overflow-hidden rounded-3xl border bg-white shadow-sm dark:bg-neutral-900 ${quotationId === quotation._id ? 'border-[#e85d00] ring-2 ring-[#e85d00]/10' : 'border-[#e2dcd2] dark:border-neutral-800'}`}>
                <div className="flex items-center gap-3 border-b border-[#eee8df] p-4 dark:border-neutral-800">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#fff0e4] text-[#e85d00]"><BuildingStorefrontIcon className="h-5 w-5" /></span>
                  <div className="min-w-0 flex-1"><h2 className="truncate text-base font-black">{quotationShopName(quotation)}</h2><p className="text-xs font-medium text-[#8a8378]">Demandé le {formatQuotationDate(quotation.createdAt)}</p></div>
                  <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${status.className}`}>{status.label}</span>
                </div>
                <div className="p-4">
                  <div className="space-y-2">
                    {(quotation.items || []).map((item) => <div key={item._id} className="flex items-center gap-3 rounded-2xl bg-[#f8f5f0] p-2.5 dark:bg-neutral-950">
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-[#eee8df]">{(item.snapshot?.image || item.product?.images?.[0]) ? <img src={item.snapshot?.image || item.product?.images?.[0]} alt="" className="h-full w-full object-cover" /> : <CubeIcon className="m-3 h-6 w-6 text-[#aaa298]" />}</div>
                      <div className="min-w-0 flex-1"><p className="truncate text-sm font-black">{item.snapshot?.title || item.product?.title || 'Produit'}</p><p className="text-xs text-[#797166]">{item.quantity} × {quotationMoney(hasOffer ? item.quotedPrice : item.originalPrice)}</p><SelectedAttributesList selectedAttributes={item.selectedAttributes} compact className="mt-1" /></div>
                      {hasOffer && Number(item.originalPrice) !== Number(item.quotedPrice) ? <span className="text-xs font-bold text-[#8a8378] line-through">{quotationMoney(item.originalPrice)}</span> : null}
                    </div>)}
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl border border-[#eee8df] p-3 sm:grid-cols-4 dark:border-neutral-800">
                    <div><p className="text-[10px] font-black uppercase text-[#8a8378]">Prix public</p><p className="mt-1 text-sm font-black">{quotationMoney(quotation.originalSubtotal)}</p></div>
                    <div><p className="text-[10px] font-black uppercase text-[#8a8378]">Prix proposé</p><p className="mt-1 text-sm font-black text-[#e85d00]">{hasOffer ? quotationMoney(quotation.quotedSubtotal) : 'En attente'}</p></div>
                    <div><p className="text-[10px] font-black uppercase text-[#8a8378]">Économie</p><p className="mt-1 text-sm font-black text-emerald-700">{hasOffer ? quotationMoney(saving) : '—'}</p></div>
                    <div><p className="text-[10px] font-black uppercase text-[#8a8378]">Expiration</p><p className="mt-1 flex items-center gap-1 text-xs font-black"><CalendarDaysIcon className="h-3.5 w-3.5" />{formatQuotationDate(quotation.expirationDate, true)}</p></div>
                  </div>
                  {quotation.sellerMessage ? <p className="mt-3 rounded-2xl bg-[#fff7ed] p-3 text-sm font-semibold text-[#7c3e13]">{quotation.sellerMessage}</p> : null}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {quotation.status === 'COUNTERED' ? <button disabled={busy} onClick={() => mutate(quotation, 'accept')} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#e85d00] px-4 text-sm font-black text-white"><CheckIcon className="h-4 w-4" />Accepter l’offre</button> : null}
                    {quotation.status === 'ACCEPTED' ? <button onClick={() => navigate(`/quotations/${quotation._id}/checkout`)} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#e85d00] px-4 text-sm font-black text-white">Finaliser la commande <ChevronRightIcon className="h-4 w-4" /></button> : null}
                    {quotation.status === 'ORDER_CREATED' && quotation.order?._id ? <Link to={`/orders/detail/${quotation.order._id}`} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#231f1b] px-4 text-sm font-black text-white">Voir la commande <ChevronRightIcon className="h-4 w-4" /></Link> : null}
                    {['COUNTERED', 'ACCEPTED'].includes(quotation.status) ? <button disabled={busy} onClick={() => mutate(quotation, 'reject')} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#ded6ca] px-4 text-sm font-black"><XMarkIcon className="h-4 w-4" />Refuser</button> : null}
                    <button onClick={() => messageSeller(quotation)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#ded6ca] px-4 text-sm font-black"><ChatBubbleLeftIcon className="h-4 w-4" />Message</button>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}
