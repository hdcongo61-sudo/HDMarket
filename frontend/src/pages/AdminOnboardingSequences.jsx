import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeftIcon, ArrowPathIcon, ChartBarIcon, ChevronDownIcon, ChevronUpIcon, DocumentDuplicateIcon, PlusIcon, PowerIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline';
import api, { getApiErrorMessage } from '../services/api';
import { useToast } from '../context/ToastContext';
import { useCountry } from '../context/CountryContext';

const DELAY_UNITS = [
  { value: 'minutes', label: 'minutes' },
  { value: 'hours', label: 'heures' },
  { value: 'days', label: 'jours' }
];
const CONDITION_OPTIONS = [
  { value: 'hasPlacedOrder', label: 'A déjà commandé' },
  { value: 'hasPublishedProduct', label: 'A déjà publié un produit' },
  { value: 'hasCreatedShop', label: 'A déjà une boutique' },
  { value: 'hasUsedBuyForMe', label: 'A déjà utilisé Acheter pour moi' },
  { value: 'hasUsedDelivery', label: 'A déjà utilisé la livraison' },
  { value: 'hasAddedFavorite', label: 'A déjà un favori' },
  { value: 'hasCompletedProfile', label: 'A un profil complet' }
];
const ROLE_OPTIONS = [
  { value: 'user', label: 'Utilisateurs' },
  { value: 'delivery_agent', label: 'Livreurs' }
];

const emptyStep = (order) => ({
  order,
  title: '',
  message: '',
  delayValue: order === 0 ? 0 : 24,
  delayUnit: 'hours',
  action: { enabled: false, label: '', type: 'none', target: '' },
  conditions: [],
  featureFlagId: null,
  channels: { inApp: true, push: true, email: false, sms: false }
});

const emptyForm = () => ({ name: '', description: '', countryRules: [], roleRules: [], steps: [emptyStep(0)] });

export default function AdminOnboardingSequences() {
  const { showToast } = useToast();
  const { countries } = useCountry();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actioningId, setActioningId] = useState('');
  const [featureFlags, setFeatureFlags] = useState([]);

  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  const [analyticsFor, setAnalyticsFor] = useState(null);
  const [analytics, setAnalytics] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/admin/onboarding-sequences');
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Impossible de charger les séquences.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    api.get('/features').then(({ data }) => setFeatureFlags(Array.isArray(data?.items) ? data.items : [])).catch(() => {});
  }, []);

  const openCreate = () => { setEditingId(null); setForm(emptyForm()); setBuilderOpen(true); };
  const openEdit = (sequence) => {
    setEditingId(sequence._id);
    setForm({
      name: sequence.name,
      description: sequence.description || '',
      countryRules: (sequence.countryRules || []).map((id) => String(id?._id || id)),
      roleRules: sequence.roleRules || [],
      steps: (sequence.steps || []).map((step) => ({ ...step, featureFlagId: step.featureFlagId ? String(step.featureFlagId?._id || step.featureFlagId) : null }))
    });
    setBuilderOpen(true);
  };

  const updateStep = (index, patch) =>
    setForm((prev) => ({ ...prev, steps: prev.steps.map((step, i) => (i === index ? { ...step, ...patch } : step)) }));

  const addStep = () => setForm((prev) => ({ ...prev, steps: [...prev.steps, emptyStep(prev.steps.length)] }));
  const removeStep = (index) =>
    setForm((prev) => ({
      ...prev,
      steps: prev.steps.filter((_, i) => i !== index).map((step, i) => ({ ...step, order: i }))
    }));
  const moveStep = (index, direction) =>
    setForm((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.steps.length) return prev;
      const steps = [...prev.steps];
      [steps[index], steps[target]] = [steps[target], steps[index]];
      return { ...prev, steps: steps.map((step, i) => ({ ...step, order: i })) };
    });
  const toggleStepCondition = (index, value) =>
    setForm((prev) => ({
      ...prev,
      steps: prev.steps.map((step, i) => {
        if (i !== index) return step;
        const has = step.conditions.includes(value);
        return { ...step, conditions: has ? step.conditions.filter((c) => c !== value) : [...step.conditions, value] };
      })
    }));
  const toggleListValue = (key, value) =>
    setForm((prev) => {
      const list = prev[key] || [];
      return { ...prev, [key]: list.includes(value) ? list.filter((item) => item !== value) : [...list, value] };
    });

  const canSubmit = form.name.trim() && form.steps.every((step) => step.title.trim() && step.message.trim());

  const submitBuilder = async () => {
    setSaving(true);
    try {
      if (editingId) {
        await api.patch(`/admin/onboarding-sequences/${editingId}`, form);
        showToast('Séquence mise à jour.', { variant: 'success' });
      } else {
        await api.post('/admin/onboarding-sequences', form);
        showToast('Séquence créée.', { variant: 'success' });
      }
      setBuilderOpen(false);
      await load();
    } catch (requestError) {
      showToast(getApiErrorMessage(requestError, 'Enregistrement impossible.'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (id, action, confirmMessage) => {
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    setActioningId(id);
    try {
      await api.post(`/admin/onboarding-sequences/${id}/${action}`);
      await load();
    } catch (requestError) {
      showToast(getApiErrorMessage(requestError, 'Action impossible.'), { variant: 'error' });
    } finally {
      setActioningId('');
    }
  };

  const deleteSequence = async (id) => {
    if (!window.confirm('Supprimer définitivement cette séquence ?')) return;
    setActioningId(id);
    try {
      await api.delete(`/admin/onboarding-sequences/${id}`);
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
      const { data } = await api.get(`/admin/onboarding-sequences/${id}/analytics`);
      setAnalytics(data);
    } catch (requestError) {
      showToast(getApiErrorMessage(requestError, 'Analytics indisponibles.'), { variant: 'error' });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 px-3 py-4 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="flex flex-col gap-4 rounded-2xl border border-gray-100 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link to="/admin" className="mb-2 inline-flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-gray-900">
              <ArrowLeftIcon className="h-4 w-4" /> Admin
            </Link>
            <h1 className="text-2xl font-black text-slate-950">Séquences d’onboarding</h1>
            <p className="mt-1 text-sm text-gray-500">Notifications automatiques envoyées progressivement aux nouveaux comptes.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={load} disabled={loading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 text-sm font-bold text-gray-700 disabled:opacity-50">
              <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button type="button" onClick={openCreate} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#e85d00] px-4 text-sm font-black text-white">
              <PlusIcon className="h-4 w-4" /> Nouvelle séquence
            </button>
          </div>
        </header>

        {error ? <p className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</p> : null}

        <section className="space-y-3">
          {loading ? (
            <p className="rounded-2xl border border-gray-100 bg-white p-6 text-center text-sm text-gray-500">Chargement…</p>
          ) : !items.length ? (
            <p className="rounded-2xl border border-dashed border-gray-200 bg-white p-6 text-center text-sm text-gray-500">Aucune séquence pour l’instant.</p>
          ) : (
            items.map((sequence) => (
              <article key={sequence._id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${sequence.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                        {sequence.isActive ? 'Active' : 'Inactive'}
                      </span>
                      <span className="text-xs text-gray-400">{(sequence.steps || []).length} étape(s)</span>
                    </div>
                    <p className="mt-1 text-sm font-black text-slate-950">{sequence.name}</p>
                    {sequence.description ? <p className="mt-0.5 text-xs text-gray-600">{sequence.description}</p> : null}
                    <p className="mt-1 text-xs text-gray-400">
                      {Object.entries(sequence.enrollmentCounts || {}).map(([status, count]) => `${status}: ${count}`).join(' · ') || 'Aucune inscription'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => openEdit(sequence)} className="inline-flex min-h-10 items-center rounded-xl border border-gray-200 px-3.5 text-xs font-bold text-gray-700">Modifier</button>
                    <button
                      type="button"
                      onClick={() => runAction(sequence._id, sequence.isActive ? 'deactivate' : 'activate')}
                      disabled={actioningId === sequence._id}
                      className={`inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3.5 text-xs font-bold disabled:opacity-50 ${sequence.isActive ? 'border border-orange-200 text-orange-700' : 'bg-[#0b6b4f] text-white'}`}
                    >
                      <PowerIcon className="h-3.5 w-3.5" /> {sequence.isActive ? 'Désactiver' : 'Activer'}
                    </button>
                    <button type="button" onClick={() => runAction(sequence._id, 'duplicate')} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-gray-200 px-3.5 text-xs font-bold text-gray-700">
                      <DocumentDuplicateIcon className="h-3.5 w-3.5" /> Dupliquer
                    </button>
                    <button type="button" onClick={() => openAnalytics(sequence._id)} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-gray-200 px-3.5 text-xs font-bold text-gray-700">
                      <ChartBarIcon className="h-3.5 w-3.5" /> Analytics
                    </button>
                    {!sequence.isActive ? (
                      <button type="button" onClick={() => deleteSequence(sequence._id)} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-gray-200 px-3.5 text-xs font-bold text-gray-500">
                        <TrashIcon className="h-3.5 w-3.5" /> Supprimer
                      </button>
                    ) : null}
                  </div>
                </div>
              </article>
            ))
          )}
        </section>
      </div>

      {builderOpen ? (
        <div className="fixed inset-0 z-[180] flex items-end justify-center bg-black/50 sm:items-center sm:p-6" onMouseDown={(e) => e.target === e.currentTarget && setBuilderOpen(false)}>
          <section className="max-h-[94dvh] w-full max-w-3xl overflow-y-auto rounded-t-[28px] bg-white p-5 sm:rounded-[28px] sm:p-7">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black text-slate-950">{editingId ? 'Modifier la séquence' : 'Nouvelle séquence'}</h2>
              <button type="button" onClick={() => setBuilderOpen(false)} className="grid h-10 w-10 place-items-center rounded-full bg-gray-100"><XMarkIcon className="h-[18px] w-[18px]" /></button>
            </div>

            <div className="mt-5 space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Nom de la séquence" className="ui-input min-h-12 rounded-xl px-4 sm:col-span-2" />
                <textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="Description (optionnel)" rows={2} className="ui-input rounded-xl px-4 py-3 sm:col-span-2" />
              </div>

              <div className="space-y-2">
                <p className="text-xs font-black uppercase tracking-wide text-[#e85d00]">Ciblage (vide = tout le monde)</p>
                <div className="flex flex-wrap gap-2">
                  {(countries || []).map((country) => {
                    const id = country.id || country._id;
                    const active = form.countryRules.includes(id);
                    return (
                      <button key={id} type="button" onClick={() => toggleListValue('countryRules', id)} className={`rounded-full px-3 py-1.5 text-xs font-bold ${active ? 'bg-[#e85d00] text-white' : 'border border-gray-200 text-gray-600'}`}>
                        {country.flagEmoji} {country.name}
                      </button>
                    );
                  })}
                  {ROLE_OPTIONS.map((option) => {
                    const active = form.roleRules.includes(option.value);
                    return (
                      <button key={option.value} type="button" onClick={() => toggleListValue('roleRules', option.value)} className={`rounded-full px-3 py-1.5 text-xs font-bold ${active ? 'bg-black text-white' : 'border border-gray-200 text-gray-600'}`}>
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-black uppercase tracking-wide text-[#e85d00]">Étapes</p>
                  <button type="button" onClick={addStep} className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-gray-200 px-3 text-xs font-bold text-gray-700">
                    <PlusIcon className="h-3.5 w-3.5" /> Ajouter une étape
                  </button>
                </div>
                {form.steps.map((step, index) => (
                  <div key={index} className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-gray-500">Étape {index + 1}</span>
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => moveStep(index, -1)} disabled={index === 0} className="grid h-8 w-8 place-items-center rounded-lg bg-white disabled:opacity-30"><ChevronUpIcon className="h-3.5 w-3.5" /></button>
                        <button type="button" onClick={() => moveStep(index, 1)} disabled={index === form.steps.length - 1} className="grid h-8 w-8 place-items-center rounded-lg bg-white disabled:opacity-30"><ChevronDownIcon className="h-3.5 w-3.5" /></button>
                        {form.steps.length > 1 ? (
                          <button type="button" onClick={() => removeStep(index)} className="grid h-8 w-8 place-items-center rounded-lg bg-white text-red-600"><TrashIcon className="h-3.5 w-3.5" /></button>
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <input value={step.title} onChange={(e) => updateStep(index, { title: e.target.value })} placeholder="Titre" className="ui-input min-h-11 rounded-xl px-3" />
                      <div className="flex gap-2">
                        <input type="number" min={0} value={step.delayValue} onChange={(e) => updateStep(index, { delayValue: Number(e.target.value) })} className="ui-input min-h-11 w-20 rounded-xl px-3" />
                        <select value={step.delayUnit} onChange={(e) => updateStep(index, { delayUnit: e.target.value })} className="ui-input min-h-11 flex-1 rounded-xl px-3">
                          {DELAY_UNITS.map((unit) => <option key={unit.value} value={unit.value}>{unit.label} après l’étape précédente</option>)}
                        </select>
                      </div>
                      <textarea value={step.message} onChange={(e) => updateStep(index, { message: e.target.value })} placeholder="Message" rows={2} className="ui-input rounded-xl px-3 py-2.5 sm:col-span-2" />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {CONDITION_OPTIONS.map((option) => {
                        const active = step.conditions.includes(option.value);
                        return (
                          <button key={option.value} type="button" onClick={() => toggleStepCondition(index, option.value)} className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${active ? 'bg-black text-white' : 'border border-gray-200 bg-white text-gray-600'}`}>
                            Ignorer si : {option.label}
                          </button>
                        );
                      })}
                    </div>
                    {featureFlags.length ? (
                      <select
                        value={step.featureFlagId || ''}
                        onChange={(e) => updateStep(index, { featureFlagId: e.target.value || null })}
                        className="ui-input mt-2 min-h-10 w-full rounded-xl px-3 text-xs"
                      >
                        <option value="">Aucune condition de fonctionnalité</option>
                        {featureFlags.map((flag) => (
                          <option key={flag._id} value={flag._id}>Ignorer si non éligible : {flag.displayName || flag.featureName}</option>
                        ))}
                      </select>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setBuilderOpen(false)} className="min-h-12 rounded-2xl border border-gray-200 px-5 font-bold text-gray-700">Annuler</button>
              <button type="button" disabled={!canSubmit || saving} onClick={submitBuilder} className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-[#e85d00] px-5 font-black text-white disabled:opacity-40">
                {saving ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : null} {editingId ? 'Enregistrer' : 'Créer'}
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
              <div className="mt-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-gray-50 p-4 text-center"><p className="text-2xl font-black">{analytics.totalEnrolled || 0}</p><p className="text-xs font-bold text-gray-500">Inscrits</p></div>
                  <div className="rounded-2xl bg-gray-50 p-4 text-center"><p className="text-2xl font-black">{analytics.sequenceCompletionRate || 0}%</p><p className="text-xs font-bold text-gray-500">Séquence terminée</p></div>
                </div>
                <div className="space-y-2">
                  {(analytics.steps || []).map((step) => (
                    <div key={step.stepOrder} className="rounded-xl border border-gray-100 p-3 text-xs">
                      <p className="font-black text-gray-700">Étape {step.stepOrder + 1}</p>
                      <p className="mt-1 text-gray-500">Délivrées: {step.delivered} · Ignorées: {step.skipped} · Ouverture: {step.openRate}% · Clic: {step.clickThroughRate}%</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
