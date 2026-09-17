import React, { useEffect, useRef, useState } from 'react';
import api from '../services/api';

export default function ProductWritingAssistant({ form, onApply }) {
  const [open, setOpen] = useState(false);
  const [facts, setFacts] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const controller = useRef(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function generate() {
    if (controller.current) return;
    const request = new AbortController();
    controller.current = request;
    setBusy(true); setError(''); setResult(null);
    try {
      const { data } = await api.post('/products/writing-assistant', {
        title: form.title, description: form.description, brand: form.brand,
        category: form.category, condition: form.condition, facts
      }, { signal: request.signal, timeout: 90000 });
      if (!request.signal.aborted) setResult(data);
    } catch (err) {
      if (!request.signal.aborted) setError(err.response?.data?.message || 'Impossible de générer le texte. Réessayez.');
    } finally {
      if (controller.current === request) controller.current = null;
      setBusy(false);
    }
  }
  return <section className="rounded-2xl border border-orange-200 bg-orange-50/60 p-4 dark:border-orange-900 dark:bg-neutral-900">
    <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="min-h-11 text-left text-sm font-bold text-orange-800 dark:text-orange-300">✨ Assistant IA · Nom et description</button>
    {open && <div className="space-y-3">
      <p className="text-xs text-neutral-600 dark:text-neutral-300">Les informations saisies sont envoyées à OpenAI pour rédiger la proposition. Décrivez les caractéristiques réelles du produit. L’assistant utilise ces informations et les champs déjà remplis ; il n’analyse pas les photos.</p>
      <label className="block text-sm font-semibold">Informations à inclure<textarea value={facts} onChange={e => setFacts(e.target.value)} maxLength={2000} rows={3} placeholder="Ex. : sac noir, cuir synthétique, deux poches, fermeture éclair, petite rayure sur le côté…" className="mt-1 w-full rounded-xl border border-neutral-300 bg-white p-3 text-neutral-900" /></label>
      <div className="flex flex-wrap gap-2"><button type="button" disabled={busy || !(facts.trim() || form.title?.trim() || form.description?.trim())} onClick={generate} className="min-h-11 rounded-xl bg-orange-700 px-4 text-sm font-bold text-white disabled:opacity-50">{busy ? 'Rédaction en cours…' : result ? 'Générer une autre proposition' : 'Générer une proposition'}</button>
      {busy && <button type="button" onClick={() => controller.current?.abort()} className="min-h-11 px-3 text-sm">Annuler</button>}</div>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {result && <div className="space-y-3 rounded-xl bg-white p-4 dark:bg-neutral-800">
        <p className="text-xs text-neutral-500">Relisez les caractéristiques avant d’appliquer. Vos champs ne changent pas automatiquement.</p>
        <label className="block text-sm font-semibold">Nom proposé<input maxLength={200} value={result.title} onChange={e => setResult({ ...result, title: e.target.value })} className="mt-1 w-full rounded-lg border p-2 text-neutral-900" /></label>
        <label className="block text-sm font-semibold">Description proposée<textarea maxLength={5000} rows={6} value={result.description} onChange={e => setResult({ ...result, description: e.target.value })} className="mt-1 w-full rounded-lg border p-2 text-neutral-900" /></label>
        <div className="flex flex-wrap gap-2">{[['title', 'Utiliser le nom'], ['description', 'Utiliser la description'], ['both', 'Utiliser les deux']].map(([field, label]) => <button key={field} type="button" disabled={!result.title.trim() || !result.description.trim()} onClick={() => onApply(field === 'both' ? result : { [field]: result[field] })} className="min-h-11 rounded-lg border border-orange-300 px-3 text-sm font-semibold disabled:opacity-50">{label}</button>)}</div>
      </div>}
    </div>}
  </section>;
}
