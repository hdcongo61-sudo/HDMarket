import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  BarChart3,
  Camera,
  CheckCircle2,
  ClipboardList,
  Filter,
  Loader2,
  MapPin,
  Package,
  RefreshCcw,
  Truck,
  UserCheck,
  XCircle
} from 'lucide-react';
import api from '../services/api';
import { useAppSettings } from '../context/AppSettingsContext';
import { formatPriceWithStoredSettings } from '../utils/priceFormatter';
import BaseModal from '../components/modals/BaseModal';

const STATUS_TABS = [
  { key: 'all', label: 'Toutes' },
  { key: 'PENDING', label: 'Pending' },
  { key: 'ACCEPTED', label: 'Accepted' },
  { key: 'IN_PROGRESS', label: 'In progress' },
  { key: 'DELIVERED', label: 'Delivered' },
  { key: 'REJECTED', label: 'Rejected' }
];

const STATUS_STYLES = {
  PENDING: 'bg-amber-100 text-amber-800 border-amber-200',
  ACCEPTED: 'bg-blue-100 text-blue-800 border-blue-200',
  IN_PROGRESS: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  DELIVERED: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  REJECTED: 'bg-red-100 text-red-800 border-red-200',
  CANCELED: 'bg-neutral-100 text-neutral-700 border-neutral-200'
};

const fmtMoney = (value) => formatPriceWithStoredSettings(Number(value || 0));

const normalizeList = (payload) => (Array.isArray(payload) ? payload : payload?.items || []);
const normalizeFileUrl = (url = '') => {
  const normalized = String(url || '').trim();
  if (!normalized) return '';
  if (/^https?:\/\//i.test(normalized)) return normalized;
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
  const host = apiBase.replace(/\/api\/?$/, '');
  return `${host}/${normalized.replace(/^\/+/, '')}`;
};

export default function AdminDeliveryRequests() {
  const { cities, communes, getRuntimeValue } = useAppSettings();
  const platformDeliveryEnabled =
    String(getRuntimeValue('enable_platform_delivery', false)) === 'true' ||
    getRuntimeValue('enable_platform_delivery', false) === true;
  const deliveryRequestsEnabled =
    String(getRuntimeValue('enable_delivery_requests', true)) !== 'false' &&
    getRuntimeValue('enable_delivery_requests', true) !== false;

  const [statusTab, setStatusTab] = useState('all');
  const [cityFilter, setCityFilter] = useState('');
  const [pickupCommuneFilter, setPickupCommuneFilter] = useState('');
  const [dropoffCommuneFilter, setDropoffCommuneFilter] = useState('');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');
  const [priceMinFilter, setPriceMinFilter] = useState('');
  const [priceMaxFilter, setPriceMaxFilter] = useState('');
  const [shopFilter, setShopFilter] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1, pageSize: 20 });
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const [deliveryGuys, setDeliveryGuys] = useState([]);
  const [deliveryGuysLoading, setDeliveryGuysLoading] = useState(false);

  const [selectedItem, setSelectedItem] = useState(null);
  const [acceptModalOpen, setAcceptModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedDeliveryGuyId, setSelectedDeliveryGuyId] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [savingAction, setSavingAction] = useState(false);
  const [actionError, setActionError] = useState('');
  const [proofModalOpen, setProofModalOpen] = useState(false);
  const [proofType, setProofType] = useState('pickup');
  const [proofPhoto, setProofPhoto] = useState(null);
  const [proofSignatureFile, setProofSignatureFile] = useState(null);
  const [proofSignatureUrl, setProofSignatureUrl] = useState('');
  const [proofNote, setProofNote] = useState('');
  const [proofSaving, setProofSaving] = useState(false);
  const [proofError, setProofError] = useState('');

  const communeOptions = useMemo(
    () => (Array.isArray(communes) ? communes.filter((entry) => entry?.isActive !== false) : []),
    [communes]
  );
  const cityOptions = useMemo(
    () => (Array.isArray(cities) ? cities.filter((entry) => entry?.isActive !== false) : []),
    [cities]
  );

  const buildRequestParams = useCallback(() => {
    const params = new URLSearchParams();
    if (statusTab !== 'all') params.set('status', statusTab);
    if (cityFilter) params.set('city', cityFilter);
    if (pickupCommuneFilter) params.set('pickupCommune', pickupCommuneFilter);
    if (dropoffCommuneFilter) params.set('dropoffCommune', dropoffCommuneFilter);
    if (dateFromFilter) params.set('dateFrom', dateFromFilter);
    if (dateToFilter) params.set('dateTo', dateToFilter);
    if (priceMinFilter) params.set('priceMin', priceMinFilter);
    if (priceMaxFilter) params.set('priceMax', priceMaxFilter);
    if (shopFilter) params.set('shop', shopFilter);
    params.set('page', String(page));
    params.set('limit', '20');
    return params;
  }, [
    statusTab,
    cityFilter,
    pickupCommuneFilter,
    dropoffCommuneFilter,
    dateFromFilter,
    dateToFilter,
    priceMinFilter,
    priceMaxFilter,
    shopFilter,
    page
  ]);

  const buildAnalyticsParams = useCallback(() => {
    const params = new URLSearchParams();
    if (statusTab !== 'all') params.set('status', statusTab);
    if (cityFilter) params.set('city', cityFilter);
    if (pickupCommuneFilter) params.set('pickupCommune', pickupCommuneFilter);
    if (dropoffCommuneFilter) params.set('dropoffCommune', dropoffCommuneFilter);
    if (dateFromFilter) params.set('dateFrom', dateFromFilter);
    if (dateToFilter) params.set('dateTo', dateToFilter);
    if (priceMinFilter) params.set('priceMin', priceMinFilter);
    if (priceMaxFilter) params.set('priceMax', priceMaxFilter);
    if (shopFilter) params.set('shop', shopFilter);
    return params;
  }, [
    statusTab,
    cityFilter,
    pickupCommuneFilter,
    dropoffCommuneFilter,
    dateFromFilter,
    dateToFilter,
    priceMinFilter,
    priceMaxFilter,
    shopFilter
  ]);

  const loadDeliveryRequests = useCallback(
    async ({ silent = false } = {}) => {
      if (!platformDeliveryEnabled || !deliveryRequestsEnabled) {
        setItems([]);
        setMeta({ total: 0, totalPages: 1, pageSize: 20 });
        return;
      }
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError('');
      try {
        const params = buildRequestParams();
        const { data } = await api.get(`/admin/delivery-requests?${params.toString()}`);
        const list = normalizeList(data);
        setItems(list);
        setMeta({
          total: Number(data?.total || list.length || 0),
          totalPages: Number(data?.totalPages || 1),
          pageSize: Number(data?.pageSize || 20)
        });
      } catch (err) {
        setError(err.response?.data?.message || 'Impossible de charger les demandes de livraison.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [buildRequestParams, deliveryRequestsEnabled, platformDeliveryEnabled]
  );

  const loadDeliveryAnalytics = useCallback(
    async ({ silent = false } = {}) => {
      if (!platformDeliveryEnabled || !deliveryRequestsEnabled) {
        setAnalytics(null);
        return;
      }
      if (!silent) setAnalyticsLoading(true);
      try {
        const params = buildAnalyticsParams();
        const { data } = await api.get(`/admin/delivery-requests/analytics?${params.toString()}`);
        setAnalytics(data || null);
      } catch {
        setAnalytics(null);
      } finally {
        setAnalyticsLoading(false);
      }
    },
    [buildAnalyticsParams, deliveryRequestsEnabled, platformDeliveryEnabled]
  );

  const loadDeliveryGuys = useCallback(async () => {
    setDeliveryGuysLoading(true);
    try {
      const { data } = await api.get('/admin/delivery-guys?limit=200');
      const list = normalizeList(data).filter((entry) => entry?.isActive !== false && entry?.active !== false);
      setDeliveryGuys(list);
    } catch {
      setDeliveryGuys([]);
    } finally {
      setDeliveryGuysLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDeliveryRequests();
  }, [loadDeliveryRequests]);

  useEffect(() => {
    loadDeliveryAnalytics();
  }, [loadDeliveryAnalytics]);

  useEffect(() => {
    if (!platformDeliveryEnabled || !deliveryRequestsEnabled) return;
    loadDeliveryGuys();
  }, [deliveryRequestsEnabled, loadDeliveryGuys, platformDeliveryEnabled]);

  useEffect(() => {
    setPage(1);
  }, [
    statusTab,
    cityFilter,
    pickupCommuneFilter,
    dropoffCommuneFilter,
    dateFromFilter,
    dateToFilter,
    priceMinFilter,
    priceMaxFilter,
    shopFilter
  ]);

  const resetActionState = () => {
    setActionError('');
    setSavingAction(false);
    setSelectedDeliveryGuyId('');
    setRejectionReason('');
  };

  const openAccept = (item) => {
    setSelectedItem(item);
    setAcceptModalOpen(true);
    setActionError('');
  };

  const openReject = (item) => {
    setSelectedItem(item);
    setRejectModalOpen(true);
    setActionError('');
  };

  const openAssign = (item) => {
    setSelectedItem(item);
    setAssignModalOpen(true);
    setSelectedDeliveryGuyId(item?.assignedDeliveryGuyId?._id || item?.assignedDeliveryGuyId || '');
    setActionError('');
  };

  const closeAllModals = () => {
    setAcceptModalOpen(false);
    setRejectModalOpen(false);
    setAssignModalOpen(false);
    setProofModalOpen(false);
    setSelectedItem(null);
    resetActionState();
    setProofPhoto(null);
    setProofSignatureFile(null);
    setProofSignatureUrl('');
    setProofNote('');
    setProofError('');
    setProofSaving(false);
  };

  const handleAccept = async () => {
    if (!selectedItem?._id) return;
    setSavingAction(true);
    setActionError('');
    try {
      await api.patch(`/admin/delivery-requests/${selectedItem._id}/accept`, {
        deliveryGuyId: selectedDeliveryGuyId || undefined
      });
      closeAllModals();
      await Promise.all([loadDeliveryRequests({ silent: true }), loadDeliveryAnalytics({ silent: true })]);
    } catch (err) {
      setActionError(err.response?.data?.message || 'Impossible d’accepter la demande.');
      setSavingAction(false);
    }
  };

  const handleReject = async () => {
    if (!selectedItem?._id) return;
    if (!rejectionReason.trim()) {
      setActionError('Veuillez renseigner une raison.');
      return;
    }
    setSavingAction(true);
    setActionError('');
    try {
      await api.patch(`/admin/delivery-requests/${selectedItem._id}/reject`, {
        reason: rejectionReason.trim()
      });
      closeAllModals();
      await Promise.all([loadDeliveryRequests({ silent: true }), loadDeliveryAnalytics({ silent: true })]);
    } catch (err) {
      setActionError(err.response?.data?.message || 'Impossible de rejeter la demande.');
      setSavingAction(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedItem?._id) return;
    if (!selectedDeliveryGuyId) {
      setActionError('Choisissez un livreur.');
      return;
    }
    setSavingAction(true);
    setActionError('');
    try {
      await api.patch(`/admin/delivery-requests/${selectedItem._id}/assign-delivery-guy`, {
        deliveryGuyId: selectedDeliveryGuyId
      });
      closeAllModals();
      await Promise.all([loadDeliveryRequests({ silent: true }), loadDeliveryAnalytics({ silent: true })]);
    } catch (err) {
      setActionError(err.response?.data?.message || 'Impossible d’assigner le livreur.');
      setSavingAction(false);
    }
  };

  const openProofModal = (item, nextType = 'pickup') => {
    setSelectedItem(item);
    setProofType(nextType);
    setProofPhoto(null);
    setProofSignatureFile(null);
    setProofSignatureUrl('');
    setProofNote('');
    setProofError('');
    setProofModalOpen(true);
  };

  const handleSubmitProof = async () => {
    if (!selectedItem?._id) return;
    if (!proofPhoto && !proofSignatureFile && !proofSignatureUrl.trim() && !proofNote.trim()) {
      setProofError('Ajoutez au moins une photo, une signature ou une note.');
      return;
    }
    setProofSaving(true);
    setProofError('');
    try {
      const formData = new FormData();
      if (proofPhoto) formData.append('photos', proofPhoto);
      if (proofSignatureFile) formData.append('signatureFile', proofSignatureFile);
      if (proofSignatureUrl.trim()) formData.append('signatureUrl', proofSignatureUrl.trim());
      if (proofNote.trim()) formData.append('note', proofNote.trim());
      const route = proofType === 'delivery' ? 'delivery-proof' : 'pickup-proof';
      await api.patch(`/admin/delivery-requests/${selectedItem._id}/${route}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      closeAllModals();
      await Promise.all([
        loadDeliveryRequests({ silent: true }),
        loadDeliveryAnalytics({ silent: true })
      ]);
    } catch (err) {
      setProofError(err.response?.data?.message || 'Impossible d’enregistrer la preuve.');
      setProofSaving(false);
    }
  };

  if (!platformDeliveryEnabled || !deliveryRequestsEnabled) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
          Livraison plateforme désactivée dans la configuration runtime.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-3 py-4 sm:px-4 sm:py-6 space-y-4">
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-gray-900 sm:text-xl">Delivery Requests</h1>
            <p className="text-sm text-gray-500">Inbox opérationnelle des demandes plateforme</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                Promise.all([
                  loadDeliveryRequests({ silent: true }),
                  loadDeliveryAnalytics({ silent: true })
                ])
              }
              disabled={refreshing || loading}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            >
              <RefreshCcw size={14} className={refreshing ? 'animate-spin' : ''} />
              Refresh
            </button>
            <Link
              to="/admin/delivery-guys"
              className="inline-flex items-center gap-2 rounded-xl bg-neutral-700 px-3 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
            >
              <Truck size={14} />
              Livreurs
            </Link>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-800">
          <BarChart3 size={15} />
          Analytics livraison
        </div>
        {analyticsLoading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 size={14} className="animate-spin" />
            Chargement analytics...
          </div>
        ) : analytics?.kpis ? (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                <p className="text-[11px] text-gray-500">Demandes</p>
                <p className="text-lg font-bold text-gray-900">{analytics.kpis.totalRequests || 0}</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                <p className="text-[11px] text-gray-500">Livrées</p>
                <p className="text-lg font-bold text-emerald-700">{analytics.kpis.delivered || 0}</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                <p className="text-[11px] text-gray-500">Revenu livré</p>
                <p className="text-lg font-bold text-gray-900">{fmtMoney(analytics.kpis.deliveredRevenue || 0)}</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                <p className="text-[11px] text-gray-500">SLA breaches</p>
                <p className="text-lg font-bold text-red-700">
                  {(analytics.kpis.slaBreachOpen || 0) + (analytics.kpis.slaBreachDelivered || 0)}
                </p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-600 sm:grid-cols-4">
              <div className="rounded-lg border border-gray-200 px-2.5 py-2">
                Acceptation: <span className="font-semibold text-gray-800">{analytics.kpis.acceptanceRate || 0}%</span>
              </div>
              <div className="rounded-lg border border-gray-200 px-2.5 py-2">
                Completion: <span className="font-semibold text-gray-800">{analytics.kpis.completionRate || 0}%</span>
              </div>
              <div className="rounded-lg border border-gray-200 px-2.5 py-2">
                Avg accept: <span className="font-semibold text-gray-800">{analytics.kpis.avgAcceptanceMinutes || 0} min</span>
              </div>
              <div className="rounded-lg border border-gray-200 px-2.5 py-2">
                Avg delivery: <span className="font-semibold text-gray-800">{analytics.kpis.avgDeliveryMinutes || 0} min</span>
              </div>
            </div>
            {Array.isArray(analytics.communes) && analytics.communes.length ? (
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-left text-xs">
                  <thead>
                    <tr className="text-gray-500">
                      <th className="px-2 py-2 font-semibold">Commune</th>
                      <th className="px-2 py-2 font-semibold">Demandes</th>
                      <th className="px-2 py-2 font-semibold">Livrées</th>
                      <th className="px-2 py-2 font-semibold">Revenu</th>
                      <th className="px-2 py-2 font-semibold">SLA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.communes.slice(0, 6).map((entry) => (
                      <tr key={`${entry.communeId || entry.communeName}-${entry.cityName}`} className="border-t border-gray-100">
                        <td className="px-2 py-2 text-gray-700">
                          <p className="font-semibold text-gray-900">{entry.communeName || '—'}</p>
                          <p className="text-[11px] text-gray-500">{entry.cityName || '—'}</p>
                        </td>
                        <td className="px-2 py-2 text-gray-700">{entry.requests || 0}</td>
                        <td className="px-2 py-2 text-emerald-700">{entry.delivered || 0}</td>
                        <td className="px-2 py-2 text-gray-700">{fmtMoney(entry.revenueDelivered || 0)}</td>
                        <td className="px-2 py-2 text-red-700">{entry.slaBreaches || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-gray-500">Aucune donnée analytics pour les filtres actuels.</p>
        )}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm sm:p-4 space-y-3">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setStatusTab(tab.key)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap border ${
                statusTab === tab.key
                  ? 'bg-neutral-700 text-white border-neutral-700'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <select
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            className="rounded-xl border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Ville (toutes)</option>
            {cityOptions.map((city) => (
              <option key={city._id || city.name} value={city._id || city.name}>
                {city.name}
              </option>
            ))}
          </select>
          <select
            value={pickupCommuneFilter}
            onChange={(e) => setPickupCommuneFilter(e.target.value)}
            className="rounded-xl border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Pickup commune</option>
            {communeOptions.map((commune) => (
              <option key={commune._id} value={commune._id}>
                {commune.name}
              </option>
            ))}
          </select>
          <select
            value={dropoffCommuneFilter}
            onChange={(e) => setDropoffCommuneFilter(e.target.value)}
            className="rounded-xl border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Dropoff commune</option>
            {communeOptions.map((commune) => (
              <option key={`drop-${commune._id}`} value={commune._id}>
                {commune.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setShowAdvanced((prev) => !prev)}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <Filter size={14} />
            Filtres avancés
          </button>
        </div>

        {showAdvanced ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <input
              value={shopFilter}
              onChange={(e) => setShopFilter(e.target.value)}
              placeholder="Shop ID"
              className="rounded-xl border border-gray-300 px-3 py-2 text-sm"
            />
            <input
              type="date"
              value={dateFromFilter}
              onChange={(e) => setDateFromFilter(e.target.value)}
              className="rounded-xl border border-gray-300 px-3 py-2 text-sm"
            />
            <input
              type="date"
              value={dateToFilter}
              onChange={(e) => setDateToFilter(e.target.value)}
              className="rounded-xl border border-gray-300 px-3 py-2 text-sm"
            />
            <input
              value={priceMinFilter}
              onChange={(e) => setPriceMinFilter(e.target.value)}
              placeholder="Prix min"
              className="rounded-xl border border-gray-300 px-3 py-2 text-sm"
            />
            <input
              value={priceMaxFilter}
              onChange={(e) => setPriceMaxFilter(e.target.value)}
              placeholder="Prix max"
              className="rounded-xl border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center text-gray-500">
          <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
          Chargement des demandes...
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const status = String(item.status || 'PENDING').toUpperCase();
            const canAccept = status === 'PENDING';
            const canReject = !['REJECTED', 'DELIVERED', 'CANCELED'].includes(status);
            const canAssign = ['ACCEPTED', 'IN_PROGRESS', 'PENDING'].includes(status);
            return (
              <article key={item._id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs text-gray-500">Order #{String(item.orderId?._id || item.orderId).slice(-6)}</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {item.shopId?.shopName || item.shopId?.name || item.sellerId?.shopName || item.sellerId?.name || 'Boutique'}
                    </p>
                  </div>
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[status] || STATUS_STYLES.PENDING}`}>
                    {status}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-gray-700 sm:grid-cols-2">
                  <div className="rounded-xl bg-gray-50 p-2.5">
                    <p className="text-[11px] uppercase tracking-wide text-gray-500">Pickup</p>
                    <p className="font-medium">{item.pickup?.communeName || '—'} · {item.pickup?.cityName || '—'}</p>
                    <p className="text-xs text-gray-500">{item.pickup?.address || '—'}</p>
                  </div>
                  <div className="rounded-xl bg-gray-50 p-2.5">
                    <p className="text-[11px] uppercase tracking-wide text-gray-500">Dropoff</p>
                    <p className="font-medium">{item.dropoff?.communeName || '—'} · {item.dropoff?.cityName || '—'}</p>
                    <p className="text-xs text-gray-500">{item.dropoff?.address || '—'}</p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-gray-700">
                  <span className="inline-flex items-center gap-1">
                    <MapPin size={14} />
                    {fmtMoney(item.deliveryPrice)} {item.currency || 'XAF'}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Package size={14} />
                    {Array.isArray(item.productSnapshot) ? item.productSnapshot.length : 0} produit(s)
                  </span>
                  {item.invoiceUrl ? (
                    <a
                      href={item.invoiceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-semibold text-neutral-700 underline"
                    >
                      Facture
                    </a>
                  ) : null}
                </div>

                {item.assignedDeliveryGuyId ? (
                  <p className="mt-2 text-xs text-gray-600">
                    Livreur assigné: {item.assignedDeliveryGuyId.fullName || item.assignedDeliveryGuyId.name || '—'}
                  </p>
                ) : null}

                {item.rejectionReason ? (
                  <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-2.5 py-2 text-xs text-red-700">
                    Motif rejet: {item.rejectionReason}
                  </p>
                ) : null}

                {item.pickupProof?.photoUrl || item.pickupProof?.signatureUrl || item.deliveryProof?.photoUrl || item.deliveryProof?.signatureUrl ? (
                  <div className="mt-2 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                    <div className="rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-2">
                      <p className="font-semibold text-blue-800">Preuve pickup</p>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {item.pickupProof?.photoUrl ? (
                          <a
                            href={normalizeFileUrl(item.pickupProof.photoUrl)}
                            target="_blank"
                            rel="noreferrer"
                            className="underline"
                          >
                            Photo
                          </a>
                        ) : null}
                        {item.pickupProof?.signatureUrl ? (
                          <a
                            href={normalizeFileUrl(item.pickupProof.signatureUrl)}
                            target="_blank"
                            rel="noreferrer"
                            className="underline"
                          >
                            Signature
                          </a>
                        ) : null}
                      </div>
                    </div>
                    <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-2.5 py-2">
                      <p className="font-semibold text-emerald-800">Preuve livraison</p>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {item.deliveryProof?.photoUrl ? (
                          <a
                            href={normalizeFileUrl(item.deliveryProof.photoUrl)}
                            target="_blank"
                            rel="noreferrer"
                            className="underline"
                          >
                            Photo
                          </a>
                        ) : null}
                        {item.deliveryProof?.signatureUrl ? (
                          <a
                            href={normalizeFileUrl(item.deliveryProof.signatureUrl)}
                            target="_blank"
                            rel="noreferrer"
                            className="underline"
                          >
                            Signature
                          </a>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    to={`/admin/orders?orderId=${encodeURIComponent(String(item.orderId?._id || item.orderId || ''))}`}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    <ClipboardList size={12} />
                    Voir commande
                  </Link>
                  <button
                    type="button"
                    onClick={() => openAccept(item)}
                    disabled={!canAccept}
                    className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-40"
                  >
                    <CheckCircle2 size={12} />
                    Accepter
                  </button>
                  <button
                    type="button"
                    onClick={() => openReject(item)}
                    disabled={!canReject}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-40"
                  >
                    <XCircle size={12} />
                    Rejeter
                  </button>
                  <button
                    type="button"
                    onClick={() => openAssign(item)}
                    disabled={!canAssign}
                    className="inline-flex items-center gap-1 rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-40"
                  >
                    <UserCheck size={12} />
                    Assigner
                  </button>
                  <button
                    type="button"
                    onClick={() => openProofModal(item, 'pickup')}
                    disabled={['REJECTED', 'CANCELED', 'DELIVERED'].includes(status)}
                    className="inline-flex items-center gap-1 rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-40"
                  >
                    <Camera size={12} />
                    Preuve pickup
                  </button>
                  <button
                    type="button"
                    onClick={() => openProofModal(item, 'delivery')}
                    disabled={['REJECTED', 'CANCELED'].includes(status)}
                    className="inline-flex items-center gap-1 rounded-lg border border-violet-300 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-100 disabled:opacity-40"
                  >
                    <Camera size={12} />
                    Preuve livraison
                  </button>
                </div>
              </article>
            );
          })}

          {items.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center text-gray-500">
              <AlertCircle className="mx-auto mb-2 h-5 w-5" />
              Aucune demande pour ces filtres.
            </div>
          ) : null}
        </div>
      )}

      <div className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white px-4 py-3">
        <p className="text-sm text-gray-600">
          {meta.total} demande(s)
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={page <= 1}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 disabled:opacity-40"
          >
            Précédent
          </button>
          <span className="text-xs text-gray-600">
            {page} / {meta.totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((prev) => Math.min(meta.totalPages, prev + 1))}
            disabled={page >= meta.totalPages}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 disabled:opacity-40"
          >
            Suivant
          </button>
        </div>
      </div>

      <BaseModal
        isOpen={acceptModalOpen}
        onClose={closeAllModals}
        title="Accepter la demande"
        panelClassName="w-full max-w-md"
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-600">Vous pouvez assigner un livreur immédiatement (optionnel).</p>
          <select
            value={selectedDeliveryGuyId}
            onChange={(e) => setSelectedDeliveryGuyId(e.target.value)}
            className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
            disabled={deliveryGuysLoading || savingAction}
          >
            <option value="">Sans assignation immédiate</option>
            {deliveryGuys.map((entry) => (
              <option key={entry._id} value={entry._id}>
                {entry.fullName || entry.name}
              </option>
            ))}
          </select>
          {actionError ? <p className="text-xs text-red-600">{actionError}</p> : null}
          <button
            type="button"
            onClick={handleAccept}
            disabled={savingAction}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {savingAction ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            Confirmer
          </button>
        </div>
      </BaseModal>

      <BaseModal
        isOpen={rejectModalOpen}
        onClose={closeAllModals}
        title="Rejeter la demande"
        panelClassName="w-full max-w-md"
      >
        <div className="space-y-3">
          <textarea
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            placeholder="Raison du rejet"
            rows={4}
            className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
          />
          {actionError ? <p className="text-xs text-red-600">{actionError}</p> : null}
          <button
            type="button"
            onClick={handleReject}
            disabled={savingAction}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
          >
            {savingAction ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
            Rejeter
          </button>
        </div>
      </BaseModal>

      <BaseModal
        isOpen={assignModalOpen}
        onClose={closeAllModals}
        title="Assigner un livreur"
        panelClassName="w-full max-w-md"
      >
        <div className="space-y-3">
          <select
            value={selectedDeliveryGuyId}
            onChange={(e) => setSelectedDeliveryGuyId(e.target.value)}
            className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
            disabled={deliveryGuysLoading || savingAction}
          >
            <option value="">Choisir un livreur</option>
            {deliveryGuys.map((entry) => (
              <option key={entry._id} value={entry._id}>
                {entry.fullName || entry.name}
              </option>
            ))}
          </select>
          {actionError ? <p className="text-xs text-red-600">{actionError}</p> : null}
          <button
            type="button"
            onClick={handleAssign}
            disabled={savingAction}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {savingAction ? <Loader2 size={14} className="animate-spin" /> : <UserCheck size={14} />}
            Assigner
          </button>
        </div>
      </BaseModal>

      <BaseModal
        isOpen={proofModalOpen}
        onClose={closeAllModals}
        title={proofType === 'delivery' ? 'Preuve de livraison' : 'Preuve de pickup'}
        panelClassName="w-full max-w-md"
      >
        <div className="space-y-3">
          <label className="block text-xs font-semibold text-gray-700">
            Photo
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setProofPhoto(e.target.files?.[0] || null)}
              className="mt-1 block w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs font-semibold text-gray-700">
            Signature (fichier)
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setProofSignatureFile(e.target.files?.[0] || null)}
              className="mt-1 block w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <input
            value={proofSignatureUrl}
            onChange={(e) => setProofSignatureUrl(e.target.value)}
            placeholder="ou URL signature (optionnel)"
            className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
          />
          <textarea
            value={proofNote}
            onChange={(e) => setProofNote(e.target.value)}
            placeholder="Note (optionnel)"
            rows={3}
            className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
          />
          {proofError ? <p className="text-xs text-red-600">{proofError}</p> : null}
          <button
            type="button"
            onClick={handleSubmitProof}
            disabled={proofSaving}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-neutral-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-neutral-900 disabled:opacity-60"
          >
            {proofSaving ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
            Enregistrer la preuve
          </button>
        </div>
      </BaseModal>
    </div>
  );
}
