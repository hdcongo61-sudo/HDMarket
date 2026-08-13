import React, { useEffect, useState } from 'react';
import { ArrowLeft, BadgeCheck, LockKeyhole, MapPin, Package, Tag } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../services/api';
import { createIdempotencyKey } from '../utils/idempotency';
import { quotationMoney, quotationSavings, quotationShopName } from '../utils/quotationUtils';
import SelectedAttributesList from '../components/orders/SelectedAttributesList';

export default function QuotationCheckout() {
  const { quotationId } = useParams();
  const navigate = useNavigate();
  const [quotation, setQuotation] = useState(null);
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api.get(`/quotations/${quotationId}`).then(({ data }) => {
      if (!active) return;
      setQuotation(data);
      setAddress(data?.deliveryCity || '');
    }).catch((requestError) => active && setError(requestError.response?.data?.message || 'Devis introuvable.')).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [quotationId]);

  const createOrder = async () => {
    if (!address.trim()) return setError('Indiquez votre adresse de livraison.');
    setSubmitting(true);
    setError('');
    try {
      const { data } = await api.post(`/quotations/${quotationId}/order`, { deliveryAddress: address.trim() }, { headers: { 'Idempotency-Key': createIdempotencyKey('quote-order') } });
      navigate(`/orders/detail/${data.orderId}`, { replace: true, state: { fromQuotation: true } });
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Impossible de créer la commande.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <main className="min-h-screen bg-[#f6f3ee] p-4"><div className="mx-auto h-96 max-w-3xl animate-pulse rounded-3xl bg-white" /></main>;
  if (!quotation) return <main className="min-h-screen bg-[#f6f3ee] p-6"><div className="mx-auto max-w-xl rounded-3xl bg-white p-8 text-center"><p className="font-bold text-red-700">{error}</p><Link to="/my-quotations" className="mt-5 inline-flex rounded-xl bg-[#231f1b] px-5 py-3 font-black text-white">Retour aux devis</Link></div></main>;
  const allowed = quotation.status === 'ACCEPTED';
  return (
    <main className="min-h-screen bg-[#f6f3ee] px-3 pb-28 pt-4 text-[#231f1b] sm:px-6 lg:py-10 dark:bg-neutral-950 dark:text-white">
      <div className="mx-auto max-w-3xl">
        <header className="flex items-center gap-3"><Link to="/my-quotations" className="grid h-11 w-11 place-items-center rounded-full border border-[#ded6ca] bg-white dark:border-neutral-800 dark:bg-neutral-900"><ArrowLeft className="h-5 w-5" /></Link><div><p className="text-xs font-black uppercase tracking-[.15em] text-[#e85d00]">Checkout spécial</p><h1 className="text-2xl font-black">Votre devis accepté</h1></div></header>
        <section className="mt-6 overflow-hidden rounded-3xl border border-[#e2dcd2] bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex items-center gap-3 bg-[#231f1b] p-4 text-white"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#e85d00]"><BadgeCheck className="h-6 w-6" /></span><div className="min-w-0 flex-1"><p className="text-[11px] font-black uppercase tracking-[.12em] text-orange-200">Devis vendeur</p><p className="truncate text-lg font-black">{quotationShopName(quotation)}</p></div><span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black">Prix verrouillé</span></div>
          <div className="space-y-3 p-4 sm:p-6">{(quotation.items || []).map((item) => <article key={item._id} className="flex gap-3 rounded-2xl bg-[#f8f5f0] p-3 dark:bg-neutral-950"><div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-[#eee8df]">{(item.snapshot?.image || item.product?.images?.[0]) ? <img src={item.snapshot?.image || item.product?.images?.[0]} alt="" className="h-full w-full object-cover" /> : <Package className="m-5 h-6 w-6" />}</div><div className="min-w-0 flex-1"><p className="line-clamp-2 text-sm font-black">{item.snapshot?.title || item.product?.title}</p><SelectedAttributesList selectedAttributes={item.selectedAttributes} compact className="mt-1" /><span className="mt-1 inline-flex items-center gap-1 rounded-full bg-[#fff0e4] px-2 py-1 text-[10px] font-black text-[#d95400]"><Tag className="h-3 w-3" />Prix négocié</span><p className="mt-1 text-xs text-[#797166]">{item.quantity} × <strong className="text-[#231f1b] dark:text-white">{quotationMoney(item.quotedPrice)}</strong> <span className="ml-1 line-through">{quotationMoney(item.originalPrice)}</span></p></div></article>)}</div>
          <div className="border-t border-[#eee8df] p-4 sm:p-6 dark:border-neutral-800"><label className="text-xs font-black text-[#57534e] dark:text-neutral-300"><MapPin className="mr-1 inline h-4 w-4" />Adresse de livraison<textarea value={address} onChange={(event) => setAddress(event.target.value)} className="mt-2 min-h-24 w-full rounded-2xl border border-[#ded6ca] bg-white p-3 text-sm font-semibold outline-none focus:border-[#e85d00] dark:border-neutral-700 dark:bg-neutral-950" maxLength={500} /></label></div>
          <div className="border-t border-[#eee8df] p-4 sm:p-6 dark:border-neutral-800"><div className="space-y-2 text-sm"><div className="flex justify-between text-[#797166]"><span>Prix public</span><span className="line-through">{quotationMoney(quotation.originalSubtotal)}</span></div><div className="flex justify-between font-bold"><span>Prix négocié</span><span>{quotationMoney(quotation.quotedSubtotal)}</span></div><div className="flex justify-between text-emerald-700"><span>Votre économie</span><strong>{quotationMoney(quotationSavings(quotation))}</strong></div><div className="flex justify-between"><span>Livraison</span><strong>{quotation.deliveryFee ? quotationMoney(quotation.deliveryFee) : 'Gratuite'}</strong></div><div className="mt-3 flex justify-between border-t border-dashed border-[#ded6ca] pt-3 text-lg font-black"><span>Total</span><span className="text-[#e85d00]">{quotationMoney(Number(quotation.quotedSubtotal || 0) + Number(quotation.deliveryFee || 0))}</span></div></div>
            {error ? <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p> : null}
            <button type="button" disabled={!allowed || submitting} onClick={createOrder} className="mt-5 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#e85d00] px-5 text-base font-black text-white disabled:opacity-50"><LockKeyhole className="h-5 w-5" />{submitting ? 'Création…' : allowed ? 'Créer la commande sécurisée' : 'Ce devis n’est plus disponible'}</button>
            <p className="mt-3 text-center text-[11px] font-semibold text-[#8a8378]">Le paiement sécurisé s’effectue ensuite sur la commande créée.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
