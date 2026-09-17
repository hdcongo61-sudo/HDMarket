import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
export default function AdminImageEdits() {
  const [jobs, setJobs] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState('');
  async function refresh() {
    try { const { data } = await api.get('/image-studio/paid/admin/jobs', { skipCache: true }); setJobs(data.jobs || []); setError(''); }
    catch { setError('Impossible de charger les retouches.'); }
  }
  useEffect(() => { refresh(); }, []);
  async function recover(id) {
    setBusy(true);
    try { await api.post(`/image-studio/paid/admin/jobs/${id}/recover`); setConfirm(''); await refresh(); }
    catch (e) { setError(e.response?.data?.message || 'Reprise impossible.'); }
    finally { setBusy(false); }
  }
  return <main className="space-y-5 p-6"><h1 className="text-2xl font-bold">Retouches IA payantes</h1><p className="text-sm">100 dernières demandes du marché autorisé. Vérifiez le paiement et le traitement avant d’autoriser une reprise : elle peut entraîner de nouveaux frais OpenAI.</p><Link to="/admin/system-settings?tab=runtime" className="inline-block font-bold text-orange-700">Configurer les prix et l’activation →</Link><p className="text-sm">Dans Configuration, recherchez « image_edit » : activation et prix par photo pour chaque modification, en FCFA (XAF). Les demandes déjà préparées conservent leur tarif.</p><button type="button" onClick={refresh} className="rounded-lg border px-4 py-2">Actualiser</button>{error && <p role="alert" className="text-red-700">{error}</p>}<div className="space-y-3">{jobs.map(job => <article key={job.id} className="space-y-2 rounded-xl border p-4"><p className="font-semibold">{job.operation} · {job.amount} FCFA · {job.state}</p><p className="break-all text-xs">Référence {job.id} · Paiement {job.paymentStatus || 'Non démarré'} · {job.attempts} tentative(s)</p><p>{job.prompt}</p>{job.error && <p>{job.error}</p>}{job.resultUrl && <a className="text-orange-700 underline" href={job.resultUrl} target="_blank" rel="noopener noreferrer">Voir le résultat</a>}{job.paid && ['FAILED', 'PROCESSING'].includes(job.state) && <div>{confirm === job.id ? <div className="flex flex-wrap gap-3"><span>Autoriser 3 nouvelles tentatives sans refacturer le vendeur ?</span><button type="button" disabled={busy} onClick={() => recover(job.id)} className="rounded-lg border px-3 py-2">Confirmer la reprise</button><button type="button" onClick={() => setConfirm('')}>Annuler</button></div> : <button type="button" onClick={() => setConfirm(job.id)} className="rounded-lg border px-3 py-2">Autoriser une reprise</button>}</div>}</article>)}</div></main>;
}
