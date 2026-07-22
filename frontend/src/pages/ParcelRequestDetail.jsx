import React, { useContext, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Phone, ShieldCheck, X } from 'lucide-react';
import api, { getApiErrorMessage } from '../services/api';
import AuthContext from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { formatPriceWithStoredSettings as formatCurrency } from '../utils/priceFormatter';
import GlassHeader from '../components/orders/GlassHeader';
import OrderTrackingMap from '../components/OrderTrackingMap';

const TIMELINE_ICONS = {
  PARCEL_REQUEST_CREATED: { icon: '🛒', label: 'Course créée' },
  COURIER_ASSIGNED: { icon: '🚚', label: 'Livreur assigné' },
  COURIER_ACCEPTED: { icon: '✅', label: 'Livreur en route' },
  COURIER_REJECTED: { icon: '⚠️', label: 'Livreur indisponible' },
  COURIER_STAGE_UPDATED: { icon: '📍', label: 'Suivi mis à jour' },
  COURIER_PROOF_UPLOADED: { icon: '📸', label: 'Preuve soumise' },
  DELIVERY_PIN_VERIFIED: { icon: '🔒', label: 'Code vérifié' },
  PARCEL_REQUEST_CANCELED: { icon: '✖️', label: 'Course annulée' }
};

const buildTrackingData = (parcelRequest) => {
  const checkpoints = (parcelRequest.timeline || []).map((event) => {
    const config = TIMELINE_ICONS[event.type] || { icon: '📍', label: event.type };
    return {
      type: event.type,
      icon: config.icon,
      label: config.label,
      time: event.at,
      active: true
    };
  });
  if (checkpoints.length) checkpoints[checkpoints.length - 1].isCurrent = true;

  const currentPosition = parcelRequest.currentLocation?.coordinates
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
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [parcelRequest, setParcelRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  const load = () => {
    api
      .get(`/parcels/mine/${id}`)
      .then(({ data }) => setParcelRequest(data))
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

  if (!user) {
    navigate('/login');
    return null;
  }
  if (loading) {
    return <p className="py-10 text-center text-sm text-gray-400">Chargement…</p>;
  }
  if (!parcelRequest) {
    return <p className="py-10 text-center text-sm text-gray-400">Course introuvable.</p>;
  }

  const trackingData = buildTrackingData(parcelRequest);
  const canCancel = ['PENDING', 'ACCEPTED'].includes(parcelRequest.status);

  return (
    <div className="min-h-screen bg-[#faf8f5] pb-10">
      <GlassHeader title="Suivi de la course" subtitle={formatCurrency(parcelRequest.deliveryPrice)} backTo="/parcels" />

      <div className="mx-auto max-w-lg space-y-3 px-4 py-4">
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
                <Phone size={15} />
              </a>
            )}
          </div>
          <div className="mt-2 border-t border-gray-100 pt-2">
            <p className="text-[11px] font-bold text-gray-400">Dépôt</p>
            <p className="text-sm font-semibold text-gray-800">{parcelRequest.dropoff?.address}</p>
          </div>
        </div>

        {parcelRequest.deliveryPinCode && parcelRequest.status !== 'DELIVERED' && (
          <div className="flex items-center gap-3 rounded-2xl border border-[#e85d00]/30 bg-[#fff7f0] p-3">
            <ShieldCheck size={18} className="shrink-0 text-[#e85d00]" />
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
            <X size={15} /> {cancelling ? 'Annulation…' : 'Annuler la course'}
          </button>
        )}
      </div>
    </div>
  );
}
