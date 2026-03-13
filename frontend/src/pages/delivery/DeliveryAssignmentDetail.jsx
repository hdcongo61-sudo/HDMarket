import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Camera,
  ExternalLink,
  FileText,
  Loader2,
  MapPin,
  Package,
  Phone,
  ShieldAlert,
  Trash2
} from 'lucide-react';
import api from '../../services/api';
import SignaturePad from '../../components/SignaturePad';
import BaseModal, { ModalBody, ModalFooter, ModalHeader } from '../../components/modals/BaseModal';
import DeliveryActionFooter from '../../components/delivery/DeliveryActionFooter';
import DeliveryDetailTimeline from '../../components/delivery/DeliveryDetailTimeline';
import DeliverySkeleton from '../../components/delivery/DeliverySkeleton';
import OfflineBanner from '../../components/delivery/OfflineBanner';
import {
  MAX_PROOF_PHOTOS,
  NEXT_STAGE,
  STAGE_LABELS,
  buildAppleMapHref,
  buildGoogleMapHref,
  dataUrlToFile,
  extractMessage,
  fmtDateTime,
  formatCurrency,
  getApiModeFromPath,
  getCoordinatesDisplay,
  hasProofContent,
  normalizeFileUrl,
  statusPillClassOf,
  workflowLabelOf,
  workflowStatusOf
} from '../../utils/deliveryUi';

const extractProofUrl = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return String(value).trim();
  if (typeof value !== 'object') return '';
  const candidate =
    value.url ||
    value.path ||
    value.photoUrl ||
    value.imageUrl ||
    value.signatureUrl ||
    value.src ||
    '';
  return typeof candidate === 'string' ? candidate.trim() : '';
};

const getProofPhotos = (proof = {}) => {
  const urls = [];
  const pushUrl = (input) => {
    const next = extractProofUrl(input);
    if (next) urls.push(next);
  };
  pushUrl(proof?.photoUrl);
  if (Array.isArray(proof?.photoUrls)) proof.photoUrls.forEach(pushUrl);
  if (Array.isArray(proof?.photos)) proof.photos.forEach(pushUrl);
  if (Array.isArray(proof?.images)) proof.images.forEach(pushUrl);
  return Array.from(new Set(urls));
};

const getProofSignature = (proof = {}) =>
  extractProofUrl(proof?.signatureUrl) || extractProofUrl(proof?.signatureImage) || extractProofUrl(proof?.signature);

export default function DeliveryAssignmentDetail() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { apiPrefix, useLegacyCourierApi } = useMemo(
    () => getApiModeFromPath(location.pathname),
    [location.pathname]
  );

  const [proofModal, setProofModal] = useState({ open: false, type: 'pickup' });
  const [proofPhotos, setProofPhotos] = useState([]);
  const [proofSignatureImage, setProofSignatureImage] = useState('');
  const [proofNote, setProofNote] = useState('');
  const [proofFormError, setProofFormError] = useState('');
  const [proofPreview, setProofPreview] = useState(null);
  const [pinCode, setPinCode] = useState('');
  const [issueModal, setIssueModal] = useState({ open: false, reason: '' });
  const [isOffline, setIsOffline] = useState(typeof navigator !== 'undefined' ? !navigator.onLine : false);

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

  const proofPhotoPreviews = useMemo(
    () => proofPhotos.map((file) => URL.createObjectURL(file)),
    [proofPhotos]
  );

  React.useEffect(
    () => () => {
      proofPhotoPreviews.forEach((url) => URL.revokeObjectURL(url));
    },
    [proofPhotoPreviews]
  );

  const detailQuery = useQuery({
    queryKey: ['delivery', 'detail', apiPrefix, id],
    queryFn: async () => {
      const endpoint = useLegacyCourierApi ? `/assignments/${id}` : `/jobs/${id}`;
      const { data } = await api.get(`${apiPrefix}${endpoint}`);
      return data?.item || null;
    },
    enabled: Boolean(id),
    staleTime: 10_000,
    retry: 1,
    refetchInterval: isOffline ? false : 15_000
  });

  const assignment = detailQuery.data;
  const assignmentStatus = String(assignment?.assignmentStatus || '').toUpperCase();
  const currentStage = String(assignment?.currentStage || 'ASSIGNED').toUpperCase();
  const nextStage = NEXT_STAGE[currentStage] || '';
  const hasPickupProof = hasProofContent(assignment?.pickupProof || {});
  const workflowStatus = workflowStatusOf(assignment);
  const isDelivered = workflowStatus === 'DELIVERED';
  const pickupProofPhotos = useMemo(
    () => getProofPhotos(assignment?.pickupProof || {}).map((entry) => normalizeFileUrl(entry)).filter(Boolean),
    [assignment?.pickupProof]
  );
  const deliveryProofPhotos = useMemo(
    () => getProofPhotos(assignment?.deliveryProof || {}).map((entry) => normalizeFileUrl(entry)).filter(Boolean),
    [assignment?.deliveryProof]
  );
  const pickupSignatureUrl = useMemo(
    () => normalizeFileUrl(getProofSignature(assignment?.pickupProof || {})),
    [assignment?.pickupProof]
  );
  const deliverySignatureUrl = useMemo(
    () => normalizeFileUrl(getProofSignature(assignment?.deliveryProof || {})),
    [assignment?.deliveryProof]
  );
  const hasAnyProof =
    pickupProofPhotos.length > 0 ||
    deliveryProofPhotos.length > 0 ||
    Boolean(pickupSignatureUrl) ||
    Boolean(deliverySignatureUrl) ||
    String(assignment?.pickupProof?.note || '').trim() ||
    String(assignment?.deliveryProof?.note || '').trim();
  const proofPreviewIsSignature = /signature/i.test(String(proofPreview?.label || ''));

  const pickupVisible = !isDelivered && assignment?.pickup?.locationVisible !== false;
  const dropoffVisible = !isDelivered && assignment?.dropoff?.locationVisible !== false;

  const pickupMapGoogle = pickupVisible
    ? buildGoogleMapHref(
        assignment?.pickup?.coordinates,
        `${assignment?.pickup?.address || ''} ${assignment?.pickup?.communeName || ''} ${assignment?.pickup?.cityName || ''}`
      )
    : '';
  const pickupMapApple = pickupVisible
    ? buildAppleMapHref(
        assignment?.pickup?.coordinates,
        `${assignment?.pickup?.address || ''} ${assignment?.pickup?.communeName || ''} ${assignment?.pickup?.cityName || ''}`
      )
    : '';

  const dropoffAddress = assignment?.dropoff?.address || assignment?.buyer?.address || '';
  const dropoffCity = assignment?.dropoff?.cityName || assignment?.buyer?.city || '';
  const dropoffCommune = assignment?.dropoff?.communeName || assignment?.buyer?.commune || '';
  const dropoffMapGoogle = dropoffVisible
    ? buildGoogleMapHref(assignment?.dropoff?.coordinates, `${dropoffAddress} ${dropoffCommune} ${dropoffCity}`)
    : '';
  const dropoffMapApple = dropoffVisible
    ? buildAppleMapHref(assignment?.dropoff?.coordinates, `${dropoffAddress} ${dropoffCommune} ${dropoffCity}`)
    : '';

  const proofMutation = useMutation({
    mutationFn: async ({ proofType }) => {
      const formData = new FormData();
      formData.append('proofType', proofType);
      proofPhotos.forEach((photo) => formData.append('photos', photo));
      const signatureFile = dataUrlToFile(
        proofSignatureImage,
        `${proofType}-signature-${Date.now()}.png`
      );
      if (signatureFile) formData.append('signatureFile', signatureFile);
      if (proofNote.trim()) formData.append('note', proofNote.trim());
      if (pinCode.trim()) formData.append('deliveryPinCode', pinCode.trim());

      const endpoint = useLegacyCourierApi ? `/assignments/${id}/proof` : `/jobs/${id}/proof`;
      const { data } = await api.post(`${apiPrefix}${endpoint}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return data;
    },
    onSuccess: () => {
      setProofModal({ open: false, type: 'pickup' });
      setProofPhotos([]);
      setProofSignatureImage('');
      setProofNote('');
      setProofFormError('');
      setPinCode('');
      queryClient.invalidateQueries({ queryKey: ['delivery'] });
    }
  });

  const stageMutation = useMutation({
    mutationFn: async ({ stage, note }) => {
      const endpoint = useLegacyCourierApi ? `/assignments/${id}/stage` : `/jobs/${id}/stage`;
      const { data } = await api.patch(
        `${apiPrefix}${endpoint}`,
        {
          stage,
          note,
          deliveryPinCode: stage === 'DELIVERED' ? pinCode : undefined
        }
      );
      return data;
    },
    onSuccess: () => {
      setIssueModal({ open: false, reason: '' });
      queryClient.invalidateQueries({ queryKey: ['delivery'] });
    }
  });

  const acceptMutation = useMutation({
    mutationFn: async () => {
      const endpoint = useLegacyCourierApi ? `/assignments/${id}/accept` : `/jobs/${id}/accept`;
      const { data } = await api.patch(`${apiPrefix}${endpoint}`, {});
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery'] });
    }
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ reason }) => {
      const endpoint = useLegacyCourierApi ? `/assignments/${id}/reject` : `/jobs/${id}/reject`;
      const { data } = await api.patch(`${apiPrefix}${endpoint}`, { reason });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery'] });
      navigate(-1);
    }
  });

  const resetProofForm = ({ keepPin = false } = {}) => {
    setProofPhotos([]);
    setProofSignatureImage('');
    setProofNote('');
    setProofFormError('');
    if (!keepPin) setPinCode('');
  };

  const handleProofPhotosChange = (event) => {
    const selectedFiles = Array.from(event.target.files || []);
    if (!selectedFiles.length) return;
    const remaining = Math.max(0, MAX_PROOF_PHOTOS - proofPhotos.length);
    setProofPhotos((prev) => [...prev, ...selectedFiles.slice(0, remaining)]);
    setProofFormError('');
    event.target.value = '';
  };

  const removeProofPhoto = (index) => {
    setProofPhotos((prev) => prev.filter((_, idx) => idx !== index));
  };

  const submitProof = () => {
    if (!assignment?._id || proofMutation.isPending || isOffline) return;
    if (proofPhotos.length < 1) {
      setProofFormError('Ajoutez au moins une photo.');
      return;
    }
    if (!proofSignatureImage) {
      setProofFormError('Ajoutez une signature.');
      return;
    }
    setProofFormError('');
    proofMutation.mutate({ proofType: proofModal.type });
  };

  const openProof = (type) => {
    if (!assignment?._id || isDelivered) return;
    setProofModal({ open: true, type });
    resetProofForm({ keepPin: type === 'delivery' });
  };

  const handlePrimaryAction = () => {
    if (!assignment?._id || isOffline) return;
    if (assignmentStatus === 'PENDING') {
      acceptMutation.mutate();
      return;
    }
    if (!nextStage) return;
    if (nextStage === 'PICKED_UP') {
      openProof('pickup');
      return;
    }
    if (nextStage === 'DELIVERED') {
      if (!hasPickupProof) return;
      openProof('delivery');
      return;
    }
    stageMutation.mutate({ stage: nextStage });
  };

  const handleSecondaryAction = () => {
    setIssueModal({ open: true, reason: '' });
  };

  const submitSecondaryAction = () => {
    const reason = String(issueModal.reason || '').trim();
    if (!reason || isOffline) return;
    if (assignmentStatus === 'PENDING') {
      rejectMutation.mutate({ reason });
      return;
    }
    stageMutation.mutate({ stage: 'FAILED', note: reason });
  };

  const primaryLabel = (() => {
    if (assignmentStatus === 'PENDING') return 'Accept';
    if (!nextStage) return 'View summary';
    if (nextStage === 'PICKED_UP') return 'Confirm pickup';
    if (nextStage === 'IN_TRANSIT') return 'Start route';
    if (nextStage === 'ARRIVED') return 'Confirm arrived';
    if (nextStage === 'DELIVERED') return 'Confirm delivered';
    if (nextStage === 'ACCEPTED') return 'Accept';
    if (nextStage === 'PICKUP_STARTED') return 'Pickup started';
    return `Go ${STAGE_LABELS[nextStage] || nextStage}`;
  })();

  const primaryDisabled =
    isOffline ||
    detailQuery.isLoading ||
    detailQuery.isError ||
    (!nextStage && assignmentStatus !== 'PENDING') ||
    (nextStage === 'DELIVERED' && !hasPickupProof) ||
    isDelivered;

  const secondaryLabel = assignmentStatus === 'PENDING' ? 'Reject' : 'Report issue';

  const firstItem = Array.isArray(assignment?.itemsSnapshot) ? assignment.itemsSnapshot[0] : null;
  const itemCount = Array.isArray(assignment?.itemsSnapshot) ? assignment.itemsSnapshot.length : 0;
  const isFragile =
    Boolean(firstItem?.fragile) ||
    (Array.isArray(firstItem?.tags) ? firstItem.tags.some((tag) => String(tag || '').toLowerCase() === 'fragile') : false);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 px-3 pb-28 pt-2 sm:px-5">
      <OfflineBanner offline={isOffline} />

      <header className="sticky top-[max(0px,env(safe-area-inset-top))] z-30 -mx-3 border-b border-gray-100/70 bg-white/80 px-3 pb-3 pt-2 backdrop-blur-xl sm:-mx-5 sm:px-5">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex min-h-[44px] items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-700"
          >
            <ArrowLeft size={14} />
            Back
          </button>

          {assignment ? (
            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusPillClassOf(assignment)}`}>
              {workflowLabelOf(assignment)}
            </span>
          ) : null}

          <p className="text-xs font-semibold text-gray-600">#{String(id || '').slice(-6)}</p>
        </div>
      </header>

      {detailQuery.isLoading ? (
        <DeliverySkeleton count={4} />
      ) : detailQuery.isError ? (
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-red-700">
            {extractMessage(detailQuery.error, 'Impossible de charger cette livraison.')}
          </p>
          <button
            type="button"
            onClick={() => detailQuery.refetch()}
            className="mt-3 inline-flex min-h-[44px] items-center rounded-xl bg-gray-900 px-3 text-sm font-semibold text-white"
          >
            Reessayer
          </button>
        </div>
      ) : !assignment ? (
        <div className="rounded-2xl bg-white p-4 text-sm text-gray-600 shadow-sm">Livraison introuvable.</div>
      ) : (
        <>
          <DeliveryDetailTimeline currentStage={assignment.currentStage} />

          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">Produit</p>
            <div className="mt-3 flex items-center gap-3">
              {firstItem?.imageUrl ? (
                <img
                  src={normalizeFileUrl(firstItem.imageUrl)}
                  alt={firstItem.name || 'Produit'}
                  className="h-14 w-14 rounded-xl object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="grid h-14 w-14 place-items-center rounded-xl bg-gray-100 text-gray-400">
                  <Package size={16} />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-gray-900">{firstItem?.name || 'Produit'}</p>
                <p className="text-xs text-gray-500">Quantite: {Number(firstItem?.qty || 1)} · {itemCount} article(s)</p>
                {isFragile ? (
                  <span className="mt-1 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                    Fragile
                  </span>
                ) : null}
              </div>
            </div>
          </section>

          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">Parties</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-gray-50 p-3">
                <p className="text-xs font-semibold text-gray-800">Seller</p>
                <p className="mt-1 text-sm font-medium text-gray-900">
                  {assignment?.seller?.name || '—'} · {assignment?.pickup?.communeName || '—'}
                </p>
                {assignment?.seller?.phone ? (
                  <a
                    href={`tel:${assignment.seller.phone}`}
                    className="mt-2 inline-flex min-h-[40px] items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-semibold text-gray-700"
                  >
                    <Phone size={12} />
                    {assignment.seller.phone}
                  </a>
                ) : null}
              </div>
              <div className="rounded-xl bg-gray-50 p-3">
                <p className="text-xs font-semibold text-gray-800">Buyer</p>
                <p className="mt-1 text-sm font-medium text-gray-900">
                  {assignment?.buyer?.name || '—'} · {assignment?.dropoff?.communeName || assignment?.buyer?.commune || '—'}
                </p>
                {assignment?.buyer?.phone ? (
                  <a
                    href={`tel:${assignment.buyer.phone}`}
                    className="mt-2 inline-flex min-h-[40px] items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-semibold text-gray-700"
                  >
                    <Phone size={12} />
                    {assignment.buyer.phone}
                  </a>
                ) : null}
              </div>
            </div>
          </section>

          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">Map</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-gray-50 p-3">
                <p className="text-xs font-semibold text-gray-800">Seller pickup</p>
                <p className="mt-1 text-xs text-gray-500">{assignment?.pickup?.address || 'Adresse non disponible'}</p>
                {pickupVisible ? (
                  <>
                    {getCoordinatesDisplay(assignment?.pickup?.coordinates) ? (
                      <p className="mt-1 text-[11px] text-emerald-600">GPS: {getCoordinatesDisplay(assignment?.pickup?.coordinates)}</p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap gap-2">
                      {pickupMapGoogle ? (
                        <a
                          href={pickupMapGoogle}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex min-h-[40px] items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-semibold text-gray-700"
                        >
                          Google <ExternalLink size={11} />
                        </a>
                      ) : null}
                      {pickupMapApple ? (
                        <a
                          href={pickupMapApple}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex min-h-[40px] items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-semibold text-gray-700"
                        >
                          Apple <ExternalLink size={11} />
                        </a>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <p className="mt-2 text-xs text-gray-500">Location hidden for privacy.</p>
                )}
              </div>

              <div className="rounded-xl bg-gray-50 p-3">
                <p className="text-xs font-semibold text-gray-800">Buyer destination</p>
                <p className="mt-1 text-xs text-gray-500">{dropoffAddress || 'Adresse non disponible'}</p>
                {dropoffVisible ? (
                  <>
                    {getCoordinatesDisplay(assignment?.dropoff?.coordinates) ? (
                      <p className="mt-1 text-[11px] text-emerald-600">GPS: {getCoordinatesDisplay(assignment?.dropoff?.coordinates)}</p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap gap-2">
                      {dropoffMapGoogle ? (
                        <a
                          href={dropoffMapGoogle}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex min-h-[40px] items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-semibold text-gray-700"
                        >
                          Google <ExternalLink size={11} />
                        </a>
                      ) : null}
                      {dropoffMapApple ? (
                        <a
                          href={dropoffMapApple}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex min-h-[40px] items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-semibold text-gray-700"
                        >
                          Apple <ExternalLink size={11} />
                        </a>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <p className="mt-2 text-xs text-gray-500">Location hidden for privacy.</p>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">Facture</p>
            {assignment?.invoiceUrl || assignment?.invoiceAttachmentUrl || assignment?.order?.invoiceUrl ? (
              <a
                href={normalizeFileUrl(
                  assignment?.invoiceUrl || assignment?.invoiceAttachmentUrl || assignment?.order?.invoiceUrl
                )}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm font-semibold text-gray-700"
              >
                <FileText size={14} />
                Ouvrir la facture
              </a>
            ) : (
              <p className="mt-2 text-xs text-gray-500">Facture non disponible pour cette livraison.</p>
            )}
          </section>

          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">Delivery info</p>
            <div className="mt-2 space-y-1 text-sm text-gray-700">
              <p>Etape: <span className="font-semibold">{STAGE_LABELS[currentStage] || currentStage}</span></p>
              <p>Statut: <span className="font-semibold">{workflowLabelOf(assignment)}</span></p>
              <p>Frais: <span className="font-semibold">{formatCurrency(assignment?.deliveryPrice, assignment?.currency)}</span></p>
              <p>Mise a jour: <span className="font-semibold">{fmtDateTime(assignment?.updatedAt)}</span></p>
            </div>
            {nextStage === 'DELIVERED' && !hasPickupProof ? (
              <p className="mt-2 inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                <ShieldAlert size={12} /> Submit pickup proof first to unlock delivery proof.
              </p>
            ) : null}
          </section>

          {hasAnyProof ? (
            <section className="rounded-2xl bg-white p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">Preuves soumises</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
                  <p className="text-xs font-semibold text-blue-800">Pickup</p>
                  {pickupProofPhotos.length > 0 ? (
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {pickupProofPhotos.map((src, index) => (
                        <button
                          key={`pickup-proof-${index}`}
                          type="button"
                          onClick={() => setProofPreview({ url: src, label: `Preuve pickup ${index + 1}` })}
                          className="group relative aspect-[4/3] overflow-hidden rounded-lg bg-white ring-1 ring-blue-200"
                        >
                          <img src={src} alt={`Preuve pickup ${index + 1}`} className="h-full w-full object-contain bg-slate-50 p-1" loading="lazy" />
                          <span className="absolute inset-x-0 bottom-0 bg-black/55 px-1 py-0.5 text-[10px] font-semibold text-white">
                            Photo {index + 1}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {pickupSignatureUrl ? (
                    <button
                      type="button"
                      onClick={() => setProofPreview({ url: pickupSignatureUrl, label: 'Signature pickup' })}
                      className="mt-2 block w-full overflow-hidden rounded-lg bg-white ring-1 ring-blue-200"
                    >
                      <img src={pickupSignatureUrl} alt="Signature pickup" className="h-20 w-full object-contain bg-white p-1" loading="lazy" />
                    </button>
                  ) : null}
                  {assignment?.pickupProof?.note ? (
                    <p className="mt-2 rounded-lg bg-white px-2 py-1 text-[11px] text-blue-900 ring-1 ring-blue-200">
                      Note: {assignment.pickupProof.note}
                    </p>
                  ) : null}
                </div>

                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                  <p className="text-xs font-semibold text-emerald-800">Livraison</p>
                  {deliveryProofPhotos.length > 0 ? (
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {deliveryProofPhotos.map((src, index) => (
                        <button
                          key={`delivery-proof-${index}`}
                          type="button"
                          onClick={() => setProofPreview({ url: src, label: `Preuve livraison ${index + 1}` })}
                          className="group relative aspect-[4/3] overflow-hidden rounded-lg bg-white ring-1 ring-emerald-200"
                        >
                          <img src={src} alt={`Preuve livraison ${index + 1}`} className="h-full w-full object-contain bg-slate-50 p-1" loading="lazy" />
                          <span className="absolute inset-x-0 bottom-0 bg-black/55 px-1 py-0.5 text-[10px] font-semibold text-white">
                            Photo {index + 1}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {deliverySignatureUrl ? (
                    <button
                      type="button"
                      onClick={() => setProofPreview({ url: deliverySignatureUrl, label: 'Signature livraison' })}
                      className="mt-2 block w-full overflow-hidden rounded-lg bg-white ring-1 ring-emerald-200"
                    >
                      <img src={deliverySignatureUrl} alt="Signature livraison" className="h-20 w-full object-contain bg-white p-1" loading="lazy" />
                    </button>
                  ) : null}
                  {assignment?.deliveryProof?.note ? (
                    <p className="mt-2 rounded-lg bg-white px-2 py-1 text-[11px] text-emerald-900 ring-1 ring-emerald-200">
                      Note: {assignment.deliveryProof.note}
                    </p>
                  ) : null}
                </div>
              </div>
            </section>
          ) : null}
        </>
      )}

      {assignment ? (
        <DeliveryActionFooter
          primaryLabel={primaryLabel}
          onPrimary={handlePrimaryAction}
          primaryDisabled={primaryDisabled}
          primaryLoading={
            acceptMutation.isPending ||
            rejectMutation.isPending ||
            stageMutation.isPending ||
            proofMutation.isPending
          }
          secondaryLabel={secondaryLabel}
          onSecondary={handleSecondaryAction}
          secondaryDisabled={isOffline || isDelivered}
        />
      ) : null}

      <BaseModal
        isOpen={proofModal.open}
        onClose={() => {
          setProofModal({ open: false, type: 'pickup' });
          resetProofForm();
        }}
        panelClassName="w-full max-w-md"
      >
        <ModalHeader
          title={proofModal.type === 'delivery' ? 'Preuve livraison' : 'Preuve pickup'}
          subtitle="3 photos, signature et note"
          onClose={() => {
            setProofModal({ open: false, type: 'pickup' });
            resetProofForm();
          }}
        />
        <ModalBody className="space-y-3">
          <div className="space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-3">
            <p className="text-xs font-semibold text-gray-700">Photos ({proofPhotos.length}/{MAX_PROOF_PHOTOS})</p>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700">
              <Camera size={14} />
              Ajouter des photos
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleProofPhotosChange}
                className="hidden"
              />
            </label>

            {proofPhotos.length > 0 ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {proofPhotos.map((file, index) => (
                  <div key={`${file.name}-${index}`} className="rounded-lg border border-gray-200 bg-white p-2">
                    <button
                      type="button"
                      onClick={() =>
                        setProofPreview({
                          url: proofPhotoPreviews[index],
                          label: `Aperçu photo ${index + 1}`
                        })
                      }
                      className="block w-full overflow-hidden rounded-lg border border-gray-100"
                    >
                      <img
                        src={proofPhotoPreviews[index]}
                        alt={file.name || `proof-${index + 1}`}
                        className="h-24 w-full rounded object-contain bg-slate-50 p-1"
                      />
                    </button>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span className="truncate text-[10px] text-gray-600">{file.name}</span>
                      <button type="button" onClick={() => removeProofPhoto(index)} className="text-red-600">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-3">
            <p className="text-xs font-semibold text-gray-700">Signature</p>
            <SignaturePad value={proofSignatureImage} onChange={setProofSignatureImage} height={160} />
            {proofSignatureImage ? (
              <button
                type="button"
                onClick={() => setProofPreview({ url: proofSignatureImage, label: 'Aperçu signature' })}
                className="block w-full overflow-hidden rounded-lg bg-white ring-1 ring-gray-200"
              >
                <img
                  src={proofSignatureImage}
                  alt="Aperçu signature"
                  className="h-20 w-full object-contain bg-white p-1"
                />
              </button>
            ) : null}
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-gray-700">Note</label>
            <textarea
              value={proofNote}
              onChange={(event) => {
                setProofNote(event.target.value.slice(0, 1000));
                if (proofFormError) setProofFormError('');
              }}
              rows={3}
              placeholder="Ajoutez un commentaire"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
            />
          </div>

          {proofModal.type === 'delivery' ? (
            <input
              value={pinCode}
              onChange={(event) => setPinCode(event.target.value)}
              placeholder="Code livraison (si requis)"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
            />
          ) : null}

          {proofFormError ? <p className="text-xs text-red-600">{proofFormError}</p> : null}
          {proofMutation.isError ? (
            <p className="text-xs text-red-600">{extractMessage(proofMutation.error, 'Impossible d’envoyer la preuve.')}</p>
          ) : null}
        </ModalBody>
        <ModalFooter>
          <button
            type="button"
            disabled={proofMutation.isPending || isOffline}
            onClick={submitProof}
            className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 text-sm font-semibold text-white disabled:opacity-60"
          >
            {proofMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
            Enregistrer la preuve
          </button>
        </ModalFooter>
      </BaseModal>

      <BaseModal
        isOpen={Boolean(proofPreview?.url)}
        onClose={() => setProofPreview(null)}
        mobileSheet={false}
        size="full"
        rootClassName="z-[140] p-3 sm:p-6"
        panelClassName="max-h-[92dvh] border-none bg-transparent p-0 shadow-none sm:max-w-[92vw]"
        backdropClassName="bg-black/85 backdrop-blur-sm"
        ariaLabel={proofPreview?.label || 'Aperçu preuve'}
      >
        <div className="relative mx-auto flex max-h-[92dvh] max-w-[92vw] items-center justify-center p-2 sm:p-4">
          {proofPreview?.url ? (
            <a
              href={proofPreview.url}
              target="_blank"
              rel="noreferrer"
              className="absolute left-2 top-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/25 sm:left-4 sm:top-4"
            >
              Ouvrir
            </a>
          ) : null}
          <button
            type="button"
            onClick={() => setProofPreview(null)}
            className="absolute right-2 top-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/25 sm:right-4 sm:top-4"
          >
            Fermer
          </button>
          <div
            className={`rounded-xl p-2 sm:p-3 ${
              proofPreviewIsSignature ? 'bg-white shadow-2xl' : 'bg-black/20'
            }`}
          >
            <img
              src={proofPreview?.url || ''}
              alt={proofPreview?.label || 'Aperçu preuve'}
              className={`max-h-[84dvh] max-w-[88vw] rounded-lg object-contain ${
                proofPreviewIsSignature ? 'bg-white' : 'bg-black/10'
              }`}
              loading="lazy"
            />
          </div>
        </div>
      </BaseModal>

      <BaseModal
        isOpen={issueModal.open}
        onClose={() => setIssueModal({ open: false, reason: '' })}
        panelClassName="w-full max-w-md"
      >
        <ModalHeader
          title={assignmentStatus === 'PENDING' ? 'Reject assignment' : 'Report issue'}
          subtitle={assignmentStatus === 'PENDING' ? 'Cette action retirera la livraison de votre file.' : 'Nous enregistrerons un echec avec votre note.'}
          onClose={() => setIssueModal({ open: false, reason: '' })}
        />
        <ModalBody className="space-y-3">
          <textarea
            value={issueModal.reason}
            onChange={(event) => setIssueModal({ open: true, reason: event.target.value.slice(0, 600) })}
            rows={4}
            placeholder="Expliquez le probleme"
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
          />
          {(rejectMutation.isError || stageMutation.isError) ? (
            <p className="text-xs text-red-600">
              {extractMessage(rejectMutation.error || stageMutation.error, 'Action impossible.')}
            </p>
          ) : null}
        </ModalBody>
        <ModalFooter>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setIssueModal({ open: false, reason: '' })}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={submitSecondaryAction}
              disabled={!issueModal.reason.trim() || isOffline || rejectMutation.isPending || stageMutation.isPending}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
            >
              {(rejectMutation.isPending || stageMutation.isPending) ? (
                <Loader2 size={14} className="animate-spin" />
              ) : null}
              Confirmer
            </button>
          </div>
        </ModalFooter>
      </BaseModal>

    </div>
  );
}
