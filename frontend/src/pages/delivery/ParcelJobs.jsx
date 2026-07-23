import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Package,
  Phone,
  MapPin,
  Image as ImageIcon,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Loader2,
  Camera
} from 'lucide-react';
import api, { getApiErrorMessage } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { STAGE_LABELS, NEXT_STAGE, normalizeFileUrl } from '../../utils/deliveryUi';
import { formatPriceWithStoredSettings as formatCurrency } from '../../utils/priceFormatter';

function ParcelJobCard({ job, onChange }) {
  const { showToast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [proofFile, setProofFile] = useState(null);
  const [pinCode, setPinCode] = useState('');
  const [showProof, setShowProof] = useState(false);

  const currentStage = job.currentStage || 'ASSIGNED';
  const nextStage = NEXT_STAGE[currentStage];
  const isPendingAcceptance = job.assignmentStatus === 'PENDING';
  const isClosed = ['DELIVERED', 'CANCELED', 'FAILED', 'REJECTED'].includes(job.status);

  const handleAccept = async () => {
    setBusy(true);
    try {
      const { data } = await api.patch(`/courier/parcel-jobs/${job._id}/accept`);
      onChange(data.item);
      showToast('Course acceptée.', { variant: 'success' });
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Impossible d’accepter.'), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) return;
    setBusy(true);
    try {
      const { data } = await api.patch(`/courier/parcel-jobs/${job._id}/reject`, { reason: rejectReason });
      onChange(data.item);
      showToast('Course refusée.', { variant: 'info' });
      setShowReject(false);
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Impossible de refuser.'), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const handleAdvanceStage = async () => {
    if (!nextStage) return;
    if (['PICKED_UP', 'DELIVERED'].includes(nextStage) && !showProof) {
      setShowProof(true);
      return;
    }
    setBusy(true);
    try {
      const proofType = nextStage === 'PICKED_UP' ? 'pickup' : nextStage === 'DELIVERED' ? 'delivery' : '';
      if (proofType) {
        const formData = new FormData();
        formData.append('proofType', proofType);
        if (proofFile) formData.append('photos', proofFile);
        await api.post(`/courier/parcel-jobs/${job._id}/proof`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }
      const { data } = await api.patch(`/courier/parcel-jobs/${job._id}/stage`, {
        stage: nextStage,
        deliveryPinCode: nextStage === 'DELIVERED' ? pinCode : undefined
      });
      onChange(data.item);
      setShowProof(false);
      setProofFile(null);
      setPinCode('');
      showToast(`Étape mise à jour : ${STAGE_LABELS[nextStage] || nextStage}`, { variant: 'success' });
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Action impossible.'), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 p-3.5 text-left"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-[#FF6A00] dark:bg-orange-950">
          <Package size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-gray-900 dark:text-white">
            {job.pickup?.communeName || job.pickup?.address} → {job.dropoff?.communeName || job.dropoff?.address}
          </p>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            {STAGE_LABELS[currentStage] || currentStage} · {formatCurrency(job.deliveryPrice)}
          </p>
        </div>
        {expanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </button>

      {expanded && (
        <div className="space-y-3 border-t border-gray-100 p-3.5 dark:border-neutral-800">
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 dark:border-neutral-800 dark:bg-neutral-900">
            <div className="flex items-start gap-2">
              <MapPin size={14} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <div>
                <p className="text-[10px] font-bold uppercase text-gray-400 dark:text-gray-500">Retrait</p>
                <p className="text-sm text-gray-800 dark:text-gray-200">{job.pickup?.address}</p>
                {job.pickup?.contactName && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {job.pickup.contactName} {job.pickup.contactPhone ? `· ${job.pickup.contactPhone}` : ''}
                  </p>
                )}
              </div>
            </div>
            <div className="mt-2 flex items-start gap-2 border-t border-gray-200 pt-2 dark:border-neutral-700">
              <MapPin size={14} className="mt-0.5 shrink-0 text-[#FF6A00]" />
              <div>
                <p className="text-[10px] font-bold uppercase text-gray-400 dark:text-gray-500">Dépôt</p>
                <p className="text-sm text-gray-800 dark:text-gray-200">{job.dropoff?.address}</p>
                {job.dropoff?.contactName && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {job.dropoff.contactName} {job.dropoff.contactPhone ? `· ${job.dropoff.contactPhone}` : ''}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Authorization to present at pickup */}
          <div className="rounded-xl border border-orange-200 bg-orange-50 p-3 dark:border-orange-900 dark:bg-orange-950">
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-black uppercase text-[#FF6A00]">
              <ShieldCheck size={13} /> À présenter au retrait
            </p>
            {job.parcelDescription && <p className="text-sm text-gray-800 dark:text-gray-200">{job.parcelDescription}</p>}
            {job.authorization?.referenceCode && (
              <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">Référence : {job.authorization.referenceCode}</p>
            )}
            {job.authorization?.notes && <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">{job.authorization.notes}</p>}
            {job.authorization?.proofImageUrl && (
              <a
                href={normalizeFileUrl(job.authorization.proofImageUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-[#FF6A00]"
              >
                <ImageIcon size={13} /> Voir le justificatif
              </a>
            )}
            {job.requesterId?.phone && (
              <a
                href={`tel:${job.requesterId.phone}`}
                className="mt-2 flex items-center gap-1.5 text-xs font-bold text-gray-600 dark:text-gray-400"
              >
                <Phone size={13} /> {job.requesterId.name || 'Client'} · {job.requesterId.phone}
              </a>
            )}
          </div>

          {isClosed ? (
            <p className="text-center text-xs font-semibold text-gray-400 dark:text-gray-500">Course clôturée.</p>
          ) : isPendingAcceptance ? (
            showReject ? (
              <div className="space-y-2">
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={2}
                  placeholder="Motif du refus"
                  className="ui-input w-full resize-none rounded-xl p-2 text-xs outline-none"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleReject}
                    disabled={busy || !rejectReason.trim()}
                    className="flex-1 rounded-full border border-rose-200 py-2 text-xs font-bold text-rose-600 disabled:opacity-50 dark:border-rose-900 dark:text-rose-400"
                  >
                    Confirmer le refus
                  </button>
                  <button type="button" onClick={() => setShowReject(false)} className="rounded-full border border-gray-200 px-3 text-xs font-bold text-gray-500 dark:border-neutral-700 dark:text-gray-400">
                    Annuler
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleAccept}
                  disabled={busy}
                  className="flex-1 rounded-full bg-gray-900 py-2.5 text-sm font-black text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
                >
                  {busy ? <Loader2 size={14} className="mx-auto animate-spin" /> : 'Accepter la course'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowReject(true)}
                  className="rounded-full border border-rose-200 px-4 text-sm font-bold text-rose-600 dark:border-rose-900 dark:text-rose-400"
                >
                  Refuser
                </button>
              </div>
            )
          ) : nextStage ? (
            showProof ? (
              <div className="space-y-2">
                <label className="flex min-h-16 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 text-xs font-semibold text-gray-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-gray-500">
                  {proofFile ? proofFile.name : (
                    <span className="flex items-center gap-1.5"><Camera size={16} /> Photo de preuve</span>
                  )}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => setProofFile(e.target.files?.[0] || null)} />
                </label>
                {nextStage === 'DELIVERED' && (
                  <input
                    type="text"
                    value={pinCode}
                    onChange={(e) => setPinCode(e.target.value)}
                    placeholder="Code de livraison (demandé au client)"
                    className="ui-input w-full rounded-xl p-2.5 text-sm outline-none"
                  />
                )}
                <button
                  type="button"
                  onClick={handleAdvanceStage}
                  disabled={busy}
                  className="w-full rounded-full bg-[#FF6A00] py-2.5 text-sm font-black text-white disabled:opacity-50"
                >
                  {busy ? <Loader2 size={14} className="mx-auto animate-spin" /> : `Confirmer : ${STAGE_LABELS[nextStage]}`}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleAdvanceStage}
                disabled={busy}
                className="w-full rounded-full bg-gray-900 py-2.5 text-sm font-black text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
              >
                {busy ? <Loader2 size={14} className="mx-auto animate-spin" /> : `Étape suivante : ${STAGE_LABELS[nextStage]}`}
              </button>
            )
          ) : null}
        </div>
      )}
    </div>
  );
}

export default function ParcelJobs() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    api
      .get('/courier/parcel-jobs')
      .then(({ data }) => setItems(Array.isArray(data?.items) ? data.items : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 20000);
    return () => clearInterval(interval);
  }, []);

  const handleChange = (updated) => {
    setItems((prev) => prev.map((item) => (item._id === updated._id ? { ...item, ...updated } : item)));
  };

  const sorted = useMemo(
    () => [...items].sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)),
    [items]
  );

  return (
    <div className="min-h-screen bg-[#f5f5f5] pb-10 dark:bg-neutral-950">
      <div className="border-b border-gray-100 bg-white px-4 py-3.5 dark:border-neutral-800 dark:bg-neutral-950">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-black text-gray-900 dark:text-white">Courses colis</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">Livraisons de colis à la demande</p>
          </div>
          <Link to="/delivery" className="text-xs font-bold text-[#FF6A00]">Retour</Link>
        </div>
      </div>

      <div className="mx-auto max-w-lg space-y-2.5 px-4 py-4">
        {loading ? (
          <p className="py-10 text-center text-sm text-gray-400 dark:text-gray-500">Chargement…</p>
        ) : sorted.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-400 dark:text-gray-500">Aucune course colis assignée.</p>
        ) : (
          sorted.map((job) => <ParcelJobCard key={job._id} job={job} onChange={handleChange} />)
        )}
      </div>
    </div>
  );
}
