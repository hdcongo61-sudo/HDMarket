import MarketingPackResults from '../commerce-ai/MarketingPackResults';
import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import PawaPayButton from '../PawaPayButton';

export default function PaidImageEditor({ getImageFile, onApply, initialOperation = 'background', productFacts = null }) {
  const [params, setParams] = useSearchParams();
  const [pricing, setPricing] = useState(null);
  const [operation, setOperation] = useState(initialOperation);
  const [marketingTitle, setMarketingTitle] = useState(productFacts?.title || '');
  const [marketingFacts, setMarketingFacts] = useState(productFacts?.description || '');
  const [prompt, setPrompt] = useState('');
  const [job, setJob] = useState(null);
  const [history, setHistory] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [upload, setUpload] = useState(null);
  const refresh = useCallback(async () => {
    const { data } = await api.get('/image-studio/paid/jobs', { skipCache: true });
    setHistory(data.jobs || []);
    const id = job?.id || params.get('job');
    if (id) {
      const selected = await api.get(`/image-studio/paid/jobs/${id}`, { skipCache: true });
      setJob(selected.data.job);
    }
  }, [job?.id, params]);
  useEffect(() => {
    let active = true;
    api.get('/image-studio/paid/pricing', { skipCache: true }).then(({ data }) => { if (active) setPricing(data); }).catch(() => { if (active) setError('Impossible de charger les tarifs.'); });
    return () => { active = false; };
  }, []);
  useEffect(() => { refresh().catch(() => setError('Impossible de charger vos retouches.')); }, [refresh]);
  useEffect(() => {
    if (!job || job.state === 'COMPLETED' || job.state === 'FAILED') return undefined;
    const timer = setInterval(() => { refresh().catch(() => {}); }, 15000);
    return () => clearInterval(timer);
  }, [job?.state, job?.id, refresh]);
  async function action(fn) {
    if (busy) return;
    setBusy(true); setError('');
    try { await fn(); } catch (e) { setError(e.response?.data?.message || e.message || 'Opération impossible. Réessayez.'); }
    finally { setBusy(false); }
  }
  const prepare = () => action(async () => {
    const file = getImageFile ? await getImageFile() : upload;
    if (!file) throw new Error('Choisissez une photo.');
    const form = new FormData(); form.append('image', file); form.append('operation', operation); form.append('prompt', prompt);
    if (operation === 'marketing') { form.append('marketingTitle', marketingTitle); form.append('marketingFacts', marketingFacts); }
    const { data } = await api.post('/image-studio/paid/jobs', form, { timeout: 90000 });
    setJob(data.job);
  });
  const run = () => action(async () => {
    const { data } = await api.post(`/image-studio/paid/jobs/${job.id}/run`);
    setJob(data.job);
  });
  const apply = () => action(async () => {
    const response = await fetch(job.resultUrl);
    if (!response.ok) throw new Error('Téléchargement indisponible. Réessayez.');
    const blob = await response.blob();
    const file = new File([blob], 'produit-retouche-ia.png', { type: blob.type || 'image/png' });
    await onApply(file);
  });
  const price = pricing?.operations?.find(item => item.id === operation)?.amount;
  return <div className="space-y-4 text-sm">
    <p className="text-neutral-600">Une photo + une demande = une retouche payante. Le prix est fixé avant paiement. Le résultat IA est une image carrée de 1 024 × 1 024 pixels. Votre photo et vos instructions sont envoyées à OpenAI. Vérifiez que le résultat représente fidèlement le produit.</p>
    <Link className="inline-block font-semibold text-orange-700" to="/seller/image-edits">Retrouver mes retouches et paiements ↗</Link>
    {!pricing?.enabled && <p role="status">Les nouvelles retouches IA sont actuellement indisponibles. Vos résultats restent accessibles.</p>}
    {!job && <div className="space-y-3">
      {!getImageFile && <label className="block">Photo (PNG, JPEG, WebP · 10 Mo maximum)<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => setUpload(e.target.files?.[0] || null)} className="mt-2 block w-full" /></label>}
      <label className="block">Modification<select value={operation} onChange={e => setOperation(e.target.value)} className="mt-1 w-full rounded-lg border bg-white p-3 text-neutral-900">{pricing?.operations?.map(item => <option key={item.id} value={item.id}>{item.label} · {item.amount} FCFA {item.id === 'marketing' ? '/ pack' : '/ photo'}</option>)}</select></label>
      {operation === 'marketing' && <div className="space-y-2 rounded-xl bg-orange-50 p-3 text-neutral-900"><p>Le pack comprend une photo retouchée, deux bannières à exporter et des textes WhatsApp/Facebook. Un seul paiement pour l’ensemble.</p><label className="block">Nom réel du produit<input value={marketingTitle} maxLength={200} onChange={e => setMarketingTitle(e.target.value)} className="mt-1 w-full rounded-lg border p-2" /></label><label className="block">Caractéristiques vérifiées<textarea value={marketingFacts} maxLength={2000} rows={3} onChange={e => setMarketingFacts(e.target.value)} className="mt-1 w-full rounded-lg border p-2" /></label></div>}
      <label className="block">Vos instructions<textarea maxLength={1000} rows={3} value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Ex. : placez le produit sur un fond blanc, sans modifier ses détails." className="mt-1 w-full rounded-lg border bg-white p-3 text-neutral-900" /></label>
      <button type="button" disabled={busy || !pricing?.enabled || prompt.trim().length < 5} onClick={prepare} className="min-h-11 rounded-lg bg-orange-700 px-4 font-bold text-white disabled:opacity-50">{busy ? 'Préparation…' : `Préparer la retouche · ${price ?? '…'} FCFA`}</button>
    </div>}
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {job && <div className="space-y-3 rounded-xl border p-4">
      <p className="font-semibold">{job.amount} FCFA · {pricing?.operations?.find(item => item.id === job.operation)?.label || job.operation}</p>
      <p className="whitespace-pre-wrap">{job.prompt}</p>
      <p className="break-all text-xs text-neutral-500">Référence : {job.id}</p>
      <div className="grid grid-cols-2 gap-3"><div><p>Original</p><img src={job.sourceUrl} alt="Photo avant retouche" className="mt-1 aspect-square w-full rounded-lg object-contain" /></div>{job.resultUrl && <div><p>Résultat IA</p><img src={job.resultUrl} alt="Photo après retouche IA" className="mt-1 aspect-square w-full rounded-lg object-contain" /></div>}</div>
      {!job.paid && job.state === 'AWAITING_PAYMENT' && pricing?.enabled && <PawaPayButton key={job.id} amount={job.amount} purpose="IMAGE_EDIT_FUNDING" returnPath={`/seller/image-edits?job=${job.id}`} onBeforeStart={() => ({ imageEditJobId: job.id })} onResult={() => { refresh().catch(() => {}); }} label="Payer cette retouche" />}
      {!job.paid && <button type="button" disabled={busy} onClick={() => action(async () => { if (job.checkoutId) await api.get(`/payments/pawapay/checkouts/${job.checkoutId}`, { skipCache: true }); await refresh(); })} className="min-h-11 rounded-lg border px-3">Vérifier le paiement</button>}
      {job.paid && (['AWAITING_PAYMENT', 'FAILED'].includes(job.state) || job.needsSupport) && job.attempts < 3 && <button type="button" disabled={busy} onClick={run} className="min-h-11 rounded-lg bg-orange-700 px-4 font-semibold text-white disabled:opacity-50">{busy ? 'Démarrage…' : job.state === 'FAILED' ? 'Réessayer sans repayer' : 'Paiement confirmé · Lancer la retouche'}</button>}
      {job.state === 'PROCESSING' && <p role="status">Retouche en cours. Vous pouvez revenir ici plus tard.</p>}
      {job.error && <p role="alert">{job.error}</p>}
      {(job.needsSupport || job.attempts >= 3 && job.state === 'FAILED') && <p>Contactez le support avec cette référence pour une reprise ou un remboursement après vérification. Ne payez pas à nouveau.</p>}
      {job.state === 'COMPLETED' && job.marketingCopy?.headline && <MarketingPackResults key={job.id} job={job} />}
      {job.resultUrl && <div className="flex flex-wrap gap-3">{onApply && <button type="button" disabled={busy} onClick={apply} className="min-h-11 rounded-lg bg-orange-700 px-4 font-semibold text-white">Utiliser ce résultat</button>}<a href={job.resultUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-lg border px-3">Ouvrir / enregistrer la photo ↗</a></div>}
      <button type="button" onClick={() => { setJob(null); setParams(previous => { previous.delete('job'); return previous; }, { replace: true }); }} className="min-h-11 rounded-lg border px-3">Préparer une autre retouche (nouveau paiement)</button>
    </div>}
    {!!history.length && <details><summary className="cursor-pointer font-semibold">Mes 20 dernières retouches</summary><div className="mt-2 space-y-2">{history.map(item => <button type="button" key={item.id} onClick={() => setJob(item)} className="block w-full rounded-lg border p-3 text-left"><span className="block truncate">{item.prompt}</span><span className="text-xs">{item.amount} FCFA · {item.state === 'COMPLETED' ? 'Terminée' : item.state === 'PROCESSING' ? 'En cours' : item.state === 'FAILED' ? 'À réessayer' : item.paid ? 'Payée' : 'Paiement à confirmer'}</span></button>)}</div></details>}
  </div>;
}
