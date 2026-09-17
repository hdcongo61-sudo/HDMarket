import React, { useState } from 'react';
import AiPanel, { aiButton, aiInput, useAiRequest } from './AiPanel';
export default function SellerReplyAssistant({ conversationId, onApply }) {
  const [open, setOpen] = useState(false), [question, setQuestion] = useState(''), [consent, setConsent] = useState(false), [draft, setDraft] = useState('');
  const { busy, error, run } = useAiRequest();
  if (!open) return <button type="button" className="mx-3 my-2 min-h-11 rounded-xl border border-orange-200 px-3 text-sm font-semibold text-orange-700" onClick={() => setOpen(true)}>Préparer une réponse avec l’IA</button>;
  return <div className="max-h-[45vh] overflow-y-auto px-3"><AiPanel title="Assistant de réponse" subtitle="Copiez la question à traiter. L’historique complet de la conversation n’est pas transmis." busy={busy} error={error}>
    <label className="text-sm">Question du client<textarea className={aiInput} rows={2} maxLength={1000} value={question} onChange={e => { setQuestion(e.target.value); setDraft(''); }} /></label>
    <label className="my-3 flex items-start gap-2 text-xs"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />J’accepte d’envoyer ce texte et le contexte utile de la commande à OpenAI. J’ai retiré les informations personnelles.</label>
    <button type="button" className={aiButton} disabled={busy || !consent || !question.trim()} onClick={async () => { const data = await run(`/commerce-ai/conversations/${conversationId}/reply`, { question, consent }); if (data) setDraft(data.reply); }}>Préparer un brouillon</button>
    {draft && <div className="mt-3"><label className="text-sm">Relire et corriger<textarea className={aiInput} rows={3} maxLength={900} value={draft} onChange={e => setDraft(e.target.value)} /></label><button type="button" className={aiButton} onClick={() => { onApply(draft); setOpen(false); }}>Insérer dans mon message</button><p className="mt-2 text-xs">Le bouton Envoyer habituel reste nécessaire.</p></div>}
    <button type="button" disabled={busy} className="ml-3 min-h-11 px-3 text-sm" onClick={() => setOpen(false)}>Fermer</button>
  </AiPanel></div>;
}
