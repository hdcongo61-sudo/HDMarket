import React, { useContext, useState } from 'react';
import AuthContext from '../context/AuthContext';
import { founderTools, isToolDue, readToolChecks } from '../services/founderTools';

export default function FounderTools() {
  const { user } = useContext(AuthContext);
  const key = `hdmarket:founder-tools:${user?._id || user?.id}`;
  const [checks, setChecks] = useState(() => readToolChecks(key));
  const [error, setError] = useState('');
  function markChecked(id) {
    const next = { ...checks, [id]: new Date().toISOString() };
    try {
      localStorage.setItem(key, JSON.stringify(next));
      setChecks(next);
      setError('');
      window.dispatchEvent(new Event('founder-tools-updated'));
    } catch { setError('Impossible d’enregistrer le rappel sur cet appareil. Vérifiez les paramètres de stockage du navigateur.'); }
  }
  return <main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
    <header className="rounded-2xl bg-neutral-900 p-6 text-white">
      <p className="text-sm text-orange-300">Espace fondateur</p>
      <h1 className="mt-2 text-2xl font-bold">Mes outils & ma routine</h1>
      <p className="mt-3 text-sm text-neutral-300">Chaque jour : erreurs, disponibilité et visiteurs. Chaque semaine : tests, sécurité, vitesse et visibilité Google.</p>
    </header>
    <p className="text-sm text-neutral-600 dark:text-neutral-300">Ces rappels sont enregistrés pour votre compte sur cet appareil. « Vérifié » indique votre dernière consultation, pas le bon fonctionnement du service. Les comptes externes et alertes nécessitent une activation ; aucun abonnement payant n’est souscrit.</p>
    {error && <p role="alert" className="text-red-600">{error}</p>}
    <div className="grid gap-4 md:grid-cols-2">
      {founderTools.map(tool => <article key={tool.id} className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex items-start justify-between gap-3"><h2 className="text-lg font-bold">{tool.name}</h2><span className="text-xs font-semibold text-orange-700 dark:text-orange-300">{tool.days === 1 ? 'Chaque jour' : 'Chaque semaine'}</span></div>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">{tool.status}</p>
        <p className="text-sm">{tool.action}</p>
        <details className="text-sm"><summary className="cursor-pointer font-semibold">Guide d’activation et d’utilisation</summary><p className="mt-2 leading-6 text-neutral-600 dark:text-neutral-300">{tool.setup}</p></details>
        <p className="text-xs" aria-live="polite">{isToolDue(checks[tool.id], tool.days) ? 'À vérifier' : 'Vérifié pour cette période'}{checks[tool.id] && Number.isFinite(Date.parse(checks[tool.id])) ? ` · ${new Date(checks[tool.id]).toLocaleString('fr-FR')}` : ''}</p>
        <div className="flex flex-wrap gap-3"><a href={tool.url} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-orange-600 px-3 py-2 text-sm font-semibold text-white">Ouvrir {tool.name} ↗</a><button type="button" onClick={() => markChecked(tool.id)} className="rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700">J’ai vérifié</button></div>
      </article>)}
    </div>
  </main>;
}
