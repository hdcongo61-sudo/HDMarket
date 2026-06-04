import React, { useEffect, useMemo, useState } from 'react';
import { Camera, CheckCircle2, Loader2, MapPin, Paperclip, Send, Trash2 } from 'lucide-react';
import api from '../services/api';
import SignaturePad from './SignaturePad';

const MAX_FILES = 5;
const MAX_IMAGE_DIMENSION = 1600;
const IMAGE_QUALITY = 0.78;
const MIN_COMPRESS_BYTES = 420 * 1024;

const buildFileUrl = (url) => {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  if (/^data:/i.test(url)) return url;
  if (/^blob:/i.test(url)) return url;
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
  const host = apiBase.replace(/\/api\/?$/, '');
  return `${host}/${String(url).replace(/^\/+/, '')}`;
};

const formatFileSize = (bytes = 0) => {
  const value = Number(bytes || 0);
  if (!Number.isFinite(value) || value <= 0) return '0 Ko';
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} Ko`;
  return `${(value / (1024 * 1024)).toFixed(1)} Mo`;
};

const loadImage = (file) =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('IMAGE_LOAD_FAILED'));
    };
    image.src = url;
  });

const canvasToBlob = (canvas, type, quality) =>
  new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });

const optimizeProofImage = async (file) => {
  if (!file?.type?.startsWith('image/') || file.type === 'image/gif') {
    return { file, originalSize: file?.size || 0, optimized: false };
  }

  if (Number(file.size || 0) < MIN_COMPRESS_BYTES) {
    return { file, originalSize: file.size || 0, optimized: false };
  }

  try {
    const image = await loadImage(file);
    const longestSide = Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height);
    const scale = longestSide > MAX_IMAGE_DIMENSION ? MAX_IMAGE_DIMENSION / longestSide : 1;
    const width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
    const height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { alpha: false });
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    const blob = await canvasToBlob(canvas, 'image/jpeg', IMAGE_QUALITY);
    if (!blob || blob.size >= file.size) {
      return { file, originalSize: file.size || 0, optimized: false };
    }
    const baseName = String(file.name || 'preuve-livraison').replace(/\.[^.]+$/, '');
    return {
      file: new File([blob], `${baseName}.jpg`, { type: 'image/jpeg', lastModified: Date.now() }),
      originalSize: file.size || 0,
      optimized: true
    };
  } catch {
    return { file, originalSize: file?.size || 0, optimized: false };
  }
};

export default function DeliveryProofUpload({
  orderId,
  initialProofs = [],
  onSuccess,
  mode = 'delivery',
  minFiles = 1
}) {
  const normalizedMode = String(mode || 'delivery').toLowerCase() === 'pickup' ? 'pickup' : 'delivery';
  const minimumFilesRequired = Math.max(1, Number(minFiles) || 1);
  const isPickupMode = normalizedMode === 'pickup';
  const proofLabel = isPickupMode ? 'retrait' : 'livraison';
  const [files, setFiles] = useState([]);
  const [signatureImage, setSignatureImage] = useState('');
  const [deliveryNote, setDeliveryNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [preparingFiles, setPreparingFiles] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const [location, setLocation] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);

  const previews = useMemo(() => files.map((entry) => URL.createObjectURL(entry.file)), [files]);
  useEffect(
    () => () => {
      previews.forEach((url) => URL.revokeObjectURL(url));
    },
    [previews]
  );

  const onFilesChange = async (event) => {
    const selected = Array.from(event.target.files || []);
    const remaining = Math.max(0, MAX_FILES - files.length);
    const selectedFiles = selected.slice(0, remaining);
    if (!selectedFiles.length) {
      event.target.value = '';
      return;
    }
    setPreparingFiles(true);
    setError('');
    try {
      const processedFiles = await Promise.all(
        selectedFiles.map(async (file, index) => {
          const optimized = await optimizeProofImage(file);
          return {
            id: `${Date.now()}-${index}-${file.name}`,
            file: optimized.file,
            originalName: file.name,
            originalSize: optimized.originalSize,
            optimized: optimized.optimized
          };
        })
      );
      setFiles((prev) => [...prev, ...processedFiles]);
    } catch {
      setError('Certaines photos n’ont pas pu être préparées. Réessayez avec des images plus légères.');
    } finally {
      setPreparingFiles(false);
    }
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
    if (!orderId || loading || preparingFiles) return;
    if (files.length < minimumFilesRequired) {
      setError(
        `Ajoutez au moins ${minimumFilesRequired} photo${minimumFilesRequired > 1 ? 's' : ''} de ${proofLabel}.`
      );
      return;
    }
    if (!signatureImage) {
      setError('La signature client est obligatoire.');
      return;
    }

    setLoading(true);
    setUploadProgress(0);
    setError('');
    try {
      const payload = new FormData();
      files.forEach(({ file }) => payload.append('deliveryProofImages', file));
      payload.append('clientSignatureImage', signatureImage);
      if (deliveryNote.trim()) payload.append('deliveryNote', deliveryNote.trim());
      if (location) {
        payload.append('locationLatitude', String(location.latitude));
        payload.append('locationLongitude', String(location.longitude));
        payload.append('locationAccuracy', String(location.accuracy || 0));
      }

      const { data } = await api.post(`/orders/seller/${orderId}/delivery-proof`, payload, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 90_000,
        onUploadProgress: (event) => {
          if (!event.total) return;
          setUploadProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
        }
      });
      setUploadProgress(100);
      setFiles([]);
      setSignatureImage('');
      setDeliveryNote('');
      if (typeof onSuccess === 'function') onSuccess(data?.order || null);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          (isPickupMode
            ? 'Impossible d’envoyer la preuve de retrait.'
            : 'Impossible d’envoyer la preuve de livraison.')
      );
    } finally {
      setLoading(false);
      setTimeout(() => setUploadProgress(0), 800);
    }
  };

  const submitDisabled = loading || preparingFiles;

  return (
    <div className="space-y-4 rounded-[28px] border border-orange-100 bg-white p-4 shadow-[0_18px_42px_rgba(117,75,36,0.09)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-50 text-[#FF6A00] ring-1 ring-orange-100">
            <Camera className="w-5 h-5" />
          </span>
          <div>
            <h4 className="text-sm font-black text-gray-950">
              {isPickupMode ? 'Preuve de retrait' : 'Preuve de livraison'}
            </h4>
            <p className="text-xs font-semibold text-stone-500">
              {files.length}/{MAX_FILES} photo{files.length > 1 ? 's' : ''} · signature requise
            </p>
          </div>
        </div>
        {preparingFiles ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-1 text-[11px] font-black text-[#9A4A00] ring-1 ring-orange-100">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Préparation
          </span>
        ) : null}
      </div>

      {Array.isArray(initialProofs) && initialProofs.length > 0 && (
        <div className="space-y-2 rounded-[22px] border border-stone-100 bg-[#fffaf4] p-3">
          <p className="text-xs font-black text-gray-800">Preuves déjà soumises</p>
          <div className="flex flex-wrap gap-2">
            {initialProofs.map((proof, index) => (
              <a
                key={`proof-${index}`}
                href={buildFileUrl(proof?.url || proof?.path || '')}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-[34px] items-center gap-1 rounded-full border border-orange-100 bg-white px-3 text-xs font-bold text-slate-700 transition hover:bg-orange-50 active:scale-95"
              >
                <Paperclip className="w-3 h-3" />
                Preuve {index + 1}
              </a>
            ))}
          </div>
        </div>
      )}

      <div>
        <label className="mb-2 block text-xs font-black text-gray-800">
          Photos de {proofLabel} ({files.length}/{MAX_FILES}, min {minimumFilesRequired})
        </label>
        <label className="flex min-h-[84px] cursor-pointer flex-col items-center justify-center gap-2 rounded-[24px] border border-dashed border-orange-200 bg-orange-50/70 px-4 py-4 text-center transition hover:bg-orange-50 active:scale-[0.99]">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-[#FF6A00] shadow-sm ring-1 ring-orange-100">
            <Camera className="w-5 h-5" />
          </span>
          <span className="text-sm font-black text-[#9A4A00]">
            {preparingFiles ? 'Préparation des photos...' : 'Ajouter des photos'}
          </span>
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={onFilesChange}
            disabled={loading || preparingFiles || files.length >= MAX_FILES}
          />
        </label>
        {files.length > 0 && (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {files.map((entry, index) => (
              <div key={entry.id} className="overflow-hidden rounded-[20px] border border-orange-100 bg-[#fffaf4] p-2">
                <div className="relative overflow-hidden rounded-[16px] bg-white">
                  <img src={previews[index]} alt={entry.originalName} className="h-24 w-full object-cover" />
                  {entry.optimized ? (
                    <span className="absolute left-1.5 top-1.5 rounded-full bg-[#FF6A00] px-2 py-0.5 text-[10px] font-black text-white">
                      Optimisée
                    </span>
                  ) : null}
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="block truncate text-[11px] font-bold text-gray-800">
                      {entry.file.name}
                    </span>
                    <span className="text-[10px] font-semibold text-stone-500">
                      {entry.optimized
                        ? `${formatFileSize(entry.originalSize)} → ${formatFileSize(entry.file.size)}`
                        : formatFileSize(entry.file.size)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-red-600 ring-1 ring-red-100 transition hover:bg-red-50 active:scale-95"
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
        <label className="mb-2 block text-xs font-black text-gray-800">Signature client</label>
        <div className="overflow-hidden rounded-[22px] border border-orange-100 bg-[#fffaf4] p-2">
          <SignaturePad value={signatureImage} onChange={setSignatureImage} />
        </div>
      </div>

      <div>
        <label className="mb-2 block text-xs font-black text-gray-800">
          {isPickupMode ? 'Note de retrait (optionnel)' : 'Note de livraison (optionnel)'}
        </label>
        <textarea
          rows={3}
          value={deliveryNote}
          onChange={(event) => setDeliveryNote(event.target.value.slice(0, 1000))}
          className="w-full resize-none rounded-[20px] border border-orange-100 bg-[#fffaf4] px-4 py-3 text-sm font-semibold text-gray-900 outline-none transition placeholder:text-stone-400 focus:border-[#FF6A00] focus:bg-white focus:ring-4 focus:ring-orange-100"
          placeholder={
            isPickupMode
              ? 'Ex: Retrait en boutique, article vérifié et signé.'
              : 'Ex: Remis en main propre, colis intact.'
          }
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={captureLocation}
          disabled={locationLoading}
          className="inline-flex min-h-[38px] items-center gap-1.5 rounded-full border border-orange-100 bg-orange-50 px-3 text-xs font-black text-[#9A4A00] transition hover:bg-orange-100 active:scale-95 disabled:opacity-60"
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

      {loading && uploadProgress > 0 ? (
        <div className="rounded-[18px] border border-orange-100 bg-orange-50 p-3">
          <div className="mb-2 flex items-center justify-between text-xs font-black text-[#9A4A00]">
            <span>Envoi en cours</span>
            <span>{uploadProgress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#FFB000] to-[#FF6A00] transition-all duration-200"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      ) : null}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={submit}
          disabled={submitDisabled}
          className="inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#FFB000] to-[#FF6A00] px-4 text-sm font-black text-white shadow-[0_16px_30px_-18px_rgba(255,106,0,0.9)] transition hover:brightness-105 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:min-w-56"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {loading
            ? 'Envoi...'
            : preparingFiles
              ? 'Préparation...'
              : isPickupMode
                ? 'Confirmer le retrait'
                : 'Soumettre la preuve'}
        </button>
      </div>
    </div>
  );
}
