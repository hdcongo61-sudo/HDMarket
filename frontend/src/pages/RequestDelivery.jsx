import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Package, MapPin, Navigation, Camera, Loader2, ArrowLeft, ShieldCheck, Wallet, MapPinned, X, User } from 'lucide-react';
import api, { getApiErrorMessage } from '../services/api';
import AuthContext from '../context/AuthContext';
import { useAppSettings } from '../context/AppSettingsContext';
import { useToast } from '../context/ToastContext';
import { formatPriceWithStoredSettings as formatCurrency } from '../utils/priceFormatter';
import GlassHeader from '../components/orders/GlassHeader';
import PawaPayButton from '../components/PawaPayButton';
import AddressHistoryChips from '../components/AddressHistoryChips';
import { readAddressHistory, saveAddressToHistory } from '../utils/addressHistory';

const emptyLocation = () => ({
  cityId: '',
  communeId: '',
  address: '',
  contactName: '',
  contactPhone: '',
  coordinates: null,
  landmarkId: '',
  landmarkName: ''
});

function LocationFields({ title, value, onChange, cities, communesForCity, allCommunes = [], onAutofill, addressHistory = [], onPickHistory }) {
  const [locating, setLocating] = useState(false);
  const [suggestions, setSuggestions] = useState([]);

  useEffect(() => {
    if (value.landmarkId || !value.address.trim() || !value.cityId) {
      setSuggestions([]);
      return undefined;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      api
        .get('/delivery-pricing/landmarks/search', { params: { text: value.address, cityId: value.cityId } })
        .then(({ data }) => {
          if (!cancelled) setSuggestions(Array.isArray(data?.items) ? data.items : []);
        })
        .catch(() => {
          if (!cancelled) setSuggestions([]);
        });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [value.address, value.cityId, value.landmarkId]);

  const handlePickLandmark = (landmark) => {
    setSuggestions([]);
    onChange({
      ...value,
      landmarkId: landmark.id,
      landmarkName: landmark.name,
      communeId: landmark.communeId || value.communeId
    });
  };

  const handleClearLandmark = () => {
    onChange({ ...value, landmarkId: '', landmarkName: '' });
  };

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
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-black text-gray-900">
          <MapPin size={15} className="text-[#FF5000]" /> {title}
        </h3>
        <div className="flex items-center gap-3">
          {onAutofill ? (
            <button
              type="button"
              onClick={onAutofill}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-[#FF5000]"
            >
              <User size={12} />
              Mes infos
            </button>
          ) : null}
          <button
            type="button"
            onClick={handleUseCurrentLocation}
            disabled={locating}
            className="inline-flex items-center gap-1 text-[11px] font-bold text-[#FF5000] disabled:opacity-50"
          >
            {locating ? <Loader2 size={12} className="animate-spin" /> : <Navigation size={12} />}
            {value.coordinates ? 'Position capturée' : 'Utiliser ma position'}
          </button>
        </div>
      </div>

      {onPickHistory && addressHistory.length > 0 ? (
        <div className="mb-3">
          <AddressHistoryChips items={addressHistory} cities={cities} communes={allCommunes} onPick={onPickHistory} />
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <select
          value={value.cityId}
          onChange={(e) => onChange({ ...value, cityId: e.target.value, communeId: '' })}
          className="min-h-11 rounded-xl border border-gray-200 bg-gray-50 px-2.5 text-sm font-semibold text-gray-800 outline-none focus:border-[#FF5000]"
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
          className="min-h-11 rounded-xl border border-gray-200 bg-gray-50 px-2.5 text-sm font-semibold text-gray-800 outline-none disabled:opacity-50 focus:border-[#FF5000]"
        >
          <option value="">Commune</option>
          {communesForCity.map((entry) => (
            <option key={entry._id} value={entry._id}>{entry.name}</option>
          ))}
        </select>
      </div>

      <div className="relative mt-2">
        <input
          type="text"
          value={value.address}
          onChange={(e) => onChange({ ...value, address: e.target.value, landmarkId: '', landmarkName: '' })}
          placeholder="Adresse précise (quartier, rue, repère — ex: Près de Total Station)"
          className="min-h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm font-semibold text-gray-800 outline-none focus:border-[#FF5000]"
        />
        {suggestions.length > 0 ? (
          <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
            {suggestions.map((landmark) => (
              <button
                key={landmark.id}
                type="button"
                onClick={() => handlePickLandmark(landmark)}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-semibold text-gray-800 hover:bg-gray-50"
              >
                <MapPinned size={14} className="shrink-0 text-[#FF5000]" />
                {landmark.name}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {value.landmarkId ? (
        <div className="mt-1.5 flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[11px] font-bold text-emerald-700">
          <MapPinned size={12} />
          <span className="flex-1">Repère : {value.landmarkName}</span>
          <button type="button" onClick={handleClearLandmark} aria-label="Retirer le repère">
            <X size={12} />
          </button>
        </div>
      ) : null}

      <div className="mt-2 grid grid-cols-2 gap-2">
        <input
          type="text"
          value={value.contactName}
          onChange={(e) => onChange({ ...value, contactName: e.target.value })}
          placeholder="Nom du contact"
          className="min-h-11 rounded-xl border border-gray-200 bg-gray-50 px-2.5 text-sm text-gray-800 outline-none focus:border-[#FF5000]"
        />
        <input
          type="tel"
          value={value.contactPhone}
          onChange={(e) => onChange({ ...value, contactPhone: e.target.value })}
          placeholder="Téléphone"
          className="min-h-11 rounded-xl border border-gray-200 bg-gray-50 px-2.5 text-sm text-gray-800 outline-none focus:border-[#FF5000]"
        />
      </div>
    </div>
  );
}

export default function RequestDelivery() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
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
  const [paymentMethod, setPaymentMethod] = useState('pawapay');
  const [packageTypeId, setPackageTypeId] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [deliverySpeed, setDeliverySpeed] = useState('STANDARD');
  const [promoCode, setPromoCode] = useState('');
  const [packageTypes, setPackageTypes] = useState([]);
  const [speedRules, setSpeedRules] = useState([]);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [addressHistory, setAddressHistory] = useState(readAddressHistory);

  useEffect(() => {
    api
      .get('/parcels/capabilities')
      .then(({ data }) => setEnabled(Boolean(data?.enabled)))
      .catch(() => setEnabled(true));
    api
      .get('/delivery-pricing/options')
      .then(({ data }) => {
        setPackageTypes(Array.isArray(data?.packageTypes) ? data.packageTypes : []);
        setSpeedRules(Array.isArray(data?.speedRules) ? data.speedRules : []);
      })
      .catch(() => {
        setPackageTypes([]);
        setSpeedRules([]);
      });
  }, []);

  const pickupCommunes = useMemo(
    () => communes.filter((entry) => String(entry?.cityId?._id || entry?.cityId || '') === String(pickup.cityId || '')),
    [communes, pickup.cityId]
  );
  const dropoffCommunes = useMemo(
    () => communes.filter((entry) => String(entry?.cityId?._id || entry?.cityId || '') === String(dropoff.cityId || '')),
    [communes, dropoff.cityId]
  );

  // Autofill a location (pickup or dropoff) from the connected user's profile.
  const buildUserAutofill = useCallback(() => {
    if (!user) return null;
    const cityId = cities.some((entry) => String(entry?._id) === String(user.cityId || ''))
      ? user.cityId
      : '';
    const communeId = communes.some((entry) => String(entry?._id) === String(user.communeId || ''))
      ? user.communeId
      : '';
    return {
      cityId,
      communeId: cityId ? communeId : '',
      address: user.address || '',
      contactName: user.name || '',
      contactPhone: user.phone || ''
    };
  }, [user, cities, communes]);

  // Only fills when the user clicks "Mes infos" — never automatically.
  const applyUserAutofill = useCallback(
    (setter) => {
      const autofill = buildUserAutofill();
      if (!autofill) return;
      setter((prev) => ({
        ...prev,
        ...autofill,
        // Address text changes: drop the picked landmark, keep the GPS point.
        landmarkId: '',
        landmarkName: ''
      }));
    },
    [buildUserAutofill]
  );

  // Fills a location (pickup or dropoff) from a saved history entry.
  const applyAddressHistory = useCallback(
    (setter, item) => {
      setter((prev) => ({
        ...prev,
        cityId: item.cityId || '',
        communeId: item.communeId || '',
        address: item.address || '',
        contactName: item.contactName || '',
        contactPhone: item.contactPhone || '',
        landmarkId: '',
        landmarkName: ''
      }));
    },
    []
  );

  // Remembers both addresses once the form is valid enough to submit.
  const persistLocationsToHistory = useCallback(() => {
    saveAddressToHistory(pickup);
    setAddressHistory(saveAddressToHistory(dropoff));
  }, [pickup, dropoff]);

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
          pickup: { cityId: pickup.cityId, communeId: pickup.communeId, address: pickup.address, coordinates: pickup.coordinates, landmarkId: pickup.landmarkId || undefined },
          dropoff: { cityId: dropoff.cityId, communeId: dropoff.communeId, address: dropoff.address, coordinates: dropoff.coordinates, landmarkId: dropoff.landmarkId || undefined },
          packageTypeId: packageTypeId || undefined,
          weightKg: weightKg || undefined,
          deliverySpeed,
          promoCode: promoCode || undefined
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
  }, [
    pickup.cityId,
    pickup.communeId,
    pickup.address,
    pickup.coordinates,
    pickup.landmarkId,
    dropoff.cityId,
    dropoff.communeId,
    dropoff.address,
    dropoff.coordinates,
    dropoff.landmarkId,
    packageTypeId,
    weightKg,
    deliverySpeed,
    promoCode
  ]);

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
    persistLocationsToHistory();
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('pickup', JSON.stringify(buildLocationPayload(pickup, cities, communes)));
      formData.append('dropoff', JSON.stringify(buildLocationPayload(dropoff, cities, communes)));
      formData.append('parcelDescription', parcelDescription);
      formData.append('referenceCode', referenceCode);
      formData.append('notes', notes);
      formData.append('proofImage', proofFile);
      if (packageTypeId) formData.append('packageTypeId', packageTypeId);
      if (weightKg) formData.append('weightKg', weightKg);
      formData.append('deliverySpeed', deliverySpeed);
      if (promoCode) formData.append('promoCode', promoCode);

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

  // PawaPayButton's onBeforeStart: validate the form, upload the proof photo
  // standalone (a checkout's actionContext is JSON-only, no file upload), and
  // hand back the actionContext override so the request is only actually
  // created once payment is confirmed (see pawaPayCreateParcelRequest).
  const handlePawaPayBeforeStart = async () => {
    if (!canSubmit) {
      return 'Renseignez le retrait, le dépôt et le justificatif avant de payer.';
    }
    persistLocationsToHistory();
    try {
      const uploadData = new FormData();
      uploadData.append('proofImage', proofFile);
      const { data } = await api.post('/parcels/proof-upload', uploadData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return {
        actionContext: {
          kind: 'PARCEL_REQUEST_CHECKOUT',
          pickup: buildLocationPayload(pickup, cities, communes),
          dropoff: buildLocationPayload(dropoff, cities, communes),
          parcelDescription,
          referenceCode,
          notes,
          proofImageUrl: data?.proofImageUrl || '',
          packageTypeId: packageTypeId || undefined,
          weightKg: weightKg || undefined,
          deliverySpeed,
          promoCode: promoCode || undefined
        }
      };
    } catch (error) {
      return getApiErrorMessage(error, 'Impossible d’envoyer le justificatif.');
    }
  };

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
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
    <div className="min-h-screen bg-[#F6F6F6] pb-28">
      <GlassHeader title="Envoyer un colis" subtitle="Course à la demande" backTo="/profile" />

      <form onSubmit={handleSubmit} className="mx-auto max-w-lg space-y-3 px-4 py-4">
        <LocationFields title="Retrait" value={pickup} onChange={setPickup} cities={cities} communesForCity={pickupCommunes} allCommunes={communes} onAutofill={() => applyUserAutofill(setPickup)} addressHistory={addressHistory} onPickHistory={(item) => applyAddressHistory(setPickup, item)} />
        <LocationFields title="Dépôt" value={dropoff} onChange={setDropoff} cities={cities} communesForCity={dropoffCommunes} allCommunes={communes} onAutofill={() => applyUserAutofill(setDropoff)} addressHistory={addressHistory} onPickHistory={(item) => applyAddressHistory(setDropoff, item)} />

        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <h3 className="mb-3 flex items-center gap-1.5 text-sm font-black text-gray-900">
            <Package size={15} className="text-[#FF5000]" /> Le colis
          </h3>
          <textarea
            value={parcelDescription}
            onChange={(e) => setParcelDescription(e.target.value)}
            rows={2}
            maxLength={300}
            placeholder="Description (ex : un carton, un document, une commande à récupérer...)"
            className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-sm text-gray-800 outline-none focus:border-[#FF5000]"
          />

          <div className="mt-2 grid grid-cols-2 gap-2">
            {packageTypes.length > 0 && (
              <select
                value={packageTypeId}
                onChange={(e) => setPackageTypeId(e.target.value)}
                className="min-h-11 rounded-xl border border-gray-200 bg-gray-50 px-2.5 text-sm font-semibold text-gray-800 outline-none focus:border-[#FF5000]"
              >
                <option value="">Type de colis</option>
                {packageTypes.map((type) => (
                  <option key={type._id} value={type._id}>{type.name}</option>
                ))}
              </select>
            )}
            <input
              type="number"
              min="0"
              step="0.1"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              placeholder="Poids estimé (kg)"
              className="min-h-11 rounded-xl border border-gray-200 bg-gray-50 px-2.5 text-sm font-semibold text-gray-800 outline-none focus:border-[#FF5000]"
            />
          </div>

          {speedRules.length > 0 && (
            <div className="mt-2 flex gap-2 overflow-x-auto">
              {speedRules.map((rule) => (
                <button
                  key={rule.key}
                  type="button"
                  onClick={() => setDeliverySpeed(rule.key)}
                  className={`min-h-10 shrink-0 rounded-xl border px-3 text-xs font-black transition ${
                    deliverySpeed === rule.key
                      ? 'border-[#FF5000] bg-[#FF5000] text-white'
                      : 'border-gray-200 text-gray-600'
                  }`}
                >
                  {rule.label}{rule.extraPrice > 0 ? ` (+${formatCurrency(rule.extraPrice)})` : ''}
                </button>
              ))}
            </div>
          )}

          <input
            type="text"
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
            placeholder="Code promo (optionnel)"
            className="mt-2 min-h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm font-semibold text-gray-800 outline-none focus:border-[#FF5000]"
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
            className="mt-2 min-h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm text-gray-800 outline-none focus:border-[#FF5000]"
          />
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="Consignes pour le livreur (ex : demander M. X à la réception)"
            className="mt-2 w-full resize-none rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-sm text-gray-800 outline-none focus:border-[#FF5000]"
          />
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-black text-gray-900">Paiement</h3>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setPaymentMethod('pawapay')}
              className={`flex min-h-11 items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-black transition ${
                paymentMethod === 'pawapay'
                  ? 'border-[#0b6b4f] bg-[#0b6b4f]/10 text-[#0b6b4f]'
                  : 'border-gray-200 text-gray-500'
              }`}
            >
              <ShieldCheck size={14} /> Payer maintenant
            </button>
            <button
              type="button"
              onClick={() => setPaymentMethod('cod')}
              className={`flex min-h-11 items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-black transition ${
                paymentMethod === 'cod'
                  ? 'border-[#FF5000] bg-orange-50 text-[#FF5000]'
                  : 'border-gray-200 text-gray-500'
              }`}
            >
              <Wallet size={14} /> À la livraison
            </button>
          </div>
          <p className="mt-2 text-[11px] text-gray-500">
            {paymentMethod === 'pawapay'
              ? 'Payez par Mobile Money via PawaPay : la course est créée dès la confirmation du paiement.'
              : 'Le livreur collectera le montant en espèces à la livraison.'}
          </p>
        </div>

        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-100 bg-white px-4 py-3 [padding-bottom:calc(env(safe-area-inset-bottom)+0.75rem)]">
          <div className="mx-auto max-w-lg">
            {estimate?.breakdown?.length > 0 && showBreakdown ? (
              <div className="mb-2 space-y-1 rounded-xl bg-gray-50 p-2.5">
                {estimate.breakdown.map((line, index) => (
                  <div key={`${line.label}-${index}`} className="flex items-center justify-between text-[11px] font-semibold text-gray-600">
                    <span>{line.label}</span>
                    <span>{line.amount < 0 ? '-' : ''}{formatCurrency(Math.abs(line.amount))}</span>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowBreakdown((prev) => !prev)}
                disabled={!estimate?.breakdown?.length}
                className="text-[11px] font-bold text-gray-400 underline decoration-dotted disabled:no-underline"
              >
                {estimate?.breakdown?.length ? (showBreakdown ? 'Masquer le détail' : 'Prix estimé (détail)') : 'Prix estimé'}
              </button>
              <p className="text-lg font-black text-[#FF3D00]">
                {estimating ? '…' : estimate ? formatCurrency(estimate.price) : '—'}
              </p>
            </div>
            {estimate?.pricingVersion ? (
              <p className="-mt-1 mb-2 text-right text-[10px] font-semibold text-gray-400">
                Tarif {estimate.pricingVersion}
              </p>
            ) : null}
            {paymentMethod === 'pawapay' ? (
              <PawaPayButton
                amount={estimate?.price || 0}
                purpose="PARCEL_REQUEST_FUNDING"
                returnPath="/parcels"
                label="Payer et commander"
                onBeforeStart={handlePawaPayBeforeStart}
              />
            ) : (
              <button
                type="submit"
                disabled={!canSubmit}
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#FF5000] to-[#FF3D00] px-4 text-sm font-black text-white shadow-sm transition hover:brightness-95 active:scale-[0.98] disabled:opacity-50"
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <ArrowLeft size={16} className="rotate-180" />}
                {submitting ? 'Envoi…' : 'Commander la course (cash)'}
              </button>
            )}
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
    coordinates: value.coordinates || undefined,
    landmarkId: value.landmarkId || undefined
  };
}
