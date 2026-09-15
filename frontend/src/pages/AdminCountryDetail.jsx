import React, { useContext, useEffect, useState } from 'react';
import { AdjustmentsHorizontalIcon, ArrowLeftIcon, BookOpenIcon, CheckCircleIcon, CheckIcon, ExclamationTriangleIcon, PlusIcon, ShieldCheckIcon, TrashIcon } from '@heroicons/react/24/outline';
import { Link, useParams } from 'react-router-dom';
import api from '../services/api';
import AuthContext from '../context/AuthContext';

const TABS = ['Guide', 'Overview', 'Locations', 'Currency', 'Languages', 'Payments', 'Delivery', 'Fees', 'Features', 'Boosts', 'Ads', 'Users/Testers', 'Analytics', 'Commerce', 'Operations', 'System', 'Advanced'];
const LABELS = { Guide: 'Guide', Overview: 'Vue générale', Locations: 'Localisations', Currency: 'Devise', Languages: 'Langues', Payments: 'Paiements', Delivery: 'Livraison', Fees: 'Frais', Features: 'Fonctionnalités', Boosts: 'Boosts', Ads: 'Publicités', 'Users/Testers': 'Utilisateurs / testeurs', Analytics: 'Analytics', Commerce: 'Commerce', Operations: 'Opérations', System: 'Système', Advanced: 'Avancé' };
const stateClass = { ACTIVE: 'bg-emerald-100 text-emerald-700', TEST: 'bg-amber-100 text-amber-700', DRAFT: 'bg-neutral-200 text-neutral-700', DISABLED: 'bg-rose-100 text-rose-700' };

const FIELD_KINDS = [
  { key: 'text', label: 'Texte' },
  { key: 'number', label: 'Nombre' },
  { key: 'boolean', label: 'Oui / Non' }
];

const coerceRowValue = (value) => {
  if (typeof value === 'boolean') return { kind: 'boolean', text: value ? 'true' : 'false' };
  if (typeof value === 'number') return { kind: 'number', text: String(value) };
  return { kind: 'text', text: value && typeof value === 'object' ? JSON.stringify(value) : String(value ?? '') };
};

let fieldRowSeq = 0;
const nextFieldRowId = () => `field-${Date.now()}-${fieldRowSeq++}`;

const FieldsEditor = ({ title, value, onSave }) => {
  const buildRows = (source) =>
    Object.entries(source || {}).map(([key, val]) => ({ id: nextFieldRowId(), key, ...coerceRowValue(val) }));
  const [rows, setRows] = useState(() => buildRows(value));
  const serialized = JSON.stringify(value || {});

  useEffect(() => {
    setRows(buildRows(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serialized]);

  const patchRow = (id, patch) =>
    setRows((prev) => prev.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)));

  const save = () => {
    const next = {};
    rows.forEach((row) => {
      const key = String(row.key || '').trim();
      if (!key) return;
      if (row.kind === 'boolean') next[key] = String(row.text) === 'true';
      else if (row.kind === 'number') {
        const parsed = Number(row.text);
        if (Number.isFinite(parsed)) next[key] = parsed;
      } else next[key] = String(row.text ?? '');
    });
    onSave(next);
  };

  return (
    <div className="rounded-[24px] border border-[#e8ded3] bg-white p-5">
      <h3 className="font-black">{title}</h3>
      <div className="mt-4 space-y-2">
        {rows.length === 0 ? <p className="text-sm font-semibold text-[#b2a89d]">Aucun champ pour le moment.</p> : null}
        {rows.map((row) => (
          <div key={row.id} className="grid items-center gap-2 sm:grid-cols-[1fr_120px_1fr_40px]">
            <input
              value={row.key}
              onChange={(e) => patchRow(row.id, { key: e.target.value })}
              placeholder="Clé"
              className="min-h-11 w-full rounded-xl border border-[#e2d8cd] bg-white px-3 outline-none focus:border-[#e85d00]"
            />
            <select
              value={row.kind}
              onChange={(e) => patchRow(row.id, { kind: e.target.value })}
              className="min-h-11 w-full rounded-xl border border-[#e2d8cd] bg-white px-2 outline-none focus:border-[#e85d00]"
            >
              {FIELD_KINDS.map((kind) => <option key={kind.key} value={kind.key}>{kind.label}</option>)}
            </select>
            {row.kind === 'boolean' ? (
              <select
                value={row.text === 'true' ? 'true' : 'false'}
                onChange={(e) => patchRow(row.id, { text: e.target.value })}
                className="min-h-11 w-full rounded-xl border border-[#e2d8cd] bg-white px-2 outline-none focus:border-[#e85d00]"
              >
                <option value="true">Oui</option>
                <option value="false">Non</option>
              </select>
            ) : (
              <input
                value={row.text}
                onChange={(e) => patchRow(row.id, { text: e.target.value })}
                placeholder={row.kind === 'number' ? '0' : 'Valeur'}
                type={row.kind === 'number' ? 'number' : 'text'}
                className="min-h-11 w-full rounded-xl border border-[#e2d8cd] bg-white px-3 outline-none focus:border-[#e85d00]"
              />
            )}
            <button
              type="button"
              onClick={() => setRows((prev) => prev.filter((entry) => entry.id !== row.id))}
              aria-label="Retirer le champ"
              className="grid h-10 w-10 place-items-center rounded-xl text-rose-600 transition hover:bg-rose-50"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#f0e9e0] pt-4">
        <button
          type="button"
          onClick={() => setRows((prev) => [...prev, { id: nextFieldRowId(), key: '', kind: 'text', text: '' }])}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#e2d8cd] bg-white px-3 font-bold text-[#62594f] transition hover:border-[#e85d00]"
        >
          <PlusIcon className="h-4 w-4" /> Ajouter un champ
        </button>
        <button
          type="button"
          onClick={save}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#211b17] px-4 font-bold text-white"
        >
          <CheckIcon className="h-4 w-4" /> Enregistrer
        </button>
      </div>
    </div>
  );
};

export default function AdminCountryDetail() {
  const { id } = useParams();
  const { user } = useContext(AuthContext);
  const isScoped = user?.role === 'admin' && Array.isArray(user?.adminCountryIds) && user.adminCountryIds.length > 0;
  const visibleTabs = isScoped ? TABS.filter((tabKey) => tabKey !== 'Advanced') : TABS;
  const [payload, setPayload] = useState(null);
  const [tab, setTab] = useState('Overview');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [city, setCity] = useState({ name: '', regionName: '' });
  const [commune, setCommune] = useState({ name: '', cityId: '' });
  const [payment, setPayment] = useState({ provider: 'PAWAPAY', displayName: 'PawaPay', enabled: true });
  const [testerId, setTesterId] = useState('');
  const [analytics, setAnalytics] = useState(null);
  const [commerce, setCommerce] = useState(null);
  const [operations, setOperations] = useState(null);
  const [countryAdmins, setCountryAdmins] = useState(null);
  const [adminUserId, setAdminUserId] = useState('');

  const load = async () => {
    setLoading(true);
    try { const { data } = await api.get(`/admin/countries/${id}`, { skipCache: true }); setPayload(data); setError(''); }
    catch (requestError) { setError(requestError?.response?.data?.message || 'Pays introuvable.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [id]);
  useEffect(() => { if (tab === 'Analytics' && !analytics) api.get(`/admin/countries/${id}/analytics`).then(({ data }) => setAnalytics(data)).catch(() => {}); }, [analytics, id, tab]);
  useEffect(() => { if (tab === 'Commerce' && !commerce) api.get(`/admin/countries/${id}/commerce`).then(({ data }) => setCommerce(data)).catch(() => {}); }, [commerce, id, tab]);
  useEffect(() => { if (tab === 'Operations' && !operations) api.get(`/admin/countries/${id}/operations`).then(({ data }) => setOperations(data)).catch(() => {}); }, [operations, id, tab]);
  useEffect(() => { if (tab === 'Users/Testers' && !countryAdmins) api.get(`/admin/countries/${id}/admins`).then(({ data }) => setCountryAdmins(Array.isArray(data?.admins) ? data.admins : [])).catch(() => {}); }, [countryAdmins, id, tab]);
  const country = payload?.item;
  const config = payload?.config || {};
  const readiness = payload?.readiness || { score: 0, checks: {} };
  const deliveryValue = config.delivery || country?.settings?.delivery || {};

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
  const addCommune = async () => {
    if (!commune.name.trim() || !commune.cityId) return;
    try {
      await api.post('/admin/communes', { cityId: commune.cityId, name: commune.name.trim(), isActive: true });
      setCommune({ name: '', cityId: '' }); await load();
    } catch (requestError) { setError(requestError?.response?.data?.message || 'Ajout de la commune impossible.'); }
  };
  const savePayment = async () => {
    await api.put(`/admin/countries/${id}/payments`, { ...payment, type: 'MOBILE_MONEY', currencies: [country.currency.code] }); await load();
  };
  const addTester = async () => { if (!testerId.trim()) return; await api.post(`/admin/countries/${id}/testers`, { userId: testerId.trim() }); setTesterId(''); await load(); };

  const addAdminUser = async () => {
    if (!adminUserId.trim()) return;
    setSaving(true); setError('');
    try {
      await api.post(`/admin/countries/${id}/admins`, { userId: adminUserId.trim() });
      setAdminUserId(''); setCountryAdmins(null); setMessage('Admin ajouté au pays.');
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Ajout impossible.');
    } finally { setSaving(false); }
  };

  const removeAdminUser = async (userId) => {
    setSaving(true); setError('');
    try {
      await api.delete(`/admin/countries/${id}/admins/${userId}`);
      setCountryAdmins(null); setMessage('Admin retiré de ce pays.');
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Retrait impossible.');
    } finally { setSaving(false); }
  };

  if (loading && !payload) return <div className="mx-auto max-w-7xl p-6"><div className="h-72 animate-pulse rounded-[28px] bg-neutral-100" /></div>;
  if (!country) return <div className="mx-auto max-w-3xl p-6"><p className="rounded-2xl bg-rose-50 p-5 font-bold text-rose-700">{error || 'Pays introuvable.'}</p></div>;

  return <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <Link to="/admin/countries" className="inline-flex items-center gap-2 text-sm font-bold text-[#776e65]"><ArrowLeftIcon className="h-4 w-4" /> Tous les pays</Link>
      <Link to={`/admin/system-settings?countryId=${id}`} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#e2d8cd] bg-white px-4 text-sm font-black text-[#514940] transition hover:border-[#e85d00]"><AdjustmentsHorizontalIcon className="h-4 w-4 text-[#e85d00]" /> Paramètres du pays</Link>
    </div>
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
    <div className="mt-4 flex gap-2 overflow-x-auto pb-2">{visibleTabs.map((item) => <button key={item} onClick={() => setTab(item)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ${tab === item ? 'bg-[#e85d00] text-white' : 'border border-[#e5dcd2] bg-white text-[#62594f]'}`}>{LABELS[item]}</button>)}</div>
    {message ? <p className="mt-3 rounded-2xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{message}</p> : null}{error ? <p className="mt-3 rounded-2xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</p> : null}
    <div className="mt-5">
      {tab === 'Guide' ? <div className="rounded-[24px] border border-[#f0d9c6] bg-[#fffaf5] p-5 sm:p-6"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-[#e85d00] ring-1 ring-[#f0d9c6]"><BookOpenIcon className="h-5 w-5" /></span><div><h2 className="text-lg font-black text-[#211b16]">Mode d’emploi de la fiche pays</h2><p className="text-sm font-semibold text-[#8a7263]">Chaque onglet correspond à un pilier du lancement d’un marché.</p></div></div><div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{[{ tab: 'Overview', title: 'Vue générale', text: 'Le score de readiness et la liste des exigences manquantes. Activez le pays uniquement quand tout est vert.' }, { tab: 'Locations', title: 'Localisations', text: 'Ajoutez les villes, puis les communes rattachées à chaque ville. Le pays a besoin d’au moins une ville active.' }, { tab: 'Currency', title: 'Devise', text: 'Monnaie principale (code, symbole, décimales) et devises secondaires acceptées.' }, { tab: 'Languages', title: 'Langues', text: 'La langue par défaut du marché et la liste des langues prises en charge.' }, { tab: 'Payments', title: 'Paiements', text: 'Ajoutez ou activez un moyen de paiement (ex. PawaPay). Sans paiement actif, impossible d’activer le pays.' }, { tab: 'Delivery', title: 'Livraison', text: 'Activez la livraison et complétez les paramètres (zones, tarifs, types de livraison).' }, { tab: 'Fees', title: 'Frais & fonctionnalités', text: 'Frais, fonctionnalités, boosts et publicités se règlent ici sous forme de champs clé-valeur — sans JSON à écrire à la main.' }, { tab: 'Users/Testers', title: 'Utilisateurs / testeurs', text: 'Testeurs du mode TEST et admins du pays : chaque marché gère ses propres admins et ses données.' }, { tab: 'Analytics', title: 'Analytics', text: 'Chiffres clés du marché : utilisateurs, produits, commandes et volume.' }, { tab: 'Commerce', title: 'Commerce', text: 'Commandes, produits, paiements et boosts propres à ce pays.' }, { tab: 'Operations', title: 'Opérations', text: 'Utilisateurs, boutiques, livreurs et demandes de livraison du pays.' }, { tab: 'System', title: 'Système', text: 'Identité, préparation au lancement et liens vers les paramètres du pays.' }, { tab: 'Advanced', title: 'Avancé', text: 'Paramètres techniques et réglages sensibles du pays.' }].map((entry) => <div key={entry.tab} className="rounded-2xl bg-white p-4 ring-1 ring-[#f0e9e0]"><button onClick={() => setTab(entry.tab)} className="text-sm font-black text-[#e85d00]">{LABELS[entry.tab]}</button><p className="mt-1 text-sm font-black text-[#211b16]">{entry.title}</p><p className="mt-1 text-xs leading-5 text-[#8a7263]">{entry.text}</p></div>)}</div></div> : null}
      {tab === 'Overview' ? <div className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]"><section className="rounded-[24px] border border-[#e8ded3] bg-white p-5"><h2 className="text-xl font-black">État du lancement</h2><div className="mt-4 grid gap-2 sm:grid-cols-2">{Object.entries(readiness.checks || {}).map(([key, ok]) => <div key={key} className="flex items-center gap-3 rounded-2xl bg-[#faf7f3] p-3">{ok ? <CheckCircleIcon className="text-emerald-600 h-[18px] w-[18px]" /> : <ExclamationTriangleIcon className="text-amber-600 h-[18px] w-[18px]" />}<span className="font-bold capitalize">{key}</span></div>)}</div></section><section className="rounded-[24px] border border-[#e8ded3] bg-white p-5"><h2 className="text-xl font-black">Cycle de vie</h2>{isScoped ? <><div className="mt-4 grid gap-2">{['DRAFT', 'TEST', 'ACTIVE', 'DISABLED'].map((status) => <div key={status} className={`min-h-11 rounded-xl border px-4 py-2.5 font-black ${status === country.status ? 'border-[#e85d00] bg-[#fff1e6] text-[#c84d00]' : 'border-[#e6ded5] text-[#8a7e72]'}`}>{status}</div>)}</div><p className="mt-3 text-xs leading-5 text-[#8a7e72]">Seul un administrateur global ou le fondateur peut changer le statut du marché.</p></> : <><div className="mt-4 grid gap-2">{['DRAFT', 'TEST', 'ACTIVE', 'DISABLED'].map((status) => <button disabled={saving || status === country.status} key={status} onClick={() => updateCountry({ status })} className={`min-h-11 rounded-xl border px-4 text-left font-black ${status === country.status ? 'border-[#e85d00] bg-[#fff1e6] text-[#c84d00]' : 'border-[#e6ded5]'}`}>{status}</button>)}</div>{!readiness.canActivate ? <p className="mt-3 text-xs leading-5 text-[#8a7e72]">ACTIVE reste bloqué jusqu’à ce que les informations, une ville, un paiement et la livraison soient prêts.</p> : null}</>}</section></div> : null}
      {tab === 'Locations' ? <div className="grid gap-5 lg:grid-cols-[.8fr_1.2fr]"><div className="space-y-5"><section className="rounded-[24px] border border-[#e8ded3] bg-white p-5"><h2 className="font-black">Ajouter une ville</h2><input placeholder="Nom de la ville" value={city.name} onChange={(e) => setCity((v) => ({ ...v, name: e.target.value }))} className="mt-4 min-h-12 w-full rounded-2xl border border-[#e2d8cd] px-4" /><input placeholder="Région / province" value={city.regionName} onChange={(e) => setCity((v) => ({ ...v, regionName: e.target.value }))} className="mt-3 min-h-12 w-full rounded-2xl border border-[#e2d8cd] px-4" /><button onClick={addCity} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#e85d00] px-4 font-bold text-white"><PlusIcon className="h-4 w-4" /> Ajouter</button></section><section className="rounded-[24px] border border-[#e8ded3] bg-white p-5"><h2 className="font-black">Ajouter une commune</h2><select value={commune.cityId} onChange={(e) => setCommune((v) => ({ ...v, cityId: e.target.value }))} className="mt-4 min-h-12 w-full rounded-2xl border border-[#e2d8cd] bg-white px-4"><option value="">Choisir la ville</option>{(payload.cities || []).map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</select><input placeholder="Nom de la commune" value={commune.name} onChange={(e) => setCommune((v) => ({ ...v, name: e.target.value }))} className="mt-3 min-h-12 w-full rounded-2xl border border-[#e2d8cd] px-4" /><button onClick={addCommune} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#211b17] px-4 font-bold text-white"><PlusIcon className="h-4 w-4" /> Ajouter</button></section></div><section className="overflow-hidden rounded-[24px] border border-[#e8ded3] bg-white">{(payload.cities || []).map((item) => { const cityCommunes = (payload.communes || []).filter((entry) => String(entry.cityId) === String(item._id)); return <div key={item._id} className="border-b border-[#eee7df] p-4 last:border-0"><div className="flex items-center justify-between"><div><b>{item.name}</b><p className="text-xs text-[#897f75]">{item.regionName || 'Région non précisée'}</p></div><span className="text-xs font-bold text-emerald-600">{item.isActive ? 'ACTIVE' : 'INACTIVE'}</span></div>{cityCommunes.length > 0 ? <ul className="mt-2 space-y-1 border-t border-[#f3ede5] pt-2">{cityCommunes.map((entry) => <li key={entry._id} className="flex items-center justify-between pl-4 text-sm"><span className="text-[#62594f]">{entry.name}</span><span className="text-[11px] font-bold text-[#8b8177]">{entry.isActive ? 'ACTIVE' : 'INACTIVE'}</span></li>)}</ul> : <p className="mt-2 pl-4 text-xs font-semibold text-[#b2a89d]">Aucune commune</p>}</div>; })}{(payload.cities || []).length === 0 ? <p className="p-5 text-sm font-bold text-[#8a7e72]">Aucune ville pour ce pays.</p> : null}</section></div> : null}
      {tab === 'Currency' ? <section className="max-w-xl rounded-[24px] border border-[#e8ded3] bg-white p-5"><h2 className="text-xl font-black">Devise principale</h2><div className="mt-4 grid gap-3 sm:grid-cols-2"><input value={country.currency.code} onChange={(e) => setPayload((p) => ({ ...p, item: { ...p.item, currency: { ...p.item.currency, code: e.target.value } } }))} className="min-h-12 rounded-2xl border border-[#e2d8cd] px-4" /><input value={country.currency.symbol} onChange={(e) => setPayload((p) => ({ ...p, item: { ...p.item, currency: { ...p.item.currency, symbol: e.target.value } } }))} className="min-h-12 rounded-2xl border border-[#e2d8cd] px-4" /><input value={country.currency.name} onChange={(e) => setPayload((p) => ({ ...p, item: { ...p.item, currency: { ...p.item.currency, name: e.target.value } } }))} className="min-h-12 rounded-2xl border border-[#e2d8cd] px-4" /><input type="number" value={country.currency.decimals} onChange={(e) => setPayload((p) => ({ ...p, item: { ...p.item, currency: { ...p.item.currency, decimals: Number(e.target.value) } } }))} className="min-h-12 rounded-2xl border border-[#e2d8cd] px-4" /></div><button onClick={() => updateCountry({ currency: country.currency, supportedCurrencies: country.supportedCurrencies })} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#211b17] px-4 font-bold text-white"><CheckIcon className="h-4 w-4" /> Enregistrer</button></section> : null}
      {tab === 'Languages' ? <div className="max-w-2xl rounded-[24px] border border-[#e8ded3] bg-white p-5"><h2 className="text-xl font-black">Langues du pays</h2><label className="mt-4 grid gap-1 text-sm font-bold text-[#62594f]">Langue par défaut<select value={country.defaultLanguage || ''} onChange={(e) => setPayload((p) => ({ ...p, item: { ...p.item, defaultLanguage: e.target.value } }))} className="mt-1 min-h-12 w-full rounded-2xl border border-[#e2d8cd] bg-white px-4 outline-none focus:border-[#e85d00]">{(country.supportedLanguages || []).map((lang) => <option key={lang} value={lang}>{lang}</option>)}</select></label><p className="mt-5 text-sm font-bold text-[#62594f]">Langues prises en charge</p><div className="mt-2 space-y-2">{(country.supportedLanguages || []).map((lang, index) => <div key={`${lang}-${index}`} className="flex items-center gap-2"><input value={lang} onChange={(e) => setPayload((p) => ({ ...p, item: { ...p.item, supportedLanguages: (p.item.supportedLanguages || []).map((entry, entryIndex) => (entryIndex === index ? e.target.value : entry)) } }))} className="min-h-11 flex-1 rounded-xl border border-[#e2d8cd] bg-white px-3 outline-none focus:border-[#e85d00]" /><button type="button" onClick={() => setPayload((p) => ({ ...p, item: { ...p.item, supportedLanguages: (p.item.supportedLanguages || []).filter((_, entryIndex) => entryIndex !== index) } }))} disabled={(country.supportedLanguages || []).length <= 1} aria-label="Retirer la langue" className="grid h-10 w-10 place-items-center rounded-xl text-rose-600 transition hover:bg-rose-50 disabled:opacity-30">×</button></div>)}</div><button type="button" onClick={() => setPayload((p) => ({ ...p, item: { ...p.item, supportedLanguages: [...(p.item.supportedLanguages || []), ''] } }))} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#e2d8cd] bg-white px-3 font-bold text-[#62594f] transition hover:border-[#e85d00]"><PlusIcon className="h-4 w-4" /> Ajouter une langue</button><div className="mt-5 border-t border-[#f0e9e0] pt-4"><button type="button" onClick={() => updateCountry({ defaultLanguage: country.defaultLanguage, supportedLanguages: country.supportedLanguages })} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#211b17] px-4 font-bold text-white"><CheckIcon className="h-4 w-4" /> Enregistrer les langues</button></div></div> : null}
      {tab === 'Payments' ? <div className="grid gap-5 lg:grid-cols-[.8fr_1.2fr]"><section className="rounded-[24px] border border-[#e8ded3] bg-white p-5"><h2 className="font-black">Ajouter / mettre à jour</h2><input value={payment.provider} onChange={(e) => setPayment((v) => ({ ...v, provider: e.target.value }))} placeholder="PAWAPAY" className="mt-4 min-h-12 w-full rounded-2xl border border-[#e2d8cd] px-4" /><input value={payment.displayName} onChange={(e) => setPayment((v) => ({ ...v, displayName: e.target.value }))} placeholder="Nom affiché" className="mt-3 min-h-12 w-full rounded-2xl border border-[#e2d8cd] px-4" /><label className="mt-3 flex items-center justify-between rounded-xl bg-[#faf7f3] p-3 font-bold">Activé<input type="checkbox" checked={payment.enabled} onChange={(e) => setPayment((v) => ({ ...v, enabled: e.target.checked }))} /></label><button onClick={savePayment} className="mt-3 min-h-11 rounded-xl bg-[#e85d00] px-4 font-bold text-white">Enregistrer</button></section><section className="overflow-hidden rounded-[24px] border border-[#e8ded3] bg-white">{(payload.paymentMethods || []).map((item) => <div key={item._id} className="flex items-center justify-between border-b border-[#eee7df] p-4"><div><b>{item.displayName}</b><p className="text-xs text-[#887e74]">{item.provider} · {(item.currencies || []).join(', ')}</p></div><span className={`rounded-full px-2 py-1 text-xs font-black ${item.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-100'}`}>{item.enabled ? 'ON' : 'OFF'}</span></div>)}</section></div> : null}
      {tab === 'Delivery' ? <div className="max-w-xl space-y-5"><section className="rounded-[24px] border border-[#e8ded3] bg-white p-5"><h2 className="text-xl font-black">Livraison</h2>{[['enabled', 'Livraison disponible dans le pays'], ['configured', 'Configuration de livraison terminée']].map(([key, label]) => <label key={key} className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-[#faf7f3] p-3 font-bold">{label}<input type="checkbox" checked={Boolean(deliveryValue[key])} onChange={(e) => updateConfig('delivery', { ...deliveryValue, [key]: e.target.checked })} className="h-5 w-5 accent-[#e85d00]" /></label>)}</section><FieldsEditor title="Paramètres de livraison supplémentaires" value={deliveryValue} onSave={(next) => updateConfig('delivery', next)} /></div> : null}
      {tab === 'Fees' ? <div className="max-w-2xl"><FieldsEditor title="Frais et commissions" value={config.fees} onSave={(value) => updateConfig('fees', value)} /></div> : null}
      {tab === 'Features' ? <div className="max-w-2xl"><FieldsEditor title="Fonctionnalités du pays" value={config.features || country.featureOverrides} onSave={(value) => { updateConfig('features', value); updateCountry({ featureOverrides: value }); }} /></div> : null}
      {tab === 'Boosts' ? <div className="max-w-2xl"><FieldsEditor title="Tarification des boosts" value={config.boosts} onSave={(value) => updateConfig('boosts', value)} /></div> : null}
      {tab === 'Ads' ? <div className="max-w-2xl"><FieldsEditor title="Publicités et placements" value={config.ads} onSave={(value) => updateConfig('ads', value)} /></div> : null}
      {tab === 'Users/Testers' ? <div className="space-y-5"><div className="grid gap-5 lg:grid-cols-[.8fr_1.2fr]"><section className="rounded-[24px] border border-[#e8ded3] bg-white p-5"><h2 className="font-black">Ajouter un testeur</h2><input value={testerId} onChange={(e) => setTesterId(e.target.value)} placeholder="ObjectId utilisateur" className="mt-4 min-h-12 w-full rounded-2xl border border-[#e2d8cd] px-4" /><button onClick={addTester} className="mt-3 min-h-11 rounded-xl bg-[#e85d00] px-4 font-bold text-white">Ajouter</button></section><section className="rounded-[24px] border border-[#e8ded3] bg-white p-5"><h2 className="font-black">Accès TEST</h2><div className="mt-3 space-y-2">{(country.testerUserIds || []).map((userId) => <div key={userId} className="flex items-center justify-between rounded-xl bg-[#faf7f3] p-3"><code className="text-xs">{userId}</code><button onClick={async () => { await api.delete(`/admin/countries/${id}/testers/${userId}`); await load(); }} className="text-rose-600"><TrashIcon className="h-4 w-4" /></button></div>)}</div></section></div><section className="rounded-[24px] border border-[#e8ded3] bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-black">Admins du pays</h2><p className="mt-1 text-sm text-[#80766c]">Chaque pays gère ses propres admins : attachés ici, ils ne voient que ce marché.</p></div><span className="rounded-full bg-[#f8f5f0] px-3 py-1 text-xs font-black text-[#62594f]">{Array.isArray(countryAdmins) ? countryAdmins.length : '…'}</span></div><div className="mt-4 flex flex-wrap gap-2"><input value={adminUserId} onChange={(e) => setAdminUserId(e.target.value)} placeholder="ObjectId utilisateur" className="min-h-12 min-w-52 flex-1 rounded-2xl border border-[#e2d8cd] bg-white px-4" /><button onClick={addAdminUser} disabled={saving} className="min-h-12 rounded-xl bg-[#211b17] px-5 font-black text-white disabled:opacity-50">Ajouter admin</button></div><div className="mt-4 space-y-2">{(countryAdmins || []).map((admin) => <div key={admin._id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#faf7f3] p-3"><div><p className="text-sm font-bold">{admin.name || 'Sans nom'}</p><p className="text-[11px] text-[#8a7263]">{admin.phone} · {admin.email || '—'}</p></div><div className="flex items-center gap-2"><span className="rounded-full bg-neutral-200 px-2 py-0.5 text-[10px] font-black uppercase text-neutral-700">{admin.role}</span><button onClick={() => removeAdminUser(admin._id)} disabled={saving} className="grid h-8 w-8 place-items-center rounded-lg text-rose-600 transition hover:bg-rose-50 disabled:opacity-40" aria-label="Retirer cet admin"><TrashIcon className="h-4 w-4" /></button></div></div>)}{Array.isArray(countryAdmins) && !countryAdmins.length ? <p className="text-sm font-semibold text-[#b2a89d]">Aucun admin attaché à ce pays.</p> : null}</div></section></div> : null}
      {tab === 'Analytics' ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{Object.entries(analytics || {}).filter(([, value]) => typeof value === 'number').map(([key, value]) => <div key={key} className="rounded-[22px] border border-[#e8ded3] bg-white p-5"><p className="text-xs font-black uppercase text-[#8b8177]">{key}</p><p className="mt-2 text-2xl font-black">{Number(value).toLocaleString('fr-FR')}</p></div>)}</div> : null}
      {tab === 'Commerce' ? <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-[22px] border border-[#e8ded3] bg-white p-5"><p className="text-xs font-black uppercase text-[#8b8177]">Commandes</p><p className="mt-2 text-2xl font-black">{Number(commerce?.orders?.total || 0).toLocaleString('fr-FR')}</p></div>
          <div className="rounded-[22px] border border-[#e8ded3] bg-white p-5"><p className="text-xs font-black uppercase text-[#8b8177]">Produits</p><p className="mt-2 text-2xl font-black">{Number(commerce?.products?.total || 0).toLocaleString('fr-FR')}</p></div>
          <div className="rounded-[22px] border border-[#e8ded3] bg-white p-5"><p className="text-xs font-black uppercase text-[#8b8177]">Paiements</p><p className="mt-2 text-2xl font-black">{Number(commerce?.payments?.total || 0).toLocaleString('fr-FR')}</p></div>
          <div className="rounded-[22px] border border-[#e8ded3] bg-white p-5"><p className="text-xs font-black uppercase text-[#8b8177]">Volume encaissé</p><p className="mt-2 text-2xl font-black">{Number(commerce?.payments?.volume || 0).toLocaleString('fr-FR')} <span className="text-sm text-[#8b8177]">{commerce?.currency}</span></p></div>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-[#f8f5f0] px-3 py-1.5 text-xs font-bold text-[#62594f]">Boosts : {commerce?.boosts?.total || 0}</span>
          <span className="rounded-full bg-[#f8f5f0] px-3 py-1.5 text-xs font-bold text-[#62594f]">Prix à débattre : {commerce?.quotations || 0}</span>
          <span className="rounded-full bg-[#f8f5f0] px-3 py-1.5 text-xs font-bold text-[#62594f]">Acheter pour moi : {commerce?.buyForMe || 0}</span>
        </div>
        <div className="grid gap-5 lg:grid-cols-3">
          <section className="rounded-[24px] border border-[#e8ded3] bg-white p-5"><h3 className="font-black">Commandes récentes</h3><div className="mt-3 space-y-2">{(commerce?.orders?.recent || []).map((order) => <div key={order._id} className="flex items-center justify-between gap-2 rounded-xl bg-[#faf7f3] p-3"><div><code className="text-[11px] text-[#8a7263]">#{String(order._id).slice(-6)}</code><span className="ml-2 rounded-full bg-neutral-200 px-2 py-0.5 text-[10px] font-black uppercase text-neutral-700">{order.status}</span></div><b>{Number(order.totalAmount || 0).toLocaleString('fr-FR')}</b></div>)}{!(commerce?.orders?.recent || []).length ? <p className="text-sm font-semibold text-[#b2a89d]">Aucune commande.</p> : null}</div></section>
          <section className="rounded-[24px] border border-[#e8ded3] bg-white p-5"><h3 className="font-black">Produits récents</h3><div className="mt-3 space-y-2">{(commerce?.products?.recent || []).map((product) => <div key={product._id} className="flex items-center justify-between gap-2 rounded-xl bg-[#faf7f3] p-3"><span className="truncate text-sm font-bold">{product.title}</span><b>{Number(product.price || 0).toLocaleString('fr-FR')} {product.currency}</b></div>)}{!(commerce?.products?.recent || []).length ? <p className="text-sm font-semibold text-[#b2a89d]">Aucun produit.</p> : null}</div></section>
          <section className="rounded-[24px] border border-[#e8ded3] bg-white p-5"><h3 className="font-black">Paiements récents</h3><div className="mt-3 space-y-2">{(commerce?.payments?.recent || []).map((payment) => <div key={payment._id} className="flex items-center justify-between gap-2 rounded-xl bg-[#faf7f3] p-3"><div><p className="text-sm font-bold">{payment.paymentMethod || 'Paiement'}</p><span className="rounded-full bg-neutral-200 px-2 py-0.5 text-[10px] font-black uppercase text-neutral-700">{payment.status}</span></div><b>{Number((payment.amountPaid ?? payment.amount) || 0).toLocaleString('fr-FR')}</b></div>)}{!(commerce?.payments?.recent || []).length ? <p className="text-sm font-semibold text-[#b2a89d]">Aucun paiement.</p> : null}</div></section>
        </div>
      </div> : null}
      {tab === 'Operations' ? <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-[22px] border border-[#e8ded3] bg-white p-5"><p className="text-xs font-black uppercase text-[#8b8177]">Utilisateurs</p><p className="mt-2 text-2xl font-black">{Number(operations?.users?.total || 0).toLocaleString('fr-FR')}</p></div>
          <div className="rounded-[22px] border border-[#e8ded3] bg-white p-5"><p className="text-xs font-black uppercase text-[#8b8177]">Boutiques</p><p className="mt-2 text-2xl font-black">{Number(operations?.users?.shops || 0).toLocaleString('fr-FR')}</p></div>
          <div className="rounded-[22px] border border-[#e8ded3] bg-white p-5"><p className="text-xs font-black uppercase text-[#8b8177]">Livreurs</p><p className="mt-2 text-2xl font-black">{Number(operations?.delivery?.couriers || 0).toLocaleString('fr-FR')}</p></div>
          <div className="rounded-[22px] border border-[#e8ded3] bg-white p-5"><p className="text-xs font-black uppercase text-[#8b8177]">Demandes livraison</p><p className="mt-2 text-2xl font-black">{Number(operations?.delivery?.requests || 0).toLocaleString('fr-FR')}</p></div>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700 ring-1 ring-amber-200">Candidatures livreurs en attente : {operations?.delivery?.pendingApplications || 0}</span>
          <span className="rounded-full bg-[#f8f5f0] px-3 py-1.5 text-xs font-bold text-[#62594f]">Courses colis : {operations?.parcels || 0}</span>
          <span className="rounded-full bg-[#f8f5f0] px-3 py-1.5 text-xs font-bold text-[#62594f]">Notifications globales : {operations?.globalNotifications || 0}</span>
        </div>
        {Object.keys(operations?.delivery?.byStatus || {}).length ? <div className="rounded-[24px] border border-[#e8ded3] bg-white p-5"><h3 className="font-black">Livraisons par statut</h3><div className="mt-3 flex flex-wrap gap-2">{Object.entries(operations.delivery.byStatus).map(([status, count]) => <span key={status} className="rounded-full bg-neutral-100 px-3 py-1.5 text-xs font-bold text-neutral-700">{status} · {count}</span>)}</div></div> : null}
        <section className="rounded-[24px] border border-[#e8ded3] bg-white p-5"><h3 className="font-black">Utilisateurs récents</h3><div className="mt-3 grid gap-2 sm:grid-cols-2">{(operations?.users?.recent || []).map((entry) => <div key={entry._id} className="flex items-center justify-between gap-2 rounded-xl bg-[#faf7f3] p-3"><div><p className="text-sm font-bold">{entry.name || 'Sans nom'}</p><p className="text-[11px] text-[#8a7263]">{entry.phone} · {entry.accountType}</p></div><span className="rounded-full bg-neutral-200 px-2 py-0.5 text-[10px] font-black uppercase text-neutral-700">{entry.role}</span></div>)}{!(operations?.users?.recent || []).length ? <p className="text-sm font-semibold text-[#b2a89d]">Aucun utilisateur.</p> : null}</div></section>
      </div> : null}
      {tab === 'System' ? <div className="space-y-5">
        <section className="rounded-[24px] border border-[#e8ded3] bg-white p-5"><h3 className="font-black">Identité du pays</h3><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{[['Code ISO2', country.code], ['Code ISO3', country.iso3], ['Indicatif', country.phoneCode], ['Fuseau horaire', country.timezone], ['Langue par défaut', country.defaultLanguage], ['Devise', `${country.currency?.code} (${country.currency?.symbol})`]].map(([label, value]) => <div key={label} className="rounded-xl bg-[#faf7f3] p-3"><p className="text-[11px] font-black uppercase text-[#8b8177]">{label}</p><p className="mt-1 text-sm font-black">{value || '—'}</p></div>)}</div></section>
        <section className="rounded-[24px] border border-[#e8ded3] bg-white p-5"><h3 className="font-black">Préparation du lancement</h3><div className="mt-3 grid gap-2 sm:grid-cols-2">{Object.entries(readiness.checks || {}).map(([key, ok]) => <div key={key} className="flex items-center gap-3 rounded-2xl bg-[#faf7f3] p-3">{ok ? <CheckCircleIcon className="text-emerald-600 h-[18px] w-[18px]" /> : <ExclamationTriangleIcon className="text-amber-600 h-[18px] w-[18px]" />}<span className="font-bold capitalize">{key}</span></div>)}</div><p className="mt-3 text-sm font-bold text-[#62594f]">Score : <span className="text-[#e85d00]">{readiness.score}%</span></p></section>
        <section className="rounded-[24px] border border-[#f0d9c6] bg-[#fffaf5] p-5"><h3 className="font-black">Liens rapides</h3><div className="mt-3 flex flex-wrap gap-2"><Link to={`/admin/system-settings?countryId=${id}`} className="rounded-xl bg-[#e85d00] px-4 py-2.5 text-sm font-black text-white">Paramètres runtime du pays</Link><button onClick={() => setTab('Payments')} className="rounded-xl border border-[#e2d8cd] bg-white px-4 py-2.5 text-sm font-black text-[#514940]">Paiements</button><button onClick={() => setTab('Delivery')} className="rounded-xl border border-[#e2d8cd] bg-white px-4 py-2.5 text-sm font-black text-[#514940]">Livraison</button><button onClick={() => setTab('Fees')} className="rounded-xl border border-[#e2d8cd] bg-white px-4 py-2.5 text-sm font-black text-[#514940]">Frais</button></div></section>
      </div> : null}
      {tab === 'Advanced' ? <div className="grid gap-5 lg:grid-cols-2"><FieldsEditor title="Paramètres avancés" value={country.settings} onSave={(value) => updateCountry({ settings: value })} /><section className="rounded-[24px] border border-rose-200 bg-rose-50 p-5"><div className="flex items-center gap-2 font-black text-rose-800"><ShieldCheckIcon className="h-[19px] w-[19px]" /> Zone sensible</div><p className="mt-3 text-sm leading-6 text-rose-700">Les pays utilisés ne sont jamais supprimés : désactivez-les pour préserver commandes, paiements et historiques.</p><button onClick={() => updateCountry({ status: 'DISABLED' })} className="mt-4 min-h-11 rounded-xl bg-rose-700 px-4 font-bold text-white">Désactiver le pays</button></section></div> : null}
    </div>
  </div>;
}
