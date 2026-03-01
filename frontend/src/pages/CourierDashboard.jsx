import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Camera,
  Check,
  Clock3,
  ExternalLink,
  Loader2,
  LogOut,
  MapPin,
  Package,
  RefreshCcw,
  Route,
  ShieldAlert,
  Truck,
  User,
  X
} from 'lucide-react';
import api from '../services/api';
import BaseModal, { ModalBody, ModalFooter, ModalHeader } from '../components/modals/BaseModal';
import AuthContext from '../context/AuthContext';

const STATUS_FILTERS = [
  { key: 'all', label: 'Toutes' },
  { key: 'PENDING', label: 'À accepter' },
  { key: 'ACCEPTED', label: 'Acceptées' },
  { key: 'IN_PROGRESS', label: 'En cours' },
  { key: 'DELIVERED', label: 'Livrées' }
];

const STAGE_ORDER = [
  'ASSIGNED',
  'ACCEPTED',
  'PICKUP_STARTED',
  'PICKED_UP',
  'IN_TRANSIT',
  'ARRIVED',
  'DELIVERED'
];

const STAGE_LABELS = {
  ASSIGNED: 'Assignée',
  ACCEPTED: 'Acceptée',
  PICKUP_STARTED: 'Départ pickup',
  PICKED_UP: 'Pickup validé',
  IN_TRANSIT: 'En transit',
  ARRIVED: 'Arrivé destination',
  DELIVERED: 'Livrée',
  FAILED: 'Échec'
};

const NEXT_STAGE = {
  ASSIGNED: 'ACCEPTED',
  ACCEPTED: 'PICKUP_STARTED',
  PICKUP_STARTED: 'PICKED_UP',
  PICKED_UP: 'IN_TRANSIT',
  IN_TRANSIT: 'ARRIVED',
  ARRIVED: 'DELIVERED'
};

const normalizeFileUrl = (url = '') => {
  const normalized = String(url || '').trim();
  if (!normalized) return '';
  if (/^https?:\/\//i.test(normalized)) return normalized;
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
  const host = apiBase.replace(/\/api\/?$/, '');
  return `${host}/${normalized.replace(/^\/+/, '')}`;
};

const getLatLng = (geoPoint = null) => {
  const coordinates = Array.isArray(geoPoint?.coordinates) ? geoPoint.coordinates : null;
  if (!coordinates || coordinates.length !== 2) return null;
  const lng = Number(coordinates[0]);
  const lat = Number(coordinates[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
};

const buildMapHref = (geoPoint = null, fallbackAddress = '') => {
  const latLng = getLatLng(geoPoint);
  if (latLng) {
    return `https://www.google.com/maps?q=${latLng.lat},${latLng.lng}`;
  }
  const address = String(fallbackAddress || '').trim();
  if (!address) return '';
  return `https://www.google.com/maps?q=${encodeURIComponent(address)}`;
};

const fmtDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const extractMessage = (error, fallback) =>
  error?.response?.data?.message || error?.response?.data?.details?.[0] || fallback;

export default function CourierDashboard() {
  const { logout } = useContext(AuthContext);
  const location = useLocation();
  const queryClient = useQueryClient();
  const useLegacyCourierApi = location.pathname.startsWith('/courier');
  const apiPrefix = useLegacyCourierApi ? '/courier' : '/delivery';
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedDeliveryGuyId, setSelectedDeliveryGuyId] = useState('');
  const [selected, setSelected] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [proofModal, setProofModal] = useState({ open: false, type: 'pickup', item: null });
  const [proofPhoto, setProofPhoto] = useState(null);
  const [proofSignatureFile, setProofSignatureFile] = useState(null);
  const [proofSignatureUrl, setProofSignatureUrl] = useState('');
  const [proofNote, setProofNote] = useState('');
  const [pinCode, setPinCode] = useState('');

  const bootstrapQuery = useQuery({
    queryKey: ['courier', 'bootstrap', apiPrefix],
    queryFn: async () => {
      const { data } = await api.get(`${apiPrefix}/bootstrap`);
      return data || {};
    },
    staleTime: 30_000,
    retry: 1
  });

  const previewMode = Boolean(bootstrapQuery.data?.previewMode);
  const availableDeliveryGuys = useMemo(
    () => (Array.isArray(bootstrapQuery.data?.availableDeliveryGuys) ? bootstrapQuery.data.availableDeliveryGuys : []),
    [bootstrapQuery.data?.availableDeliveryGuys]
  );

  useEffect(() => {
    if (!previewMode) {
      if (selectedDeliveryGuyId) setSelectedDeliveryGuyId('');
      return;
    }
    if (!availableDeliveryGuys.length) {
      if (selectedDeliveryGuyId) setSelectedDeliveryGuyId('');
      return;
    }
    if (selectedDeliveryGuyId && availableDeliveryGuys.some((entry) => String(entry?._id || '') === selectedDeliveryGuyId)) {
      return;
    }
    if (availableDeliveryGuys.length === 1) {
      setSelectedDeliveryGuyId(String(availableDeliveryGuys[0]?._id || ''));
    }
  }, [previewMode, availableDeliveryGuys, selectedDeliveryGuyId]);

  useEffect(() => {
    setSelected(null);
    setRejectReason('');
    setPinCode('');
  }, [selectedDeliveryGuyId, previewMode]);

  const params = useMemo(() => {
    const p = new URLSearchParams();
    p.set('date', 'today');
    if (statusFilter !== 'all') p.set('status', statusFilter);
    if (previewMode && selectedDeliveryGuyId) p.set('deliveryGuyId', selectedDeliveryGuyId);
    p.set('limit', '30');
    return p.toString();
  }, [statusFilter, previewMode, selectedDeliveryGuyId]);

  const assignmentsQuery = useQuery({
    queryKey: ['courier', 'assignments', apiPrefix, params, previewMode, selectedDeliveryGuyId],
    queryFn: async () => {
      const endpoint = useLegacyCourierApi ? `/assignments?${params}` : `/jobs?${params}`;
      const { data } = await api.get(`${apiPrefix}${endpoint}`);
      return data || { items: [], total: 0 };
    },
    enabled: bootstrapQuery.isSuccess && (!previewMode || Boolean(selectedDeliveryGuyId)),
    staleTime: 15_000,
    retry: 1,
    refetchInterval: 10_000
  });

  const refetchAll = () => {
    queryClient.invalidateQueries({ queryKey: ['courier'] });
  };

  const acceptMutation = useMutation({
    mutationFn: async ({ id }) => {
      const payload = previewMode && selectedDeliveryGuyId ? { deliveryGuyId: selectedDeliveryGuyId } : {};
      const endpoint = useLegacyCourierApi ? `/assignments/${id}/accept` : `/jobs/${id}/accept`;
      const { data } = await api.patch(`${apiPrefix}${endpoint}`, payload);
      return data;
    },
    onSuccess: () => {
      setRejectReason('');
      refetchAll();
    }
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }) => {
      const endpoint = useLegacyCourierApi ? `/assignments/${id}/reject` : `/jobs/${id}/reject`;
      const { data } = await api.patch(`${apiPrefix}${endpoint}`, {
        reason,
        ...(previewMode && selectedDeliveryGuyId ? { deliveryGuyId: selectedDeliveryGuyId } : {})
      });
      return data;
    },
    onSuccess: () => {
      setSelected(null);
      setRejectReason('');
      refetchAll();
    }
  });

  const stageMutation = useMutation({
    mutationFn: async ({ id, stage, note, deliveryPinCode }) => {
      const endpoint = useLegacyCourierApi ? `/assignments/${id}/stage` : `/jobs/${id}/stage`;
      const { data } = await api.patch(`${apiPrefix}${endpoint}`, {
        stage,
        note,
        deliveryPinCode,
        ...(previewMode && selectedDeliveryGuyId ? { deliveryGuyId: selectedDeliveryGuyId } : {})
      });
      return data;
    },
    onSuccess: (payload) => {
      setSelected(payload?.item || null);
      setPinCode('');
      refetchAll();
    }
  });

  const proofMutation = useMutation({
    mutationFn: async ({ id, proofType }) => {
      const formData = new FormData();
      formData.append('proofType', proofType);
      if (proofPhoto) formData.append('photos', proofPhoto);
      if (proofSignatureFile) formData.append('signatureFile', proofSignatureFile);
      if (proofSignatureUrl.trim()) formData.append('signatureUrl', proofSignatureUrl.trim());
      if (proofNote.trim()) formData.append('note', proofNote.trim());
      if (pinCode.trim()) formData.append('deliveryPinCode', pinCode.trim());
      if (previewMode && selectedDeliveryGuyId) formData.append('deliveryGuyId', selectedDeliveryGuyId);
      const endpoint = useLegacyCourierApi ? `/assignments/${id}/proof` : `/jobs/${id}/proof`;
      const { data } = await api.post(`${apiPrefix}${endpoint}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return data;
    },
    onSuccess: (payload) => {
      setProofModal({ open: false, type: 'pickup', item: null });
      setProofPhoto(null);
      setProofSignatureFile(null);
      setProofSignatureUrl('');
      setProofNote('');
      setPinCode('');
      setSelected(payload?.item || null);
      refetchAll();
    }
  });

  const items = Array.isArray(assignmentsQuery.data?.items) ? assignmentsQuery.data.items : [];
  const statsQuery = useQuery({
    queryKey: ['courier', 'stats', apiPrefix],
    queryFn: async () => {
      const { data } = await api.get(`${apiPrefix}/stats`);
      return data || null;
    },
    enabled: bootstrapQuery.isSuccess && !previewMode,
    staleTime: 30_000,
    retry: 1
  });
  const deliveryStats = statsQuery.data?.stats || null;
  const stats = useMemo(() => {
    const initial = { total: 0, pending: 0, inProgress: 0, delivered: 0 };
    return items.reduce((acc, item) => {
      acc.total += 1;
      const assignmentStatus = String(item.assignmentStatus || '').toUpperCase();
      const status = String(item.status || '').toUpperCase();
      if (assignmentStatus === 'PENDING') acc.pending += 1;
      if (status === 'IN_PROGRESS') acc.inProgress += 1;
      if (status === 'DELIVERED') acc.delivered += 1;
      return acc;
    }, initial);
  }, [items]);

  const loading = bootstrapQuery.isLoading || assignmentsQuery.isLoading;
  const hardError = bootstrapQuery.error || assignmentsQuery.error;
  const modeEnabled = bootstrapQuery.data?.enabled !== false;
  const selectedDeliveryGuy = availableDeliveryGuys.find(
    (entry) => String(entry?._id || '') === String(selectedDeliveryGuyId || '')
  );

  const selectedCurrentStage = String(selected?.currentStage || '').toUpperCase();
  const nextStage = NEXT_STAGE[selectedCurrentStage] || '';

  const openProof = (item, type) => {
    setProofModal({ open: true, type, item });
    setProofPhoto(null);
    setProofSignatureFile(null);
    setProofSignatureUrl('');
    setProofNote('');
    setPinCode('');
  };

  const handleLogout = async () => {
    try {
      await api.post(`${apiPrefix}/logout-event`);
    } catch {
      // best effort audit event
    }
    await logout();
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 px-3 py-4 sm:px-5">
      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Courier mode</p>
            <h1 className="mt-1 text-xl font-bold text-slate-900">Tableau livreur</h1>
            <p className="mt-1 text-xs text-slate-500">
              {previewMode
                ? `${selectedDeliveryGuy?.fullName || 'Aperçu admin'} · ${selectedDeliveryGuy?.phone || 'Sélection requise'}`
                : `${bootstrapQuery.data?.deliveryGuy?.fullName || 'Livreur'} · ${bootstrapQuery.data?.deliveryGuy?.phone || '—'}`}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {!previewMode && (
              <Link
                to="/my"
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    window.localStorage.setItem('hdmarket:courier-view-mode', 'normal');
                  }
                }}
                className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <User size={14} />
                Compte normal
              </Link>
            )}
            <button
              type="button"
              onClick={refetchAll}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700"
            >
              <RefreshCcw size={15} className={assignmentsQuery.isFetching ? 'animate-spin' : ''} />
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl border border-red-200 bg-red-50 px-3 text-xs font-semibold text-red-700"
            >
              <LogOut size={14} />
              Déconnexion
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-[11px] text-slate-500">Total</p>
            <p className="text-lg font-bold text-slate-900">{stats.total}</p>
          </div>
          <div className="rounded-2xl border border-amber-100 bg-amber-50 px-3 py-2">
            <p className="text-[11px] text-amber-700">À accepter</p>
            <p className="text-lg font-bold text-amber-800">{stats.pending}</p>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-2">
            <p className="text-[11px] text-emerald-700">Livrées</p>
            <p className="text-lg font-bold text-emerald-800">{stats.delivered}</p>
          </div>
          <div className="rounded-2xl border border-blue-100 bg-blue-50 px-3 py-2">
            <p className="text-[11px] text-blue-700">Complétion</p>
            <p className="text-lg font-bold text-blue-800">
              {deliveryStats ? `${deliveryStats.completionRate || 0}%` : '—'}
            </p>
          </div>
        </div>
        {previewMode ? (
          <div className="mt-3 rounded-2xl border border-indigo-200 bg-indigo-50 p-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-indigo-700">Mode admin</p>
            <p className="mt-1 text-xs text-indigo-700/90">
              Sélectionnez un livreur pour consulter et opérer ses affectations.
            </p>
            <label className="mt-2 block">
              <span className="sr-only">Sélection livreur</span>
              <select
                value={selectedDeliveryGuyId}
                onChange={(event) => setSelectedDeliveryGuyId(event.target.value)}
                className="w-full rounded-xl border border-indigo-200 bg-white px-3 py-2 text-sm text-slate-800"
              >
                <option value="">Choisir un livreur</option>
                {availableDeliveryGuys.map((entry) => (
                  <option key={entry._id} value={entry._id}>
                    {entry.fullName || 'Livreur'}{entry.phone ? ` · ${entry.phone}` : ''}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.key}
              type="button"
              onClick={() => setStatusFilter(filter.key)}
              className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold ${
                statusFilter === filter.key
                  ? 'border-neutral-900 bg-neutral-900 text-white'
                  : 'border-slate-200 bg-white text-slate-700'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </section>

      {loading ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-slate-500">
          <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
          Chargement des affectations…
        </div>
      ) : hardError ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {extractMessage(hardError, 'Impossible de charger le mode livreur.')}
        </div>
      ) : !modeEnabled ? (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Le mode livreur est désactivé par la configuration système.
        </div>
      ) : previewMode && !selectedDeliveryGuyId ? (
        <div className="rounded-3xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-800">
          Choisissez un livreur dans la carte en haut pour afficher les affectations.
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-slate-500">
          <ShieldAlert className="mx-auto mb-2 h-5 w-5" />
          Aucune affectation pour ce filtre.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const assignmentStatus = String(item.assignmentStatus || '').toUpperCase();
            const status = String(item.status || '').toUpperCase();
            const canAccept = assignmentStatus === 'PENDING';
            const canReject = assignmentStatus === 'PENDING';
            const isProgressing = ['ACCEPTED', 'IN_PROGRESS'].includes(status);
            const dropoffCommuneName = item?.dropoff?.communeName || item?.buyer?.commune || '—';
            const dropoffCityName = item?.dropoff?.cityName || item?.buyer?.city || '—';
            const dropoffAddress = item?.dropoff?.address || item?.buyer?.address || '—';
            const hasDeliveryPin = Boolean(String(item?.deliveryPinCode || '').trim());
            const pickupMapHref = buildMapHref(
              item?.pickup?.coordinates,
              `${item?.pickup?.address || ''} ${item?.pickup?.communeName || ''} ${item?.pickup?.cityName || ''}`
            );
            const dropoffMapHref = buildMapHref(
              item?.dropoff?.coordinates,
              `${dropoffAddress} ${dropoffCommuneName} ${dropoffCityName}`
            );
            return (
              <article
                key={item._id}
                className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] text-slate-500">Commande #{String(item.orderId || '').slice(-6)}</p>
                    <p className="text-sm font-semibold text-slate-900">{STAGE_LABELS[item.currentStage] || item.currentStage}</p>
                    <p className="text-xs text-slate-500">{fmtDateTime(item.createdAt)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelected(item)}
                    className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700"
                  >
                    Détails
                  </button>
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <div className="rounded-2xl bg-slate-50 p-2.5">
                    <p className="flex items-center gap-1 text-[11px] font-semibold uppercase text-slate-500">
                      <MapPin size={12} /> Pickup
                    </p>
                    <p className="text-sm font-medium text-slate-900">{item.pickup?.communeName || '—'} · {item.pickup?.cityName || '—'}</p>
                    <p className="text-xs text-slate-500">{item.pickup?.address || '—'}</p>
                    {pickupMapHref ? (
                      <a
                        href={pickupMapHref}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-slate-700 underline"
                      >
                        Ouvrir Maps <ExternalLink size={11} />
                      </a>
                    ) : null}
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-2.5">
                    <p className="flex items-center gap-1 text-[11px] font-semibold uppercase text-slate-500">
                      <Route size={12} /> Dropoff
                    </p>
                    <p className="text-sm font-medium text-slate-900">{dropoffCommuneName} · {dropoffCityName}</p>
                    <p className="text-xs text-slate-500">{dropoffAddress}</p>
                    {dropoffMapHref ? (
                      <a
                        href={dropoffMapHref}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-slate-700 underline"
                      >
                        Ouvrir Maps <ExternalLink size={11} />
                      </a>
                    ) : null}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                  <Package size={13} />
                  {(Array.isArray(item.itemsSnapshot) ? item.itemsSnapshot : []).length} article(s)
                  <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-800">
                    Code livraison: {hasDeliveryPin ? item.deliveryPinCode : '—'}
                  </span>
                  <span className="ml-auto rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">
                    Frais: {Number(item.deliveryPrice || item.deliveryFee || 0).toLocaleString('fr-FR')} {item.currency || 'XAF'}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={!canAccept || acceptMutation.isPending}
                    onClick={() => acceptMutation.mutate({ id: item._id })}
                    className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 disabled:opacity-50"
                  >
                    {acceptMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                    Accepter
                  </button>
                  <button
                    type="button"
                    disabled={!canReject || rejectMutation.isPending}
                    onClick={() => {
                      setSelected(item);
                      setRejectReason('');
                    }}
                    className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-red-200 bg-red-50 px-3 text-xs font-semibold text-red-700 disabled:opacity-50"
                  >
                    <X size={12} />
                    Refuser
                  </button>
                  <button
                    type="button"
                    disabled={!isProgressing || stageMutation.isPending}
                    onClick={() => setSelected(item)}
                    className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-700 disabled:opacity-50"
                  >
                    <Truck size={12} />
                    Mettre à jour
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <BaseModal
        isOpen={Boolean(selected)}
        onClose={() => {
          setSelected(null);
          setRejectReason('');
          setPinCode('');
        }}
        panelClassName="w-full max-w-2xl"
        ariaLabel="Détails livraison"
      >
        <ModalHeader
          title={selected ? `Commande #${String(selected.orderId || '').slice(-6)}` : 'Détails livraison'}
          subtitle={
            selected
              ? `${selected.pickup?.communeName || '—'} → ${selected.dropoff?.communeName || selected?.buyer?.commune || '—'}`
              : ''
          }
          onClose={() => {
            setSelected(null);
            setRejectReason('');
            setPinCode('');
          }}
        />
        <ModalBody className="space-y-4">
          {selected ? (
            <>
              <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                {STAGE_ORDER.map((stage) => {
                  const stageIndex = STAGE_ORDER.indexOf(stage);
                  const currentIndex = STAGE_ORDER.indexOf(String(selected.currentStage || 'ASSIGNED').toUpperCase());
                  const done = currentIndex >= 0 && stageIndex <= currentIndex;
                  return (
                    <div
                      key={stage}
                      className={`rounded-xl border px-2 py-2 ${done ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-500'}`}
                    >
                      {STAGE_LABELS[stage] || stage}
                    </div>
                  );
                })}
              </div>

              {selected.order ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Détails commande
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    Commande #{String(selected.order._id || selected.orderId || '').slice(-6) || '—'}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    Statut commande : {selected.order.status || '—'}
                  </p>
                  <p className="text-xs text-slate-600">
                    Statut livraison plateforme : {selected.order.platformDeliveryStatus || '—'}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Mode : {selected.order.deliveryMode || '—'} · Adresse :{' '}
                    {[selected.order.deliveryAddress, selected.order.deliveryCity].filter(Boolean).join(', ') || '—'}
                  </p>
                </div>
              ) : null}

              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Pickup</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {selected.pickup?.communeName || '—'} · {selected.pickup?.cityName || '—'}
                  </p>
                  <p className="text-xs text-slate-500">{selected.pickup?.address || '—'}</p>
                  {buildMapHref(
                    selected?.pickup?.coordinates,
                    `${selected?.pickup?.address || ''} ${selected?.pickup?.communeName || ''} ${selected?.pickup?.cityName || ''}`
                  ) ? (
                    <a
                      href={buildMapHref(
                        selected?.pickup?.coordinates,
                        `${selected?.pickup?.address || ''} ${selected?.pickup?.communeName || ''} ${selected?.pickup?.cityName || ''}`
                      )}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-slate-700 underline"
                    >
                      Ouvrir Maps <ExternalLink size={11} />
                    </a>
                  ) : null}
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Dropoff</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {selected.dropoff?.communeName || selected.buyer?.commune || '—'} ·{' '}
                    {selected.dropoff?.cityName || selected.buyer?.city || '—'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {selected.dropoff?.address || selected.buyer?.address || '—'}
                  </p>
                  {buildMapHref(
                    selected?.dropoff?.coordinates,
                    `${selected?.dropoff?.address || selected?.buyer?.address || ''} ${selected?.dropoff?.communeName || selected?.buyer?.commune || ''} ${selected?.dropoff?.cityName || selected?.buyer?.city || ''}`
                  ) ? (
                    <a
                      href={buildMapHref(
                        selected?.dropoff?.coordinates,
                        `${selected?.dropoff?.address || selected?.buyer?.address || ''} ${selected?.dropoff?.communeName || selected?.buyer?.commune || ''} ${selected?.dropoff?.cityName || selected?.buyer?.city || ''}`
                      )}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-slate-700 underline"
                    >
                      Ouvrir Maps <ExternalLink size={11} />
                    </a>
                  ) : null}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Frais livraison</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {Number(selected.deliveryPrice ?? selected.deliveryFee ?? 0).toLocaleString('fr-FR')} {selected.currency || 'XAF'}
                </p>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-700">
                  Code livraison
                </p>
                {String(selected.deliveryPinCode || '').trim() ? (
                  <>
                    <p className="mt-1 text-lg font-black tracking-[0.2em] text-amber-900">
                      {selected.deliveryPinCode}
                    </p>
                    <p className="text-xs text-amber-700">
                      Expire: {fmtDateTime(selected.deliveryPinCodeExpiresAt)}
                    </p>
                  </>
                ) : (
                  <p className="mt-1 text-xs text-amber-700">
                    Aucun code requis pour cette livraison.
                  </p>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase text-slate-500">Articles</p>
                <div className="mt-2 space-y-2">
                  {(Array.isArray(selected.itemsSnapshot) ? selected.itemsSnapshot : []).map((entry, index) => (
                    <div key={`${entry.productId || index}`} className="flex items-center gap-2 rounded-xl bg-white p-2">
                      {entry.imageUrl ? (
                        <img
                          src={normalizeFileUrl(entry.imageUrl)}
                          alt={entry.name || 'Produit'}
                          className="h-11 w-11 rounded-lg object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="h-11 w-11 rounded-lg bg-slate-100" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900">{entry.name || 'Produit'}</p>
                        <p className="text-xs text-slate-500">Qté: {entry.qty || 1}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => openProof(selected, 'pickup')}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 text-sm font-semibold text-indigo-700"
                >
                  <Camera size={14} />
                  Preuve pickup
                </button>
                <button
                  type="button"
                  onClick={() => openProof(selected, 'delivery')}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 text-sm font-semibold text-violet-700"
                >
                  <Camera size={14} />
                  Preuve livraison
                </button>
              </div>

              {rejectReason ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                  <textarea
                    value={rejectReason}
                    onChange={(event) => setRejectReason(event.target.value)}
                    rows={3}
                    placeholder="Motif du refus"
                    className="w-full rounded-xl border border-red-200 px-3 py-2 text-sm"
                  />
                </div>
              ) : null}

              {(stageMutation.isError || rejectMutation.isError || acceptMutation.isError) ? (
                <p className="text-xs text-red-600">
                  {extractMessage(stageMutation.error || rejectMutation.error || acceptMutation.error, 'Action impossible.')}
                </p>
              ) : null}
            </>
          ) : null}
        </ModalBody>
        <ModalFooter>
          {selected ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <button
                type="button"
                disabled={!nextStage || stageMutation.isPending}
                onClick={() =>
                  stageMutation.mutate({
                    id: selected._id,
                    stage: nextStage,
                    deliveryPinCode: nextStage === 'DELIVERED' ? pinCode : undefined
                  })
                }
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-neutral-900 px-4 text-sm font-semibold text-white disabled:opacity-50"
              >
                {stageMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Truck size={14} />}
                {nextStage ? `Passer: ${STAGE_LABELS[nextStage] || nextStage}` : 'Aucune étape'}
              </button>
              <button
                type="button"
                disabled={rejectMutation.isPending || !rejectReason.trim()}
                onClick={() => rejectMutation.mutate({ id: selected._id, reason: rejectReason.trim() })}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-700 disabled:opacity-50"
              >
                {rejectMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
                Refuser affectation
              </button>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700"
              >
                Fermer
              </button>
            </div>
          ) : null}
          {nextStage === 'DELIVERED' ? (
            <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
              <label className="text-xs font-medium text-slate-600">Code livraison (si requis)</label>
              <div className="mt-1 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                <Clock3 size={14} className="text-slate-400" />
                <input
                  value={pinCode}
                  onChange={(event) => setPinCode(event.target.value)}
                  inputMode="numeric"
                  placeholder="Code client"
                  className="w-full border-none bg-transparent text-sm outline-none"
                />
              </div>
            </div>
          ) : null}
        </ModalFooter>
      </BaseModal>

      <BaseModal
        isOpen={proofModal.open}
        onClose={() => {
          setProofModal({ open: false, type: 'pickup', item: null });
          setProofPhoto(null);
          setProofSignatureFile(null);
          setProofSignatureUrl('');
          setProofNote('');
          setPinCode('');
        }}
        panelClassName="w-full max-w-md"
      >
        <ModalHeader
          title={proofModal.type === 'delivery' ? 'Preuve livraison' : 'Preuve pickup'}
          subtitle="Ajoutez photo, signature ou note"
          onClose={() => {
            setProofModal({ open: false, type: 'pickup', item: null });
            setProofPhoto(null);
            setProofSignatureFile(null);
            setProofSignatureUrl('');
            setProofNote('');
            setPinCode('');
          }}
        />
        <ModalBody className="space-y-3">
          <label className="block text-xs font-semibold text-slate-700">
            Photo
            <input
              type="file"
              accept="image/*"
              onChange={(event) => setProofPhoto(event.target.files?.[0] || null)}
              className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs font-semibold text-slate-700">
            Signature (fichier)
            <input
              type="file"
              accept="image/*"
              onChange={(event) => setProofSignatureFile(event.target.files?.[0] || null)}
              className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <input
            value={proofSignatureUrl}
            onChange={(event) => setProofSignatureUrl(event.target.value)}
            placeholder="ou URL signature"
            data-autofocus
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
          <textarea
            value={proofNote}
            onChange={(event) => setProofNote(event.target.value)}
            rows={3}
            placeholder="Note"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
          {proofModal.type === 'delivery' ? (
            <input
              value={pinCode}
              onChange={(event) => setPinCode(event.target.value)}
              placeholder="Code livraison (si requis)"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          ) : null}
          {proofMutation.isError ? (
            <p className="text-xs text-red-600">
              {extractMessage(proofMutation.error, 'Impossible d’envoyer la preuve.')}
            </p>
          ) : null}
        </ModalBody>
        <ModalFooter>
          <button
            type="button"
            disabled={proofMutation.isPending || !proofModal.item?._id}
            onClick={() =>
              proofMutation.mutate({
                id: proofModal.item?._id,
                proofType: proofModal.type
              })
            }
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-neutral-900 px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            {proofMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
            Enregistrer la preuve
          </button>
        </ModalFooter>
      </BaseModal>
    </div>
  );
}
