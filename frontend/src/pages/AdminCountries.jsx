import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Plus, Rocket, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';

const STEPS = ['Identité', 'Devise & langue', 'Localisation', 'Paiements', 'Livraison', 'Fonctionnalités', 'Testeurs', 'Vérification'];
const initialForm = {
  name: '', officialName: '', code: '', iso3: '', phoneCode: '', flagEmoji: '🌍', timezone: 'UTC',
  defaultLanguage: 'fr', supportedLanguages: 'fr', currencyCode: '', currencySymbol: '', currencyName: '', decimals: 0,
  cityName: '', regionName: '', paymentProvider: 'PAWAPAY', paymentName: 'PawaPay',
  deliveryEnabled: true, deliveryConfigured: false, testerUserIds: '', copyFromCountryId: '',
  featureOverrides: '{}', fees: '{}', boosts: '{}', ads: '{}', legal: '{}'
};

const statusStyles = {
  ACTIVE: 'bg-emerald-100 text-emerald-700', TEST: 'bg-amber-100 text-amber-700',
  DRAFT: 'bg-neutral-200 text-neutral-700', DISABLED: 'bg-rose-100 text-rose-700'
};

const Field = ({ label, ...props }) => (
  <label className="block text-sm font-bold text-[#514940]">
    {label}
    <input {...props} className="mt-2 min-h-12 w-full rounded-2xl border border-[#e2d8cd] bg-white px-4 font-medium text-[#211b16] outline-none focus:border-[#e85d00]" />
  </label>
);

const jsonValue = (value, fallback = {}) => {
  try { return JSON.parse(value || '{}'); } catch { return fallback; }
};

export default function AdminCountries() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [wizard, setWizard] = useState(false);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try { const { data } = await api.get('/admin/countries'); setItems(data?.items || []); }
    catch (requestError) { setError(requestError?.response?.data?.message || 'Chargement impossible.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const canContinue = useMemo(() => {
    if (step === 0) return form.name && /^[A-Za-z]{2}$/.test(form.code) && /^[A-Za-z]{3}$/.test(form.iso3) && /^\+\d{1,4}$/.test(form.phoneCode);
    if (step === 1) return /^[A-Za-z]{3}$/.test(form.currencyCode) && form.currencySymbol && form.defaultLanguage;
    if (step === 2) return Boolean(form.cityName);
    return true;
  }, [form, step]);

  const createCountry = async () => {
    setSaving(true); setError('');
    try {
      const testerUserIds = form.testerUserIds.split(',').map((item) => item.trim()).filter(Boolean);
      const { data } = await api.post('/admin/countries', {
        name: form.name, officialName: form.officialName || form.name, code: form.code.toUpperCase(), iso3: form.iso3.toUpperCase(),
        phoneCode: form.phoneCode, flagEmoji: form.flagEmoji, timezone: form.timezone,
        defaultLanguage: form.defaultLanguage, supportedLanguages: form.supportedLanguages.split(',').map((item) => item.trim()).filter(Boolean),
        currency: { code: form.currencyCode.toUpperCase(), symbol: form.currencySymbol, name: form.currencyName || form.currencyCode.toUpperCase(), decimals: Number(form.decimals || 0) },
        copyFromCountryId: form.copyFromCountryId || undefined,
        testerUserIds,
        featureOverrides: jsonValue(form.featureOverrides)
      });
      const id = data?.item?._id || data?.item?.id;
      await api.post('/admin/cities', { countryId: id, name: form.cityName, regionName: form.regionName, isDefault: true, isActive: true });
      if (form.paymentProvider) {
        await api.put(`/admin/countries/${id}/payments`, {
          provider: form.paymentProvider, displayName: form.paymentName || form.paymentProvider, enabled: true,
          currencies: [form.currencyCode.toUpperCase()], type: 'MOBILE_MONEY'
        });
      }
      await api.patch(`/admin/countries/${id}/config`, {
        delivery: { enabled: form.deliveryEnabled, configured: form.deliveryConfigured },
        fees: jsonValue(form.fees), boosts: jsonValue(form.boosts), ads: jsonValue(form.ads), legal: jsonValue(form.legal),
        features: jsonValue(form.featureOverrides)
      });
      navigate(`/admin/countries/${id}`);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || requestError.message || 'Création impossible.');
    } finally { setSaving(false); }
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-xs font-black uppercase tracking-[.18em] text-[#e85d00]">HDMarket Global</p><h1 className="mt-1 text-3xl font-black text-[#1d1814]">Pays</h1><p className="mt-1 text-sm text-[#80766c]">Ouvrez, testez et pilotez chaque marché sans modifier le core.</p></div>
        <button onClick={() => { setWizard(true); setStep(0); setForm(initialForm); }} className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-[#e85d00] px-5 font-black text-white"><Plus size={18} /> Ajouter un pays</button>
      </div>
      {error ? <p className="mt-4 rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</p> : null}
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {loading ? Array.from({ length: 3 }, (_, i) => <div key={i} className="h-56 animate-pulse rounded-[26px] bg-neutral-100" />) : items.map((item) => (
          <Link key={item._id} to={`/admin/countries/${item._id}`} className="rounded-[26px] border border-[#e8ded3] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-start justify-between"><span className="text-4xl">{item.flagEmoji}</span><span className={`rounded-full px-3 py-1 text-xs font-black ${statusStyles[item.status]}`}>{item.status}</span></div>
            <h2 className="mt-4 text-xl font-black text-[#201b17]">{item.name}</h2><p className="text-sm text-[#82786e]">{item.officialName}</p>
            <div className="mt-5 grid grid-cols-3 gap-2 text-center"><div className="rounded-xl bg-[#f8f5f0] p-2"><b className="block">{item.currency?.code}</b><span className="text-[11px] text-[#8b8178]">Devise</span></div><div className="rounded-xl bg-[#f8f5f0] p-2"><b className="block">{item.phoneCode}</b><span className="text-[11px] text-[#8b8178]">Indicatif</span></div><div className="rounded-xl bg-[#f8f5f0] p-2"><b className="block">{item.readiness?.score || 0}%</b><span className="text-[11px] text-[#8b8178]">Prêt</span></div></div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#eee8e1]"><div className="h-full rounded-full bg-[#e85d00]" style={{ width: `${item.readiness?.score || 0}%` }} /></div>
          </Link>
        ))}
      </div>

      {wizard ? <div className="fixed inset-0 z-[180] flex items-end justify-center bg-black/50 sm:items-center sm:p-6"><section className="max-h-[94dvh] w-full max-w-2xl overflow-y-auto rounded-t-[30px] bg-[#f8f5f0] p-5 sm:rounded-[30px] sm:p-7">
        <div className="flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-widest text-[#e85d00]">Étape {step + 1} sur 8</p><h2 className="mt-1 text-2xl font-black">{STEPS[step]}</h2></div><button onClick={() => setWizard(false)} className="grid h-10 w-10 place-items-center rounded-full bg-white"><X size={18} /></button></div>
        <div className="mt-4 h-1.5 rounded-full bg-[#e7dfd6]"><div className="h-full rounded-full bg-[#e85d00] transition-all" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} /></div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {step === 0 ? <><Field label="Nom" value={form.name} onChange={(e) => update('name', e.target.value)} /><Field label="Nom officiel" value={form.officialName} onChange={(e) => update('officialName', e.target.value)} /><Field label="Code ISO2" maxLength={2} value={form.code} onChange={(e) => update('code', e.target.value)} /><Field label="Code ISO3" maxLength={3} value={form.iso3} onChange={(e) => update('iso3', e.target.value)} /><Field label="Indicatif" placeholder="+243" value={form.phoneCode} onChange={(e) => update('phoneCode', e.target.value)} /><Field label="Drapeau" value={form.flagEmoji} onChange={(e) => update('flagEmoji', e.target.value)} /><Field label="Fuseau horaire" value={form.timezone} onChange={(e) => update('timezone', e.target.value)} /><label className="text-sm font-bold">Copier depuis<select value={form.copyFromCountryId} onChange={(e) => update('copyFromCountryId', e.target.value)} className="mt-2 min-h-12 w-full rounded-2xl border border-[#e2d8cd] bg-white px-4"><option value="">Aucune configuration</option>{items.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</select></label></> : null}
          {step === 1 ? <><Field label="Devise ISO" value={form.currencyCode} onChange={(e) => update('currencyCode', e.target.value)} /><Field label="Symbole" value={form.currencySymbol} onChange={(e) => update('currencySymbol', e.target.value)} /><Field label="Nom de la devise" value={form.currencyName} onChange={(e) => update('currencyName', e.target.value)} /><Field label="Décimales" type="number" min="0" max="8" value={form.decimals} onChange={(e) => update('decimals', e.target.value)} /><Field label="Langue par défaut" value={form.defaultLanguage} onChange={(e) => update('defaultLanguage', e.target.value)} /><Field label="Langues (séparées par virgule)" value={form.supportedLanguages} onChange={(e) => update('supportedLanguages', e.target.value)} /></> : null}
          {step === 2 ? <><Field label="Première ville" value={form.cityName} onChange={(e) => update('cityName', e.target.value)} /><Field label="Région / province" value={form.regionName} onChange={(e) => update('regionName', e.target.value)} /></> : null}
          {step === 3 ? <><Field label="Provider" value={form.paymentProvider} onChange={(e) => update('paymentProvider', e.target.value)} /><Field label="Nom affiché" value={form.paymentName} onChange={(e) => update('paymentName', e.target.value)} /><p className="sm:col-span-2 rounded-2xl bg-amber-50 p-4 text-sm text-amber-800">Les identifiants et secrets ne sont jamais copiés ni saisis dans cette interface. Configurez la référence secrète côté serveur.</p></> : null}
          {step === 4 ? <div className="sm:col-span-2 space-y-3"><label className="flex items-center justify-between rounded-2xl bg-white p-4 font-bold">Livraison disponible<input type="checkbox" checked={form.deliveryEnabled} onChange={(e) => update('deliveryEnabled', e.target.checked)} /></label><label className="flex items-center justify-between rounded-2xl bg-white p-4 font-bold">Règles de livraison configurées<input type="checkbox" checked={form.deliveryConfigured} onChange={(e) => update('deliveryConfigured', e.target.checked)} /></label></div> : null}
          {step === 5 ? <><Field label="Features JSON" value={form.featureOverrides} onChange={(e) => update('featureOverrides', e.target.value)} /><Field label="Frais JSON" value={form.fees} onChange={(e) => update('fees', e.target.value)} /><Field label="Boosts JSON" value={form.boosts} onChange={(e) => update('boosts', e.target.value)} /><Field label="Publicités JSON" value={form.ads} onChange={(e) => update('ads', e.target.value)} /><Field label="Legal JSON" value={form.legal} onChange={(e) => update('legal', e.target.value)} /></> : null}
          {step === 6 ? <div className="sm:col-span-2"><Field label="IDs utilisateurs test (séparés par virgule)" value={form.testerUserIds} onChange={(e) => update('testerUserIds', e.target.value)} /><p className="mt-3 text-sm text-[#81776d]">En mode TEST, seuls les admins, beta testeurs et utilisateurs ajoutés ici pourront voir ce pays.</p></div> : null}
          {step === 7 ? <div className="sm:col-span-2 rounded-[24px] bg-white p-5"><div className="flex items-center gap-3"><span className="text-4xl">{form.flagEmoji}</span><div><h3 className="text-xl font-black">{form.name}</h3><p className="text-sm text-[#80766c]">{form.code.toUpperCase()} · {form.currencyCode.toUpperCase()} · {form.phoneCode}</p></div></div><ul className="mt-5 space-y-2 text-sm font-bold">{['Identité renseignée', `Ville : ${form.cityName}`, `Paiement : ${form.paymentName}`, `Livraison : ${form.deliveryConfigured ? 'configurée' : 'à compléter'}`, 'Création initiale en DRAFT'].map((text) => <li key={text} className="flex items-center gap-2"><Check size={16} className="text-emerald-600" />{text}</li>)}</ul></div> : null}
        </div>
        {error ? <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</p> : null}
        <div className="mt-7 flex justify-between gap-3"><button disabled={step === 0 || saving} onClick={() => setStep((value) => value - 1)} className="inline-flex min-h-12 items-center gap-2 rounded-2xl border border-[#ded5cc] bg-white px-5 font-bold disabled:opacity-40"><ArrowLeft size={17} /> Retour</button>{step < 7 ? <button disabled={!canContinue} onClick={() => setStep((value) => value + 1)} className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-[#1e1915] px-5 font-black text-white disabled:opacity-40">Continuer <ArrowRight size={17} /></button> : <button disabled={saving} onClick={createCountry} className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-[#e85d00] px-5 font-black text-white"><Rocket size={17} /> {saving ? 'Création…' : 'Créer le pays'}</button>}</div>
      </section></div> : null}
    </div>
  );
}
