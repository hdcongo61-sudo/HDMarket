import React, { useState } from 'react';
import AiPanel, { aiButton, aiInput, AiProductResults, useAiRequest } from './AiPanel';
export default function ShoppingAssistant() {
  const [query, setQuery] = useState(''), [context, setContext] = useState(''), [open, setOpen] = useState(false);
  const { result, busy, error, run, reset } = useAiRequest();
  if (!open) return <button type="button" className={`${aiButton} my-3`} onClick={() => setOpen(true)}>M’aider à choisir avec l’IA</button>;
  const submit = async () => {
    const request = [context, query.trim()].filter(Boolean).join('\nPrécision : ').slice(-1000);
    if (await run('/commerce-ai/shopping', { query: request })) { setContext(request); setQuery(''); }
  };
  return <AiPanel title="Trouvez le bon produit" subtitle="Décrivez votre besoin, votre budget et votre ville. Comparez les annonces du catalogue, sans frais pour l’acheteur et dans la limite du quota disponible." busy={busy} error={error}>
    {context && <p className="mb-2 whitespace-pre-wrap rounded-xl bg-orange-100 p-3 text-sm text-neutral-900">{context}</p>}
    <label className="text-sm font-medium">{context ? 'Précisez votre recherche' : 'Que recherchez-vous ?'}<textarea className={aiInput} rows={2} maxLength={600} value={query} onChange={e => setQuery(e.target.value)} placeholder="Un téléphone neuf à moins de 100 000 FCFA à Brazzaville" /></label>
    <p className="my-2 text-xs text-neutral-500">Votre demande est transmise à OpenAI. Évitez les informations personnelles.</p>
    <div className="flex flex-wrap gap-2"><button type="button" className={aiButton} disabled={busy || !query.trim()} onClick={submit}>Chercher avec l’IA</button><button type="button" disabled={busy} className="min-h-11 rounded-xl border px-3 text-sm" onClick={() => { setContext(''); setQuery(''); reset(); }}>Nouvelle recherche</button><button type="button" disabled={busy} className="min-h-11 px-3 text-sm" onClick={() => setOpen(false)}>Réduire</button></div>
    {result && <div className="mt-4" aria-live="polite"><p className="text-sm">{result.summary}</p>{result.followUp && <p className="mt-2 font-medium">{result.followUp}</p>}<AiProductResults products={result.products} /></div>}
  </AiPanel>;
}
