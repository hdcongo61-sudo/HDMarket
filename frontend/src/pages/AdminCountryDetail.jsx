import React, { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, Plus, Save, ShieldCheck, Trash2, TriangleAlert } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import api from '../services/api';

const TABS = ['Overview', 'Locations', 'Currency', 'Languages', 'Payments', 'Delivery', 'Fees', 'Features', 'Boosts', 'Ads', 'Users/Testers', 'Analytics', 'Advanced'];
const LABELS = { Overview: 'Vue générale', Locations: 'Localisations', Currency: 'Devise', Languages: 'Langues', Payments: 'Paiements', Delivery: 'Livraison', Fees: 'Frais', Features: 'Fonctionnalités', Boosts: 'Boosts', Ads: 'Publicités', 'Users/Testers': 'Utilisateurs / testeurs', Analytics: 'Analytics', Advanced: 'Avancé' };
const stateClass = { ACTIVE: 'bg-emerald-100 text-emerald-700', TEST: 'bg-amber-100 text-amber-700', DRAFT: 'bg-neutral-200 text-neutral-700', DISABLED: 'bg-rose-100 text-rose-700' };

const JsonEditor = ({ title, value, onSave }) => {
  const [text, setText] = useState(() => JSON.stringify(value || {}, null, 2));
  const [error, setError] = useState('');
  useEffect(() => setText(JSON.stringify(value || {}, null, 2)), [value]);
  return <div className="rounded-[24px] border border-[#e8ded3] bg-white p-5"><h3 className="font-black">{title}</h3><textarea value={text} onChange={(e) => setText(e.target.value)} rows={12} className="mt-3 w-full rounded-2xl border border-[#e2d8cd] bg-[#fbf9f6] p-4 font-mono text-xs outline-none focus:border-[#e85d00]" />{error ? <p className="mt-2 text-sm font-bold text-rose-600">{error}</p> : null}<button onClick={() => { try { onSave(JSON.parse(text)); setError(''); } catch { setError('JSON invalide'); } }} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#211b17] px-4 font-bold text-white"><Save size={16} /> Enregistrer</button></div>;
};

export default function AdminCountryDetail() {
  const { id } = useParams();
  const [payload, setPayload] = useState(null);
  const [tab, setTab] = useState('Overview');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [city, setCity] = useState({ name: '', regionName: '' });
  const [payment, setPayment] = useState({ provider: 'PAWAPAY', displayName: 'PawaPay', enabled: true });
  const [testerId, setTesterId] = useState('');
  const [analytics, setAnalytics] = useState(null);

  const load = async () => {
    setLoading(true);
    try { const { data } = await api.get(`/admin/countries/${id}`, { skipCache: true }); setPayload(data); setError(''); }
    catch (requestError) { setError(requestError?.response?.data?.message || 'Pays introuvable.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [id]);
  useEffect(() => { if (tab === 'Analytics' && !analytics) api.get(`/admin/countries/${id}/analytics`).then(({ data }) => setAnalytics(data)).catch(() => {}); }, [analytics, id, tab]);
  const country = payload?.item;
  const config = payload?.config || {};
  const readiness = payload?.readiness || { score: 0, checks: {} };

  const updateCountry = async (changes) => {
    setSaving(true); setMessage(''); setError('');
    try { await api.patch(`/admin/countries/${id}`, changes); await load(); setMessage('Configuration enregistrée.'); }
    catch (requestError) { setError(requestError?.response?.data?.message || 'Mise à jour impossible.'); if (requestError?.response?.data?.readiness) setPayload((current) => ({ ...current, readiness: requestError.response.data.readiness })); }
    finally { setSaving(false); }
  };
  const updateConfig = async (section, value) => {
    setSaving(true); setError('');
    try { await api.patch(`/admin/countries/${id}/config`, { [section]: value }); await load(); setMessage(`${LABELS[tab]} enregistré.`); }
    catch (requestError) { setError(requestError?.response?.data?.message || 'Enregistrement impossible.'); }
    finally { setSaving(false); }
  };
  const addCity = async () => {
    if (!city.name.trim()) return;
    await api.post('/admin/cities', { countryId: id, name: city.name, regionName: city.regionName, isActive: true, isDefault: !(payload?.cities || []).length });
    setCity({ name: '', regionName: '' }); await load();
  };
  const savePayment = async () => {
    await api.put(`/admin/countries/${id}/payments`, { ...payment, type: 'MOBILE_MONEY', currencies: [country.currency.code] }); await load();
  };
  const addTester = async () => { if (!testerId.trim()) return; await api.post(`/admin/countries/${id}/testers`, { userId: testerId.trim() }); setTesterId(''); await load(); };

  if (loading && !payload) return <div className="mx-auto max-w-7xl p-6"><div className="h-72 animate-pulse rounded-[28px] bg-neutral-100" /></div>;
  if (!country) return <div className="mx-auto max-w-3xl p-6"><p className="rounded-2xl bg-rose-50 p-5 font-bold text-rose-700">{error || 'Pays introuvable.'}</p></div>;

  return <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
    <Link to="/admin/countries" className="inline-flex items-center gap-2 text-sm font-bold text-[#776e65]"><ArrowLeft size={16} /> Tous les pays</Link>
    <section className="mt-4 rounded-[28px] bg-[#211b17] p-5 text-white sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="flex items-center gap-4">
          <span className="text-5xl">{country.flagEmoji}</span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-black">{country.name}</h1>
              <span className={`rounded-full px-3 py-1 text-xs font-black ${stateClass[country.status]}`}>{country.status}</span>
            </div>
            <p className="mt-1 text-sm text-white/60">{country.officialName} · {country.code} / {country.iso3}</p>
          </div>
        </div>
        <div className="min-w-52">
          <div className="flex justify-between text-xs font-bold"><span>Launch readiness</span><span>{readiness.score}%</span></div>
          <div className="mt-2 h-2 rounded-full bg-white/15"><div className="h-full rounded-full bg-[#ff6b00]" style={{ width: `${readiness.score}%` }} /></div>
        </div>
      </div>
    </section>
    <div className="mt-4 flex gap-2 overflow-x-auto pb-2">{TABS.map((item) => <button key={item} onClick={() => setTab(item)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ${tab === item ? 'bg-[#e85d00] text-white' : 'border border-[#e5dcd2] bg-white text-[#62594f]'}`}>{LABELS[item]}</button>)}</div>
    {message ? <p className="mt-3 rounded-2xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{message}</p> : null}{error ? <p className="mt-3 rounded-2xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</p> : null}
    <div className="mt-5">
      {tab === 'Overview' ? <div className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]"><section className="rounded-[24px] border border-[#e8ded3] bg-white p-5"><h2 className="text-xl font-black">État du lancement</h2><div className="mt-4 grid gap-2 sm:grid-cols-2">{Object.entries(readiness.checks || {}).map(([key, ok]) => <div key={key} className="flex items-center gap-3 rounded-2xl bg-[#faf7f3] p-3">{ok ? <CheckCircle2 className="text-emerald-600" size={18} /> : <TriangleAlert className="text-amber-600" size={18} />}<span className="font-bold capitalize">{key}</span></div>)}</div></section><section className="rounded-[24px] border border-[#e8ded3] bg-white p-5"><h2 className="text-xl font-black">Cycle de vie</h2><div className="mt-4 grid gap-2">{['DRAFT', 'TEST', 'ACTIVE', 'DISABLED'].map((status) => <button disabled={saving || status === country.status} key={status} onClick={() => updateCountry({ status })} className={`min-h-11 rounded-xl border px-4 text-left font-black ${status === country.status ? 'border-[#e85d00] bg-[#fff1e6] text-[#c84d00]' : 'border-[#e6ded5]'}`}>{status}</button>)}</div>{!readiness.canActivate ? <p className="mt-3 text-xs leading-5 text-[#8a7e72]">ACTIVE reste bloqué jusqu’à ce que les informations, une ville, un paiement et la livraison soient prêts.</p> : null}</section></div> : null}
      {tab === 'Locations' ? <div className="grid gap-5 lg:grid-cols-[.8fr_1.2fr]"><section className="rounded-[24px] border border-[#e8ded3] bg-white p-5"><h2 className="font-black">Ajouter une ville</h2><input placeholder="Nom de la ville" value={city.name} onChange={(e) => setCity((v) => ({ ...v, name: e.target.value }))} className="mt-4 min-h-12 w-full rounded-2xl border border-[#e2d8cd] px-4" /><input placeholder="Région / province" value={city.regionName} onChange={(e) => setCity((v) => ({ ...v, regionName: e.target.value }))} className="mt-3 min-h-12 w-full rounded-2xl border border-[#e2d8cd] px-4" /><button onClick={addCity} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#e85d00] px-4 font-bold text-white"><Plus size={16} /> Ajouter</button></section><section className="overflow-hidden rounded-[24px] border border-[#e8ded3] bg-white">{(payload.cities || []).map((item) => <div key={item._id} className="flex items-center justify-between border-b border-[#eee7df] p-4 last:border-0"><div><b>{item.name}</b><p className="text-xs text-[#897f75]">{item.regionName || 'Région non précisée'}</p></div><span className="text-xs font-bold text-emerald-600">{item.isActive ? 'ACTIVE' : 'INACTIVE'}</span></div>)}</section></div> : null}
      {tab === 'Currency' ? <section className="max-w-xl rounded-[24px] border border-[#e8ded3] bg-white p-5"><h2 className="text-xl font-black">Devise principale</h2><div className="mt-4 grid gap-3 sm:grid-cols-2"><input value={country.currency.code} onChange={(e) => setPayload((p) => ({ ...p, item: { ...p.item, currency: { ...p.item.currency, code: e.target.value } } }))} className="min-h-12 rounded-2xl border border-[#e2d8cd] px-4" /><input value={country.currency.symbol} onChange={(e) => setPayload((p) => ({ ...p, item: { ...p.item, currency: { ...p.item.currency, symbol: e.target.value } } }))} className="min-h-12 rounded-2xl border border-[#e2d8cd] px-4" /><input value={country.currency.name} onChange={(e) => setPayload((p) => ({ ...p, item: { ...p.item, currency: { ...p.item.currency, name: e.target.value } } }))} className="min-h-12 rounded-2xl border border-[#e2d8cd] px-4" /><input type="number" value={country.currency.decimals} onChange={(e) => setPayload((p) => ({ ...p, item: { ...p.item, currency: { ...p.item.currency, decimals: Number(e.target.value) } } }))} className="min-h-12 rounded-2xl border border-[#e2d8cd] px-4" /></div><button onClick={() => updateCountry({ currency: country.currency, supportedCurrencies: country.supportedCurrencies })} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#211b17] px-4 font-bold text-white"><Save size={16} /> Enregistrer</button></section> : null}
      {tab === 'Languages' ? <JsonEditor title="Langues du pays" value={{ defaultLanguage: country.defaultLanguage, supportedLanguages: country.supportedLanguages }} onSave={(value) => updateCountry(value)} /> : null}
      {tab === 'Payments' ? <div className="grid gap-5 lg:grid-cols-[.8fr_1.2fr]"><section className="rounded-[24px] border border-[#e8ded3] bg-white p-5"><h2 className="font-black">Ajouter / mettre à jour</h2><input value={payment.provider} onChange={(e) => setPayment((v) => ({ ...v, provider: e.target.value }))} placeholder="PAWAPAY" className="mt-4 min-h-12 w-full rounded-2xl border border-[#e2d8cd] px-4" /><input value={payment.displayName} onChange={(e) => setPayment((v) => ({ ...v, displayName: e.target.value }))} placeholder="Nom affiché" className="mt-3 min-h-12 w-full rounded-2xl border border-[#e2d8cd] px-4" /><label className="mt-3 flex items-center justify-between rounded-xl bg-[#faf7f3] p-3 font-bold">Activé<input type="checkbox" checked={payment.enabled} onChange={(e) => setPayment((v) => ({ ...v, enabled: e.target.checked }))} /></label><button onClick={savePayment} className="mt-3 min-h-11 rounded-xl bg-[#e85d00] px-4 font-bold text-white">Enregistrer</button></section><section className="overflow-hidden rounded-[24px] border border-[#e8ded3] bg-white">{(payload.paymentMethods || []).map((item) => <div key={item._id} className="flex items-center justify-between border-b border-[#eee7df] p-4"><div><b>{item.displayName}</b><p className="text-xs text-[#887e74]">{item.provider} · {(item.currencies || []).join(', ')}</p></div><span className={`rounded-full px-2 py-1 text-xs font-black ${item.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-100'}`}>{item.enabled ? 'ON' : 'OFF'}</span></div>)}</section></div> : null}
      {tab === 'Delivery' ? <JsonEditor title="Configuration livraison" value={config.delivery || country.settings?.delivery} onSave={(value) => updateConfig('delivery', value)} /> : null}
      {tab === 'Fees' ? <JsonEditor title="Frais et commissions" value={config.fees} onSave={(value) => updateConfig('fees', value)} /> : null}
      {tab === 'Features' ? <JsonEditor title="Fonctionnalités du pays" value={config.features || country.featureOverrides} onSave={(value) => { updateConfig('features', value); updateCountry({ featureOverrides: value }); }} /> : null}
      {tab === 'Boosts' ? <JsonEditor title="Tarification des boosts" value={config.boosts} onSave={(value) => updateConfig('boosts', value)} /> : null}
      {tab === 'Ads' ? <JsonEditor title="Publicités et placements" value={config.ads} onSave={(value) => updateConfig('ads', value)} /> : null}
      {tab === 'Users/Testers' ? <div className="grid gap-5 lg:grid-cols-[.8fr_1.2fr]"><section className="rounded-[24px] border border-[#e8ded3] bg-white p-5"><h2 className="font-black">Ajouter un testeur</h2><input value={testerId} onChange={(e) => setTesterId(e.target.value)} placeholder="ObjectId utilisateur" className="mt-4 min-h-12 w-full rounded-2xl border border-[#e2d8cd] px-4" /><button onClick={addTester} className="mt-3 min-h-11 rounded-xl bg-[#e85d00] px-4 font-bold text-white">Ajouter</button></section><section className="rounded-[24px] border border-[#e8ded3] bg-white p-5"><h2 className="font-black">Accès TEST</h2><div className="mt-3 space-y-2">{(country.testerUserIds || []).map((userId) => <div key={userId} className="flex items-center justify-between rounded-xl bg-[#faf7f3] p-3"><code className="text-xs">{userId}</code><button onClick={async () => { await api.delete(`/admin/countries/${id}/testers/${userId}`); await load(); }} className="text-rose-600"><Trash2 size={16} /></button></div>)}</div></section></div> : null}
      {tab === 'Analytics' ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{Object.entries(analytics || {}).filter(([, value]) => typeof value === 'number').map(([key, value]) => <div key={key} className="rounded-[22px] border border-[#e8ded3] bg-white p-5"><p className="text-xs font-black uppercase text-[#8b8177]">{key}</p><p className="mt-2 text-2xl font-black">{Number(value).toLocaleString('fr-FR')}</p></div>)}</div> : null}
      {tab === 'Advanced' ? <div className="grid gap-5 lg:grid-cols-2"><JsonEditor title="Paramètres avancés" value={country.settings} onSave={(value) => updateCountry({ settings: value })} /><section className="rounded-[24px] border border-rose-200 bg-rose-50 p-5"><div className="flex items-center gap-2 font-black text-rose-800"><ShieldCheck size={19} /> Zone sensible</div><p className="mt-3 text-sm leading-6 text-rose-700">Les pays utilisés ne sont jamais supprimés : désactivez-les pour préserver commandes, paiements et historiques.</p><button onClick={() => updateCountry({ status: 'DISABLED' })} className="mt-4 min-h-11 rounded-xl bg-rose-700 px-4 font-bold text-white">Désactiver le pays</button></section></div> : null}
    </div>
  </div>;
}
