import React, { useContext, useEffect, useState } from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import { ArrowPathIcon, ArrowUpTrayIcon, PhoneIcon, PhotoIcon, ShieldCheckIcon, WalletIcon, XMarkIcon } from '@heroicons/react/24/outline';
import api, { getApiErrorMessage } from '../services/api';
import AuthContext from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { formatPriceWithStoredSettings as formatCurrency } from '../utils/priceFormatter';
import GlassHeader from '../components/orders/GlassHeader';
import OrderTrackingMap from '../components/OrderTrackingMap';
import { normalizeFileUrl } from '../utils/deliveryUi';

// Mirrors backend/models/parcelRequestModel.js's currentStage enum and the
// courier-side STAGE_ORDER (frontend/src/utils/deliveryUi.js) so a requester
// sees the same journey the delivery guy is actually working through,
// including the steps still ahead (shown dimmed) rather than only past events.
const STAGE_SEQUENCE = ['ASSIGNED', 'ACCEPTED', 'PICKUP_STARTED', 'PICKED_UP', 'IN_TRANSIT', 'ARRIVED', 'DELIVERED'];

const STAGE_META = {
  ASSIGNED: { icon: '🔎', label: 'Recherche d’un livreur' },
  ACCEPTED: { icon: '🚴', label: 'Livreur en route pour le retrait' },
  PICKUP_STARTED: { icon: '📦', label: 'Retrait en cours' },
  PICKED_UP: { icon: '📤', label: 'Colis récupéré' },
  IN_TRANSIT: { icon: '🛣️', label: 'En route vers le dépôt' },
  ARRIVED: { icon: '📍', label: 'Arrivé au point de dépôt' },
  DELIVERED: { icon: '🏁', label: 'Colis livré' }
};

const findEventTime = (timeline, predicate) => (timeline || []).find(predicate)?.at || null;

const stageEventTime = (timeline, stage) => {
  if (stage === 'ASSIGNED') {
    return findEventTime(timeline, (e) => e.type === 'COURIER_ASSIGNED' || e.type === 'COURIER_CLAIMED');
  }
  if (stage === 'ACCEPTED') {
    return (
      findEventTime(timeline, (e) => e.type === 'COURIER_ACCEPTED' || e.type === 'COURIER_CLAIMED') ||
      findEventTime(timeline, (e) => e.type === 'COURIER_STAGE_UPDATED' && e.meta?.newStage === 'ACCEPTED')
    );
  }
  if (stage === 'PICKED_UP') {
    return (
      findEventTime(timeline, (e) => e.type === 'COURIER_STAGE_UPDATED' && e.meta?.newStage === 'PICKED_UP') ||
      findEventTime(timeline, (e) => e.type === 'COURIER_PROOF_UPLOADED' && e.meta?.proofType === 'pickup')
    );
  }
  if (stage === 'DELIVERED') {
    return (
      findEventTime(timeline, (e) => e.type === 'COURIER_STAGE_UPDATED' && e.meta?.newStage === 'DELIVERED') ||
      findEventTime(timeline, (e) => e.type === 'COURIER_PROOF_UPLOADED' && e.meta?.proofType === 'delivery')
    );
  }
  return findEventTime(timeline, (e) => e.type === 'COURIER_STAGE_UPDATED' && e.meta?.newStage === stage);
};

const buildTrackingData = (parcelRequest) => {
  const timeline = parcelRequest.timeline || [];
  const status = String(parcelRequest.status || '').toUpperCase();
  const currentStage = String(parcelRequest.currentStage || 'ASSIGNED').toUpperCase();
  const currentIndex = Math.max(0, STAGE_SEQUENCE.indexOf(currentStage));
  const isTerminalFailure = ['CANCELED', 'REJECTED', 'FAILED'].includes(status) || currentStage === 'FAILED';

  const checkpoints = [
    {
      type: 'PARCEL_REQUEST_CREATED',
      icon: '🛒',
      label: 'Course créée',
      time: findEventTime(timeline, (e) => e.type === 'PARCEL_REQUEST_CREATED') || parcelRequest.createdAt,
      active: true
    }
  ];

  STAGE_SEQUENCE.forEach((stage, index) => {
    if (isTerminalFailure && index > currentIndex) return;
    const reached = index <= currentIndex;
    const label =
      stage === 'ASSIGNED' && !parcelRequest.assignedDeliveryGuyId
        ? STAGE_META.ASSIGNED.label
        : stage === 'ASSIGNED'
          ? 'Livreur assigné, confirmation en attente'
          : STAGE_META[stage].label;
    checkpoints.push({
      type: stage,
      icon: STAGE_META[stage].icon,
      label,
      time: reached ? stageEventTime(timeline, stage) : null,
      active: reached,
      isCurrent: index === currentIndex && !isTerminalFailure
    });
  });

  if (isTerminalFailure) {
    const isCanceled = status === 'CANCELED';
    checkpoints.push({
      type: isCanceled ? 'PARCEL_REQUEST_CANCELED' : 'PARCEL_REQUEST_FAILED',
      icon: '✖️',
      label: isCanceled ? 'Course annulée' : 'Échec de la livraison',
      time:
        findEventTime(timeline, (e) => e.type === 'PARCEL_REQUEST_CANCELED') ||
        findEventTime(timeline, (e) => e.type === 'COURIER_STAGE_UPDATED' && e.meta?.newStage === 'FAILED') ||
        parcelRequest.updatedAt,
      description: parcelRequest.rejectionReason || parcelRequest.assignmentRejectReason || '',
      active: true,
      isCurrent: true
    });
  }

  // Once delivered (or the course is over), the courier's last-known spot is
  // stale — possibly already en route to someone else's job — so stop
  // surfacing it as if it were still live.
  const isTrackable = status !== 'DELIVERED' && !isTerminalFailure;
  const currentPosition =
    isTrackable && parcelRequest.currentLocation?.coordinates
      ? { lat: parcelRequest.currentLocation.coordinates[1], lng: parcelRequest.currentLocation.coordinates[0] }
      : null;
  const dropoffCoords = parcelRequest.dropoff?.coordinates?.coordinates;
  const pickupCoords = parcelRequest.pickup?.coordinates?.coordinates;
  const mapCenter =
    currentPosition ||
    (dropoffCoords ? { lat: dropoffCoords[1], lng: dropoffCoords[0] } : null) ||
    (pickupCoords ? { lat: pickupCoords[1], lng: pickupCoords[0] } : null) ||
    { lat: -4.2634, lng: 15.2429 };

  return {
    orderId: parcelRequest._id,
    status: parcelRequest.status,
    createdAt: parcelRequest.createdAt,
    currentPosition,
    currentPositionUpdatedAt: isTrackable ? parcelRequest.currentLocationUpdatedAt || null : null,
    mapCenter,
    checkpoints,
    hasDeliveryRequest: Boolean(parcelRequest.assignedDeliveryGuyId),
    courierName: parcelRequest.assignedDeliveryGuyId?.fullName || parcelRequest.assignedDeliveryGuyId?.name || null,
    courierPhone: parcelRequest.assignedDeliveryGuyId?.phone || null
  };
};

export default function ParcelRequestDetail() {
  const { id } = useParams();
  const { user } = useContext(AuthContext);
  const location = useLocation();
  const { showToast } = useToast();
  const [parcelRequest, setParcelRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [proofBroken, setProofBroken] = useState(false);
  const [replacingProof, setReplacingProof] = useState(false);

  const load = () => {
    api
      .get(`/parcels/mine/${id}`)
      .then(({ data }) => {
        setParcelRequest((previous) => {
          if (
            String(previous?.authorization?.proofImageUrl || '') !==
            String(data?.authorization?.proofImageUrl || '')
          ) {
            setProofBroken(false);
          }
          return data;
        });
      })
      .catch(() => setParcelRequest(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!user || !id) return;
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, id]);

  const handleCancel = async () => {
    if (cancelling) return;
    setCancelling(true);
    try {
      await api.post(`/parcels/mine/${id}/cancel`);
      showToast('Course annulée.', { variant: 'success' });
      load();
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Impossible d’annuler.'), { variant: 'error' });
    } finally {
      setCancelling(false);
    }
  };

  const handleReplaceProof = async (event) => {
    const file = event.target.files?.[0] || null;
    event.target.value = '';
    if (!file || replacingProof) return;
    setReplacingProof(true);
    try {
      const formData = new FormData();
      formData.append('proofImage', file);
      const { data } = await api.post(`/parcels/mine/${id}/proof`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setParcelRequest(data);
      setProofBroken(false);
      showToast('Justificatif remplacé.', { variant: 'success' });
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Impossible de remplacer le justificatif.'), {
        variant: 'error'
      });
    } finally {
      setReplacingProof(false);
    }
  };

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  if (loading) {
    return <p className="py-10 text-center text-sm text-gray-400">Chargement…</p>;
  }
  if (!parcelRequest) {
    return <p className="py-10 text-center text-sm text-gray-400">Course introuvable.</p>;
  }

  const trackingData = buildTrackingData(parcelRequest);
  const canCancel = ['PENDING', 'ACCEPTED'].includes(parcelRequest.status);
  const canReplaceProof =
    !['DELIVERED', 'CANCELED', 'FAILED'].includes(parcelRequest.status) &&
    !['PICKED_UP', 'IN_TRANSIT', 'ARRIVED', 'DELIVERED'].includes(parcelRequest.currentStage);
  const proofUrl = normalizeFileUrl(parcelRequest.authorization?.proofImageUrl);

  return (
    <div className="min-h-screen bg-[#faf8f5] pb-10">
      <GlassHeader title="Suivi de la course" subtitle={formatCurrency(parcelRequest.deliveryPrice)} backTo="/parcels" />

      <div className="mx-auto max-w-lg space-y-3 px-4 py-4">
        <div
          className={`flex items-center gap-2 rounded-2xl border p-3 ${
            parcelRequest.paymentMethod === 'PAWAPAY'
              ? 'border-emerald-100 bg-emerald-50'
              : 'border-amber-100 bg-amber-50'
          }`}
        >
          {parcelRequest.paymentMethod === 'PAWAPAY' ? (
            <ShieldCheckIcon className="shrink-0 text-emerald-700 h-4 w-4" />
          ) : (
            <WalletIcon className="shrink-0 text-amber-700 h-4 w-4" />
          )}
          <p
            className={`text-xs font-black ${
              parcelRequest.paymentMethod === 'PAWAPAY' ? 'text-emerald-800' : 'text-amber-800'
            }`}
          >
            {parcelRequest.paymentMethod === 'PAWAPAY'
              ? 'Payé avec PawaPay'
              : 'Paiement à la livraison (cash)'}
          </p>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[11px] font-bold text-gray-400">Retrait</p>
              <p className="text-sm font-semibold text-gray-800">{parcelRequest.pickup?.address}</p>
            </div>
            {parcelRequest.assignedDeliveryGuyId?.phone && (
              <a
                href={`tel:${parcelRequest.assignedDeliveryGuyId.phone}`}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-700"
              >
                <PhoneIcon className="h-[15px] w-[15px]" />
              </a>
            )}
          </div>
          <div className="mt-2 border-t border-gray-100 pt-2">
            <p className="text-[11px] font-bold text-gray-400">Dépôt</p>
            <p className="text-sm font-semibold text-gray-800">{parcelRequest.dropoff?.address}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <PhotoIcon className="text-[#e85d00] h-4 w-4" />
              <div>
                <p className="text-sm font-black text-gray-900">Justificatif de retrait</p>
                <p className="text-[11px] text-gray-500">Visible par le livreur après acceptation.</p>
              </div>
            </div>
            {canReplaceProof && (
              <label className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full bg-orange-50 px-3 text-xs font-black text-[#e85d00]">
                {replacingProof ? <ArrowPathIcon className="animate-spin h-[13px] w-[13px]" /> : <ArrowUpTrayIcon className="h-[13px] w-[13px]" />}
                {replacingProof ? 'Envoi…' : 'Remplacer'}
                <input
                  type="file"
                  accept="image/*"
                  disabled={replacingProof}
                  onChange={handleReplaceProof}
                  className="hidden"
                />
              </label>
            )}
          </div>
          {proofUrl && !proofBroken ? (
            <img
              src={proofUrl}
              alt="Justificatif de retrait"
              onError={() => setProofBroken(true)}
              className="mt-3 max-h-52 w-full rounded-xl bg-gray-50 object-contain"
            />
          ) : (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800">
              Le fichier enregistré n’est plus disponible.
              {canReplaceProof ? ' Remplacez-le avant le retrait du colis.' : ''}
            </div>
          )}
        </div>

        {parcelRequest.deliveryPinCode && parcelRequest.status !== 'DELIVERED' && (
          <div className="flex items-center gap-3 rounded-2xl border border-[#e85d00]/30 bg-[#fff7f0] p-3">
            <ShieldCheckIcon className="shrink-0 text-[#e85d00] h-[18px] w-[18px]" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-gray-700">
                Donnez ce code au livreur uniquement à la livraison, pour confirmer la réception.
              </p>
              <p className="mt-1 font-mono text-xl font-black tracking-[0.3em] text-[#e85d00]">
                {parcelRequest.deliveryPinCode}
              </p>
            </div>
          </div>
        )}

        <OrderTrackingMap trackingData={trackingData} />

        {canCancel && (
          <button
            type="button"
            onClick={handleCancel}
            disabled={cancelling}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-red-200 text-sm font-bold text-red-600 disabled:opacity-50"
          >
            <XMarkIcon className="h-[15px] w-[15px]" /> {cancelling ? 'Annulation…' : 'Annuler la course'}
          </button>
        )}
      </div>
    </div>
  );
}
