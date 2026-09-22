import React, { useEffect, useState } from 'react';
import { getPrivacyChoices, setPrivacyPreference, subscribePrivacyPreference } from '../services/privacyPreferences';

export default function PrivacyControls() {
  const [choices, setChoices] = useState(() => getPrivacyChoices());
  const [draft, setDraft] = useState(() => getPrivacyChoices() || { analytics: false, diagnostics: false });
  const [saved, setSaved] = useState(false);
  useEffect(() => subscribePrivacyPreference(() => {
    const current = getPrivacyChoices();
    setChoices(current);
    setDraft(current || { analytics: false, diagnostics: false });
  }), []);
  const save = value => { setPrivacyPreference(value); setSaved(true); };
  const buttonClass = 'min-h-11 rounded-xl border border-neutral-500 bg-white px-4 py-2 text-sm font-bold text-neutral-900 hover:bg-orange-50';
  return <div className="space-y-4 text-neutral-900">
    <p className="text-sm">Les fonctions essentielles restent actives. Les options ci-dessous sont facultatives et indépendantes.</p>
    <fieldset className="space-y-3">
      <legend className="sr-only">Utilisations facultatives de vos données</legend>
      {[
        ['analytics', 'Statistiques d’utilisation', 'Mesure des pages et des parcours d’achat, sans le texte de vos recherches ni le contenu de vos messages.'],
        ['diagnostics', 'Diagnostic des erreurs', 'Rapports techniques pour comprendre les plantages, sans enregistrement de votre écran.']
      ].map(([key, label, description]) => <label key={key} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-neutral-300 p-3">
        <input type="checkbox" checked={draft[key]} onChange={e => { setDraft(current => ({ ...current, [key]: e.target.checked })); setSaved(false); }} className="mt-1 h-5 w-5 shrink-0 accent-[#c2410c]" />
        <span><span className="block text-sm font-bold">{label}</span><span className="mt-1 block text-sm text-neutral-600">{description}</span></span>
      </label>)}
    </fieldset>
    <div className="flex flex-wrap gap-2">
      <button type="button" className={buttonClass} onClick={() => save('essential')}>Tout refuser</button>
      <button type="button" className={buttonClass} onClick={() => save({ analytics: true, diagnostics: true })}>Tout autoriser</button>
      <button type="button" className="min-h-11 rounded-xl bg-[#c2410c] px-4 py-2 text-sm font-bold text-white" onClick={() => save(draft)}>Enregistrer mes choix</button>
    </div>
    <p role="status" className="text-sm text-neutral-700">{saved ? 'Préférences enregistrées. ' : ''}{choices ? `Statistiques : ${choices.analytics ? 'autorisées' : 'refusées'} · Diagnostic : ${choices.diagnostics ? 'autorisé' : 'refusé'}.` : 'Aucun accord donné : les options facultatives sont désactivées.'}</p>
  </div>;
}
