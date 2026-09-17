import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { aiButton, aiInput } from './AiPanel';
const amountText = (amount, currency) => `${Number(amount || 0).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} ${currency === 'UNKNOWN' ? '(devise inconnue)' : currency}`;
const channels = { listing: 'Validation annonces', listing_adjustment: 'Compléments annonces', boost: 'Boosts', shop: 'Conversions boutique', notification: 'Campagnes', ai: 'Photos et packs IA' };
export default function FounderFinance() {
  const [data, setData] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), [saved, setSaved] = useState(false);
  const initial = () => ({ reference: crypto.randomUUID(), category: 'provider_ai', amount: '', currency: 'USD', note: '', incurredAt: new Date().toISOString().slice(0, 10) });
  const [expense, setExpense] = useState(initial);
  const load = useCallback(async () => {
    try { const response = await api.get('/commerce-ai/founder/finance', { skipCache: true }); setData(response.data); setError(''); }
    catch (e) { setError(e.response?.data?.message || 'Impossible de charger les finances.'); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const save = async () => {
    if (busy) return; setBusy(true); setError(''); setSaved(false);
    try { await api.post('/commerce-ai/founder/expenses', { ...expense, amount: Number(expense.amount) }); setExpense(initial()); setSaved(true); await load(); }
    catch (e) { setError(e.response?.data?.message || 'La dépense n’a pas pu être enregistrée.'); }
    finally { setBusy(false); }
  };
  return <section id="finance" className="my-4 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-bold">Finances de la plateforme · 30 jours</h2><button type="button" onClick={load} className="min-h-11 rounded-xl border px-3 text-sm">Actualiser les chiffres</button></div>
    <p className="my-2 text-sm text-neutral-500">Les ventes des marchands sont séparées des encaissements HDMarket. Les devises ne sont jamais additionnées entre elles.</p>
    {error && <p role="alert" className="my-2 text-red-700">{error}</p>}
    {!data && !error && <p role="status">Chargement des finances…</p>}
    {data && <>
      <p className="text-xs text-neutral-500">{data.period}</p>
      <div className="my-4 grid gap-3 lg:grid-cols-2">{data.currencies.map(row => <article key={row.currency} className="rounded-xl border p-4"><h3 className="font-semibold">{row.currency === 'UNKNOWN' ? 'À rapprocher · devise inconnue' : row.currency}</h3><dl className="mt-3 space-y-2 text-sm">{[['Encaissements plateforme', row.receipts], ['Remboursements enregistrés dans les paiements', row.recordedRefunds], ['Dépenses saisies', row.recordedExpenses], ['Solde après coûts enregistrés (partiel)', row.balanceAfterRecordedCosts]].map(([label, value]) => <div key={label} className="flex justify-between gap-3"><dt>{label}</dt><dd className="shrink-0 font-semibold">{amountText(value, row.currency)}</dd></div>)}</dl><details className="mt-3 text-xs"><summary className="cursor-pointer">Sources des recettes nettes de remboursements</summary>{Object.entries(row.channels).map(([key, value]) => <p className="mt-1" key={key}>{channels[key] || key} : {amountText(value, row.currency)}</p>)}</details></article>)}</div>
      {!data.currencies.length && <p className="my-3 text-sm">Aucun encaissement plateforme ni coût saisi sur cette période.</p>}
      <div className="rounded-xl bg-neutral-50 p-3 text-sm dark:bg-neutral-800"><h3 className="font-semibold">Volume des commandes marchandes terminées</h3>{data.merchandise.map(row => <p key={row._id}>{amountText(row.amount, row._id)} · {row.orders} commandes</p>)}{!data.merchandise.length && <p>Aucune commande terminée sur cette période.</p>}<p className="mt-1 text-xs text-neutral-500">Ces montants appartiennent aux ventes des marchands, pas aux recettes HDMarket.</p></div>
      <div className="my-4 overflow-x-auto"><table className="w-full text-left text-xs"><caption className="mb-2 text-left font-semibold">Consommation IA enregistrée · estimations distinctes des factures</caption><thead><tr><th className="p-2">Outil</th><th className="p-2">Appels / échecs</th><th className="p-2">Tokens entrants / sortants</th><th className="p-2">Estimation USD</th></tr></thead><tbody>{data.usage.map(row => <tr key={row._id} className="border-t"><td className="p-2">{row._id}</td><td className="p-2">{row.calls} / {row.failed}</td><td className="p-2">{row.inputTokens} / {row.outputTokens}</td><td className="p-2">{Number(row.estimatedUsd).toFixed(4)} USD{row.unpriced > 0 && <span className="block text-amber-700">+ {row.unpriced} appel(s) sans coût connu</span>}</td></tr>)}</tbody></table></div>
      <p className="my-3 text-sm">Recherche shopping IA : {data.searches?.total || 0} recherches, dont {data.searches?.noResults || 0} sans résultat. Les recherches classiques ne sont pas incluses.</p>
      <Link to="/admin/image-edits" className="inline-block py-2 text-sm font-semibold text-orange-700">{data.jobsNeedingReview} traitement(s) photo à vérifier ↗</Link>
      <details className="my-3 rounded-xl border p-3"><summary className="cursor-pointer font-semibold">Enregistrer une dépense réelle</summary><p className="mt-2 text-xs text-neutral-500">Saisissez la facture fournisseur ou les frais réellement payés. Ne ressaisissez pas un remboursement déjà comptabilisé ci-dessus. Conservez une référence unique par facture.</p><div className="mt-3 grid gap-3 sm:grid-cols-2">{[['Référence unique', 'reference', 'text'], ['Montant', 'amount', 'number'], ['Devise ISO (XAF, USD…)', 'currency', 'text'], ['Date de la dépense', 'incurredAt', 'date']].map(([label, key, type]) => <label className="text-sm" key={key}>{label}<input className={aiInput} type={type} value={expense[key]} maxLength={key === 'currency' ? 3 : 100} step={type === 'number' ? '0.01' : undefined} onChange={e => setExpense(prev => ({ ...prev, [key]: key === 'currency' ? e.target.value.toUpperCase() : e.target.value }))} /></label>)}<label className="text-sm">Catégorie<select className={aiInput} value={expense.category} onChange={e => setExpense(prev => ({ ...prev, category: e.target.value }))}>{[['provider_ai', 'Facture IA'], ['payment_fees', 'Frais de paiement'], ['hosting', 'Hébergement'], ['refund', 'Remboursement non comptabilisé'], ['other', 'Autre']].map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label className="text-sm">Note<input className={aiInput} maxLength={300} value={expense.note} onChange={e => setExpense(prev => ({ ...prev, note: e.target.value }))} /></label></div><button type="button" className={`${aiButton} mt-3`} disabled={busy || !(Number(expense.amount) > 0)} onClick={save}>Enregistrer la dépense</button>{saved && <p role="status" className="mt-2 text-sm text-green-700">Dépense enregistrée.</p>}</details>
      {data.recentExpenses.length > 0 && <details className="my-3 text-sm"><summary className="cursor-pointer font-semibold">Dernières dépenses saisies</summary>{data.recentExpenses.map(row => <p className="mt-2 break-words" key={row._id}>{row.reference} · {amountText(row.amount, row.currency)} · {new Date(row.incurredAt).toLocaleDateString('fr-FR')} {row.note && `· ${row.note}`}</p>)}</details>}
      <ul className="ml-4 list-disc space-y-1 text-xs text-neutral-500">{data.limitations.map(line => <li key={line}>{line}</li>)}</ul>
      <Link to="/admin/system-settings?tab=runtime" className="mt-3 inline-block text-sm font-semibold text-orange-700">Configurer activation, quotas, coûts estimés et tarifs IA ↗</Link>
    </>}
  </section>;
}
