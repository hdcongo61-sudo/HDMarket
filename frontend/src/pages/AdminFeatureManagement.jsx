import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AdjustmentsHorizontalIcon, ArchiveBoxIcon, ArrowPathIcon, BeakerIcon, CheckIcon, ChevronRightIcon, ClockIcon, CodeBracketIcon, ExclamationTriangleIcon, FlagIcon, MagnifyingGlassIcon, NoSymbolIcon, PlusIcon, RocketLaunchIcon, ShieldExclamationIcon, UsersIcon, XMarkIcon } from '@heroicons/react/24/outline';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { appConfirm } from '../utils/appDialog';
import { AdminCommandHero } from '../components/admin/AdminCommandSurface';

const STAGE_META = {
  development: { label: 'Développement', className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200' },
  beta: { label: 'Bêta', className: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200' },
  released: { label: 'Publiée', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200' },
  archived: { label: 'Archivée', className: 'bg-neutral-200 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200' }
};

const PLATFORM_OPTIONS = ['android', 'ios', 'web', 'pwa'];

const splitList = (value = '') =>
  String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const dateTimeLocal = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const prettyJson = (value) => JSON.stringify(value && typeof value === 'object' ? value : {}, null, 2);

const makeForm = (feature = {}) => ({
  featureName: feature.featureName || '',
  displayName: feature.displayName || '',
  description: feature.description || '',
  category: feature.category || 'other',
  icon: feature.icon || 'Sparkles',
  version: feature.version || '1.0.0',
  enabled: Boolean(feature.enabled),
  emergencyDisabled: Boolean(feature.emergencyDisabled),
  releaseStage: feature.releaseStage || 'development',
  rolloutPercentage: Number(feature.rolloutPercentage ?? 100),
  roles: (feature.targeting?.roles || feature.rolesAllowed || []).join(', '),
  countries: (feature.targeting?.countries || []).join(', '),
  cities: (feature.targeting?.cities || []).join(', '),
  communes: (feature.targeting?.communes || []).join(', '),
  platforms: feature.targeting?.platforms || [],
  minAppVersion: feature.targeting?.minAppVersion || '',
  betaTestersOnly: Boolean(feature.targeting?.betaTestersOnly),
  dependencies: (feature.dependencies || []).join(', '),
  releaseAt: dateTimeLocal(feature.schedule?.releaseAt),
  expiresAt: dateTimeLocal(feature.schedule?.expiresAt),
  timezone: feature.schedule?.timezone || 'Africa/Brazzaville',
  remoteConfig: prettyJson(feature.remoteConfig),
  experiments: prettyJson(feature.experiments || [])
});

const emptyFeature = () => makeForm({
  releaseStage: 'development',
  enabled: false,
  rolloutPercentage: 0,
  remoteConfig: {},
  experiments: []
});

const parseJson = (value, label) => {
  try {
    return JSON.parse(value || (label === 'Expériences' ? '[]' : '{}'));
  } catch {
    throw new Error(`${label} doit contenir du JSON valide.`);
  }
};

const serializeForm = (form, { creating = false } = {}) => {
  const remoteConfig = parseJson(form.remoteConfig, 'Configuration distante');
  const experiments = parseJson(form.experiments, 'Expériences');
  if (!remoteConfig || Array.isArray(remoteConfig) || typeof remoteConfig !== 'object') {
    throw new Error('La configuration distante doit être un objet JSON.');
  }
  if (!Array.isArray(experiments)) throw new Error('Les expériences doivent être une liste JSON.');
  const payload = {
    ...(creating ? { featureName: form.featureName.trim().toLowerCase() } : {}),
    displayName: form.displayName.trim(),
    description: form.description.trim(),
    category: form.category.trim() || 'other',
    icon: form.icon.trim() || 'Sparkles',
    version: form.version.trim() || '1.0.0',
    enabled: Boolean(form.enabled),
    emergencyDisabled: Boolean(form.emergencyDisabled),
    releaseStage: form.releaseStage,
    rolloutPercentage: Math.min(100, Math.max(0, Number(form.rolloutPercentage) || 0)),
    rolesAllowed: splitList(form.roles),
    targeting: {
      roles: splitList(form.roles),
      countries: splitList(form.countries),
      cities: splitList(form.cities),
      communes: splitList(form.communes),
      platforms: form.platforms,
      minAppVersion: form.minAppVersion.trim(),
      betaTestersOnly: Boolean(form.betaTestersOnly)
    },
    dependencies: splitList(form.dependencies),
    remoteConfig,
    experiments,
    schedule: {
      releaseAt: form.releaseAt ? new Date(form.releaseAt).toISOString() : null,
      expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
      timezone: form.timezone.trim() || 'Africa/Brazzaville'
    }
  };
  if (!payload.displayName || (creating && !payload.featureName)) {
    throw new Error('Le nom et la clé interne sont requis.');
  }
  return payload;
};

const Metric = ({ label, value, suffix = '' }) => (
  <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900/60">
    <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">{label}</div>
    <div className="mt-1 text-sm font-bold text-neutral-900 dark:text-white">{value}{suffix}</div>
  </div>
);

export default function AdminFeatureManagement() {
  const { showToast } = useToast();
  const [features, setFeatures] = useState([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(emptyFeature);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [history, setHistory] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [testerSearch, setTesterSearch] = useState('');
  const [testerResults, setTesterResults] = useState([]);
  const [betaUserSearch, setBetaUserSearch] = useState('');
  const [betaUserResults, setBetaUserResults] = useState([]);
  const [betaRequests, setBetaRequests] = useState([]);

  const loadFeatures = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const { data } = await api.get('/features');
      setFeatures(Array.isArray(data?.items) ? data.items : []);
      setTotalUsers(Number(data?.totalUsers || 0));
    } catch (error) {
      showToast(error?.response?.data?.message || 'Impossible de charger les fonctionnalités.', 'error');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [showToast]);

  const loadBetaRequests = useCallback(async () => {
    try {
      const { data } = await api.get('/features/beta/requests?limit=100');
      setBetaRequests(Array.isArray(data) ? data : []);
    } catch {
      setBetaRequests([]);
    }
  }, []);

  useEffect(() => {
    void loadFeatures();
    void loadBetaRequests();
  }, [loadBetaRequests, loadFeatures]);

  const openFeature = useCallback(async (feature) => {
    setSelected(feature);
    setShowCreate(false);
    setForm(makeForm(feature));
    setHistory([]);
    setFeedback([]);
    try {
      const [historyResult, feedbackResult] = await Promise.all([
        api.get(`/features/${encodeURIComponent(feature._id || feature.featureName)}/history`),
        api.get(`/features/${encodeURIComponent(feature._id || feature.featureName)}/feedback`)
      ]);
      setHistory(Array.isArray(historyResult.data) ? historyResult.data : []);
      setFeedback(Array.isArray(feedbackResult.data) ? feedbackResult.data : []);
    } catch {
      // A catalog feature without a saved database record has no history yet.
    }
  }, []);

  const saveFeature = async (event) => {
    event?.preventDefault();
    try {
      const creating = showCreate;
      const payload = serializeForm(form, { creating });
      setSaving(true);
      const response = creating
        ? await api.post('/features', payload)
        : await api.put(`/features/${encodeURIComponent(selected?._id || selected?.featureName)}`, payload);
      const item = response.data?.item;
      showToast(creating ? 'Fonctionnalité créée.' : 'Fonctionnalité enregistrée.', 'success');
      setShowCreate(false);
      await loadFeatures({ silent: true });
      if (item) await openFeature(item);
    } catch (error) {
      showToast(error?.response?.data?.message || error.message || 'Enregistrement impossible.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const patchStatus = async (payload, message) => {
    if (!selected) return;
    try {
      setSaving(true);
      const { data } = await api.patch(
        `/features/${encodeURIComponent(selected._id || selected.featureName)}/status`,
        payload
      );
      showToast(message, 'success');
      await loadFeatures({ silent: true });
      if (data?.item) await openFeature(data.item);
    } catch (error) {
      showToast(error?.response?.data?.message || 'Mise à jour impossible.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const emergencyDisable = async () => {
    if (!selected) return;
    const confirmed = await appConfirm(
      `Désactiver en urgence ${selected.displayName || selected.featureName} ? La fonctionnalité disparaîtra immédiatement pour tous les utilisateurs.`
    );
    if (!confirmed) return;
    try {
      setSaving(true);
      const { data } = await api.post(
        `/features/${encodeURIComponent(selected._id || selected.featureName)}/emergency-disable`,
        { reason: 'Interruption d’urgence depuis le tableau de bord.' }
      );
      showToast('Interruption d’urgence activée.', 'success');
      await loadFeatures({ silent: true });
      if (data?.item) await openFeature(data.item);
    } catch (error) {
      showToast(error?.response?.data?.message || 'Action impossible.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const searchTesters = async (value) => {
    setTesterSearch(value);
    if (value.trim().length < 2) return setTesterResults([]);
    try {
      const { data } = await api.get('/admin/users', { params: { search: value.trim(), limit: 12 } });
      setTesterResults(Array.isArray(data) ? data : []);
    } catch {
      setTesterResults([]);
    }
  };

  const addSpecificTester = async (userId) => {
    if (!selected) return;
    try {
      const { data } = await api.post(
        `/features/${encodeURIComponent(selected._id || selected.featureName)}/testers`,
        { userId }
      );
      showToast('Testeur ajouté à cette fonctionnalité.', 'success');
      setTesterSearch('');
      setTesterResults([]);
      await loadFeatures({ silent: true });
      if (data?.item) await openFeature(data.item);
    } catch (error) {
      showToast(error?.response?.data?.message || 'Impossible d’ajouter le testeur.', 'error');
    }
  };

  const removeSpecificTester = async (userId) => {
    if (!selected) return;
    try {
      const { data } = await api.delete(
        `/features/${encodeURIComponent(selected._id || selected.featureName)}/testers/${userId}`
      );
      showToast('Testeur retiré.', 'success');
      await loadFeatures({ silent: true });
      if (data?.item) await openFeature(data.item);
    } catch (error) {
      showToast(error?.response?.data?.message || 'Impossible de retirer le testeur.', 'error');
    }
  };

  const reviewBetaRequest = async (userId, status) => {
    try {
      await api.patch(`/features/beta/requests/${userId}`, { status });
      showToast(status === 'approved' ? 'Testeur bêta approuvé.' : 'Demande refusée.', 'success');
      await loadBetaRequests();
    } catch (error) {
      showToast(error?.response?.data?.message || 'Action impossible.', 'error');
    }
  };

  const searchBetaUsers = async (value) => {
    setBetaUserSearch(value);
    if (value.trim().length < 2) return setBetaUserResults([]);
    try {
      const { data } = await api.get('/admin/users', { params: { search: value.trim(), limit: 12 } });
      setBetaUserResults(Array.isArray(data) ? data : []);
    } catch {
      setBetaUserResults([]);
    }
  };

  const setManualBetaTester = async (userId, enabled) => {
    await reviewBetaRequest(userId, enabled ? 'approved' : 'rejected');
    setBetaUserSearch('');
    setBetaUserResults([]);
  };

  const visibleFeatures = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return features;
    return features.filter((feature) =>
      [feature.displayName, feature.featureName, feature.category, feature.description]
        .join(' ')
        .toLowerCase()
        .includes(needle)
    );
  }, [features, search]);

  const betaCount = features.filter((feature) => (feature.effectiveReleaseStage || feature.releaseStage) === 'beta').length;
  const releasedCount = features.filter((feature) => (feature.effectiveReleaseStage || feature.releaseStage) === 'released' && feature.enabled && !feature.emergencyDisabled && !feature.isExpired).length;
  const emergencyCount = features.filter((feature) => feature.emergencyDisabled).length;

  const updateForm = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const togglePlatform = (platform) => setForm((current) => ({
    ...current,
    platforms: current.platforms.includes(platform)
      ? current.platforms.filter((item) => item !== platform)
      : [...current.platforms, platform]
  }));

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 px-3 pb-12 pt-4 sm:px-6 lg:px-8">
      <AdminCommandHero
        eyebrow="Système de publication"
        title="Gestion des fonctionnalités"
        subtitle="Pilotez les fonctionnalités sans redéploiement : développement, bêta ciblée, publication, arrêt d’urgence et configuration distante."
        actions={[
          {
            label: 'Nouvelle fonctionnalité',
            icon: PlusIcon,
            onClick: () => {
              setSelected(null);
              setShowCreate(true);
              setForm(emptyFeature());
              setHistory([]);
              setFeedback([]);
            }
          },
          { label: 'Actualiser', icon: ArrowPathIcon, onClick: () => loadFeatures() }
        ]}
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Fonctionnalités" value={features.length} />
        <Metric label="En bêta" value={betaCount} />
        <Metric label="Publiées" value={releasedCount} />
        <Metric label="Arrêts d’urgence" value={emergencyCount} />
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(430px,0.9fr)]">
        <section className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-950 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-neutral-900 dark:text-white">Répertoire des fonctionnalités</h2>
              <p className="text-sm text-neutral-500">{totalUsers.toLocaleString('fr-FR')} utilisateurs actifs sur la plateforme.</p>
            </div>
            <label className="flex min-w-[220px] items-center gap-2 rounded-xl border border-neutral-200 px-3 py-2 dark:border-neutral-700">
              <MagnifyingGlassIcon className="text-neutral-400 h-4 w-4" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher" className="w-full bg-transparent text-sm outline-none" />
            </label>
          </div>

          {loading ? (
            <div className="flex min-h-64 items-center justify-center text-neutral-500"><ArrowPathIcon className="mr-2 animate-spin h-5 w-5" /> Chargement…</div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {visibleFeatures.map((feature) => {
                const stage = STAGE_META[feature.effectiveReleaseStage || feature.releaseStage] || STAGE_META.development;
                const isSelected = selected?.featureName === feature.featureName && !showCreate;
                return (
                  <button
                    key={feature.featureName}
                    type="button"
                    onClick={() => openFeature(feature)}
                    className={`group rounded-2xl border p-4 text-left transition ${isSelected ? 'border-neutral-900 ring-2 ring-neutral-900/10 dark:border-white dark:ring-white/10' : 'border-neutral-200 hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600'}`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="rounded-xl bg-neutral-100 p-2.5 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"><FlagIcon className="h-[18px] w-[18px]" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate font-bold text-neutral-900 dark:text-white">{feature.displayName || feature.featureName}</span>
                        {(feature.emergencyDisabled || feature.isExpired) && <ShieldExclamationIcon className="shrink-0 text-red-500 h-4 w-4" />}
                        </span>
                        <span className="mt-1 block truncate font-mono text-xs text-neutral-500">{feature.featureName}</span>
                      </span>
                      <ChevronRightIcon className="mt-1 text-neutral-400 group-hover:text-neutral-900 dark:group-hover:text-white h-[18px] w-[18px]" />
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                      <span className={`rounded-full px-2 py-1 font-semibold ${stage.className}`}>{stage.label}</span>
                      <span className={`rounded-full px-2 py-1 font-semibold ${feature.enabled && !feature.emergencyDisabled ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200' : 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-200'}`}>
                        {feature.enabled && !feature.emergencyDisabled && !feature.isExpired ? 'ON' : 'OFF'}
                      </span>
                      <span className="text-neutral-500">{Number(feature.rolloutPercentage || 0)} %</span>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2 border-t border-neutral-100 pt-3 text-center text-xs dark:border-neutral-800">
                      <span><b className="block text-sm text-neutral-900 dark:text-white">{feature.metrics?.activeUsers || 0}</b>actifs</span>
                      <span><b className="block text-sm text-neutral-900 dark:text-white">{feature.metrics?.feedbackCount || 0}</b>retours</span>
                      <span><b className="block text-sm text-neutral-900 dark:text-white">{feature.metrics?.errorRate || 0}%</b>erreurs</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-950 sm:p-5">
          {!selected && !showCreate ? (
            <div className="flex min-h-96 flex-col items-center justify-center text-center text-neutral-500">
              <AdjustmentsHorizontalIcon className="mb-3 h-8 w-8" />
              <p className="font-semibold text-neutral-700 dark:text-neutral-200">Sélectionnez une fonctionnalité</p>
              <p className="mt-1 max-w-sm text-sm">Ses règles de visibilité, configurations, testeurs, métriques et historique apparaîtront ici.</p>
            </div>
          ) : (
            <form onSubmit={saveFeature} className="space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{showCreate ? 'Nouvelle entrée' : 'Configuration complète'}</div>
                  <h2 className="mt-1 text-xl font-bold text-neutral-900 dark:text-white">{showCreate ? 'Créer une fonctionnalité' : selected.displayName || selected.featureName}</h2>
                </div>
                <button type="button" onClick={() => { setSelected(null); setShowCreate(false); }} className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"><XMarkIcon className="h-[18px] w-[18px]" /></button>
              </div>

              {!showCreate && selected && (
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={saving} onClick={() => patchStatus({ enabled: !selected.enabled }, selected.enabled ? 'Fonctionnalité désactivée.' : 'Fonctionnalité activée.')} className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900">
                    {selected.enabled ? <NoSymbolIcon className="h-4 w-4" /> : <CheckIcon className="h-4 w-4" />}{selected.enabled ? 'Désactiver' : 'Activer'}
                  </button>
                  <button type="button" disabled={saving} onClick={emergencyDisable} className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"><ExclamationTriangleIcon className="h-4 w-4" />Urgence</button>
                  <button type="button" disabled={saving} onClick={async () => { try { const { data } = await api.post(`/features/${encodeURIComponent(selected._id || selected.featureName)}/release`); showToast('Fonctionnalité publiée.', 'success'); await loadFeatures({ silent: true }); if (data?.item) await openFeature(data.item); } catch (error) { showToast(error?.response?.data?.message || 'Publication impossible.', 'error'); } }} className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900 dark:text-emerald-300 dark:hover:bg-emerald-950/40"><RocketLaunchIcon className="h-4 w-4" />Publier</button>
                  <button type="button" disabled={saving} onClick={async () => { const ok = await appConfirm(`Archiver ${selected.displayName || selected.featureName} ? La fonctionnalité sera coupée.`); if (!ok) return; try { const { data } = await api.post(`/features/${encodeURIComponent(selected._id || selected.featureName)}/archive`); showToast('Fonctionnalité archivée.', 'success'); await loadFeatures({ silent: true }); if (data?.item) await openFeature(data.item); } catch (error) { showToast(error?.response?.data?.message || 'Archivage impossible.', 'error'); } }} className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 px-3 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"><ArchiveBoxIcon className="h-4 w-4" />Archiver</button>
                </div>
              )}

              <fieldset className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-medium">Nom<input value={form.displayName} onChange={(event) => updateForm('displayName', event.target.value)} className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 outline-none focus:border-neutral-800 dark:border-neutral-700 dark:bg-neutral-900" /></label>
                <label className="text-sm font-medium">Clé interne<input disabled={!showCreate} value={form.featureName} onChange={(event) => updateForm('featureName', event.target.value)} className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 font-mono text-sm outline-none disabled:cursor-not-allowed disabled:opacity-60 focus:border-neutral-800 dark:border-neutral-700 dark:bg-neutral-900" /></label>
                <label className="text-sm font-medium">Catégorie<input value={form.category} onChange={(event) => updateForm('category', event.target.value)} className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 outline-none dark:border-neutral-700 dark:bg-neutral-900" /></label>
                <label className="text-sm font-medium">Version<input value={form.version} onChange={(event) => updateForm('version', event.target.value)} className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 outline-none dark:border-neutral-700 dark:bg-neutral-900" /></label>
                <label className="text-sm font-medium">Icône Lucide<input value={form.icon} onChange={(event) => updateForm('icon', event.target.value)} className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 outline-none dark:border-neutral-700 dark:bg-neutral-900" /></label>
                <label className="text-sm font-medium">Statut<select value={form.releaseStage} onChange={(event) => updateForm('releaseStage', event.target.value)} className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 outline-none dark:border-neutral-700 dark:bg-neutral-900"><option value="development">Développement</option><option value="beta">Bêta</option><option value="released">Publiée</option><option value="archived">Archivée</option></select></label>
                <label className="sm:col-span-2 text-sm font-medium">Description<textarea rows="2" value={form.description} onChange={(event) => updateForm('description', event.target.value)} className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 outline-none dark:border-neutral-700 dark:bg-neutral-900" /></label>
              </fieldset>

              <section className="rounded-2xl bg-neutral-50 p-4 dark:bg-neutral-900/60">
                <div className="mb-3 flex items-center gap-2 font-bold text-neutral-900 dark:text-white"><AdjustmentsHorizontalIcon className="h-[17px] w-[17px]" />Publication et ciblage</div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"><input type="checkbox" checked={form.enabled} onChange={(event) => updateForm('enabled', event.target.checked)} /> Activée</label>
                  <label className="flex items-center gap-2 rounded-xl border border-red-200 bg-white px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-neutral-950 dark:text-red-300"><input type="checkbox" checked={form.emergencyDisabled} onChange={(event) => updateForm('emergencyDisabled', event.target.checked)} /> Arrêt d’urgence</label>
                  <label className="text-sm font-medium">Déploiement : {form.rolloutPercentage}%<input type="range" min="0" max="100" step="1" value={form.rolloutPercentage} onChange={(event) => updateForm('rolloutPercentage', event.target.value)} className="mt-2 w-full" /></label>
                  <label className="text-sm font-medium">Version minimale<input value={form.minAppVersion} onChange={(event) => updateForm('minAppVersion', event.target.value)} placeholder="2.3.0" className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 outline-none dark:border-neutral-700 dark:bg-neutral-950" /></label>
                  <label className="text-sm font-medium">Rôles (séparés par virgule)<input value={form.roles} onChange={(event) => updateForm('roles', event.target.value)} placeholder="user, shop, delivery_agent" className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 outline-none dark:border-neutral-700 dark:bg-neutral-950" /></label>
                  <label className="text-sm font-medium">Pays<input value={form.countries} onChange={(event) => updateForm('countries', event.target.value)} placeholder="République du Congo" className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 outline-none dark:border-neutral-700 dark:bg-neutral-950" /></label>
                  <label className="text-sm font-medium">Villes<input value={form.cities} onChange={(event) => updateForm('cities', event.target.value)} placeholder="Brazzaville, Pointe-Noire" className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 outline-none dark:border-neutral-700 dark:bg-neutral-950" /></label>
                  <label className="text-sm font-medium">Communes<input value={form.communes} onChange={(event) => updateForm('communes', event.target.value)} placeholder="Poto-Poto, Moungali" className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 outline-none dark:border-neutral-700 dark:bg-neutral-950" /></label>
                  <div className="sm:col-span-2"><div className="text-sm font-medium">Plateformes</div><div className="mt-2 flex flex-wrap gap-2">{PLATFORM_OPTIONS.map((platform) => <label key={platform} className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm capitalize dark:border-neutral-700 dark:bg-neutral-950"><input type="checkbox" checked={form.platforms.includes(platform)} onChange={() => togglePlatform(platform)} />{platform}</label>)}</div></div>
                  <label className="sm:col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={form.betaTestersOnly} onChange={(event) => updateForm('betaTestersOnly', event.target.checked)} /> Limiter aux testeurs bêta approuvés (les testeurs ajoutés explicitement restent autorisés).</label>
                </div>
              </section>

              <section className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-medium">Dépendances<input value={form.dependencies} onChange={(event) => updateForm('dependencies', event.target.value)} placeholder="enable_delivery, enable_global_notifications" className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 font-mono text-sm outline-none dark:border-neutral-700 dark:bg-neutral-900" /></label>
                <label className="text-sm font-medium">Fuseau horaire<input value={form.timezone} onChange={(event) => updateForm('timezone', event.target.value)} className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 outline-none dark:border-neutral-700 dark:bg-neutral-900" /></label>
                <label className="text-sm font-medium">Publication automatique<input type="datetime-local" value={form.releaseAt} onChange={(event) => updateForm('releaseAt', event.target.value)} className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 outline-none dark:border-neutral-700 dark:bg-neutral-900" /></label>
                <label className="text-sm font-medium">Expiration<input type="datetime-local" value={form.expiresAt} onChange={(event) => updateForm('expiresAt', event.target.value)} className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 outline-none dark:border-neutral-700 dark:bg-neutral-900" /></label>
              </section>

              <section className="space-y-3">
                <label className="block text-sm font-medium"><span className="flex items-center gap-2"><CodeBracketIcon className="h-4 w-4" />Configuration distante (JSON)</span><textarea rows="7" value={form.remoteConfig} onChange={(event) => updateForm('remoteConfig', event.target.value)} spellCheck="false" className="mt-1 w-full rounded-xl border border-neutral-200 bg-neutral-950 px-3 py-2 font-mono text-xs text-emerald-200 outline-none dark:border-neutral-700" /></label>
                <label className="block text-sm font-medium"><span className="flex items-center gap-2"><BeakerIcon className="h-4 w-4" />Expériences A/B (JSON)</span><textarea rows="5" value={form.experiments} onChange={(event) => updateForm('experiments', event.target.value)} spellCheck="false" className="mt-1 w-full rounded-xl border border-neutral-200 bg-neutral-950 px-3 py-2 font-mono text-xs text-emerald-200 outline-none dark:border-neutral-700" /></label>
              </section>

              <button type="submit" disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-xl bg-neutral-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900">{saving ? <ArrowPathIcon className="animate-spin h-[17px] w-[17px]" /> : <CheckIcon className="h-[17px] w-[17px]" />}{showCreate ? 'Créer la fonctionnalité' : 'Enregistrer les réglages'}</button>

              {!showCreate && selected && (
                <section className="space-y-3 border-t border-neutral-200 pt-5 dark:border-neutral-800">
                  <div className="flex items-center gap-2 font-bold text-neutral-900 dark:text-white"><UsersIcon className="h-[17px] w-[17px]" />Testeurs spécifiques</div>
                  <div className="relative"><input value={testerSearch} onChange={(event) => searchTesters(event.target.value)} placeholder="Rechercher nom, email, téléphone, boutique…" className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none dark:border-neutral-700 dark:bg-neutral-900" />{testerResults.length > 0 && <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-900">{testerResults.map((user) => <button key={user._id || user.id} type="button" onClick={() => addSpecificTester(user._id || user.id)} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800"><span><b>{user.name}</b><span className="ml-2 text-neutral-500">{user.email || user.phone}</span></span><PlusIcon className="h-4 w-4" /></button>)}</div>}</div>
                  <div className="flex flex-wrap gap-2">{(selected.targeting?.userIds || []).length ? selected.targeting.userIds.map((userId) => <span key={userId} className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-1 font-mono text-xs text-violet-800 dark:bg-violet-500/15 dark:text-violet-200">{String(userId).slice(-8)}<button type="button" onClick={() => removeSpecificTester(userId)} className="rounded-full p-0.5 hover:bg-violet-200 dark:hover:bg-violet-500/30"><XMarkIcon className="h-3 w-3" /></button></span>) : <span className="text-sm text-neutral-500">Aucun testeur ciblé. Utilisez « tous les testeurs bêta » ci-dessus ou ajoutez une personne.</span>}</div>
                </section>
              )}

              {!showCreate && selected && (
                <section className="grid gap-3 border-t border-neutral-200 pt-5 dark:border-neutral-800 sm:grid-cols-2">
                  <Metric label="Expositions (30 j)" value={selected.metrics?.exposures || 0} />
                  <Metric label="Activations (30 j)" value={selected.metrics?.activations || 0} />
                  <Metric label="Conversion" value={selected.metrics?.conversionRate || 0} suffix=" %" />
                  <Metric label="Note moyenne" value={selected.metrics?.averageRating ? Number(selected.metrics.averageRating).toFixed(1) : '—'} />
                  <div className="sm:col-span-2 rounded-xl border border-neutral-200 p-3 dark:border-neutral-700"><div className="mb-2 flex items-center gap-2 text-sm font-bold"><ClockIcon className="h-[15px] w-[15px]" />Historique récent</div>{history.length ? <div className="space-y-2">{history.slice(0, 4).map((entry) => <div key={entry._id} className="text-xs text-neutral-600 dark:text-neutral-300"><b>{entry.performedBy?.name || 'Administrateur'}</b> · {entry.actionType} · {new Date(entry.createdAt).toLocaleString('fr-FR')}</div>)}</div> : <p className="text-xs text-neutral-500">Aucun changement enregistré.</p>}</div>
                  <div className="sm:col-span-2 rounded-xl border border-neutral-200 p-3 dark:border-neutral-700"><div className="mb-2 flex items-center gap-2 text-sm font-bold"><BeakerIcon className="h-[15px] w-[15px]" />Retours bêta</div>{feedback.length ? <div className="space-y-2">{feedback.slice(0, 4).map((item) => <div key={item._id} className="text-xs text-neutral-600 dark:text-neutral-300"><b>{item.type}</b>{item.rating ? ` · ${item.rating}/5` : ''} · {item.message || 'Note sans commentaire'}</div>)}</div> : <p className="text-xs text-neutral-500">Aucun retour pour le moment.</p>}</div>
                </section>
              )}
            </form>
          )}
        </section>
      </div>

      <section className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-950 sm:p-5">
        <div className="mb-4 flex items-center gap-2"><UsersIcon className="h-[19px] w-[19px]" /><div><h2 className="font-bold text-neutral-900 dark:text-white">Demandes de testeurs bêta</h2><p className="text-sm text-neutral-500">Une appartenance bêta conserve le rôle d’origine du client, de la boutique ou du livreur.</p></div></div>
        <div className="relative mb-4 max-w-xl"><input value={betaUserSearch} onChange={(event) => searchBetaUsers(event.target.value)} placeholder="Ajouter manuellement : rechercher nom, email, téléphone ou boutique" className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none dark:border-neutral-700 dark:bg-neutral-900" />{betaUserResults.length > 0 && <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-900">{betaUserResults.map((user) => <button key={user._id || user.id} type="button" onClick={() => setManualBetaTester(user._id || user.id, true)} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800"><span><b>{user.name}</b><span className="ml-2 text-neutral-500">{user.email || user.phone}</span></span><span className="rounded-lg bg-emerald-600 px-2 py-1 text-xs font-bold text-white">Ajouter</span></button>)}</div>}</div>
        {betaRequests.length ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{betaRequests.map((request) => <div key={request._id} className="rounded-2xl border border-neutral-200 p-3 dark:border-neutral-800"><div className="font-semibold text-neutral-900 dark:text-white">{request.name}</div><div className="mt-0.5 text-xs text-neutral-500">{request.email || request.phone} · {request.role}</div><div className="mt-2 text-xs text-neutral-600 dark:text-neutral-300">Statut : <b>{request.betaTesterApplication?.status || (request.betaTester ? 'approved' : 'none')}</b></div>{request.betaTesterApplication?.status === 'pending' && <div className="mt-3 flex gap-2"><button type="button" onClick={() => reviewBetaRequest(request._id, 'approved')} className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-bold text-white">Approuver</button><button type="button" onClick={() => reviewBetaRequest(request._id, 'rejected')} className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-bold text-red-700 dark:border-red-900 dark:text-red-300">Refuser</button></div>}{request.betaTester && <button type="button" onClick={() => setManualBetaTester(request._id, false)} className="mt-3 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-bold text-red-700 dark:border-red-900 dark:text-red-300">Retirer du programme</button>}</div>)}</div> : <p className="text-sm text-neutral-500">Aucune demande bêta pour le moment.</p>}
      </section>
    </div>
  );
}
