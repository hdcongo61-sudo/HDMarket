import React, { useEffect, useState } from 'react';
import { Check, ChevronDown, ChevronUp, ExternalLink, Loader2, MapPin, ReceiptText, ShoppingBasket, Store, Truck, X } from 'lucide-react';
import api, { getApiErrorMessage } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { formatPriceWithStoredSettings as formatCurrency } from '../../utils/priceFormatter';
import { normalizeFileUrl } from '../../utils/deliveryUi';

const statusLabel = (status) => ({
  SEARCHING_DRIVER: 'Disponible', DRIVER_ASSIGNED: 'À accepter', SHOPPING: 'Achats en cours', WAITING_CUSTOMER_APPROVAL: 'Attente client', RECEIPT_UPLOADED: 'Prête à livrer', DELIVERING: 'En livraison', DELIVERED: 'Livrée', COMPLETED: 'Terminée'
}[status] || status);

function JobCard({ job, onChange }) {
  const { showToast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receipt, setReceipt] = useState({ storeName: job.preferredStore || '', amountSpent: '', note: '', file: null, productPhotos: [] });
  const claimable = Boolean(job.claimable);
  const usesShoppingBudget = job.authorizationMode === 'SHOPPING_BUDGET' || job.pricing?.authorizationMode === 'SHOPPING_BUDGET';
  const action = async (path, body = {}, isForm = false) => {
    setBusy(true);
    try {
      const { data } = isForm ? await api.post(path, body, { headers: { 'Content-Type': 'multipart/form-data' } }) : await api.patch(path, body);
      onChange(data.item);
      showToast('Mission mise à jour.', { variant: 'success' });
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Action impossible.'), { variant: 'error' });
    } finally { setBusy(false); }
  };
  const submitReceipt = () => {
    if (!receipt.file || !Number(receipt.amountSpent)) { showToast('Ajoutez le montant et la photo du reçu.', { variant: 'error' }); return; }
    const form = new FormData();
    form.append('receipt', receipt.file);
    form.append('storeName', receipt.storeName);
    form.append('amountSpent', receipt.amountSpent);
    form.append('note', receipt.note);
    Array.from(receipt.productPhotos || []).slice(0, 5).forEach((file) => form.append('productPhotos', file));
    action(`/buy-for-me/courier/jobs/${job._id}/receipt`, form, true).then(() => setReceiptOpen(false));
  };
  const mapHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.pickup?.address || job.pickup?.communeName || '')}`;

  return <article className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
    <button type="button" onClick={() => setExpanded((value) => !value)} className="flex w-full items-center gap-3 p-3.5 text-left"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-orange-50 text-[#e85d00] dark:bg-orange-950"><ShoppingBasket size={19} /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-black text-gray-900 dark:text-white">{job.preferredStore || 'Magasin local'}</p><p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">{job.items?.length || 0} article(s) · {usesShoppingBudget ? 'Budget autorisé' : 'Valeur estimée'} {formatCurrency(job.estimatedShoppingValue || job.pricing?.estimatedShoppingValue || job.pricing?.shoppingBudget || job.maxShoppingBudget)}</p><p className="mt-1 text-xs font-black text-[#e85d00]">Votre gain : {formatCurrency(job.pricing?.driverEarnings)}</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-black ${claimable ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'}`}>{statusLabel(job.status)}</span>{expanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}</button>
    {expanded ? <div className="space-y-3 border-t border-gray-100 p-3.5 dark:border-neutral-800"><div className="rounded-xl bg-gray-50 p-3 dark:bg-neutral-900"><p className="flex items-center gap-1.5 text-[10px] font-black uppercase text-gray-400"><Store size={12} /> Magasin / retrait</p><p className="mt-1 text-sm font-bold text-gray-900 dark:text-white">{claimable ? (job.pickup?.communeName || job.pickup?.cityName || 'Adresse visible après acceptation') : job.pickup?.address}</p>{!claimable ? <a href={mapHref} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-black text-[#e85d00]"><MapPin size={13} /> Naviguer <ExternalLink size={12} /></a> : null}<div className="mt-3 border-t border-gray-200 pt-3 dark:border-neutral-700"><p className="flex items-center gap-1.5 text-[10px] font-black uppercase text-gray-400"><Truck size={12} /> Livraison</p><p className="mt-1 text-sm font-bold text-gray-900 dark:text-white">{claimable ? (job.dropoff?.communeName || job.dropoff?.cityName || 'Adresse visible après acceptation') : job.dropoff?.address}</p></div></div>
      <div className="rounded-xl border border-orange-100 bg-orange-50 p-3"><p className="text-xs font-black text-orange-900">Liste du client</p><ul className="mt-2 space-y-2">{(job.items || []).map((item) => <li key={item._id} className="flex items-start gap-2 rounded-lg bg-white/70 p-2 text-xs text-orange-900">{item.imageUrl ? <a href={normalizeFileUrl(item.imageUrl)} target="_blank" rel="noreferrer" className="shrink-0"><img src={normalizeFileUrl(item.imageUrl)} alt={item.name} className="h-12 w-12 rounded-lg bg-orange-100 object-cover" /></a> : null}<span className="min-w-0 flex-1"><strong>{item.name}</strong> × {item.quantity}<span className="mt-0.5 block text-[10px] font-semibold text-orange-800">{item.estimatedUnitPrice > 0 ? `${formatCurrency(item.estimatedUnitPrice)} × ${item.quantity} = ${formatCurrency(item.estimatedTotal)}` : 'Prix à confirmer dans le budget autorisé'}</span>{item.note ? <span className="mt-0.5 block text-[10px] text-orange-700">{item.note}</span> : null}</span><span className="shrink-0 font-black">{item.status}</span></li>)}</ul>{job.specialInstructions ? <p className="mt-3 border-t border-orange-200 pt-2 text-xs font-semibold text-orange-800">Instruction : {job.specialInstructions}</p> : null}</div>
      {claimable ? <button type="button" disabled={busy} onClick={() => action(`/buy-for-me/courier/jobs/${job._id}/accept`)} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#e85d00] text-sm font-black text-white disabled:opacity-60">{busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Prendre cette mission</button> : null}
      {!claimable && job.status === 'DRIVER_ASSIGNED' ? <div className="grid grid-cols-2 gap-2"><button type="button" disabled={busy} onClick={() => action(`/buy-for-me/courier/jobs/${job._id}/start-shopping`)} className="min-h-11 rounded-xl bg-[#e85d00] text-xs font-black text-white">Commencer les achats</button><button type="button" disabled={busy} onClick={() => action(`/buy-for-me/courier/jobs/${job._id}/reject`, { reason: 'Indisponible' })} className="min-h-11 rounded-xl border border-red-200 text-xs font-black text-red-600">Refuser</button></div> : null}
      {!claimable && job.status === 'SHOPPING' ? <div className="space-y-2"><div className="grid grid-cols-2 gap-2">{(job.items || []).filter((item) => item.status === 'PENDING').map((item) => <React.Fragment key={item._id}><button type="button" disabled={busy} onClick={() => action(`/buy-for-me/courier/jobs/${job._id}/items/${item._id}`, { status: 'FOUND' })} className="rounded-lg border border-emerald-200 py-2 text-[10px] font-black text-emerald-700">Trouvé : {item.name}</button><button type="button" disabled={busy} onClick={() => action(`/buy-for-me/courier/jobs/${job._id}/items/${item._id}`, { status: 'UNAVAILABLE' })} className="rounded-lg border border-orange-200 py-2 text-[10px] font-black text-orange-700">Indispo : {item.name}</button></React.Fragment>)}</div><button type="button" onClick={() => setReceiptOpen((value) => !value)} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-violet-600 text-xs font-black text-white"><ReceiptText size={15} /> Ajouter le reçu</button>{receiptOpen ? <div className="space-y-2 rounded-xl bg-violet-50 p-3"><input value={receipt.storeName} onChange={(event) => setReceipt((previous) => ({ ...previous, storeName: event.target.value }))} placeholder="Nom du magasin" className="min-h-10 w-full rounded-lg border border-violet-100 bg-white px-2.5 text-sm outline-none" /><input type="number" value={receipt.amountSpent} onChange={(event) => setReceipt((previous) => ({ ...previous, amountSpent: event.target.value }))} placeholder="Montant final du reçu" className="min-h-10 w-full rounded-lg border border-violet-100 bg-white px-2.5 text-sm outline-none" /><input type="file" accept="image/*" onChange={(event) => setReceipt((previous) => ({ ...previous, file: event.target.files?.[0] || null }))} className="block w-full text-xs" /><label className="block text-xs font-semibold text-violet-900">Photos des produits (facultatif, 5 maximum)<input type="file" accept="image/*" multiple onChange={(event) => setReceipt((previous) => ({ ...previous, productPhotos: Array.from(event.target.files || []).slice(0, 5) }))} className="mt-1 block w-full text-xs" /></label><textarea value={receipt.note} onChange={(event) => setReceipt((previous) => ({ ...previous, note: event.target.value }))} rows={2} placeholder="Note facultative" className="w-full rounded-lg border border-violet-100 bg-white p-2.5 text-xs outline-none" /><button type="button" disabled={busy} onClick={submitReceipt} className="min-h-10 w-full rounded-lg bg-violet-600 text-xs font-black text-white">Enregistrer le reçu</button></div> : null}</div> : null}
      {!claimable && job.status === 'RECEIPT_UPLOADED' ? <button type="button" disabled={busy} onClick={() => action(`/buy-for-me/courier/jobs/${job._id}/start-delivery`)} className="min-h-11 w-full rounded-xl bg-blue-600 text-sm font-black text-white">Démarrer la livraison</button> : null}
      {!claimable && job.status === 'DELIVERING' ? <button type="button" disabled={busy} onClick={() => action(`/buy-for-me/courier/jobs/${job._id}/delivered`)} className="min-h-11 w-full rounded-xl bg-emerald-600 text-sm font-black text-white">Marquer comme livrée</button> : null}
      {!claimable && job.status === 'WAITING_CUSTOMER_APPROVAL' ? <p className="rounded-xl bg-orange-50 px-3 py-2 text-xs font-bold text-orange-800">Attendez la décision du client avant de poursuivre. N’avancez jamais la différence.</p> : null}
    </div> : null}
  </article>;
}

export default function BuyForMeJobs() {
  const { showToast } = useToast();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const load = () => api.get('/buy-for-me/courier/jobs', { params: { scope: 'all', limit: 50 } }).then(({ data }) => setJobs(Array.isArray(data?.items) ? data.items : [])).catch((error) => showToast(getApiErrorMessage(error, 'Impossible de charger les missions.'), { variant: 'error' })).finally(() => setLoading(false));
  // The polling callback deliberately stays stable for this mounted screen.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); const timer = setInterval(load, 15000); return () => clearInterval(timer); }, []);
  const update = (next) => setJobs((previous) => { const exists = previous.some((job) => job._id === next._id); return exists ? previous.map((job) => job._id === next._id ? next : job) : [next, ...previous]; });
  return <main className="mx-auto min-h-[100dvh] max-w-3xl bg-[#f5f5f5] px-4 pb-28 pt-6 dark:bg-neutral-950"><div className="mb-5"><p className="text-xs font-black uppercase tracking-[0.16em] text-[#e85d00]">Service à la demande</p><h1 className="mt-1 text-2xl font-black tracking-tight text-gray-900 dark:text-white">Achats à faire</h1><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Acceptez, achetez, ajoutez le reçu, puis livrez.</p></div>{loading ? <p className="py-12 text-center text-sm text-gray-400">Chargement…</p> : null}{!loading && !jobs.length ? <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center text-sm text-gray-500 dark:border-neutral-800 dark:bg-neutral-900">Aucune mission d’achat disponible pour le moment.</div> : null}<div className="space-y-3">{jobs.map((job) => <JobCard key={job._id} job={job} onChange={update} />)}</div></main>;
}
