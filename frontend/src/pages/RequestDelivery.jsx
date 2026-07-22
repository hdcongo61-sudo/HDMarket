import React, { useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, MapPin, Navigation, Camera, Loader2, ArrowLeft } from 'lucide-react';
import api, { getApiErrorMessage } from '../services/api';
import AuthContext from '../context/AuthContext';
import { useAppSettings } from '../context/AppSettingsContext';
import { useToast } from '../context/ToastContext';
import { formatPriceWithStoredSettings as formatCurrency } from '../utils/priceFormatter';
import GlassHeader from '../components/orders/GlassHeader';

const emptyLocation = () => ({
  cityId: '',
  communeId: '',
  address: '',
  contactName: '',
  contactPhone: '',
  coordinates: null
});

function LocationFields({ title, value, onChange, cities, communesForCity }) {
  const [locating, setLocating] = useState(false);

  const handleUseCurrentLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        onChange({
          ...value,
          coordinates: [position.coords.longitude, position.coords.latitude]
        });
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-black text-gray-900">
          <MapPin size={15} className="text-[#e85d00]" /> {title}
        </h3>
        <button
          type="button"
          onClick={handleUseCurrentLocation}
          disabled={locating}
          className="inline-flex items-center gap-1 text-[11px] font-bold text-[#e85d00] disabled:opacity-50"
        >
          {locating ? <Loader2 size={12} className="animate-spin" /> : <Navigation size={12} />}
          {value.coordinates ? 'Position capturée' : 'Utiliser ma position'}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <select
          value={value.cityId}
          onChange={(e) => onChange({ ...value, cityId: e.target.value, communeId: '' })}
          className="min-h-11 rounded-xl border border-gray-200 bg-gray-50 px-2.5 text-sm font-semibold text-gray-800 outline-none focus:border-[#e85d00]"
        >
          <option value="">Ville</option>
          {cities.map((entry) => (
            <option key={entry._id} value={entry._id}>{entry.name}</option>
          ))}
        </select>
        <select
          value={value.communeId}
          onChange={(e) => onChange({ ...value, communeId: e.target.value })}
          disabled={!value.cityId}
          className="min-h-11 rounded-xl border border-gray-200 bg-gray-50 px-2.5 text-sm font-semibold text-gray-800 outline-none disabled:opacity-50 focus:border-[#e85d00]"
        >
          <option value="">Commune</option>
          {communesForCity.map((entry) => (
            <option key={entry._id} value={entry._id}>{entry.name}</option>
          ))}
        </select>
      </div>

      <input
        type="text"
        value={value.address}
        onChange={(e) => onChange({ ...value, address: e.target.value })}
        placeholder="Adresse précise (quartier, rue, repère)"
        className="mt-2 min-h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm font-semibold text-gray-800 outline-none focus:border-[#e85d00]"
      />

      <div className="mt-2 grid grid-cols-2 gap-2">
        <input
          type="text"
          value={value.contactName}
          onChange={(e) => onChange({ ...value, contactName: e.target.value })}
          placeholder="Nom du contact"
          className="min-h-11 rounded-xl border border-gray-200 bg-gray-50 px-2.5 text-sm text-gray-800 outline-none focus:border-[#e85d00]"
        />
        <input
          type="tel"
          value={value.contactPhone}
          onChange={(e) => onChange({ ...value, contactPhone: e.target.value })}
          placeholder="Téléphone"
          className="min-h-11 rounded-xl border border-gray-200 bg-gray-50 px-2.5 text-sm text-gray-800 outline-none focus:border-[#e85d00]"
        />
      </div>
    </div>
  );
}

export default function RequestDelivery() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { cities = [], communes = [] } = useAppSettings();

  const [pickup, setPickup] = useState(emptyLocation);
  const [dropoff, setDropoff] = useState(emptyLocation);
  const [parcelDescription, setParcelDescription] = useState('');
  const [referenceCode, setReferenceCode] = useState('');
  const [notes, setNotes] = useState('');
  const [proofFile, setProofFile] = useState(null);
  const [proofPreview, setProofPreview] = useState('');
  const [estimate, setEstimate] = useState(null);
  const [estimating, setEstimating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    api
      .get('/parcels/capabilities')
      .then(({ data }) => setEnabled(Boolean(data?.enabled)))
      .catch(() => setEnabled(true));
  }, []);

  const pickupCommunes = useMemo(
    () => communes.filter((entry) => String(entry?.cityId?._id || entry?.cityId || '') === String(pickup.cityId || '')),
    [communes, pickup.cityId]
  );
  const dropoffCommunes = useMemo(
    () => communes.filter((entry) => String(entry?.cityId?._id || entry?.cityId || '') === String(dropoff.cityId || '')),
    [communes, dropoff.cityId]
  );

  useEffect(() => {
    const readyForEstimate =
      (pickup.communeId || pickup.coordinates) && (dropoff.communeId || dropoff.coordinates);
    if (!readyForEstimate) {
      setEstimate(null);
      return undefined;
    }
    let cancelled = false;
    setEstimating(true);
    const timer = setTimeout(() => {
      api
        .post('/parcels/estimate', {
          pickup: { communeId: pickup.communeId, coordinates: pickup.coordinates },
          dropoff: { communeId: dropoff.communeId, coordinates: dropoff.coordinates }
        })
        .then(({ data }) => {
          if (!cancelled) setEstimate(data);
        })
        .catch(() => {
          if (!cancelled) setEstimate(null);
        })
        .finally(() => {
          if (!cancelled) setEstimating(false);
        });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [pickup.communeId, pickup.coordinates, dropoff.communeId, dropoff.coordinates]);

  const handleProofChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setProofFile(file);
    const reader = new FileReader();
    reader.onload = () => setProofPreview(String(reader.result || ''));
    reader.readAsDataURL(file);
  };

  const canSubmit =
    pickup.address.trim() &&
    dropoff.address.trim() &&
    pickup.communeId &&
    dropoff.communeId &&
    proofFile &&
    !submitting;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('pickup', JSON.stringify(buildLocationPayload(pickup, cities, communes)));
      formData.append('dropoff', JSON.stringify(buildLocationPayload(dropoff, cities, communes)));
      formData.append('parcelDescription', parcelDescription);
      formData.append('referenceCode', referenceCode);
      formData.append('notes', notes);
      formData.append('proofImage', proofFile);

      const { data } = await api.post('/parcels', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      showToast('Course colis créée ! Un livreur va être assigné.', { variant: 'success' });
      navigate(`/parcels/${data._id}`);
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Impossible de créer la course.'), { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10 text-center">
        <p className="text-sm text-gray-500">Connectez-vous pour demander une livraison de colis.</p>
      </div>
    );
  }

  if (!enabled) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10 text-center">
        <Package className="mx-auto h-8 w-8 text-gray-300" />
        <p className="mt-3 text-sm text-gray-500">Ce service n’est pas encore disponible.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf8f5] pb-28">
      <GlassHeader title="Envoyer un colis" subtitle="Course à la demande" backTo="/profile" />

      <form onSubmit={handleSubmit} className="mx-auto max-w-lg space-y-3 px-4 py-4">
        <LocationFields title="Retrait" value={pickup} onChange={setPickup} cities={cities} communesForCity={pickupCommunes} />
        <LocationFields title="Dépôt" value={dropoff} onChange={setDropoff} cities={cities} communesForCity={dropoffCommunes} />

        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <h3 className="mb-3 flex items-center gap-1.5 text-sm font-black text-gray-900">
            <Package size={15} className="text-[#e85d00]" /> Le colis
          </h3>
          <textarea
            value={parcelDescription}
            onChange={(e) => setParcelDescription(e.target.value)}
            rows={2}
            maxLength={300}
            placeholder="Description (ex : un carton, un document, une commande à récupérer...)"
            className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-sm text-gray-800 outline-none focus:border-[#e85d00]"
          />

          <label className="mt-3 block text-[11px] font-bold text-gray-500">
            Justificatif à présenter au retrait (facture, reçu, pièce...) *
          </label>
          <label className="mt-1.5 flex min-h-24 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50">
            {proofPreview ? (
              <img src={proofPreview} alt="Justificatif" className="h-24 rounded-lg object-cover" />
            ) : (
              <span className="flex flex-col items-center gap-1 text-xs font-semibold text-gray-400">
                <Camera size={20} />
                Ajouter une photo
              </span>
            )}
            <input type="file" accept="image/*" onChange={handleProofChange} className="hidden" />
          </label>

          <input
            type="text"
            value={referenceCode}
            onChange={(e) => setReferenceCode(e.target.value)}
            placeholder="Référence / numéro de commande (optionnel)"
            className="mt-2 min-h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm text-gray-800 outline-none focus:border-[#e85d00]"
          />
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="Consignes pour le livreur (ex : demander M. X à la réception)"
            className="mt-2 w-full resize-none rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-sm text-gray-800 outline-none focus:border-[#e85d00]"
          />
        </div>

        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-100 bg-white px-4 py-3">
          <div className="mx-auto flex max-w-lg items-center gap-3">
            <div className="flex-1">
              <p className="text-[11px] font-bold text-gray-400">Prix estimé</p>
              <p className="text-lg font-black text-neutral-950">
                {estimating ? '…' : estimate ? formatCurrency(estimate.price) : '—'}
              </p>
            </div>
            <button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-[#e85d00] px-4 text-sm font-black text-white disabled:opacity-50"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <ArrowLeft size={16} className="rotate-180" />}
              {submitting ? 'Envoi…' : 'Commander la course'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function buildLocationPayload(value, cities, communes) {
  const city = cities.find((entry) => String(entry._id) === String(value.cityId));
  const commune = communes.find((entry) => String(entry._id) === String(value.communeId));
  return {
    cityId: value.cityId || null,
    cityName: city?.name || '',
    communeId: value.communeId || null,
    communeName: commune?.name || '',
    address: value.address,
    contactName: value.contactName,
    contactPhone: value.contactPhone,
    coordinates: value.coordinates || undefined
  };
}
