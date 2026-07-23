import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Package,
  RefreshCw,
  Search,
  ChevronDown,
  ChevronUp,
  Phone,
  Image as ImageIcon,
  ShieldCheck,
  X,
  Clock,
  Truck,
  CheckCircle2,
  Ban,
  Banknote
} from 'lucide-react';
import api, { getApiErrorMessage } from '../services/api';
import { useToast } from '../context/ToastContext';
import { formatPriceWithStoredSettings as formatCurrency } from '../utils/priceFormatter';
import { normalizeFileUrl } from '../utils/deliveryUi';

const STATUS_FILTERS = [
  { value: 'all', label: 'Toutes' },
  { value: 'PENDING', label: 'En attente' },
  { value: 'ACCEPTED', label: 'Assignées' },
  { value: 'IN_PROGRESS', label: 'En cours' },
  { value: 'DELIVERED', label: 'Livrées' },
  { value: 'CANCELED', label: 'Annulées' }
];

const STATUS_BADGE = {
  PENDING: 'bg-amber-50 text-amber-700',
  ACCEPTED: 'bg-blue-50 text-blue-700',
  IN_PROGRESS: 'bg-blue-50 text-blue-700',
  DELIVERED: 'bg-emerald-50 text-emerald-700',
  CANCELED: 'bg-neutral-100 text-neutral-500',
  FAILED: 'bg-red-50 text-red-700',
  REJECTED: 'bg-red-50 text-red-700'
};

const TIMELINE_LABELS = {
  PARCEL_REQUEST_CREATED: 'Course créée',
  COURIER_ASSIGNED: 'Livreur assigné',
  COURIER_ACCEPTED: 'Livreur en route',
  COURIER_REJECTED: 'Livreur indisponible',
  COURIER_STAGE_UPDATED: 'Suivi mis à jour',
  COURIER_PROOF_UPLOADED: 'Preuve soumise',
  DELIVERY_PIN_VERIFIED: 'Code vérifié',
  PARCEL_REQUEST_CANCELED: 'Course annulée'
};

function StatCard({ icon: Icon, label, value, tone }) {
  return (
    <div className="flex flex-col gap-1 bg-white px-4 py-3.5">
      <div className="flex items-center gap-2">
        <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${tone}`}>
          <Icon size={14} />
        </div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-400">{label}</p>
      </div>
      <p className="text-xl font-bold tabular-nums tracking-tight text-neutral-900">{value}</p>
    </div>
  );
}

function ParcelRequestCard({ item, deliveryGuys, onChange, showToast }) {
  const [expanded, setExpanded] = useState(false);
  const [selectedGuy, setSelectedGuy] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelInput, setShowCancelInput] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [pinVisible, setPinVisible] = useState(false);

  const isClosed = ['DELIVERED', 'CANCELED', 'FAILED', 'REJECTED'].includes(item.status);
  const canReassign = !isClosed;

  const handleAssign = async () => {
    if (!selectedGuy) return;
    setAssigning(true);
    try {
      const { data } = await api.post(`/parcels/admin/${item._id}/assign`, { deliveryGuyId: selectedGuy });
      onChange(data);
      showToast('Livreur assigné.', { variant: 'success' });
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Impossible d’assigner.'), { variant: 'error' });
    } finally {
      setAssigning(false);
    }
  };

  const handleCancel = async () => {
    setCancelling(true);
    try {
      const { data } = await api.post(`/parcels/admin/${item._id}/cancel`, { reason: cancelReason });
      onChange(data);
      showToast('Course annulée.', { variant: 'success' });
      setShowCancelInput(false);
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Impossible d’annuler.'), { variant: 'error' });
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <button type="button" onClick={() => setExpanded((v) => !v)} className="flex w-full items-start justify-between gap-2 p-3.5 text-left">
        <div className="min-w-0">
          <p className="text-sm font-bold text-neutral-900">
            {item.pickup?.communeName || item.pickup?.address} → {item.dropoff?.communeName || item.dropoff?.address}
          </p>
          <p className="mt-0.5 text-xs text-neutral-500">
            {item.requesterId?.name} · {item.requesterId?.phone} · {formatCurrency(item.deliveryPrice)}
            {' · '}
            {new Date(item.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </p>
          {item.assignedDeliveryGuyId && (
            <p className="mt-1 text-xs font-semibold text-emerald-700">
              Livreur : {item.assignedDeliveryGuyId.fullName || item.assignedDeliveryGuyId.name}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${STATUS_BADGE[item.status] || 'bg-neutral-100 text-neutral-600'}`}>
            {item.status}
          </span>
          {expanded ? <ChevronUp size={16} className="text-neutral-400" /> : <ChevronDown size={16} className="text-neutral-400" />}
        </div>
      </button>

      {expanded && (
        <div className="space-y-3 border-t border-neutral-100 p-3.5">
          <div className="rounded-xl bg-neutral-50 p-3 text-xs text-neutral-700">
            <p><strong>Retrait :</strong> {item.pickup?.address} {item.pickup?.contactName ? `(${item.pickup.contactName}${item.pickup.contactPhone ? ` · ${item.pickup.contactPhone}` : ''})` : ''}</p>
            <p className="mt-1"><strong>Dépôt :</strong> {item.dropoff?.address} {item.dropoff?.contactName ? `(${item.dropoff.contactName}${item.dropoff.contactPhone ? ` · ${item.dropoff.contactPhone}` : ''})` : ''}</p>
            {item.parcelDescription && <p className="mt-1"><strong>Colis :</strong> {item.parcelDescription}</p>}
            {item.requesterId?.phone && (
              <a href={`tel:${item.requesterId.phone}`} className="mt-2 inline-flex items-center gap-1 font-bold text-neutral-900">
                <Phone size={12} /> Appeler le client
              </a>
            )}
          </div>

          <div className="rounded-xl border border-[#e85d00]/30 bg-[#fff7f0] p-3 text-xs">
            <p className="mb-1.5 flex items-center gap-1.5 font-black uppercase text-[#e85d00]">
              <ShieldCheck size={12} /> Justificatif de retrait
            </p>
            {item.authorization?.referenceCode && <p>Référence : {item.authorization.referenceCode}</p>}
            {item.authorization?.notes && <p className="mt-1">{item.authorization.notes}</p>}
            {item.authorization?.proofImageUrl && (
              <a
                href={normalizeFileUrl(item.authorization.proofImageUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1.5 inline-flex items-center gap-1 font-bold text-[#e85d00]"
              >
                <ImageIcon size={12} /> Voir le justificatif
              </a>
            )}
            {item.deliveryPinCode && item.status !== 'DELIVERED' && (
              <div className="mt-2 flex items-center gap-2 border-t border-[#e85d00]/20 pt-2">
                <span className="font-bold">Code de livraison :</span>
                {pinVisible ? (
                  <span className="font-mono text-sm font-black tracking-widest">{item.deliveryPinCode}</span>
                ) : (
                  <button type="button" onClick={() => setPinVisible(true)} className="font-bold text-[#e85d00] underline">
                    Afficher
                  </button>
                )}
              </div>
            )}
          </div>

          {Array.isArray(item.timeline) && item.timeline.length > 0 && (
            <div className="rounded-xl bg-neutral-50 p-3">
              <p className="mb-1.5 text-[10px] font-black uppercase text-neutral-400">Historique</p>
              <ul className="space-y-1">
                {item.timeline.map((event, idx) => (
                  <li key={idx} className="flex items-center justify-between text-xs text-neutral-600">
                    <span>{TIMELINE_LABELS[event.type] || event.type}</span>
                    <span className="text-neutral-400">{new Date(event.at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {canReassign && (
            <div className="flex gap-2">
              <select
                value={selectedGuy}
                onChange={(e) => setSelectedGuy(e.target.value)}
                className="flex-1 rounded-lg border border-neutral-200 px-2 py-1.5 text-xs"
              >
                <option value="">{item.assignedDeliveryGuyId ? 'Réassigner à…' : 'Choisir un livreur'}</option>
                {deliveryGuys.map((guy) => (
                  <option key={guy._id} value={guy._id}>{guy.fullName || guy.name}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleAssign}
                disabled={!selectedGuy || assigning}
                className="rounded-lg bg-neutral-900 px-3 text-xs font-bold text-white disabled:opacity-50"
              >
                {item.assignedDeliveryGuyId ? 'Réassigner' : 'Assigner'}
              </button>
            </div>
          )}

          {!isClosed && (
            showCancelInput ? (
              <div className="space-y-2">
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  rows={2}
                  placeholder="Motif de l’annulation (optionnel)"
                  className="w-full resize-none rounded-lg border border-neutral-200 p-2 text-xs"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={cancelling}
                    className="flex-1 rounded-lg border border-red-200 py-2 text-xs font-bold text-red-600 disabled:opacity-50"
                  >
                    Confirmer l’annulation
                  </button>
                  <button type="button" onClick={() => setShowCancelInput(false)} className="rounded-lg border border-neutral-200 px-3 text-xs font-bold text-neutral-500">
                    Fermer
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowCancelInput(true)}
                className="inline-flex items-center gap-1 text-xs font-bold text-red-600"
              >
                <X size={12} /> Annuler la course
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminParcelRequests() {
  const { showToast } = useToast();
  const [stats, setStats] = useState(null);
  const [items, setItems] = useState([]);
  const [deliveryGuys, setDeliveryGuys] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get('/parcels/admin/list', { params: { status: statusFilter, search, page } }),
      api.get('/admin/delivery-guys?limit=200'),
      api.get('/parcels/admin/stats')
    ])
      .then(([requestsRes, guysRes, statsRes]) => {
        setItems(Array.isArray(requestsRes.data?.items) ? requestsRes.data.items : []);
        setTotalPages(Math.max(1, Number(requestsRes.data?.totalPages || 1)));
        setDeliveryGuys(Array.isArray(guysRes.data?.items) ? guysRes.data.items : guysRes.data || []);
        setStats(statsRes.data || null);
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, search, page]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, search]);

  const activeGuys = useMemo(
    () => deliveryGuys.filter((guy) => guy.isActive !== false && guy.active !== false),
    [deliveryGuys]
  );

  const handleItemChange = (updated) => {
    setItems((prev) => prev.map((item) => (item._id === updated._id ? { ...item, ...updated } : item)));
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="border-b border-neutral-200 bg-white px-4 py-3.5 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Link to="/admin" className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 text-neutral-600">
              <ArrowLeft size={15} />
            </Link>
            <div>
              <h1 className="text-lg font-black text-neutral-900">Courses colis</h1>
              <p className="text-xs text-neutral-500">Livraisons de colis à la demande</p>
            </div>
          </div>
          <button
            type="button"
            onClick={load}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 text-neutral-600"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {stats && (
          <div className="mt-3 grid grid-cols-3 gap-px overflow-hidden rounded-xl bg-neutral-100 sm:grid-cols-6">
            <StatCard icon={Package} label="Total" value={stats.total} tone="bg-neutral-100 text-neutral-600" />
            <StatCard icon={Clock} label="En attente" value={stats.pending} tone="bg-amber-100 text-amber-600" />
            <StatCard icon={Truck} label="Assignées" value={stats.accepted + stats.inProgress} tone="bg-blue-100 text-blue-600" />
            <StatCard icon={CheckCircle2} label="Livrées" value={stats.delivered} tone="bg-emerald-100 text-emerald-600" />
            <StatCard icon={Ban} label="Annulées" value={stats.canceled} tone="bg-red-100 text-red-600" />
            <StatCard icon={Banknote} label="Revenu" value={formatCurrency(stats.totalRevenue)} tone="bg-violet-100 text-violet-600" />
          </div>
        )}

        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Rechercher client (nom, téléphone)"
              className="w-full rounded-lg border border-neutral-200 bg-neutral-50 py-1.5 pl-8 pr-3 text-xs outline-none focus:border-neutral-400"
            />
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
            {STATUS_FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => setStatusFilter(filter.value)}
                className={`shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition ${
                  statusFilter === filter.value
                    ? 'bg-neutral-900 text-white'
                    : 'border border-neutral-200 bg-neutral-50 text-neutral-600'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl space-y-2.5 p-4">
        {loading ? (
          <p className="py-10 text-center text-sm text-neutral-400">Chargement…</p>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-neutral-200 bg-white p-6 text-center">
            <Package className="mx-auto h-8 w-8 text-neutral-300" />
            <p className="mt-2 text-sm text-neutral-500">Aucune course colis.</p>
          </div>
        ) : (
          items.map((item) => (
            <ParcelRequestCard
              key={item._id}
              item={item}
              deliveryGuys={activeGuys}
              onChange={handleItemChange}
              showToast={showToast}
            />
          ))
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-semibold text-neutral-600 disabled:opacity-40"
            >
              Précédent
            </button>
            <span className="text-xs text-neutral-500">{page} / {totalPages}</span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-semibold text-neutral-600 disabled:opacity-40"
            >
              Suivant
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
