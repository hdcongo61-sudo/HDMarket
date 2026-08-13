import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarClock, Check, FileText, MapPin, Package, Percent, RefreshCw, Send, UserRound, X } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../services/api';
import { createIdempotencyKey } from '../utils/idempotency';
import { formatQuotationDate, getQuotationStatus, quotationBuyerName, quotationMoney } from '../utils/quotationUtils';
import SelectedAttributesList from '../components/orders/SelectedAttributesList';

const tabs = [['PENDING', 'En attente'], ['ACCEPTED', 'Acceptés'], ['REJECTED', 'Refusés'], ['EXPIRED', 'Expirés'], ['ORDER_CREATED', 'Commandes']];
const emptyOffer = { items: [], discount: 0, deliveryFee: 0, estimatedDeliveryDate: '', validityHours: 48, expirationDate: '', message: '' };

export default function SellerQuotations() {
  const navigate = useNavigate();
  const { quotationId } = useParams();
  const [activeTab, setActiveTab] = useState('PENDING');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [offerOpen, setOfferOpen] = useState(false);
  const [offer, setOffer] = useState(emptyOffer);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const { data } = await api.get('/quotations/seller', { params: { status: activeTab } });
      const items = Array.isArray(data?.items) ? data.items : [];
      setRows(items);
      if (quotationId) setSelected(items.find((row) => row._id === quotationId) || null);
    } catch (requestError) { setError(requestError.response?.data?.message || 'Impossible de charger les devis.'); }
    finally { setLoading(false); }
  }, [activeTab, quotationId]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!quotationId) return;
    api.get(`/quotations/${quotationId}`).then(({ data }) => {
      setSelected(data);
      if (!rows.some((row) => row._id === data._id)) setRows((previous) => [data, ...previous]);
    }).catch(() => null);
  }, [quotationId]);

  const openCounter = (quotation) => {
    setSelected(quotation);
    setOffer({
      ...emptyOffer,
      items: (quotation.items || []).map((item) => ({ itemId: item._id, productId: item.product?._id || item.product, selectionKey: item.selectionKey || '', title: item.snapshot?.title || item.product?.title || 'Produit', selectedAttributes: item.selectedAttributes || [], unitPrice: item.requestedPrice || item.originalPrice })),
      message: quotation.sellerMessage || ''
    });
    setOfferOpen(true);
  };

  const respond = async (quotation, action, payload = {}) => {
    setWorking(true); setError('');
    try {
      await api.post(`/quotations/${quotation._id}/respond`, { action, ...payload }, { headers: { 'Idempotency-Key': createIdempotencyKey(`quote-${action.toLowerCase()}`) } });
      setOfferOpen(false); setSelected(null); navigate('/seller/quotations'); await load();
    } catch (requestError) { setError(requestError.response?.data?.message || 'La réponse n’a pas pu être enregistrée.'); }
    finally { setWorking(false); }
  };

  const submitCounter = (event) => {
    event.preventDefault();
    respond(selected, 'COUNTER', {
      items: offer.items,
      discount: Number(offer.discount || 0), deliveryFee: Number(offer.deliveryFee || 0),
      estimatedDeliveryDate: offer.estimatedDeliveryDate || null,
      validityHours: offer.validityHours === 'custom' ? undefined : Number(offer.validityHours),
      expirationDate: offer.validityHours === 'custom' ? offer.expirationDate : undefined,
      message: offer.message
    });
  };

  const pendingCount = useMemo(() => rows.filter((row) => ['PENDING', 'COUNTERED'].includes(row.status)).length, [rows]);
  return (
    <main className="min-h-screen bg-[#f5f2ee] px-3 pb-28 pt-5 text-[#231f1b] sm:px-6 lg:px-8 lg:py-8 dark:bg-neutral-950 dark:text-white">
      <div className="mx-auto max-w-6xl">
        <header className="flex items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.16em] text-[#e85d00]">Négociation</p><h1 className="mt-1 text-2xl font-black sm:text-4xl">Demandes de devis</h1><p className="mt-1 text-sm font-medium text-[#797166]">Répondez rapidement sans changer vos prix publics.</p></div><button onClick={load} aria-label="Actualiser" className="grid h-11 w-11 place-items-center rounded-full border border-[#ded6ca] bg-white dark:border-neutral-800 dark:bg-neutral-900"><RefreshCw className="h-4 w-4" /></button></header>
        <nav className="mt-6 flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none]">{tabs.map(([value, label]) => <button key={value} onClick={() => { setActiveTab(value); navigate('/seller/quotations'); }} className={`min-h-10 shrink-0 rounded-full px-4 text-xs font-black ${activeTab === value ? 'bg-[#231f1b] text-white dark:bg-white dark:text-black' : 'border border-[#ded6ca] bg-white text-[#6b6459] dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300'}`}>{label}{value === 'PENDING' && pendingCount ? ` · ${pendingCount}` : ''}</button>)}</nav>
        {error ? <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p> : null}
        {loading ? <div className="mt-5 grid gap-4 lg:grid-cols-2">{[1, 2, 3, 4].map((key) => <div className="h-64 animate-pulse rounded-3xl bg-white dark:bg-neutral-900" key={key} />)}</div> : null}
        {!loading && !rows.length ? <section className="mt-8 rounded-3xl border border-[#e2dcd2] bg-white py-16 text-center dark:border-neutral-800 dark:bg-neutral-900"><FileText className="mx-auto h-10 w-10 text-[#e85d00]" /><h2 className="mt-4 text-lg font-black">Aucune demande dans cet onglet</h2></section> : null}
        <section className="mt-5 grid items-start gap-4 lg:grid-cols-2">{rows.map((quotation) => {
          const status = getQuotationStatus(quotation.status); const canRespond = ['PENDING', 'COUNTERED'].includes(quotation.status);
          return <article key={quotation._id} className={`overflow-hidden rounded-3xl border bg-white shadow-sm dark:bg-neutral-900 ${selected?._id === quotation._id ? 'border-[#e85d00] ring-2 ring-[#e85d00]/10' : 'border-[#e2dcd2] dark:border-neutral-800'}`}>
            <button className="flex w-full items-center gap-3 border-b border-[#eee8df] p-4 text-left dark:border-neutral-800" onClick={() => { setSelected(quotation); navigate(`/seller/quotations/${quotation._id}`); }}><span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#fff0e4] text-[#e85d00]"><UserRound className="h-5 w-5" /></span><div className="min-w-0 flex-1"><h2 className="truncate font-black">{quotationBuyerName(quotation)}</h2><p className="text-xs text-[#8a8378]">{formatQuotationDate(quotation.createdAt, true)}</p></div><span className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${status.className}`}>{status.label}</span></button>
            <div className="p-4"><div className="space-y-2">{(quotation.items || []).map((item) => <div key={item._id} className="flex items-center gap-3 rounded-2xl bg-[#f8f5f0] p-2.5 dark:bg-neutral-950"><div className="h-12 w-12 overflow-hidden rounded-xl bg-[#eee8df]">{(item.snapshot?.image || item.product?.images?.[0]) ? <img src={item.snapshot?.image || item.product?.images?.[0]} alt="" className="h-full w-full object-cover" /> : <Package className="m-3 h-6 w-6" />}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-black">{item.snapshot?.title || item.product?.title}</p><p className="text-xs text-[#797166]">Qté {item.quantity} · souhaité {item.requestedPrice ? quotationMoney(item.requestedPrice) : 'non précisé'}</p><SelectedAttributesList selectedAttributes={item.selectedAttributes} compact className="mt-1" /></div><strong className="text-xs">{quotationMoney(item.originalPrice)}</strong></div>)}</div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs font-bold text-[#6b6459]"><span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-[#e85d00]" />{quotation.deliveryCity}</span>{quotation.expectedDeliveryDate ? <span className="inline-flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5 text-[#e85d00]" />Souhaité {formatQuotationDate(quotation.expectedDeliveryDate)}</span> : null}</div>
              {quotation.message ? <p className="mt-3 rounded-2xl border-l-4 border-[#e85d00] bg-[#fff8f1] p-3 text-sm font-semibold text-[#5f5145] dark:bg-neutral-950 dark:text-neutral-300">{quotation.message}</p> : null}
              {canRespond ? <div className="mt-4 grid grid-cols-3 gap-2"><button disabled={working} onClick={() => respond(quotation, 'ACCEPT', { validityHours: 48 })} className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl bg-emerald-600 px-2 text-xs font-black text-white"><Check className="h-4 w-4" />Accepter</button><button disabled={working} onClick={() => openCounter(quotation)} className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl bg-[#e85d00] px-2 text-xs font-black text-white"><Send className="h-4 w-4" />Contre-offre</button><button disabled={working} onClick={() => respond(quotation, 'REJECT', {})} className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl border border-[#ded6ca] px-2 text-xs font-black"><X className="h-4 w-4" />Refuser</button></div> : null}
            </div>
          </article>;
        })}</section>
      </div>

      {offerOpen && selected ? <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true"><form onSubmit={submitCounter} className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-[#f8f5f0] p-4 shadow-2xl sm:max-w-2xl sm:rounded-3xl sm:p-6 dark:bg-neutral-950"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.15em] text-[#e85d00]">Proposition vendeur</p><h2 className="text-2xl font-black">Créer une contre-offre</h2></div><button type="button" onClick={() => setOfferOpen(false)} className="grid h-10 w-10 place-items-center rounded-full bg-white dark:bg-neutral-900"><X className="h-5 w-5" /></button></div>
        <div className="mt-5 space-y-3">{offer.items.map((item, index) => <label key={item.itemId || `${item.productId}-${item.selectionKey}`} className="grid grid-cols-[1fr_140px] items-end gap-3 rounded-2xl bg-white p-3 text-xs font-black dark:bg-neutral-900"><span>{item.title}<SelectedAttributesList selectedAttributes={item.selectedAttributes} compact className="mt-1" /><small className="mt-1 block font-semibold text-[#8a8378]">Prix unitaire proposé</small></span><input required min="1" type="number" value={item.unitPrice} onChange={(event) => setOffer((previous) => ({ ...previous, items: previous.items.map((entry, itemIndex) => itemIndex === index ? { ...entry, unitPrice: event.target.value } : entry) }))} className="h-11 rounded-xl border border-[#ded6ca] bg-white px-3 text-sm outline-none focus:border-[#e85d00] dark:border-neutral-700 dark:bg-neutral-950" /></label>)}</div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-xs font-black"><Percent className="mr-1 inline h-4 w-4" />Remise indicative (%)<input type="number" min="0" max="100" value={offer.discount} onChange={(e) => setOffer((p) => ({ ...p, discount: e.target.value }))} className="mt-1.5 h-12 w-full rounded-xl border border-[#ded6ca] bg-white px-3 dark:border-neutral-700 dark:bg-neutral-900" /></label><label className="text-xs font-black">Frais de livraison<input type="number" min="0" value={offer.deliveryFee} onChange={(e) => setOffer((p) => ({ ...p, deliveryFee: e.target.value }))} className="mt-1.5 h-12 w-full rounded-xl border border-[#ded6ca] bg-white px-3 dark:border-neutral-700 dark:bg-neutral-900" /></label><label className="text-xs font-black">Date de livraison estimée<input type="date" value={offer.estimatedDeliveryDate} onChange={(e) => setOffer((p) => ({ ...p, estimatedDeliveryDate: e.target.value }))} className="mt-1.5 h-12 w-full rounded-xl border border-[#ded6ca] bg-white px-3 dark:border-neutral-700 dark:bg-neutral-900" /></label><label className="text-xs font-black">Validité<select value={offer.validityHours} onChange={(e) => setOffer((p) => ({ ...p, validityHours: e.target.value }))} className="mt-1.5 h-12 w-full rounded-xl border border-[#ded6ca] bg-white px-3 dark:border-neutral-700 dark:bg-neutral-900"><option value="24">24 heures</option><option value="48">48 heures</option><option value="168">7 jours</option><option value="336">14 jours</option><option value="custom">Personnalisée</option></select></label>{offer.validityHours === 'custom' ? <label className="text-xs font-black sm:col-span-2">Expiration personnalisée<input required type="datetime-local" value={offer.expirationDate} onChange={(e) => setOffer((p) => ({ ...p, expirationDate: e.target.value }))} className="mt-1.5 h-12 w-full rounded-xl border border-[#ded6ca] bg-white px-3 dark:border-neutral-700 dark:bg-neutral-900" /></label> : null}<label className="text-xs font-black sm:col-span-2">Message<textarea value={offer.message} onChange={(e) => setOffer((p) => ({ ...p, message: e.target.value }))} className="mt-1.5 min-h-24 w-full rounded-xl border border-[#ded6ca] bg-white p-3 dark:border-neutral-700 dark:bg-neutral-900" maxLength={2000} /></label></div>
        <button disabled={working} className="mt-5 inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-[#e85d00] px-5 font-black text-white"><Send className="h-5 w-5" />{working ? 'Envoi…' : 'Envoyer la contre-offre'}</button>
      </form></div> : null}
    </main>
  );
}
