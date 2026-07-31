import React, { useEffect, useState } from 'react';
import { Bug, Lightbulb, LoaderCircle, MessageSquarePlus, Star, X } from 'lucide-react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';

const OPTIONS = [
  { value: 'bug', label: 'Signaler un bug', icon: Bug },
  { value: 'improvement', label: 'Suggérer une amélioration', icon: Lightbulb },
  { value: 'rating', label: 'Noter la fonctionnalité', icon: Star }
];

// Drop this component into a feature screen. It self-enables only for people
// currently admitted to that feature's beta, so it does not disclose betas to
// any other user.
export default function FeatureFeedbackWidget({ featureName }) {
  const { showToast } = useToast();
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);
  const [type, setType] = useState('bug');
  const [message, setMessage] = useState('');
  const [rating, setRating] = useState(5);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    api.get(`/features/${encodeURIComponent(featureName)}`, { silentGlobalError: true })
      .then(({ data }) => {
        if (!active) return;
        setVisible(Boolean(data?.betaFeedbackEnabled));
        if (data?.enabled) {
          void api.post(`/features/${encodeURIComponent(featureName)}/events`, {
            event: 'exposure',
            variant: data?.variant || 'control',
            durationMs: 0
          }, { silentGlobalError: true }).catch(() => {});
        }
      })
      .catch(() => {
        if (active) setVisible(false);
      });
    return () => { active = false; };
  }, [featureName]);

  const submit = async (event) => {
    event.preventDefault();
    if (type !== 'rating' && !message.trim()) {
      showToast('Décrivez votre retour avant de l’envoyer.', { variant: 'error' });
      return;
    }
    setSaving(true);
    try {
      await api.post(`/features/${encodeURIComponent(featureName)}/feedback`, {
        type,
        rating: type === 'rating' ? rating : undefined,
        message: message.trim()
      });
      setMessage('');
      setOpen(false);
      showToast('Merci, votre retour a été transmis.', { variant: 'success' });
    } catch (error) {
      showToast(error?.response?.data?.message || 'Impossible d’envoyer le retour.', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-20 right-4 z-40 sm:bottom-6 sm:right-6">
      {open ? (
        <form onSubmit={submit} className="w-[min(360px,calc(100vw-2rem))] rounded-2xl border border-violet-200 bg-white p-4 shadow-2xl dark:border-violet-900 dark:bg-neutral-950">
          <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-black text-neutral-900 dark:text-white">Retour bêta</p><p className="text-xs text-neutral-500">Aidez-nous à améliorer cette fonctionnalité.</p></div><button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"><X size={17} /></button></div>
          <div className="mt-3 grid gap-2">{OPTIONS.map((option) => { const Icon = option.icon; return <button key={option.value} type="button" onClick={() => setType(option.value)} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs font-bold ${type === option.value ? 'border-violet-500 bg-violet-50 text-violet-800 dark:bg-violet-500/15 dark:text-violet-200' : 'border-neutral-200 text-neutral-600 dark:border-neutral-700 dark:text-neutral-300'}`}><Icon size={15} />{option.label}</button>; })}</div>
          {type === 'rating' ? <label className="mt-3 block text-sm font-semibold">Votre note<select value={rating} onChange={(event) => setRating(Number(event.target.value))} className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900">{[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} / 5</option>)}</select></label> : <textarea value={message} onChange={(event) => setMessage(event.target.value)} rows="4" placeholder="Décrivez ce que vous avez constaté…" className="mt-3 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-500 dark:border-neutral-700 dark:bg-neutral-900" />}
          <button disabled={saving} type="submit" className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-3 py-2.5 text-sm font-bold text-white disabled:opacity-60">{saving ? <LoaderCircle size={16} className="animate-spin" /> : <MessageSquarePlus size={16} />}Envoyer le retour</button>
        </form>
      ) : <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-full bg-violet-600 px-4 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-violet-700"><MessageSquarePlus size={17} />Retour bêta</button>}
    </div>
  );
}
