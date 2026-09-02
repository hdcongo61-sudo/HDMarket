import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeftIcon, ArrowPathIcon, ChartBarIcon, MegaphoneIcon, PaperAirplaneIcon, PauseIcon, PlayIcon, PlusIcon, TrashIcon, XCircleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import api, { getApiErrorMessage } from '../services/api';
import { useToast } from '../context/ToastContext';
import { useAppSettings } from '../context/AppSettingsContext';
import { useCountry } from '../context/CountryContext';

const STATUS_TONES = {
  draft: 'bg-gray-100 text-gray-600',
  scheduled: 'bg-amber-50 text-amber-700',
  active: 'bg-blue-50 text-blue-700',
  paused: 'bg-orange-50 text-orange-700',
  completed: 'bg-emerald-50 text-emerald-700',
  cancelled: 'bg-red-50 text-red-700'
};
const STATUS_LABELS = {
  draft: 'Brouillon',
  scheduled: 'Planifiée',
  active: 'En cours',
  paused: 'En pause',
  completed: 'Terminée',
  cancelled: 'Annulée'
};
const TYPE_LABELS = {
  announcement: 'Annonce',
  promotion: 'Promotion',
  feature: 'Fonctionnalité',
  maintenance: 'Maintenance',
  important: 'Important',
  custom: 'Personnalisé'
};
const PRIORITIES = ['low', 'normal', 'high', 'urgent'];
const PRIORITY_LABELS = { low: 'Basse', normal: 'Normale', high: 'Haute', urgent: 'Urgente' };
const ROLE_OPTIONS = [
  { value: 'user', label: 'Utilisateurs' },
  { value: 'delivery_agent', label: 'Livreurs' },
  { value: 'manager', label: 'Managers' },
  { value: 'admin', label: 'Admins' }
];
const USER_TYPE_OPTIONS = [
  { value: 'all', label: 'Tout le monde' },
  { value: 'new_users', label: 'Nouveaux utilisateurs (30j)' },
  { value: 'buyers', label: 'Acheteurs' },
  { value: 'sellers', label: 'Vendeurs / boutiques' },
  { value: 'delivery_agents', label: 'Livreurs' }
];
const ACTION_TYPES = [
  { value: 'none', label: 'Aucune' },
  { value: 'internal_route', label: 'Route interne (ex: /products)' },
  { value: 'product', label: 'Produit (slug ou ID)' },
  { value: 'shop', label: 'Boutique (slug ou ID)' },
  { value: 'category', label: 'Catégorie (slug)' },
  { value: 'external_url', label: 'URL externe (https uniquement)' }
];

const emptyForm = () => ({
  title: '',
  message: '',
  shortDescription: '',
  imageUrl: '',
  type: 'announcement',
  priority: 'normal',
  audience: { userTypes: ['all'], roles: [], countryIds: [], cityIds: [], communeIds: [], testerGroup: false },
  action: { enabled: false, label: '', type: 'none', target: '' },
  channels: { inApp: true, push: true, email: false, sms: false }
});

const formatDate = (value) =>
  value ? new Date(value).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50 px-3.5 py-2.5">
      <span className="text-sm font-semibold text-gray-700">{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-[#e85d00]" />
    </label>
  );
}

export default function AdminNotificationCampaigns() {
  const { showToast } = useToast();
  const { cities, communes } = useAppSettings();
  const { countries } = useCountry();

  const [items, setItems] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actioningId, setActioningId] = useState('');

  const [composerOpen, setComposerOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [estimatedRecipients, setEstimatedRecipients] = useState(null);
  const [estimating, setEstimating] = useState(false);
  const [confirmSend, setConfirmSend] = useState(null); // campaign id pending confirmation

  const [analyticsFor, setAnalyticsFor] = useState(null);
  const [analytics, setAnalytics] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/admin/notification-campaigns', { params: { status: statusFilter || undefined, limit: 50 } });
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Impossible de charger les campagnes.'));
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!composerOpen) return;
    let cancelled = false;
    setEstimating(true);
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get('/admin/notification-campaigns/audience-preview', {
          params: { audience: JSON.stringify(form.audience) }
        });
        if (!cancelled) setEstimatedRecipients(data?.estimatedRecipients ?? null);
      } catch {
        if (!cancelled) setEstimatedRecipients(null);
      } finally {
        if (!cancelled) setEstimating(false);
      }
    }, 400);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [composerOpen, form.audience]);

  const openComposer = () => { setForm(emptyForm()); setEstimatedRecipients(null); setComposerOpen(true); };

  const updateAudience = (patch) => setForm((prev) => ({ ...prev, audience: { ...prev.audience, ...patch } }));
  const toggleInList = (key, value) =>
    setForm((prev) => {
      const list = prev.audience[key] || [];
      const next = list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
      return { ...prev, audience: { ...prev.audience, [key]: next } };
    });

  const saveDraft = async () => {
    setSaving(true);
    try {
      const { data } = await api.post('/admin/notification-campaigns', form);
      showToast('Campagne enregistrée en brouillon.', { variant: 'success' });
      setComposerOpen(false);
      await load();
      return data?.item;
    } catch (requestError) {
      showToast(getApiErrorMessage(requestError, 'Impossible d’enregistrer la campagne.'), { variant: 'error' });
      return null;
    } finally {
      setSaving(false);
    }
  };

  const createAndSend = async () => {
    setSaving(true);
    try {
      const { data } = await api.post('/admin/notification-campaigns', form);
      const campaignId = data?.item?._id;
      setComposerOpen(false);
      await load();
      if (campaignId) setConfirmSend(campaignId);
    } catch (requestError) {
      showToast(getApiErrorMessage(requestError, 'Impossible de créer la campagne.'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const confirmAndSend = async () => {
    if (!confirmSend) return;
    setActioningId(confirmSend);
    try {
      await api.post(`/admin/notification-campaigns/${confirmSend}/send`);
      showToast('Campagne envoyée.', { variant: 'success' });
      setConfirmSend(null);
      await load();
    } catch (requestError) {
      showToast(getApiErrorMessage(requestError, 'Impossible d’envoyer la campagne.'), { variant: 'error' });
    } finally {
      setActioningId('');
    }
  };

  const runAction = async (id, action, confirmMessage) => {
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    setActioningId(id);
    try {
      await api.post(`/admin/notification-campaigns/${id}/${action}`);
      await load();
    } catch (requestError) {
      showToast(getApiErrorMessage(requestError, 'Action impossible.'), { variant: 'error' });
    } finally {
      setActioningId('');
    }
  };

  const deleteCampaign = async (id) => {
    if (!window.confirm('Supprimer définitivement ce brouillon ?')) return;
    setActioningId(id);
    try {
      await api.delete(`/admin/notification-campaigns/${id}`);
      await load();
    } catch (requestError) {
      showToast(getApiErrorMessage(requestError, 'Suppression impossible.'), { variant: 'error' });
    } finally {
      setActioningId('');
    }
  };

  const openAnalytics = async (id) => {
    setAnalyticsFor(id);
    setAnalytics(null);
    try {
      const { data } = await api.get(`/admin/notification-campaigns/${id}/analytics`);
      setAnalytics(data);
    } catch (requestError) {
      showToast(getApiErrorMessage(requestError, 'Analytics indisponibles.'), { variant: 'error' });
    }
  };

  const canSubmitComposer = form.title.trim() && form.message.trim();

  return (
    <div className="min-h-screen bg-gray-50 px-3 py-4 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="flex flex-col gap-4 rounded-2xl border border-gray-100 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link to="/admin" className="mb-2 inline-flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-gray-900">
              <ArrowLeftIcon className="h-4 w-4" /> Admin
            </Link>
            <h1 className="text-2xl font-black text-slate-950">Campagnes de notifications</h1>
            <p className="mt-1 text-sm text-gray-500">Annonces, promotions et notices ciblées — distinct des notifications sponsorisées vendeurs.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={load} disabled={loading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 text-sm font-bold text-gray-700 disabled:opacity-50">
              <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button type="button" onClick={openComposer} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#e85d00] px-4 text-sm font-black text-white">
              <PlusIcon className="h-4 w-4" /> Nouvelle campagne
            </button>
          </div>
        </header>

        <section className="flex flex-wrap gap-2">
          {['', 'draft', 'scheduled', 'active', 'paused', 'completed', 'cancelled'].map((status) => (
            <button
              key={status || 'ALL'}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`rounded-full px-3.5 py-2 text-xs font-bold transition ${statusFilter === status ? 'bg-black text-white' : 'border border-gray-200 bg-white text-gray-600'}`}
            >
              {status ? STATUS_LABELS[status] : 'Toutes'}
            </button>
          ))}
        </section>

        {error ? <p className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</p> : null}

        <section className="space-y-3">
          {loading ? (
            <p className="rounded-2xl border border-gray-100 bg-white p-6 text-center text-sm text-gray-500">Chargement…</p>
          ) : !items.length ? (
            <p className="rounded-2xl border border-dashed border-gray-200 bg-white p-6 text-center text-sm text-gray-500">Aucune campagne pour l’instant.</p>
          ) : (
            items.map((item) => (
              <article key={item._id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${STATUS_TONES[item.status] || 'bg-gray-100 text-gray-600'}`}>
                        {STATUS_LABELS[item.status] || item.status}
                      </span>
                      <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-bold text-gray-600">{TYPE_LABELS[item.type] || item.type}</span>
                      <span className="text-xs text-gray-400">{formatDate(item.createdAt)}</span>
                    </div>
                    <p className="mt-1 truncate text-sm font-black text-slate-950">{item.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-gray-600">{item.message}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1 text-right">
                    <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                      <MegaphoneIcon className="h-3 w-3" /> {item.stats?.sent || 0} / {item.stats?.targeted || 0} envoyées
                    </span>
                    {item.stats?.failed ? <span className="text-xs text-red-500">{item.stats.failed} échecs</span> : null}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {['draft', 'paused'].includes(item.status) && (
                    <button
                      type="button"
                      onClick={() => setConfirmSend(item._id)}
                      disabled={actioningId === item._id}
                      className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#0b6b4f] px-3.5 text-xs font-bold text-white disabled:opacity-50"
                    >
                      <PaperAirplaneIcon className="h-3.5 w-3.5" /> Envoyer
                    </button>
                  )}
                  {['scheduled', 'active'].includes(item.status) && (
                    <button
                      type="button"
                      onClick={() => runAction(item._id, 'pause')}
                      disabled={actioningId === item._id}
                      className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-gray-200 px-3.5 text-xs font-bold text-gray-700 disabled:opacity-50"
                    >
                      <PauseIcon className="h-3.5 w-3.5" /> PauseIcon
                    </button>
                  )}
                  {item.status === 'paused' && (
                    <button
                      type="button"
                      onClick={() => runAction(item._id, 'resume')}
                      disabled={actioningId === item._id}
                      className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-gray-200 px-3.5 text-xs font-bold text-gray-700 disabled:opacity-50"
                    >
                      <PlayIcon className="h-3.5 w-3.5" /> Reprendre
                    </button>
                  )}
                  {!['completed', 'cancelled'].includes(item.status) && (
                    <button
                      type="button"
                      onClick={() => runAction(item._id, 'cancel', 'Annuler cette campagne ?')}
                      disabled={actioningId === item._id}
                      className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-red-200 px-3.5 text-xs font-bold text-red-700 disabled:opacity-50"
                    >
                      <XCircleIcon className="h-3.5 w-3.5" /> Annuler
                    </button>
                  )}
                  {['draft', 'cancelled'].includes(item.status) && (
                    <button
                      type="button"
                      onClick={() => deleteCampaign(item._id)}
                      disabled={actioningId === item._id}
                      className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-gray-200 px-3.5 text-xs font-bold text-gray-500 disabled:opacity-50"
                    >
                      <TrashIcon className="h-3.5 w-3.5" /> Supprimer
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => openAnalytics(item._id)}
                    className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-gray-200 px-3.5 text-xs font-bold text-gray-700"
                  >
                    <ChartBarIcon className="h-3.5 w-3.5" /> Analytics
                  </button>
                </div>
              </article>
            ))
          )}
        </section>
      </div>

      {composerOpen ? (
        <div className="fixed inset-0 z-[180] flex items-end justify-center bg-black/50 sm:items-center sm:p-6" onMouseDown={(e) => e.target === e.currentTarget && setComposerOpen(false)}>
          <section className="max-h-[94dvh] w-full max-w-2xl overflow-y-auto rounded-t-[28px] bg-white p-5 sm:rounded-[28px] sm:p-7">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black text-slate-950">Nouvelle campagne</h2>
              <button type="button" onClick={() => setComposerOpen(false)} className="grid h-10 w-10 place-items-center rounded-full bg-gray-100"><XMarkIcon className="h-[18px] w-[18px]" /></button>
            </div>

            <div className="mt-5 space-y-5">
              <div className="space-y-3">
                <p className="text-xs font-black uppercase tracking-wide text-[#e85d00]">Contenu</p>
                <input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="Titre" maxLength={120} className="ui-input min-h-12 w-full rounded-xl px-4" />
                <textarea value={form.message} onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))} placeholder="Message" maxLength={500} rows={3} className="ui-input w-full rounded-xl px-4 py-3" />
                <div className="grid gap-3 sm:grid-cols-2">
                  <select value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))} className="ui-input min-h-12 rounded-xl px-3">
                    {Object.entries(TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                  <select value={form.priority} onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))} className="ui-input min-h-12 rounded-xl px-3">
                    {PRIORITIES.map((value) => <option key={value} value={value}>{PRIORITY_LABELS[value]}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-black uppercase tracking-wide text-[#e85d00]">Audience</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {USER_TYPE_OPTIONS.map((option) => (
                    <label key={option.value} className="flex items-center gap-2 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-700">
                      <input
                        type="checkbox"
                        checked={form.audience.userTypes.includes(option.value)}
                        onChange={() => toggleInList('userTypes', option.value)}
                        className="h-3.5 w-3.5 accent-[#e85d00]"
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {ROLE_OPTIONS.map((option) => (
                    <label key={option.value} className="flex items-center gap-2 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-700">
                      <input type="checkbox" checked={form.audience.roles.includes(option.value)} onChange={() => toggleInList('roles', option.value)} className="h-3.5 w-3.5 accent-[#e85d00]" />
                      {option.label}
                    </label>
                  ))}
                </div>
                <div>
                  <p className="mb-1.5 text-xs font-bold text-gray-500">Pays</p>
                  <div className="flex flex-wrap gap-2">
                    {(countries || []).map((country) => {
                      const id = country.id || country._id;
                      const active = form.audience.countryIds.includes(id);
                      return (
                        <button key={id} type="button" onClick={() => toggleInList('countryIds', id)} className={`rounded-full px-3 py-1.5 text-xs font-bold ${active ? 'bg-[#e85d00] text-white' : 'border border-gray-200 text-gray-600'}`}>
                          {country.flagEmoji} {country.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {(cities || []).length ? (
                  <div>
                    <p className="mb-1.5 text-xs font-bold text-gray-500">Villes</p>
                    <div className="flex flex-wrap gap-2">
                      {cities.map((city) => {
                        const id = city._id;
                        const active = form.audience.cityIds.includes(id);
                        return (
                          <button key={id} type="button" onClick={() => toggleInList('cityIds', id)} className={`rounded-full px-3 py-1.5 text-xs font-bold ${active ? 'bg-[#e85d00] text-white' : 'border border-gray-200 text-gray-600'}`}>
                            {city.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
                {(communes || []).length && form.audience.cityIds.length ? (
                  <div>
                    <p className="mb-1.5 text-xs font-bold text-gray-500">Communes</p>
                    <div className="flex flex-wrap gap-2">
                      {communes
                        .filter((commune) => form.audience.cityIds.includes(String(commune?.cityId?._id || commune?.cityId || '')))
                        .map((commune) => {
                          const id = commune._id;
                          const active = form.audience.communeIds.includes(id);
                          return (
                            <button key={id} type="button" onClick={() => toggleInList('communeIds', id)} className={`rounded-full px-3 py-1.5 text-xs font-bold ${active ? 'bg-[#e85d00] text-white' : 'border border-gray-200 text-gray-600'}`}>
                              {commune.name}
                            </button>
                          );
                        })}
                    </div>
                  </div>
                ) : null}
                <Toggle checked={form.audience.testerGroup} onChange={(value) => updateAudience({ testerGroup: value })} label="Uniquement les beta testeurs" />
                <p className="rounded-xl bg-blue-50 px-3.5 py-2.5 text-sm font-bold text-blue-800">
                  {estimating ? <span className="inline-flex items-center gap-2"><ArrowPathIcon className="h-4 w-4 animate-spin" /> Estimation…</span> : `Destinataires estimés : ${estimatedRecipients ?? '—'}`}
                </p>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-black uppercase tracking-wide text-[#e85d00]">Action (optionnel)</p>
                <Toggle checked={form.action.enabled} onChange={(value) => setForm((p) => ({ ...p, action: { ...p.action, enabled: value } }))} label="Ajouter un bouton d’action" />
                {form.action.enabled ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input value={form.action.label} onChange={(e) => setForm((p) => ({ ...p, action: { ...p.action, label: e.target.value } }))} placeholder="Libellé du bouton" className="ui-input min-h-11 rounded-xl px-3" />
                    <select value={form.action.type} onChange={(e) => setForm((p) => ({ ...p, action: { ...p.action, type: e.target.value } }))} className="ui-input min-h-11 rounded-xl px-3">
                      {ACTION_TYPES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                    <input value={form.action.target} onChange={(e) => setForm((p) => ({ ...p, action: { ...p.action, target: e.target.value } }))} placeholder="Cible (route, slug ou URL)" className="ui-input min-h-11 rounded-xl px-3 sm:col-span-2" />
                  </div>
                ) : null}
              </div>

              <div className="space-y-2">
                <p className="text-xs font-black uppercase tracking-wide text-[#e85d00]">Canaux</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Toggle checked={form.channels.inApp} onChange={(value) => setForm((p) => ({ ...p, channels: { ...p.channels, inApp: value } }))} label="Dans l’app" />
                  <Toggle checked={form.channels.push} onChange={(value) => setForm((p) => ({ ...p, channels: { ...p.channels, push: value } }))} label="Push" />
                  <label className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50 px-3.5 py-2.5 opacity-50">
                    <span className="text-sm font-semibold text-gray-500">Email (non disponible)</span>
                    <input type="checkbox" disabled className="h-4 w-4" />
                  </label>
                  <label className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50 px-3.5 py-2.5 opacity-50">
                    <span className="text-sm font-semibold text-gray-500">SMS (non disponible)</span>
                    <input type="checkbox" disabled className="h-4 w-4" />
                  </label>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button type="button" disabled={!canSubmitComposer || saving} onClick={saveDraft} className="inline-flex min-h-12 items-center gap-2 rounded-2xl border border-gray-200 px-5 font-bold text-gray-700 disabled:opacity-40">
                Enregistrer en brouillon
              </button>
              <button type="button" disabled={!canSubmitComposer || saving} onClick={createAndSend} className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-[#e85d00] px-5 font-black text-white disabled:opacity-40">
                {saving ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <PaperAirplaneIcon className="h-4 w-4" />} Envoyer
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {confirmSend ? (
        <div className="fixed inset-0 z-[190] grid place-items-center bg-black/50 p-5">
          <section className="w-full max-w-sm rounded-[26px] bg-white p-6 shadow-2xl" role="alertdialog" aria-modal="true">
            <h2 className="text-xl font-black text-slate-950">Confirmer l’envoi</h2>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              {estimatedRecipients !== null ? `Destinataires estimés : ${estimatedRecipients}. ` : ''}
              Cette action ne peut pas être annulée une fois la diffusion commencée.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setConfirmSend(null)} className="min-h-12 rounded-2xl border border-gray-200 font-bold">Annuler</button>
              <button type="button" disabled={actioningId === confirmSend} onClick={confirmAndSend} className="min-h-12 rounded-2xl bg-[#e85d00] font-bold text-white disabled:opacity-50">
                {actioningId === confirmSend ? <ArrowPathIcon className="mx-auto h-4 w-4 animate-spin" /> : 'Envoyer'}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {analyticsFor ? (
        <div className="fixed inset-0 z-[190] grid place-items-center bg-black/50 p-5" onMouseDown={(e) => e.target === e.currentTarget && setAnalyticsFor(null)}>
          <section className="w-full max-w-md rounded-[26px] bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black text-slate-950">Analytics</h2>
              <button type="button" onClick={() => setAnalyticsFor(null)} className="grid h-9 w-9 place-items-center rounded-full bg-gray-100"><XMarkIcon className="h-4 w-4" /></button>
            </div>
            {!analytics ? (
              <div className="mt-6 flex justify-center"><ArrowPathIcon className="h-6 w-6 animate-spin text-gray-400" /></div>
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-gray-50 p-4 text-center"><p className="text-2xl font-black">{analytics.stats?.targeted || 0}</p><p className="text-xs font-bold text-gray-500">Ciblés</p></div>
                <div className="rounded-2xl bg-gray-50 p-4 text-center"><p className="text-2xl font-black">{analytics.stats?.sent || 0}</p><p className="text-xs font-bold text-gray-500">Envoyés</p></div>
                <div className="rounded-2xl bg-gray-50 p-4 text-center"><p className="text-2xl font-black">{analytics.openRate || 0}%</p><p className="text-xs font-bold text-gray-500">Taux d’ouverture</p></div>
                <div className="rounded-2xl bg-gray-50 p-4 text-center"><p className="text-2xl font-black">{analytics.clickThroughRate || 0}%</p><p className="text-xs font-bold text-gray-500">Taux de clic</p></div>
              </div>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
