import React, { useEffect, useMemo, useState } from 'react';
import { Camera, CheckCircle2, Loader2, MapPin, Paperclip, Send, Trash2 } from 'lucide-react';
import api from '../services/api';
import SignaturePad from './SignaturePad';

const MAX_FILES = 5;

const buildFileUrl = (url) => {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
  const host = apiBase.replace(/\/api\/?$/, '');
  return `${host}/${String(url).replace(/^\/+/, '')}`;
};

export default function DeliveryProofUpload({ orderId, initialProofs = [], onSuccess }) {
  const [files, setFiles] = useState([]);
  const [signatureImage, setSignatureImage] = useState('');
  const [deliveryNote, setDeliveryNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [location, setLocation] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);

  const previews = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files]);
  useEffect(
    () => () => {
      previews.forEach((url) => URL.revokeObjectURL(url));
    },
    [previews]
  );

  const onFilesChange = (event) => {
    const selected = Array.from(event.target.files || []);
    const remaining = Math.max(0, MAX_FILES - files.length);
    setFiles((prev) => [...prev, ...selected.slice(0, remaining)]);
    setError('');
    event.target.value = '';
  };

  const removeFile = (index) => setFiles((prev) => prev.filter((_, i) => i !== index));

  const captureLocation = () => {
    if (!navigator.geolocation) return;
    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        });
        setLocationLoading(false);
      },
      () => setLocationLoading(false),
      { enableHighAccuracy: true, maximumAge: 20_000, timeout: 8_000 }
    );
  };

  const submit = async () => {
    if (!orderId || loading) return;
    if (files.length < 1) {
      setError('Ajoutez au moins une photo de livraison.');
      return;
    }
    if (!signatureImage) {
      setError('La signature client est obligatoire.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const payload = new FormData();
      files.forEach((file) => payload.append('deliveryProofImages', file));
      payload.append('clientSignatureImage', signatureImage);
      if (deliveryNote.trim()) payload.append('deliveryNote', deliveryNote.trim());
      if (location) {
        payload.append('locationLatitude', String(location.latitude));
        payload.append('locationLongitude', String(location.longitude));
        payload.append('locationAccuracy', String(location.accuracy || 0));
      }

      const { data } = await api.post(`/orders/seller/${orderId}/delivery-proof`, payload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setFiles([]);
      setSignatureImage('');
      setDeliveryNote('');
      if (typeof onSuccess === 'function') onSuccess(data?.order || null);
    } catch (err) {
      setError(err.response?.data?.message || 'Impossible d’envoyer la preuve de livraison.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Camera className="w-4 h-4 text-indigo-600" />
        <h4 className="text-sm font-bold text-gray-900 uppercase">Soumettre la preuve de livraison</h4>
      </div>

      {Array.isArray(initialProofs) && initialProofs.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-700">Preuves déjà soumises</p>
          <div className="flex flex-wrap gap-2">
            {initialProofs.map((proof, index) => (
              <a
                key={`proof-${index}`}
                href={buildFileUrl(proof?.url || proof?.path || '')}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-white px-2 py-1 text-xs text-indigo-700"
              >
                <Paperclip className="w-3 h-3" />
                Preuve {index + 1}
              </a>
            ))}
          </div>
        </div>
      )}

      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1">Photos de livraison (max {MAX_FILES})</label>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-indigo-200 bg-white px-3 py-2 text-xs font-semibold text-indigo-700">
          <Camera className="w-4 h-4" />
          Ajouter des photos
          <input type="file" accept="image/*" multiple className="hidden" onChange={onFilesChange} />
        </label>
        {files.length > 0 && (
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {files.map((file, index) => (
              <div key={`${file.name}-${index}`} className="rounded-lg border border-gray-200 bg-white p-2">
                <img src={previews[index]} alt={file.name} className="h-20 w-full rounded object-cover" />
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="truncate text-[10px] text-gray-600">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    className="text-red-600"
                    title="Retirer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1">Signature client</label>
        <SignaturePad value={signatureImage} onChange={setSignatureImage} />
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1">Note de livraison (optionnel)</label>
        <textarea
          rows={3}
          value={deliveryNote}
          onChange={(event) => setDeliveryNote(event.target.value.slice(0, 1000))}
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
          placeholder="Ex: Remis en main propre, colis intact."
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={captureLocation}
          disabled={locationLoading}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700"
        >
          <MapPin className="w-3.5 h-3.5" />
          {locationLoading ? 'GPS…' : 'Ajouter GPS'}
        </button>
        {location && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-semibold text-emerald-700">
            <CheckCircle2 className="w-3.5 h-3.5" />
            GPS capturé
          </span>
        )}
      </div>

      {error && <p className="text-xs font-semibold text-red-600">{error}</p>}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={submit}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {loading ? 'Envoi...' : 'Soumettre la preuve'}
        </button>
      </div>
    </div>
  );
}
