import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Image, Layout, Smartphone, Upload, Shield, Search, X, Sparkles, Plus, Trash2, Edit, Save } from 'lucide-react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';

const formatDateInput = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
};

function NetworkEditForm({ network, onSave, onCancel }) {
  const [name, setName] = useState(network.name);
  const [phoneNumber, setPhoneNumber] = useState(network.phoneNumber);

  return (
    <>
      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
        />
        <input
          type="text"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
        />
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onSave(name.trim(), phoneNumber.trim())}
          className="p-2 rounded-lg bg-teal-600 text-white hover:bg-teal-700 transition-colors"
        >
          <Save size={16} />
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="p-2 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors"
        >
          <X size={16} />
        </button>
      </div>
    </>
  );
}

export default function AdminAppSettings() {
  const { showToast } = useToast();

  const [appLogoDesktopFile, setAppLogoDesktopFile] = useState(null);
  const [appLogoDesktopPreview, setAppLogoDesktopPreview] = useState('');
  const [appLogoDesktopSaving, setAppLogoDesktopSaving] = useState(false);
  const [appLogoDesktopError, setAppLogoDesktopError] = useState('');
  const [appLogoDesktopSuccess, setAppLogoDesktopSuccess] = useState('');
  const [appLogoMobileFile, setAppLogoMobileFile] = useState(null);
  const [appLogoMobilePreview, setAppLogoMobilePreview] = useState('');
  const [appLogoMobileSaving, setAppLogoMobileSaving] = useState(false);
  const [appLogoMobileError, setAppLogoMobileError] = useState('');
  const [appLogoMobileSuccess, setAppLogoMobileSuccess] = useState('');

  const [heroBannerFile, setHeroBannerFile] = useState(null);
  const [heroBannerPreview, setHeroBannerPreview] = useState('');
  const [heroBannerSaving, setHeroBannerSaving] = useState(false);
  const [heroBannerError, setHeroBannerError] = useState('');
  const [heroBannerSuccess, setHeroBannerSuccess] = useState('');

  const [promoBannerFile, setPromoBannerFile] = useState(null);
  const [promoBannerPreview, setPromoBannerPreview] = useState('');
  const [promoBannerMobileFile, setPromoBannerMobileFile] = useState(null);
  const [promoBannerMobilePreview, setPromoBannerMobilePreview] = useState('');
  const [promoBannerLink, setPromoBannerLink] = useState('');
  const [promoBannerStartAt, setPromoBannerStartAt] = useState('');
  const [promoBannerEndAt, setPromoBannerEndAt] = useState('');
  const [promoBannerSaving, setPromoBannerSaving] = useState(false);
  const [promoBannerError, setPromoBannerError] = useState('');
  const [promoBannerSuccess, setPromoBannerSuccess] = useState('');

  const [prohibitedWords, setProhibitedWords] = useState([]);
  const [newProhibitedWord, setNewProhibitedWord] = useState('');
  const [prohibitedLoading, setProhibitedLoading] = useState(false);
  const [prohibitedError, setProhibitedError] = useState('');
  const [prohibitedMessage, setProhibitedMessage] = useState('');

  const [splashImageFile, setSplashImageFile] = useState(null);
  const [splashImagePreview, setSplashImagePreview] = useState('');
  const [splashDurationSeconds, setSplashDurationSeconds] = useState(3);
  const [splashEnabled, setSplashEnabled] = useState(true);
  const [splashSaving, setSplashSaving] = useState(false);
  const [splashError, setSplashError] = useState('');
  const [splashSuccess, setSplashSuccess] = useState('');

  // Network settings state
  const [networks, setNetworks] = useState([]);
  const [networkLoading, setNetworkLoading] = useState(false);
  const [editingNetworkId, setEditingNetworkId] = useState(null);
  const [newNetwork, setNewNetwork] = useState({ name: '', phoneNumber: '', isActive: true, order: 0 });
  const [networkError, setNetworkError] = useState('');

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const [heroRes, logoRes, promoRes, prohibitedRes, splashRes, networksRes] = await Promise.all([
          api.get('/settings/hero-banner'),
          api.get('/settings/app-logo'),
          api.get('/settings/promo-banner'),
          api.get('/admin/prohibited-words').catch(() => ({ data: [] })),
          api.get('/settings/splash').catch(() => ({ data: null })),
          api.get('/admin/networks').catch(() => ({ data: [] }))
        ]);
        if (!active) return;
        setHeroBannerPreview(heroRes?.data?.heroBanner || '');
        setAppLogoDesktopPreview(logoRes?.data?.appLogoDesktop || '');
        setAppLogoMobilePreview(logoRes?.data?.appLogoMobile || '');
        setPromoBannerPreview(promoRes?.data?.promoBanner || '');
        setPromoBannerMobilePreview(promoRes?.data?.promoBannerMobile || '');
        setPromoBannerLink(promoRes?.data?.promoBannerLink || '');
        setPromoBannerStartAt(formatDateInput(promoRes?.data?.promoBannerStartAt));
        setPromoBannerEndAt(formatDateInput(promoRes?.data?.promoBannerEndAt));
        setProhibitedWords(Array.isArray(prohibitedRes?.data) ? prohibitedRes.data : []);
        if (splashRes?.data) {
          setSplashImagePreview(splashRes.data.splashImage || '');
          setSplashDurationSeconds(Math.min(30, Math.max(1, Number(splashRes.data.splashDurationSeconds) || 3)));
          setSplashEnabled(splashRes.data.splashEnabled !== false);
        }
        setNetworks(Array.isArray(networksRes?.data) ? networksRes.data : []);
      } catch (err) {
        if (!active) return;
        showToast(err.response?.data?.message || 'Erreur chargement paramètres.', { variant: 'error' });
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [showToast]);

  useEffect(() => {
    return () => {
      const urls = [
        heroBannerPreview,
        appLogoDesktopPreview,
        appLogoMobilePreview,
        promoBannerPreview,
        promoBannerMobilePreview,
        splashImagePreview
      ];
      urls.forEach((url) => {
        if (url && typeof url === 'string' && url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, [
    heroBannerPreview,
    appLogoDesktopPreview,
    appLogoMobilePreview,
    promoBannerPreview,
    promoBannerMobilePreview,
    splashImagePreview
  ]);

  const onAppLogoDesktopChange = (e) => {
    const file = e.target.files?.[0] ?? null;
    setAppLogoDesktopFile(file);
    setAppLogoDesktopError('');
    setAppLogoDesktopSuccess('');
    if (file) {
      if (appLogoDesktopPreview?.startsWith?.('blob:')) URL.revokeObjectURL(appLogoDesktopPreview);
      setAppLogoDesktopPreview(URL.createObjectURL(file));
    }
  };

  const onAppLogoMobileChange = (e) => {
    const file = e.target.files?.[0] ?? null;
    setAppLogoMobileFile(file);
    setAppLogoMobileError('');
    setAppLogoMobileSuccess('');
    if (file) {
      if (appLogoMobilePreview?.startsWith?.('blob:')) URL.revokeObjectURL(appLogoMobilePreview);
      setAppLogoMobilePreview(URL.createObjectURL(file));
    }
  };

  const onHeroBannerChange = (e) => {
    const file = e.target.files?.[0] ?? null;
    setHeroBannerFile(file);
    setHeroBannerError('');
    setHeroBannerSuccess('');
    if (file) {
      if (heroBannerPreview?.startsWith?.('blob:')) URL.revokeObjectURL(heroBannerPreview);
      setHeroBannerPreview(URL.createObjectURL(file));
    }
  };

  const onPromoBannerChange = (e) => {
    const file = e.target.files?.[0] ?? null;
    setPromoBannerFile(file);
    setPromoBannerError('');
    setPromoBannerSuccess('');
    if (file) {
      if (promoBannerPreview?.startsWith?.('blob:')) URL.revokeObjectURL(promoBannerPreview);
      setPromoBannerPreview(URL.createObjectURL(file));
    }
  };

  const onPromoBannerMobileChange = (e) => {
    const file = e.target.files?.[0] ?? null;
    setPromoBannerMobileFile(file);
    setPromoBannerError('');
    setPromoBannerSuccess('');
    if (file) {
      if (promoBannerMobilePreview?.startsWith?.('blob:')) URL.revokeObjectURL(promoBannerMobilePreview);
      setPromoBannerMobilePreview(URL.createObjectURL(file));
    }
  };

  const onSplashImageChange = (e) => {
    const file = e.target.files?.[0] ?? null;
    setSplashImageFile(file);
    setSplashError('');
    setSplashSuccess('');
    if (file) {
      if (splashImagePreview?.startsWith?.('blob:')) URL.revokeObjectURL(splashImagePreview);
      setSplashImagePreview(URL.createObjectURL(file));
    }
  };

  const saveSplash = useCallback(async () => {
    const duration = Math.min(30, Math.max(1, Math.round(splashDurationSeconds)));
    if (duration < 1 || duration > 30) {
      setSplashError('La durée doit être entre 1 et 30 secondes.');
      return;
    }
    const hasImage = splashImageFile || splashImagePreview;
    if (!hasImage && splashEnabled) {
      setSplashError('Veuillez ajouter une image pour l\'écran de démarrage ou désactiver l\'écran.');
      return;
    }
    setSplashSaving(true);
    setSplashError('');
    setSplashSuccess('');
    try {
      const payload = new FormData();
      if (splashImageFile) payload.append('splashImage', splashImageFile);
      payload.append('splashDurationSeconds', String(duration));
      payload.append('splashEnabled', String(splashEnabled));
      const { data } = await api.put('/admin/splash', payload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (data?.splashImage != null) setSplashImagePreview(data.splashImage || '');
      if (data?.splashDurationSeconds != null) setSplashDurationSeconds(data.splashDurationSeconds);
      if (data?.splashEnabled !== undefined) setSplashEnabled(data.splashEnabled);
      setSplashImageFile(null);
      setSplashSuccess('Écran de démarrage mis à jour.');
      showToast('Écran de démarrage mis à jour.', { variant: 'success' });
    } catch (err) {
      const msg = err.response?.data?.message || "Impossible d'enregistrer l'écran de démarrage.";
      setSplashError(msg);
      showToast(msg, { variant: 'error' });
    } finally {
      setSplashSaving(false);
    }
  }, [splashImageFile, splashDurationSeconds, splashEnabled, showToast]);

  const saveHeroBanner = useCallback(async () => {
    if (!heroBannerFile) {
      setHeroBannerError('Veuillez sélectionner une image pour la bannière.');
      return;
    }
    setHeroBannerSaving(true);
    setHeroBannerError('');
    setHeroBannerSuccess('');
    try {
      const payload = new FormData();
      payload.append('heroBanner', heroBannerFile);
      const { data } = await api.put('/admin/hero-banner', payload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setHeroBannerPreview(data?.heroBanner ?? heroBannerPreview);
      setHeroBannerFile(null);
      setHeroBannerSuccess('Bannière mise à jour avec succès.');
      showToast('Bannière HERO mise à jour.', { variant: 'success' });
    } catch (err) {
      const msg = err.response?.data?.message || "Impossible d'enregistrer la bannière.";
      setHeroBannerError(msg);
      showToast(msg, { variant: 'error' });
    } finally {
      setHeroBannerSaving(false);
    }
  }, [heroBannerFile, heroBannerPreview, showToast]);

  const savePromoBanner = useCallback(async () => {
    if (promoBannerStartAt && promoBannerEndAt) {
      const startDate = new Date(promoBannerStartAt);
      const endDate = new Date(promoBannerEndAt);
      if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
        setPromoBannerError('Dates de bannière invalides.');
        return;
      }
      if (endDate < startDate) {
        setPromoBannerError('La date de fin doit être après la date de début.');
        return;
      }
    }
    setPromoBannerSaving(true);
    setPromoBannerError('');
    setPromoBannerSuccess('');
    try {
      const payload = new FormData();
      if (promoBannerFile) payload.append('promoBanner', promoBannerFile);
      if (promoBannerMobileFile) payload.append('promoBannerMobile', promoBannerMobileFile);
      payload.append('promoBannerLink', promoBannerLink.trim());
      payload.append('promoBannerStartAt', promoBannerStartAt);
      payload.append('promoBannerEndAt', promoBannerEndAt);
      const { data } = await api.put('/admin/promo-banner', payload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setPromoBannerPreview(data?.promoBanner ?? promoBannerPreview);
      setPromoBannerMobilePreview(data?.promoBannerMobile ?? promoBannerMobilePreview);
      setPromoBannerLink(data?.promoBannerLink ?? promoBannerLink);
      setPromoBannerStartAt(formatDateInput(data?.promoBannerStartAt));
      setPromoBannerEndAt(formatDateInput(data?.promoBannerEndAt));
      setPromoBannerFile(null);
      setPromoBannerMobileFile(null);
      setPromoBannerSuccess('Bannière publicitaire mise à jour avec succès.');
      showToast('Bannière publicitaire mise à jour.', { variant: 'success' });
    } catch (err) {
      const msg = err.response?.data?.message || "Impossible d'enregistrer la bannière publicitaire.";
      setPromoBannerError(msg);
      showToast(msg, { variant: 'error' });
    } finally {
      setPromoBannerSaving(false);
    }
  }, [promoBannerFile, promoBannerMobileFile, promoBannerLink, promoBannerStartAt, promoBannerEndAt, promoBannerPreview, promoBannerMobilePreview, showToast]);

  const saveAppLogoDesktop = useCallback(async () => {
    if (!appLogoDesktopFile) {
      setAppLogoDesktopError('Veuillez sélectionner un logo desktop.');
      return;
    }
    setAppLogoDesktopSaving(true);
    setAppLogoDesktopError('');
    setAppLogoDesktopSuccess('');
    try {
      const payload = new FormData();
      payload.append('appLogoDesktop', appLogoDesktopFile);
      const { data } = await api.put('/admin/app-logo/desktop', payload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setAppLogoDesktopPreview(data?.appLogoDesktop ?? appLogoDesktopPreview);
      setAppLogoDesktopFile(null);
      setAppLogoDesktopSuccess('Logo desktop mis à jour avec succès.');
      showToast('Logo desktop mis à jour.', { variant: 'success' });
    } catch (err) {
      const msg = err.response?.data?.message || "Impossible d'enregistrer le logo desktop.";
      setAppLogoDesktopError(msg);
      showToast(msg, { variant: 'error' });
    } finally {
      setAppLogoDesktopSaving(false);
    }
  }, [appLogoDesktopFile, appLogoDesktopPreview, showToast]);

  const saveAppLogoMobile = useCallback(async () => {
    if (!appLogoMobileFile) {
      setAppLogoMobileError('Veuillez sélectionner un logo mobile.');
      return;
    }
    setAppLogoMobileSaving(true);
    setAppLogoMobileError('');
    setAppLogoMobileSuccess('');
    try {
      const payload = new FormData();
      payload.append('appLogoMobile', appLogoMobileFile);
      const { data } = await api.put('/admin/app-logo/mobile', payload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setAppLogoMobilePreview(data?.appLogoMobile ?? appLogoMobilePreview);
      setAppLogoMobileFile(null);
      setAppLogoMobileSuccess('Logo mobile mis à jour avec succès.');
      showToast('Logo mobile mis à jour.', { variant: 'success' });
    } catch (err) {
      const msg = err.response?.data?.message || "Impossible d'enregistrer le logo mobile.";
      setAppLogoMobileError(msg);
      showToast(msg, { variant: 'error' });
    } finally {
      setAppLogoMobileSaving(false);
    }
  }, [appLogoMobileFile, appLogoMobilePreview, showToast]);

  const addProhibitedWord = useCallback(
    async (event) => {
      event.preventDefault();
      if (!newProhibitedWord.trim()) return;
      setProhibitedError('');
      setProhibitedMessage('');
      try {
        const { data } = await api.post('/admin/prohibited-words', {
          word: newProhibitedWord.trim()
        });
        setProhibitedWords((prev) => [...prev, data]);
        setNewProhibitedWord('');
        setProhibitedMessage('Mot ajouté à la liste.');
        showToast('Mot interdit ajouté.', { variant: 'success' });
      } catch (error) {
        const msg = error.response?.data?.message || error.message || 'Échec de l\'ajout du mot interdit.';
        setProhibitedError(msg);
        showToast(msg, { variant: 'error' });
      }
    },
    [newProhibitedWord, showToast]
  );

  const removeProhibitedWord = useCallback(
    async (id) => {
      setProhibitedError('');
      setProhibitedMessage('');
      try {
        await api.delete(`/admin/prohibited-words/${id}`);
        setProhibitedWords((prev) => prev.filter((word) => word.id !== id));
        setProhibitedMessage('Mot supprimé de la liste.');
        showToast('Mot interdit supprimé.', { variant: 'success' });
      } catch (error) {
        const msg = error.response?.data?.message || error.message || 'Impossible de supprimer le mot.';
        setProhibitedError(msg);
        showToast(msg, { variant: 'error' });
      }
    },
    [showToast]
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50/20">
        <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-center py-24">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
            <p className="mt-4 text-sm font-medium text-gray-600">Chargement des paramètres…</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50/20">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between pb-6 border-b border-gray-200/60">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 shadow-lg">
              <Image size={24} className="text-white" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 via-indigo-900 to-purple-900 bg-clip-text text-transparent">
                App Settings
              </h1>
              <p className="text-sm text-gray-600 mt-0.5">
                Logo, bannière HERO et bannière publicitaire
              </p>
            </div>
          </div>
          <Link
            to="/admin"
            className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 hover:border-indigo-300 hover:text-indigo-700 transition-all"
          >
            <ArrowLeft size={16} />
            Retour au tableau de bord
          </Link>
        </header>

        <section className="space-y-8">
          {/* App Logo */}
          <div className="rounded-2xl border border-gray-200/60 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
                <Layout size={20} className="text-amber-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Logos de l’application</h2>
                <p className="text-sm text-gray-500">
                  Utilisés dans la barre de navigation (desktop et mobile).
                </p>
              </div>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-3 rounded-xl border border-gray-100 bg-gray-50/50 p-4">
                <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <Layout size={16} /> Logo desktop
                </p>
                {appLogoDesktopError && <p className="text-sm text-red-600">{appLogoDesktopError}</p>}
                {appLogoDesktopSuccess && <p className="text-sm text-emerald-600">{appLogoDesktopSuccess}</p>}
                <div className="flex flex-col items-center justify-center w-full border-2 border-dashed border-gray-300 rounded-xl bg-white p-6 cursor-pointer hover:bg-gray-50 transition-colors">
                  {appLogoDesktopPreview ? (
                    <div className="text-center w-full">
                      <img src={appLogoDesktopPreview} alt="Logo desktop" className="h-16 w-auto max-w-full object-contain mx-auto mb-2" />
                      <p className="text-xs text-gray-500">Logo actuel</p>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">Aucun logo défini.</p>
                  )}
                  <label className="mt-2 flex flex-col items-center gap-1 cursor-pointer">
                    <Upload size={20} className="text-gray-400" />
                    <span className="text-xs text-indigo-600 font-medium">Cliquez pour uploader</span>
                    <span className="text-xs text-gray-400">PNG, JPG, WEBP — format horizontal</span>
                    <input type="file" accept="image/*" onChange={onAppLogoDesktopChange} className="hidden" />
                  </label>
                </div>
                <button
                  type="button"
                  onClick={saveAppLogoDesktop}
                  disabled={appLogoDesktopSaving || !appLogoDesktopFile}
                  className="w-full rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {appLogoDesktopSaving ? 'Mise à jour…' : 'Enregistrer le logo desktop'}
                </button>
              </div>
              <div className="space-y-3 rounded-xl border border-gray-100 bg-gray-50/50 p-4">
                <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <Smartphone size={16} /> Logo mobile
                </p>
                {appLogoMobileError && <p className="text-sm text-red-600">{appLogoMobileError}</p>}
                {appLogoMobileSuccess && <p className="text-sm text-emerald-600">{appLogoMobileSuccess}</p>}
                <div className="flex flex-col items-center justify-center w-full border-2 border-dashed border-gray-300 rounded-xl bg-white p-6 cursor-pointer hover:bg-gray-50 transition-colors">
                  {appLogoMobilePreview ? (
                    <div className="text-center w-full">
                      <img src={appLogoMobilePreview} alt="Logo mobile" className="h-16 w-16 rounded-xl object-contain mx-auto mb-2 border border-gray-200" />
                      <p className="text-xs text-gray-500">Logo actuel</p>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">Aucun logo défini.</p>
                  )}
                  <label className="mt-2 flex flex-col items-center gap-1 cursor-pointer">
                    <Upload size={20} className="text-gray-400" />
                    <span className="text-xs text-indigo-600 font-medium">Cliquez pour uploader</span>
                    <span className="text-xs text-gray-400">PNG, JPG, WEBP — format carré</span>
                    <input type="file" accept="image/*" onChange={onAppLogoMobileChange} className="hidden" />
                  </label>
                </div>
                <button
                  type="button"
                  onClick={saveAppLogoMobile}
                  disabled={appLogoMobileSaving || !appLogoMobileFile}
                  className="w-full rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {appLogoMobileSaving ? 'Mise à jour…' : 'Enregistrer le logo mobile'}
                </button>
              </div>
            </div>
          </div>

          {/* Hero Banner (Accueil) */}
          <div className="rounded-2xl border border-gray-200/60 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100">
                <Image size={20} className="text-indigo-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Bannière du HERO (Accueil)</h2>
                <p className="text-sm text-gray-500">
                  Image en arrière-plan du HERO sur la page d’accueil. 1600×600px recommandé.
                </p>
              </div>
            </div>
            {heroBannerError && <p className="text-sm text-red-600 mb-2">{heroBannerError}</p>}
            {heroBannerSuccess && <p className="text-sm text-emerald-600 mb-2">{heroBannerSuccess}</p>}
            <div className="flex flex-col items-center justify-center w-full border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 p-6 cursor-pointer hover:bg-gray-100 transition-colors">
              {heroBannerPreview ? (
                <div className="text-center w-full">
                  <img src={heroBannerPreview} alt="Bannière HERO" className="h-32 w-full rounded-xl object-cover mx-auto mb-2 border-2 border-indigo-200" />
                  <p className="text-sm text-gray-600">Bannière actuelle</p>
                </div>
              ) : (
                <p className="text-sm text-gray-500">Aucune bannière définie.</p>
              )}
              <label className="mt-2 flex flex-col items-center gap-1 cursor-pointer">
                <Upload size={20} className="text-gray-400" />
                <span className="text-xs text-indigo-600 font-medium">Cliquez pour uploader</span>
                <span className="text-xs text-gray-400">PNG, JPG — 1600×600px recommandé</span>
                <input type="file" accept="image/*" onChange={onHeroBannerChange} className="hidden" />
              </label>
            </div>
            <button
              type="button"
              onClick={saveHeroBanner}
              disabled={heroBannerSaving || !heroBannerFile}
              className="mt-4 w-full rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {heroBannerSaving ? 'Mise à jour…' : 'Enregistrer la bannière HERO'}
            </button>
          </div>

          {/* Promo Banner */}
          <div className="rounded-2xl border border-gray-200/60 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-100">
                <Image size={20} className="text-pink-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Bannière publicitaire</h2>
                <p className="text-sm text-gray-500">
                  Bannière sur la page d’accueil. Lien optionnel et plage de dates.
                </p>
              </div>
            </div>
            {promoBannerError && <p className="text-sm text-red-600 mb-2">{promoBannerError}</p>}
            {promoBannerSuccess && <p className="text-sm text-emerald-600 mb-2">{promoBannerSuccess}</p>}
            <div className="space-y-4 mb-6">
              <div>
                <label className="text-xs font-semibold uppercase text-gray-500">Lien du banner</label>
                <input
                  type="text"
                  value={promoBannerLink}
                  onChange={(e) => setPromoBannerLink(e.target.value)}
                  placeholder="https://exemple.com/promo ou /products"
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold uppercase text-gray-500">Date de début</label>
                  <input
                    type="date"
                    value={promoBannerStartAt}
                    onChange={(e) => setPromoBannerStartAt(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-gray-500">Date de fin</label>
                  <input
                    type="date"
                    value={promoBannerEndAt}
                    onChange={(e) => setPromoBannerEndAt(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500">Hors période, la bannière par défaut s’affiche.</p>
            </div>
            <div className="grid gap-4 lg:grid-cols-2 mb-6">
              <div className="flex flex-col items-center justify-center w-full border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 p-6 cursor-pointer hover:bg-gray-100 transition-colors">
                {promoBannerPreview ? (
                  <div className="text-center w-full">
                    <img src={promoBannerPreview} alt="Bannière publicitaire" className="h-28 w-full rounded-xl object-cover mx-auto mb-2 border border-gray-200" />
                    <p className="text-xs text-gray-600">Desktop</p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Aucune bannière desktop.</p>
                )}
                <label className="mt-2 flex flex-col items-center gap-1 cursor-pointer">
                  <Upload size={18} className="text-gray-400" />
                  <span className="text-xs text-indigo-600 font-medium">Upload</span>
                  <input type="file" accept="image/*" onChange={onPromoBannerChange} className="hidden" />
                </label>
              </div>
              <div className="flex flex-col items-center justify-center w-full border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 p-6 cursor-pointer hover:bg-gray-100 transition-colors">
                {promoBannerMobilePreview ? (
                  <div className="text-center w-full">
                    <img src={promoBannerMobilePreview} alt="Bannière publicitaire mobile" className="h-28 w-full rounded-xl object-cover mx-auto mb-2 border border-gray-200" />
                    <p className="text-xs text-gray-600">Mobile</p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Aucune bannière mobile.</p>
                )}
                <label className="mt-2 flex flex-col items-center gap-1 cursor-pointer">
                  <Upload size={18} className="text-gray-400" />
                  <span className="text-xs text-indigo-600 font-medium">Upload</span>
                  <input type="file" accept="image/*" onChange={onPromoBannerMobileChange} className="hidden" />
                </label>
              </div>
            </div>
            <button
              type="button"
              onClick={savePromoBanner}
              disabled={promoBannerSaving}
              className="w-full rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {promoBannerSaving ? 'Mise à jour…' : 'Enregistrer la bannière publicitaire'}
            </button>
          </div>

          {/* Splash screen (écran de démarrage) */}
          <div className="rounded-2xl border border-gray-200/60 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
                <Sparkles size={20} className="text-amber-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Écran de démarrage</h2>
                <p className="text-sm text-gray-500">
                  Image plein écran affichée à l’ouverture de l’app avant la page d’accueil. Durée en secondes (1–30) et bouton « Passer ».
                </p>
              </div>
            </div>
            {splashError && <p className="text-sm text-red-600 mb-2">{splashError}</p>}
            {splashSuccess && <p className="text-sm text-emerald-600 mb-2">{splashSuccess}</p>}
            <div className="flex items-center gap-3 mb-4 p-3 rounded-xl bg-gray-50 border border-gray-200">
              <input
                type="checkbox"
                id="splash-enabled"
                checked={splashEnabled}
                onChange={(e) => setSplashEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <label htmlFor="splash-enabled" className="text-sm font-medium text-gray-700 cursor-pointer">
                Afficher l’écran de démarrage au chargement de l’app
              </label>
            </div>
            <div className="grid gap-4 lg:grid-cols-2 mb-6">
              <div className="flex flex-col items-center justify-center w-full border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 p-6 cursor-pointer hover:bg-gray-100 transition-colors">
                {splashImagePreview ? (
                  <div className="text-center w-full">
                    <img
                      src={splashImagePreview}
                      alt="Écran de démarrage"
                      className="h-40 w-full rounded-xl object-cover mx-auto mb-2 border border-gray-200"
                    />
                    <p className="text-xs text-gray-600">Image actuelle</p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Aucune image. Ajoutez une image pour afficher l’écran de démarrage.</p>
                )}
                <label className="mt-2 flex flex-col items-center gap-1 cursor-pointer">
                  <Upload size={18} className="text-gray-400" />
                  <span className="text-xs text-indigo-600 font-medium">Choisir une image</span>
                  <span className="text-xs text-gray-400">PNG, JPG — plein écran</span>
                  <input type="file" accept="image/*" onChange={onSplashImageChange} className="hidden" />
                </label>
              </div>
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-gray-900">
                  Durée d’affichage (secondes)
                </label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={splashDurationSeconds}
                  onChange={(e) => setSplashDurationSeconds(Math.min(30, Math.max(1, Number(e.target.value) || 3)))}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500">Entre 1 et 30 secondes. L’utilisateur peut passer avant la fin.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={saveSplash}
              disabled={splashSaving || (splashEnabled && !splashImageFile && !splashImagePreview)}
              className="w-full rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {splashSaving ? 'Mise à jour…' : 'Enregistrer l’écran de démarrage'}
            </button>
          </div>

          {/* Prohibited Words Section */}
          <div className="rounded-2xl border border-gray-200/60 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
                <Shield size={20} className="text-amber-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Mots interdits</h2>
                <p className="text-sm text-gray-500">
                  Ajoutez les mots que les vendeurs ne doivent pas utiliser dans leurs annonces. Les annonces contenant ces mots seront bloquées.
                </p>
              </div>
            </div>
            <form onSubmit={addProhibitedWord} className="flex flex-col gap-3 sm:flex-row mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="Ex : contrefaçon, interdit..."
                  value={newProhibitedWord}
                  onChange={(e) => setNewProhibitedWord(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  disabled={prohibitedLoading}
                />
              </div>
              <button
                type="submit"
                disabled={prohibitedLoading || !newProhibitedWord.trim()}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {prohibitedLoading ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Ajout...
                  </>
                ) : (
                  <>
                    <Shield size={16} />
                    Ajouter
                  </>
                )}
              </button>
            </form>
            {prohibitedMessage && (
              <p className="text-sm text-emerald-600 mb-2">{prohibitedMessage}</p>
            )}
            {prohibitedError && (
              <p className="text-sm text-red-600 mb-2">{prohibitedError}</p>
            )}
            <div className="flex flex-wrap gap-2">
              {prohibitedWords.map((item) => (
                <span
                  key={item.id}
                  className="flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-700"
                >
                  {item.word}
                  <button
                    type="button"
                    onClick={() => removeProhibitedWord(item.id)}
                    className="text-[11px] text-red-600 hover:text-red-500 transition-colors"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
              {!prohibitedWords.length && (
                <p className="text-sm text-gray-400">Aucun mot interdit défini pour l'instant.</p>
              )}
            </div>
          </div>

          {/* Network Settings Section */}
          <div className="rounded-2xl border border-gray-200/60 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-100">
                <Smartphone size={20} className="text-teal-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Réseaux de contact</h2>
                <p className="text-sm text-gray-500">
                  Configurez les réseaux téléphoniques et leurs numéros. Ces numéros remplaceront les numéros codés en dur dans l'application.
                </p>
              </div>
            </div>

            {networkError && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200">
                <p className="text-sm text-red-600">{networkError}</p>
              </div>
            )}

            {/* Add New Network Form */}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!newNetwork.name.trim() || !newNetwork.phoneNumber.trim()) {
                  setNetworkError('Le nom et le numéro de téléphone sont requis.');
                  return;
                }
                setNetworkLoading(true);
                setNetworkError('');
                try {
                  const res = await api.post('/admin/networks', newNetwork);
                  setNetworks([...networks, res.data]);
                  setNewNetwork({ name: '', phoneNumber: '', isActive: true, order: 0 });
                  showToast('Réseau ajouté avec succès.', { variant: 'success' });
                } catch (err) {
                  setNetworkError(err.response?.data?.message || 'Erreur lors de l\'ajout du réseau.');
                } finally {
                  setNetworkLoading(false);
                }
              }}
              className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-200"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Nom du réseau <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newNetwork.name}
                    onChange={(e) => setNewNetwork({ ...newNetwork, name: e.target.value })}
                    placeholder="Ex: MTN, Airtel"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    disabled={networkLoading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Numéro de téléphone <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newNetwork.phoneNumber}
                    onChange={(e) => setNewNetwork({ ...newNetwork, phoneNumber: e.target.value })}
                    placeholder="Ex: +242 06 000 00 00"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    disabled={networkLoading}
                  />
                </div>
              </div>
              <div className="flex items-center gap-4 mb-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newNetwork.isActive}
                    onChange={(e) => setNewNetwork({ ...newNetwork, isActive: e.target.checked })}
                    className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                    disabled={networkLoading}
                  />
                  <span className="text-sm text-gray-700">Actif</span>
                </label>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-700">Ordre:</label>
                  <input
                    type="number"
                    value={newNetwork.order}
                    onChange={(e) => setNewNetwork({ ...newNetwork, order: Number(e.target.value) || 0 })}
                    className="w-20 rounded-xl border border-gray-200 px-2 py-1 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    disabled={networkLoading}
                    min="0"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={networkLoading || !newNetwork.name.trim() || !newNetwork.phoneNumber.trim()}
                className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {networkLoading ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Ajout...
                  </>
                ) : (
                  <>
                    <Plus size={16} />
                    Ajouter un réseau
                  </>
                )}
              </button>
            </form>

            {/* Networks List */}
            <div className="space-y-3">
              {networks.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">Aucun réseau configuré.</p>
              ) : (
                networks.map((network) => (
                  <div
                    key={network._id}
                    className="flex items-center gap-4 p-4 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
                  >
                    {editingNetworkId === network._id ? (
                      <NetworkEditForm
                        network={network}
                        onSave={async (name, phoneNumber) => {
                          if (!name || !phoneNumber) {
                            setNetworkError('Le nom et le numéro sont requis.');
                            return;
                          }
                          setNetworkLoading(true);
                          setNetworkError('');
                          try {
                            const res = await api.patch(`/admin/networks/${network._id}`, {
                              name,
                              phoneNumber
                            });
                            setNetworks(networks.map((n) => (n._id === network._id ? res.data : n)));
                            setEditingNetworkId(null);
                            showToast('Réseau mis à jour.', { variant: 'success' });
                          } catch (err) {
                            setNetworkError(err.response?.data?.message || 'Erreur lors de la mise à jour.');
                          } finally {
                            setNetworkLoading(false);
                          }
                        }}
                        onCancel={() => setEditingNetworkId(null)}
                      />
                    ) : (
                      <>
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <span className="font-semibold text-gray-900">{network.name}</span>
                            <span className="text-sm text-gray-600">{network.phoneNumber}</span>
                            {!network.isActive && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">Inactif</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingNetworkId(network._id)}
                            className="p-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              if (!window.confirm(`Supprimer le réseau "${network.name}" ?`)) return;
                              setNetworkLoading(true);
                              setNetworkError('');
                              try {
                                await api.delete(`/admin/networks/${network._id}`);
                                setNetworks(networks.filter((n) => n._id !== network._id));
                                showToast('Réseau supprimé.', { variant: 'success' });
                              } catch (err) {
                                setNetworkError(err.response?.data?.message || 'Erreur lors de la suppression.');
                              } finally {
                                setNetworkLoading(false);
                              }
                            }}
                            className="p-2 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
