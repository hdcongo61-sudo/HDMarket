import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Image, Layout, Smartphone, Upload, Shield, Search, X, Sparkles, Plus, Trash2, Edit, Save, Flag, MessageSquare, FileImage, User, Package, CheckCircle, XCircle, Clock, AppWindow, Monitor, Globe } from 'lucide-react';
import api, { clearCache } from '../services/api';
import { useToast } from '../context/ToastContext';
import { appConfirm } from '../utils/appDialog';

const formatDateInput = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
};

function LogoUploadTile({
  icon,
  label,
  hint,
  fileHint,
  preview,
  previewClassName,
  error,
  success,
  saving,
  canSave,
  onChange,
  onSave
}) {
  return (
    <div className="flex flex-col rounded-xl border border-gray-100 bg-gray-50 p-3.5">
      <p className="flex items-center gap-2 text-sm font-black text-gray-900">
        {icon} {label}
      </p>
      <p className="mt-0.5 mb-3 text-[11px] font-medium leading-snug text-gray-500">{hint}</p>
      {error && <p className="mb-2 text-xs font-semibold text-red-600">{error}</p>}
      {success && <p className="mb-2 text-xs font-semibold text-emerald-600">{success}</p>}
      <label className="group relative flex flex-1 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 bg-white p-5 text-center transition-colors hover:border-[#FF6A00]/50 hover:bg-orange-50/40">
        {preview ? (
          <>
            <img src={preview} alt={label} className={previewClassName} />
            <span className="text-[11px] font-semibold text-gray-400">Aperçu actuel · cliquez pour changer</span>
          </>
        ) : (
          <>
            <span className="grid h-11 w-11 place-items-center rounded-full bg-gray-100 text-gray-400 transition-colors group-hover:bg-orange-100 group-hover:text-[#FF6A00]">
              <Upload className="h-5 w-5" />
            </span>
            <span className="text-xs font-bold text-gray-700">Cliquez pour uploader</span>
          </>
        )}
        <span className="text-[10px] text-gray-400">{fileHint}</span>
        <input type="file" accept="image/*" onChange={onChange} className="hidden" />
      </label>
      <button
        type="button"
        onClick={onSave}
        disabled={saving || !canSave}
        className="mt-3 w-full rounded-lg bg-[#FF6A00] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#e85f00] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving ? 'Mise à jour…' : 'Enregistrer'}
      </button>
    </div>
  );
}

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
  const emitAppLogoUpdated = useCallback((payload = {}) => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(
      new CustomEvent('hdmarket:app-logo-updated', {
        detail: payload
      })
    );
  }, []);

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
  const [appIconFile, setAppIconFile] = useState(null);
  const [appIconPreview, setAppIconPreview] = useState('');
  const [appIconSaving, setAppIconSaving] = useState(false);
  const [appIconError, setAppIconError] = useState('');
  const [appIconSuccess, setAppIconSuccess] = useState('');
  const [appFaviconFile, setAppFaviconFile] = useState(null);
  const [appFaviconPreview, setAppFaviconPreview] = useState('');
  const [appFaviconSaving, setAppFaviconSaving] = useState(false);
  const [appFaviconError, setAppFaviconError] = useState('');
  const [appFaviconSuccess, setAppFaviconSuccess] = useState('');

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
  const [bootSplashDesktopEnabled, setBootSplashDesktopEnabled] = useState(true);
  const [bootSplashDesktopDuration, setBootSplashDesktopDuration] = useState(2.4);
  const [bootSplashMobileEnabled, setBootSplashMobileEnabled] = useState(true);
  const [bootSplashMobileDuration, setBootSplashMobileDuration] = useState(2.4);
  const [bootSplashSaving, setBootSplashSaving] = useState(false);
  const [bootSplashError, setBootSplashError] = useState('');
  const [bootSplashSuccess, setBootSplashSuccess] = useState('');

  // Network settings state
  const [networks, setNetworks] = useState([]);
  const [networkLoading, setNetworkLoading] = useState(false);
  const [editingNetworkId, setEditingNetworkId] = useState(null);
  const [newNetwork, setNewNetwork] = useState({ name: '', phoneNumber: '', isActive: true, order: 0 });
  const [networkError, setNetworkError] = useState('');

  // Reports state
  const [reports, setReports] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportsFilter, setReportsFilter] = useState('all');
  const [reportsTypeFilter, setReportsTypeFilter] = useState('all');
  const [updatingReportId, setUpdatingReportId] = useState(null);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const [heroRes, logoRes, promoRes, prohibitedRes, splashRes, networksRes] = await Promise.all([
          api.get('/settings/hero-banner'),
          api.get('/settings/app-logo', { skipCache: true }),
          api.get('/settings/promo-banner', { skipCache: true, headers: { 'x-skip-cache': '1' } }),
          api.get('/admin/prohibited-words').catch(() => ({ data: [] })),
          api.get('/settings/splash').catch(() => ({ data: null })),
          api.get('/admin/networks').catch(() => ({ data: [] }))
        ]);
        loadReports();
        if (!active) return;
        setHeroBannerPreview(heroRes?.data?.heroBanner || '');
        setAppLogoDesktopPreview(logoRes?.data?.appLogoDesktop || '');
        setAppLogoMobilePreview(logoRes?.data?.appLogoMobile || '');
        setAppIconPreview(logoRes?.data?.appIcon || '');
        setAppFaviconPreview(logoRes?.data?.appFavicon || '');
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
          const clampBoot = (v) => Math.min(10, Math.max(1, Number(v) || 2.4));
          setBootSplashDesktopEnabled(splashRes.data.bootSplashDesktopEnabled !== false);
          setBootSplashDesktopDuration(clampBoot(splashRes.data.bootSplashDesktopDurationSeconds));
          setBootSplashMobileEnabled(splashRes.data.bootSplashMobileEnabled !== false);
          setBootSplashMobileDuration(clampBoot(splashRes.data.bootSplashMobileDurationSeconds));
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

  const loadReports = useCallback(async () => {
    setReportsLoading(true);
    try {
      const params = {};
      if (reportsFilter !== 'all') params.status = reportsFilter;
      if (reportsTypeFilter !== 'all') params.type = reportsTypeFilter;
      const { data } = await api.get('/admin/content-reports', { params });
      setReports(Array.isArray(data) ? data : []);
    } catch (err) {
      showToast(err.response?.data?.message || 'Erreur chargement signalements.', { variant: 'error' });
      setReports([]);
    } finally {
      setReportsLoading(false);
    }
  }, [reportsFilter, reportsTypeFilter, showToast]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const handleReportStatusChange = useCallback(async (reportId, newStatus, adminNote = '') => {
    setUpdatingReportId(reportId);
    try {
      await api.patch(`/admin/content-reports/${reportId}/status`, { status: newStatus, adminNote });
      await loadReports();
      showToast('Statut du signalement mis à jour.', { variant: 'success' });
    } catch (err) {
      showToast(err.response?.data?.message || 'Erreur mise à jour.', { variant: 'error' });
    } finally {
      setUpdatingReportId(null);
    }
  }, [loadReports, showToast]);

  const formatDateTime = (date) => {
    if (!date) return '—';
    return new Date(date).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-700 border-yellow-300',
      reviewed: 'bg-neutral-100 text-neutral-700 border-neutral-300',
      resolved: 'bg-green-100 text-green-700 border-green-300',
      dismissed: 'bg-gray-100 text-gray-700 border-gray-300'
    };
    const labels = {
      pending: 'En attente',
      reviewed: 'Examiné',
      resolved: 'Résolu',
      dismissed: 'Rejeté'
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${styles[status] || styles.pending}`}>
        {labels[status] || status}
      </span>
    );
  };

  useEffect(() => {
    return () => {
      const urls = [
        heroBannerPreview,
        appLogoDesktopPreview,
        appLogoMobilePreview,
        appIconPreview,
        appFaviconPreview,
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
    appIconPreview,
    appFaviconPreview,
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

  const onAppIconChange = (e) => {
    const file = e.target.files?.[0] ?? null;
    setAppIconFile(file);
    setAppIconError('');
    setAppIconSuccess('');
    if (file) {
      if (appIconPreview?.startsWith?.('blob:')) URL.revokeObjectURL(appIconPreview);
      setAppIconPreview(URL.createObjectURL(file));
    }
  };

  const onAppFaviconChange = (e) => {
    const file = e.target.files?.[0] ?? null;
    setAppFaviconFile(file);
    setAppFaviconError('');
    setAppFaviconSuccess('');
    if (file) {
      if (appFaviconPreview?.startsWith?.('blob:')) URL.revokeObjectURL(appFaviconPreview);
      setAppFaviconPreview(URL.createObjectURL(file));
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

  const saveBootSplash = useCallback(async () => {
    const clamp = (v) => Math.min(10, Math.max(1, Number(v) || 2.4));
    setBootSplashSaving(true);
    setBootSplashError('');
    setBootSplashSuccess('');
    try {
      const payload = new FormData();
      payload.append('bootSplashDesktopEnabled', String(bootSplashDesktopEnabled));
      payload.append('bootSplashDesktopDurationSeconds', String(clamp(bootSplashDesktopDuration)));
      payload.append('bootSplashMobileEnabled', String(bootSplashMobileEnabled));
      payload.append('bootSplashMobileDurationSeconds', String(clamp(bootSplashMobileDuration)));
      const { data } = await api.put('/admin/splash', payload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (data?.bootSplashDesktopEnabled !== undefined) setBootSplashDesktopEnabled(data.bootSplashDesktopEnabled);
      if (data?.bootSplashDesktopDurationSeconds != null) setBootSplashDesktopDuration(data.bootSplashDesktopDurationSeconds);
      if (data?.bootSplashMobileEnabled !== undefined) setBootSplashMobileEnabled(data.bootSplashMobileEnabled);
      if (data?.bootSplashMobileDurationSeconds != null) setBootSplashMobileDuration(data.bootSplashMobileDurationSeconds);
      setBootSplashSuccess('Splash animé mis à jour.');
      showToast('Splash animé mis à jour.', { variant: 'success' });
    } catch (err) {
      const msg = err.response?.data?.message || 'Impossible de mettre à jour le splash animé.';
      setBootSplashError(msg);
      showToast(msg, { variant: 'error' });
    } finally {
      setBootSplashSaving(false);
    }
  }, [bootSplashDesktopEnabled, bootSplashDesktopDuration, bootSplashMobileEnabled, bootSplashMobileDuration, showToast]);

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
      clearCache('/settings/promo-banner').catch(() => {});
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
      const nextDesktopLogo = data?.appLogoDesktop ?? appLogoDesktopPreview;
      setAppLogoDesktopPreview(nextDesktopLogo);
      setAppLogoDesktopFile(null);
      clearCache('/settings/app-logo').catch(() => {});
      emitAppLogoUpdated({ appLogoDesktop: nextDesktopLogo });
      setAppLogoDesktopSuccess('Logo desktop mis à jour avec succès.');
      showToast('Logo desktop mis à jour.', { variant: 'success' });
    } catch (err) {
      const msg = err.response?.data?.message || "Impossible d'enregistrer le logo desktop.";
      setAppLogoDesktopError(msg);
      showToast(msg, { variant: 'error' });
    } finally {
      setAppLogoDesktopSaving(false);
    }
  }, [appLogoDesktopFile, appLogoDesktopPreview, emitAppLogoUpdated, showToast]);

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
      const nextMobileLogo = data?.appLogoMobile ?? appLogoMobilePreview;
      setAppLogoMobilePreview(nextMobileLogo);
      setAppLogoMobileFile(null);
      clearCache('/settings/app-logo').catch(() => {});
      emitAppLogoUpdated({ appLogoMobile: nextMobileLogo });
      setAppLogoMobileSuccess('Logo mobile mis à jour avec succès.');
      showToast('Logo mobile mis à jour.', { variant: 'success' });
    } catch (err) {
      const msg = err.response?.data?.message || "Impossible d'enregistrer le logo mobile.";
      setAppLogoMobileError(msg);
      showToast(msg, { variant: 'error' });
    } finally {
      setAppLogoMobileSaving(false);
    }
  }, [appLogoMobileFile, appLogoMobilePreview, emitAppLogoUpdated, showToast]);

  const saveAppIcon = useCallback(async () => {
    if (!appIconFile) {
      setAppIconError('Veuillez sélectionner une icône.');
      return;
    }
    setAppIconSaving(true);
    setAppIconError('');
    setAppIconSuccess('');
    try {
      const payload = new FormData();
      payload.append('appIcon', appIconFile);
      const { data } = await api.put('/admin/app-logo/icon', payload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const nextIcon = data?.appIcon ?? appIconPreview;
      setAppIconPreview(nextIcon);
      setAppIconFile(null);
      clearCache('/settings/app-logo').catch(() => {});
      emitAppLogoUpdated({ appIcon: nextIcon });
      setAppIconSuccess('Icône mise à jour avec succès.');
      showToast('Icône mise à jour.', { variant: 'success' });
    } catch (err) {
      const msg = err.response?.data?.message || "Impossible d'enregistrer l'icône.";
      setAppIconError(msg);
      showToast(msg, { variant: 'error' });
    } finally {
      setAppIconSaving(false);
    }
  }, [appIconFile, appIconPreview, emitAppLogoUpdated, showToast]);

  const saveAppFavicon = useCallback(async () => {
    if (!appFaviconFile) {
      setAppFaviconError('Veuillez sélectionner un favicon.');
      return;
    }
    setAppFaviconSaving(true);
    setAppFaviconError('');
    setAppFaviconSuccess('');
    try {
      const payload = new FormData();
      payload.append('appFavicon', appFaviconFile);
      const { data } = await api.put('/admin/app-logo/favicon', payload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const nextFavicon = data?.appFavicon ?? appFaviconPreview;
      setAppFaviconPreview(nextFavicon);
      setAppFaviconFile(null);
      clearCache('/settings/app-logo').catch(() => {});
      emitAppLogoUpdated({ appFavicon: nextFavicon });
      setAppFaviconSuccess('Favicon mis à jour avec succès.');
      showToast('Favicon mis à jour.', { variant: 'success' });
    } catch (err) {
      const msg = err.response?.data?.message || "Impossible d'enregistrer le favicon.";
      setAppFaviconError(msg);
      showToast(msg, { variant: 'error' });
    } finally {
      setAppFaviconSaving(false);
    }
  }, [appFaviconFile, appFaviconPreview, emitAppLogoUpdated, showToast]);

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
      <div className="min-h-screen bg-[#f5f5f5]">
        <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-center py-24">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-[#FF6A00]" />
            <p className="mt-4 text-sm font-medium text-gray-600">Chargement des paramètres…</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-[#FFF0E4] text-[#FF6A00]">
              <Image size={24} strokeWidth={2.2} />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-gray-900 sm:text-2xl">
                Paramètres de l’application
              </h1>
              <p className="mt-0.5 text-sm font-medium text-gray-500">
                Identité visuelle, bannières et configuration
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/admin/settings/categories"
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2 text-sm font-bold text-gray-700 transition hover:bg-gray-100"
            >
              <Layout size={16} />
              Catégories
            </Link>
            <Link
              to="/admin/system-settings"
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2 text-sm font-bold text-gray-700 transition hover:bg-gray-100"
            >
              <Shield size={16} />
              Paramètres système
            </Link>
            <Link
              to="/admin"
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2 text-sm font-bold text-gray-700 transition hover:bg-gray-100"
            >
              <ArrowLeft size={16} />
              Retour
            </Link>
          </div>
        </header>

        {/* Navigation d'ancres : la page fait 8 sections, on saute au lieu de scroller à l'aveugle */}
        <nav className="sticky top-2 z-20 rounded-2xl border border-gray-200 bg-white/90 px-2 py-2 shadow-sm backdrop-blur-md">
          <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {[
              ['#identite', 'Identité'],
              ['#banniere-hero', 'Bannière hero'],
              ['#banniere-pub', 'Bannière pub'],
              ['#demarrage', 'Démarrage'],
              ['#splash', 'Splash animé'],
              ['#mots-interdits', 'Mots interdits'],
              ['#contacts', 'Contacts'],
              ['#signalements', 'Signalements']
            ].map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="flex-shrink-0 rounded-full bg-gray-100 px-3.5 py-1.5 text-xs font-bold text-gray-600 transition hover:bg-[#FFF0E4] hover:text-[#FF6A00]"
              >
                {label}
              </a>
            ))}
          </div>
        </nav>

        <section className="space-y-8">
          {/* App Logos & Icon */}
          <div id="identite" className="scroll-mt-24 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#FF6A00] text-white">
                <Sparkles size={20} />
              </div>
              <div>
                <h2 className="text-base font-black text-gray-900">Identité visuelle</h2>
                <p className="text-sm font-medium text-gray-500">
                  Logos, icône de l’application et favicon du navigateur.
                </p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <LogoUploadTile
                icon={<Monitor className="h-4 w-4 text-[#FF6A00]" />}
                label="Logo desktop"
                hint="Barre de navigation (web) — format horizontal."
                fileHint="PNG, JPG, WEBP — horizontal"
                preview={appLogoDesktopPreview}
                previewClassName="h-12 w-auto max-w-full object-contain"
                error={appLogoDesktopError}
                success={appLogoDesktopSuccess}
                saving={appLogoDesktopSaving}
                canSave={Boolean(appLogoDesktopFile)}
                onChange={onAppLogoDesktopChange}
                onSave={saveAppLogoDesktop}
              />
              <LogoUploadTile
                icon={<Smartphone className="h-4 w-4 text-[#FF6A00]" />}
                label="Logo mobile"
                hint="En-tête sur mobile — format carré."
                fileHint="PNG, JPG, WEBP — carré"
                preview={appLogoMobilePreview}
                previewClassName="h-14 w-14 rounded-xl border border-gray-200 bg-white object-contain"
                error={appLogoMobileError}
                success={appLogoMobileSuccess}
                saving={appLogoMobileSaving}
                canSave={Boolean(appLogoMobileFile)}
                onChange={onAppLogoMobileChange}
                onSave={saveAppLogoMobile}
              />
              <LogoUploadTile
                icon={<AppWindow className="h-4 w-4 text-[#FF6A00]" />}
                label="Icône de l’application"
                hint="Icône PWA & écran d’accueil (iOS/Android)."
                fileHint="PNG carré — 512×512 recommandé"
                preview={appIconPreview}
                previewClassName="h-14 w-14 rounded-2xl border border-gray-200 object-cover shadow-sm"
                error={appIconError}
                success={appIconSuccess}
                saving={appIconSaving}
                canSave={Boolean(appIconFile)}
                onChange={onAppIconChange}
                onSave={saveAppIcon}
              />
              <LogoUploadTile
                icon={<Globe className="h-4 w-4 text-[#FF6A00]" />}
                label="Favicon"
                hint="Petite icône de l’onglet du navigateur."
                fileHint="PNG carré — 32×32 ou 48×48"
                preview={appFaviconPreview}
                previewClassName="h-10 w-10 rounded-lg border border-gray-200 object-cover"
                error={appFaviconError}
                success={appFaviconSuccess}
                saving={appFaviconSaving}
                canSave={Boolean(appFaviconFile)}
                onChange={onAppFaviconChange}
                onSave={saveAppFavicon}
              />
            </div>
          </div>

          {/* Hero Banner (Accueil) */}
          <div id="banniere-hero" className="scroll-mt-24 rounded-2xl border border-gray-200/60 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100">
                <Image size={20} className="text-neutral-600" />
              </div>
              <div>
                <h2 className="text-lg font-black tracking-tight text-gray-900">Bannière du HERO (Accueil)</h2>
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
                  <img src={heroBannerPreview} alt="Bannière HERO" className="h-32 w-full rounded-xl object-cover mx-auto mb-2 border-2 border-neutral-200" />
                  <p className="text-sm text-gray-600">Bannière actuelle</p>
                </div>
              ) : (
                <p className="text-sm text-gray-500">Aucune bannière définie.</p>
              )}
              <label className="mt-2 flex flex-col items-center gap-1 cursor-pointer">
                <Upload size={20} className="text-gray-400" />
                <span className="text-xs text-neutral-600 font-medium">Cliquez pour uploader</span>
                <span className="text-xs text-gray-400">PNG, JPG — 1600×600px recommandé</span>
                <input type="file" accept="image/*" onChange={onHeroBannerChange} className="hidden" />
              </label>
            </div>
            <button
              type="button"
              onClick={saveHeroBanner}
              disabled={heroBannerSaving || !heroBannerFile}
              className="mt-4 w-full rounded-xl bg-neutral-600 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {heroBannerSaving ? 'Mise à jour…' : 'Enregistrer la bannière HERO'}
            </button>
          </div>

          {/* Promo Banner */}
          <div id="banniere-pub" className="scroll-mt-24 rounded-2xl border border-gray-200/60 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100">
                <Image size={20} className="text-neutral-600" />
              </div>
              <div>
                <h2 className="text-lg font-black tracking-tight text-gray-900">Bannière publicitaire</h2>
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
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-neutral-500 focus:border-transparent"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold uppercase text-gray-500">Date de début</label>
                  <input
                    type="date"
                    value={promoBannerStartAt}
                    onChange={(e) => setPromoBannerStartAt(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-neutral-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-gray-500">Date de fin</label>
                  <input
                    type="date"
                    value={promoBannerEndAt}
                    onChange={(e) => setPromoBannerEndAt(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-neutral-500 focus:border-transparent"
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
                  <span className="text-xs text-neutral-600 font-medium">Upload</span>
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
                  <span className="text-xs text-neutral-600 font-medium">Upload</span>
                  <input type="file" accept="image/*" onChange={onPromoBannerMobileChange} className="hidden" />
                </label>
              </div>
            </div>
            <button
              type="button"
              onClick={savePromoBanner}
              disabled={promoBannerSaving}
              className="w-full rounded-xl bg-neutral-600 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {promoBannerSaving ? 'Mise à jour…' : 'Enregistrer la bannière publicitaire'}
            </button>
          </div>

          {/* Splash screen (écran de démarrage) */}
          <div id="demarrage" className="scroll-mt-24 rounded-2xl border border-gray-200/60 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
                <Sparkles size={20} className="text-amber-600" />
              </div>
              <div>
                <h2 className="text-lg font-black tracking-tight text-gray-900">Écran de démarrage</h2>
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
                className="h-4 w-4 rounded border-gray-300 text-neutral-600 focus:ring-neutral-500"
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
                  <span className="text-xs text-neutral-600 font-medium">Choisir une image</span>
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
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-neutral-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500">Entre 1 et 30 secondes. L’utilisateur peut passer avant la fin.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={saveSplash}
              disabled={splashSaving || (splashEnabled && !splashImageFile && !splashImagePreview)}
              className="w-full rounded-xl bg-neutral-600 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {splashSaving ? 'Mise à jour…' : 'Enregistrer l’écran de démarrage'}
            </button>
          </div>

          {/* Animated launch splash (BootSplash) */}
          <div id="splash" className="scroll-mt-24 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#FF6A00] text-white">
                <Monitor size={20} />
              </div>
              <div>
                <h2 className="text-base font-black text-gray-900">Splash animé (lancement)</h2>
                <p className="text-sm font-medium text-gray-500">
                  Animation de marque HD Market affichée au démarrage de l’app. Indépendante de l’écran de démarrage ci-dessus.
                </p>
              </div>
            </div>
            {bootSplashError && <p className="mb-2 text-sm font-semibold text-red-600">{bootSplashError}</p>}
            {bootSplashSuccess && <p className="mb-2 text-sm font-semibold text-emerald-600">{bootSplashSuccess}</p>}
            <div className="mb-5 grid gap-4 sm:grid-cols-2">
              {[
                {
                  key: 'desktop',
                  label: 'Desktop',
                  icon: <Monitor className="h-4 w-4 text-[#FF6A00]" />,
                  enabled: bootSplashDesktopEnabled,
                  setEnabled: setBootSplashDesktopEnabled,
                  duration: bootSplashDesktopDuration,
                  setDuration: setBootSplashDesktopDuration
                },
                {
                  key: 'mobile',
                  label: 'Mobile',
                  icon: <Smartphone className="h-4 w-4 text-[#FF6A00]" />,
                  enabled: bootSplashMobileEnabled,
                  setEnabled: setBootSplashMobileEnabled,
                  duration: bootSplashMobileDuration,
                  setDuration: setBootSplashMobileDuration
                }
              ].map((p) => (
                <div key={p.key} className="rounded-xl border border-gray-100 bg-gray-50 p-3.5">
                  <p className="mb-3 flex items-center gap-2 text-sm font-black text-gray-900">
                    {p.icon} {p.label}
                  </p>
                  <label className="flex cursor-pointer items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={p.enabled}
                      onChange={(e) => p.setEnabled(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-[#FF6A00] focus:ring-[#FF6A00]"
                    />
                    <span className="text-sm font-medium text-gray-700">Activer au lancement</span>
                  </label>
                  <div className="mt-3">
                    <label className="mb-1 block text-xs font-medium text-gray-500">Durée (secondes)</label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      step={0.1}
                      value={p.duration}
                      onChange={(e) => p.setDuration(Math.min(10, Math.max(1, Number(e.target.value) || 2.4)))}
                      disabled={!p.enabled}
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-[#FF6A00] focus:ring-2 focus:ring-orange-100 disabled:opacity-50"
                    />
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={saveBootSplash}
              disabled={bootSplashSaving}
              className="w-full rounded-lg bg-[#FF6A00] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#e85f00] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {bootSplashSaving ? 'Mise à jour…' : 'Enregistrer le splash animé'}
            </button>
          </div>

          {/* Prohibited Words Section */}
          <div id="mots-interdits" className="scroll-mt-24 rounded-2xl border border-gray-200/60 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
                <Shield size={20} className="text-amber-600" />
              </div>
              <div>
                <h2 className="text-lg font-black tracking-tight text-gray-900">Mots interdits</h2>
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
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:ring-2 focus:ring-neutral-500 focus:border-transparent"
                  disabled={prohibitedLoading}
                />
              </div>
              <button
                type="submit"
                disabled={prohibitedLoading || !newProhibitedWord.trim()}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-neutral-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
          <div id="contacts" className="scroll-mt-24 rounded-2xl border border-gray-200/60 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-100">
                <Smartphone size={20} className="text-teal-600" />
              </div>
              <div>
                <h2 className="text-lg font-black tracking-tight text-gray-900">Réseaux de contact</h2>
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
                              if (!(await appConfirm(`Supprimer le réseau "${network.name}" ?`))) return;
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

          {/* Reports Section */}
          <div id="signalements" className="scroll-mt-24 rounded-2xl border border-gray-200/60 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100">
                <Flag size={20} className="text-red-600" />
              </div>
              <div>
                <h2 className="text-lg font-black tracking-tight text-gray-900">Signalements de contenu</h2>
                <p className="text-sm text-gray-500">
                  Consultez et gérez les signalements de commentaires et photos.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
              <div className="flex flex-wrap gap-2">
                <select
                  value={reportsFilter}
                  onChange={(e) => setReportsFilter(e.target.value)}
                  className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent"
                >
                  <option value="all">Tous les statuts</option>
                  <option value="pending">En attente</option>
                  <option value="reviewed">Examiné</option>
                  <option value="resolved">Résolu</option>
                  <option value="dismissed">Rejeté</option>
                </select>
                <select
                  value={reportsTypeFilter}
                  onChange={(e) => setReportsTypeFilter(e.target.value)}
                  className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent"
                >
                  <option value="all">Tous les types</option>
                  <option value="comment">Commentaires</option>
                  <option value="photo">Photos</option>
                  <option value="preview_image">Images (preview)</option>
                </select>
              </div>
              <button
                type="button"
                onClick={loadReports}
                disabled={reportsLoading}
                className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              >
                {reportsLoading ? 'Chargement...' : 'Actualiser'}
              </button>
            </div>

            {reportsLoading ? (
              <div className="py-12 text-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-red-200 border-t-red-600 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Chargement des signalements...</p>
              </div>
            ) : reports.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">Aucun signalement pour le moment.</p>
            ) : (
              <div className="space-y-4">
                {reports.map((report) => (
                  <div key={report._id} className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {report.type === 'comment' ? (
                            <MessageSquare size={16} className="text-neutral-600" />
                          ) : (
                            <FileImage size={16} className="text-neutral-600" />
                          )}
                          <span className="font-semibold text-gray-900">
                            {report.type === 'comment'
                              ? 'Commentaire signalé'
                              : report.type === 'preview_image'
                              ? 'Image signalée (preview)'
                              : 'Photo signalée'}
                          </span>
                          {getStatusBadge(report.status)}
                        </div>
                        <div className="text-xs text-gray-600 space-y-1">
                          <p>
                            <span className="font-medium">Signalé par:</span>{' '}
                            {report.reporter?.name || 'Anonyme'} ({report.reporter?.email || '—'})
                          </p>
                          <p>
                            <span className="font-medium">Utilisateur signalé:</span>{' '}
                            {report.reportedUser?.name || '—'} ({report.reportedUser?.email || '—'})
                          </p>
                          {report.product?._id ? (
                            <p>
                              <span className="font-medium">Produit:</span>{' '}
                              <Link
                                to={`/product/${report.product?.slug || report.product?._id}`}
                                target="_blank"
                                className="text-neutral-600 hover:underline"
                              >
                                {report.product?.title || '—'}
                              </Link>
                            </p>
                          ) : null}
                          {report.shop?._id ? (
                            <p>
                              <span className="font-medium">Boutique:</span>{' '}
                              <Link
                                to={`/shop/${report.shop?.slug || report.shop?._id}`}
                                target="_blank"
                                className="text-neutral-600 hover:underline"
                              >
                                {report.shop?.shopName || report.shop?.name || '—'}
                              </Link>
                            </p>
                          ) : null}
                          {report.type === 'comment' && report.comment && (
                            <div className="mt-2 p-2 bg-white rounded-lg border border-gray-200">
                              <p className="text-xs text-gray-500 mb-1">Commentaire:</p>
                              <p className="text-sm text-gray-700">{report.comment?.message || '—'}</p>
                            </div>
                          )}
                          {(report.type === 'photo' || report.type === 'preview_image') && report.photoUrl && (
                            <div className="mt-2">
                              <img
                                src={report.photoUrl}
                                alt="Photo signalée"
                                className="max-w-xs h-32 object-cover rounded-lg border border-gray-200"
                              />
                            </div>
                          )}
                          {report.reasonCategory && report.reasonCategory !== 'other' ? (
                            <p>
                              <span className="font-medium">Catégorie:</span> {report.reasonCategory}
                            </p>
                          ) : null}
                          {report.reason && (
                            <div className="mt-2 p-2 bg-white rounded-lg border border-gray-200">
                              <p className="text-xs text-gray-500 mb-1">Raison:</p>
                              <p className="text-sm text-gray-700">{report.reason}</p>
                            </div>
                          )}
                          <p className="text-gray-400 mt-2">
                            Signalé le {formatDateTime(report.createdAt)}
                            {report.handledAt && ` · Traité le ${formatDateTime(report.handledAt)}`}
                            {report.handledBy && ` par ${report.handledBy?.name || '—'}`}
                          </p>
                          {report.adminNote && (
                            <div className="mt-2 p-2 bg-neutral-50 rounded-lg border border-neutral-200">
                              <p className="text-xs text-neutral-600 font-medium mb-1">Note admin:</p>
                              <p className="text-sm text-neutral-700">{report.adminNote}</p>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <select
                          value={report.status}
                          onChange={(e) => handleReportStatusChange(report._id, e.target.value)}
                          disabled={updatingReportId === report._id}
                          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs focus:ring-2 focus:ring-red-500"
                        >
                          <option value="pending">En attente</option>
                          <option value="reviewed">Examiné</option>
                          <option value="resolved">Résolu</option>
                          <option value="dismissed">Rejeté</option>
                        </select>
                        {updatingReportId === report._id && (
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-200 border-t-red-600 mx-auto" />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
