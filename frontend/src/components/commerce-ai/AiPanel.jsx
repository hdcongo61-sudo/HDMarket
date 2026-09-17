import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';

export const aiButton = 'inline-flex min-h-11 items-center justify-center rounded-xl bg-orange-700 px-4 py-2 text-sm font-bold text-white hover:bg-orange-800 disabled:opacity-50';
export const aiInput = 'mt-2 w-full rounded-xl border border-neutral-300 bg-white p-3 text-sm text-neutral-900 dark:border-neutral-600 dark:bg-neutral-900 dark:text-white';
export function useAiRequest() {
  const [result, setResult] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const abort = useRef(null);
  useEffect(() => () => abort.current?.abort(), []);
  async function run(path, body = {}) {
    if (abort.current) return null;
    const controller = new AbortController(); abort.current = controller; setBusy(true); setError('');
    try {
      const { data } = await api.post(path, body, { signal: controller.signal, timeout: 60000 });
      if (!controller.signal.aborted) setResult(data);
      return data;
    } catch (e) {
      if (!controller.signal.aborted) setError(e.response?.data?.message || 'L’assistant est indisponible. Réessayez ou continuez sans IA.');
      return null;
    } finally { abort.current = null; if (!controller.signal.aborted) setBusy(false); }
  }
  return { result, busy, error, run, reset: () => { setResult(null); setError(''); } };
}
export default function AiPanel({ title, subtitle, children, error, busy }) {
  return <section aria-label={title} className="my-4 overflow-hidden rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-50 via-white to-amber-50 p-4 text-neutral-900 shadow-sm dark:border-neutral-700 dark:from-neutral-900 dark:via-neutral-900 dark:to-neutral-800 dark:text-white sm:p-5">
    <div className="mb-3"><span className="text-[10px] font-bold uppercase tracking-widest text-orange-700 dark:text-orange-300">HDMarket · Assistant IA</span><h2 className="mt-1 text-lg font-bold">{title}</h2>{subtitle && <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">{subtitle}</p>}</div>
    {children}
    {busy && <p role="status" className="mt-3 text-sm">Préparation de votre proposition…</p>}
    {error && <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-300">{error}</p>}
  </section>;
}
export function AiReportPanel({ founder = false }) {
  const { result, busy, error, run } = useAiRequest();
  return <AiPanel title={founder ? 'Votre brief du jour' : 'Votre coach de vente'} subtitle={founder ? 'Des priorités basées sur les recettes et coûts enregistrés. Le brief est conservé pour la journée.' : 'Des conseils basés sur vos annonces et leurs compteurs cumulés. Chaque changement reste à votre initiative.'} busy={busy} error={error}>
    <p className="mb-3 text-xs text-neutral-500">Les indicateurs utiles sont transmis à OpenAI à votre demande. Aucun nom de client ni message privé n’est envoyé.</p>
    <button type="button" className={aiButton} disabled={busy} onClick={() => run(founder ? '/commerce-ai/founder/brief' : '/commerce-ai/coach')}>{founder ? 'Préparer mon brief' : 'Analyser mes annonces'}</button>
    {result && <div className="mt-4 space-y-3" aria-live="polite"><p className="whitespace-pre-wrap text-sm">{result.summary}</p>{result.generatedAt && <p className="text-xs text-neutral-500">Préparé le {new Date(result.generatedAt).toLocaleString('fr-FR')}{result.cached ? ' · Brief sauvegardé' : ''}</p>}<div className="grid gap-3 md:grid-cols-2">{result.actions?.map((action, i) => <article key={i} className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900"><h3 className="font-semibold">{action.title}</h3><p className="my-2 text-sm text-neutral-600 dark:text-neutral-300">{action.detail}</p><Link className="text-sm font-semibold text-orange-700 dark:text-orange-300" to={action.source.url}>{action.source.title} ↗</Link></article>)}</div></div>}
  </AiPanel>;
}
export function AiProductResults({ products = [] }) {
  return <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{products.map(product => <article key={product.id} className="min-w-0 rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-900">
    <Link to={product.url}>{product.image && <img src={product.image} alt="" loading="lazy" className="mb-3 aspect-square w-full rounded-lg object-contain" />}<h3 className="font-semibold">{product.title}</h3></Link>
    <p className="mt-1 font-bold text-orange-700 dark:text-orange-300">{Number(product.price).toLocaleString('fr-FR')} {product.currency}</p><p className="text-xs text-neutral-500">{product.city} · {product.condition === 'new' ? 'Neuf' : 'Occasion'}</p>
    {product.reason ? <p className="mt-2 text-sm">{product.reason}</p> : <p className="mt-2 text-sm">{product.deliveryAvailable ? 'Livraison proposée' : 'Livraison à confirmer'} · {product.pickupAvailable ? 'Retrait proposé' : 'Retrait à confirmer'}</p>}
    <Link to={product.url} className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-orange-700 dark:text-orange-300">Vérifier la fiche et les options ↗</Link>
  </article>)}</div>;
}
