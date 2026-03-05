import React, { useContext, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, History, Loader2, LogOut, MapPin } from 'lucide-react';
import api from '../../services/api';
import AuthContext from '../../context/AuthContext';
import DeliveryHeader from '../../components/delivery/DeliveryHeader';
import OfflineBanner from '../../components/delivery/OfflineBanner';
import {
  extractMessage,
  formatCurrency,
  getApiModeFromPath
} from '../../utils/deliveryUi';
import { resolveDeliveryGuyProfileImage } from '../../utils/deliveryGuyAvatar';

const GEOLOCATION_CAPTURE_TIMEOUT_MS = 15000;

const parseCoords = (location) => {
  const coords = Array.isArray(location?.coordinates) ? location.coordinates : null;
  if (!coords || coords.length !== 2) return null;
  const lng = Number(coords[0]);
  const lat = Number(coords[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
};

export default function DeliveryProfile() {
  const location = useLocation();
  const { apiPrefix, routePrefix } = useMemo(() => getApiModeFromPath(location.pathname), [location.pathname]);
  const { user, updateUser, logout } = useContext(AuthContext);
  const queryClient = useQueryClient();

  const [isOffline, setIsOffline] = useState(typeof navigator !== 'undefined' ? !navigator.onLine : false);
  const [capturing, setCapturing] = useState(false);
  const [savingManual, setSavingManual] = useState(false);
  const [manualLat, setManualLat] = useState('');
  const [manualLng, setManualLng] = useState('');
  const [positionMessage, setPositionMessage] = useState('');
  const [positionError, setPositionError] = useState('');

  React.useEffect(() => {
    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const meQuery = useQuery({
    queryKey: ['delivery', 'profile', apiPrefix],
    queryFn: async () => {
      const { data } = await api.get(`${apiPrefix}/me`);
      return data || {};
    },
    staleTime: 30_000,
    retry: 1
  });

  const statsQuery = useQuery({
    queryKey: ['delivery', 'stats', apiPrefix],
    queryFn: async () => {
      const { data } = await api.get(`${apiPrefix}/stats`);
      return data?.stats || null;
    },
    staleTime: 30_000,
    retry: 1
  });

  const currentCoords = parseCoords(user?.location);

  const saveCoordinates = async ({ latitude, longitude, source = 'gps', accuracy = null }) => {
    const { data } = await api.put(
      '/users/profile/location',
      {
        latitude,
        longitude,
        accuracy,
        source
      }
    );

    if (data?.user) {
      await updateUser(data.user);
    }

    queryClient.invalidateQueries({ queryKey: ['delivery'] });
    setPositionMessage('Position enregistree avec succes.');
    setPositionError('');
  };

  const captureAgentCoordinates = async () => {
    if (isOffline || capturing) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setPositionError('Geolocalisation indisponible sur cet appareil.');
      return;
    }

    setCapturing(true);
    setPositionError('');
    setPositionMessage('');

    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: GEOLOCATION_CAPTURE_TIMEOUT_MS,
          maximumAge: 5000
        });
      });

      const latitude = Number(position?.coords?.latitude);
      const longitude = Number(position?.coords?.longitude);
      const accuracy = Number(position?.coords?.accuracy || 0);

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        throw new Error('Coordonnees GPS invalides.');
      }

      await saveCoordinates({ latitude, longitude, accuracy, source: 'gps' });
    } catch (error) {
      setPositionError(error?.message || 'Impossible de capturer la position.');
    } finally {
      setCapturing(false);
    }
  };

  const saveManualCoordinates = async () => {
    if (savingManual || isOffline) return;
    const latitude = Number(manualLat);
    const longitude = Number(manualLng);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setPositionError('Latitude/Longitude invalides.');
      return;
    }
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      setPositionError('Coordonnees hors limites.');
      return;
    }

    setSavingManual(true);
    setPositionError('');
    setPositionMessage('');
    try {
      await saveCoordinates({ latitude, longitude, source: 'manual' });
    } catch (error) {
      setPositionError(extractMessage(error, 'Impossible d’enregistrer les coordonnees.'));
    } finally {
      setSavingManual(false);
    }
  };

  const handleLogout = async () => {
    try {
      await api.post(`${apiPrefix}/logout-event`, {});
    } catch {
      // best effort
    }
    queryClient.clear();
    await logout();
  };

  const profile = meQuery.data?.deliveryGuy || {};
  const runtime = meQuery.data?.runtime || {};
  const stats = statsQuery.data || null;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 px-3 pb-20 pt-2 sm:px-5">
      <OfflineBanner offline={isOffline} />

      <DeliveryHeader
        title="Profil livreur"
        subtitle="Coordonnees, securite et performance"
        online={!isOffline}
        actions={[
          { key: 'back', label: 'Dashboard', to: `${routePrefix}/dashboard`, icon: ArrowLeft },
          { key: 'history', label: 'History', to: `${routePrefix}/history`, icon: History },
          { key: 'logout', label: 'Logout', onClick: handleLogout, icon: LogOut, tone: 'danger' }
        ]}
      />

      {meQuery.isLoading ? (
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="inline-flex items-center gap-2 text-sm text-gray-500">
            <Loader2 size={14} className="animate-spin" /> Chargement du profil...
          </p>
        </div>
      ) : meQuery.isError ? (
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-red-700">
            {extractMessage(meQuery.error, 'Impossible de charger votre profil livreur.')}
          </p>
          <button
            type="button"
            onClick={() => meQuery.refetch()}
            className="mt-3 inline-flex min-h-[44px] items-center rounded-xl bg-gray-900 px-3 text-sm font-semibold text-white"
          >
            Reessayer
          </button>
        </div>
      ) : (
        <>
          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">Identite</p>
            <div className="mt-3 flex items-start gap-3">
              {resolveDeliveryGuyProfileImage(profile) ? (
                <img
                  src={resolveDeliveryGuyProfileImage(profile)}
                  alt={profile.fullName || 'Livreur'}
                  className="h-14 w-14 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-base font-semibold text-gray-600">
                  {String(profile.fullName || profile.name || 'L').charAt(0).toUpperCase()}
                </div>
              )}
              <div className="space-y-1 text-sm text-gray-700">
                <p>Nom: <span className="font-semibold text-gray-900">{profile.fullName || profile.name || '—'}</span></p>
                <p>Telephone: <span className="font-semibold text-gray-900">{profile.phone || '—'}</span></p>
                <p>Role: <span className="font-semibold text-gray-900">{String(meQuery.data?.role || '').toUpperCase() || '—'}</span></p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">Position agent</p>
            <p className="mt-2 text-xs text-gray-500">
              Capturez la position actuelle du livreur pour les futures logiques de distance et de confidentialite.
            </p>

            <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
              <button
                type="button"
                onClick={captureAgentCoordinates}
                disabled={capturing || isOffline}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 text-sm font-semibold text-white disabled:opacity-60"
              >
                {capturing ? <Loader2 size={14} className="animate-spin" /> : <MapPin size={14} />}
                {capturing ? 'Capture...' : 'Capture agent coordinates'}
              </button>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <input
                value={manualLat}
                onChange={(event) => setManualLat(event.target.value)}
                placeholder="Latitude"
                className="min-h-[44px] rounded-xl border border-gray-200 px-3 text-sm"
              />
              <input
                value={manualLng}
                onChange={(event) => setManualLng(event.target.value)}
                placeholder="Longitude"
                className="min-h-[44px] rounded-xl border border-gray-200 px-3 text-sm"
              />
            </div>
            <button
              type="button"
              onClick={saveManualCoordinates}
              disabled={savingManual || isOffline}
              className="mt-2 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 text-sm font-semibold text-gray-700 disabled:opacity-60"
            >
              {savingManual ? <Loader2 size={14} className="animate-spin" /> : null}
              Enregistrer position manuelle
            </button>

            {currentCoords ? (
              <p className="mt-3 text-xs text-emerald-700">
                Position actuelle: {currentCoords.lat.toFixed(6)}, {currentCoords.lng.toFixed(6)}
              </p>
            ) : (
              <p className="mt-3 text-xs text-gray-500">Aucune position agent enregistree.</p>
            )}
            {positionError ? <p className="mt-2 text-xs text-red-600">{positionError}</p> : null}
            {positionMessage ? <p className="mt-2 text-xs text-emerald-700">{positionMessage}</p> : null}
          </section>

          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">Mini analytics</p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-gray-700 sm:grid-cols-3">
              <article className="rounded-xl bg-gray-50 p-3">
                <p className="text-xs text-gray-500">Completed</p>
                <p className="mt-1 font-semibold text-gray-900">{stats?.delivered ?? '—'}</p>
              </article>
              <article className="rounded-xl bg-gray-50 p-3">
                <p className="text-xs text-gray-500">Failed</p>
                <p className="mt-1 font-semibold text-gray-900">{stats?.failed ?? '—'}</p>
              </article>
              <article className="rounded-xl bg-gray-50 p-3">
                <p className="text-xs text-gray-500">Acceptance</p>
                <p className="mt-1 font-semibold text-gray-900">{stats ? `${stats.acceptanceRate || 0}%` : '—'}</p>
              </article>
              <article className="rounded-xl bg-gray-50 p-3">
                <p className="text-xs text-gray-500">Avg pickup</p>
                <p className="mt-1 font-semibold text-gray-900">{stats?.avgAcceptToPickupMinutes ? `${stats.avgAcceptToPickupMinutes} min` : '—'}</p>
              </article>
              <article className="rounded-xl bg-gray-50 p-3">
                <p className="text-xs text-gray-500">Avg route</p>
                <p className="mt-1 font-semibold text-gray-900">{stats?.avgPickupToDeliveredMinutes ? `${stats.avgPickupToDeliveredMinutes} min` : '—'}</p>
              </article>
              <article className="rounded-xl bg-indigo-50 p-3">
                <p className="text-xs text-indigo-700">Total earnings</p>
                <p className="mt-1 font-semibold text-indigo-900">{stats ? formatCurrency(stats.deliveryFeeRevenue || 0) : '—'}</p>
              </article>
            </div>
          </section>

          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">Runtime guardrails</p>
            <div className="mt-2 space-y-1 text-xs text-gray-600">
              <p>Proof upload: <span className="font-semibold text-gray-800">{runtime.enableProofUpload ? 'Enabled' : 'Disabled'}</span></p>
              <p>PIN code: <span className="font-semibold text-gray-800">{runtime.enableDeliveryPinCode ? 'Enabled' : 'Disabled'}</span></p>
              <p>Location lock: <span className="font-semibold text-gray-800">{runtime.locationLockEnabled ? 'Enabled' : 'Disabled'}</span></p>
              <p>Lock threshold: <span className="font-semibold text-gray-800">{Number(runtime.locationLockDistanceMeters || 0)} m</span></p>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
