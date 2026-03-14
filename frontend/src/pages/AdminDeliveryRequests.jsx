import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  BarChart3,
  Camera,
  CheckCircle2,
  ClipboardList,
  Filter,
  Landmark,
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
import { resolveDeliveryGuyProfileImage } from '../utils/deliveryGuyAvatar';
import BaseModal, { ModalBody, ModalFooter, ModalHeader } from '../components/modals/BaseModal';
import { appConfirm } from '../utils/appDialog';

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

/** Only add query param if value is non-empty and not the literal "undefined"/"null" */
const setFilterParam = (params, key, value) => {
  const v = String(value ?? '').trim();
  if (v && v !== 'undefined' && v !== 'null') params.set(key, v);
};
const normalizeFileUrl = (url = '') => {
  const normalized = String(url || '').trim();
  if (!normalized) return '';
  if (/^https?:\/\//i.test(normalized)) return normalized;
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
  const host = apiBase.replace(/\/api\/?$/, '');
  return `${host}/${normalized.replace(/^\/+/, '')}`;
};

const getRequestItems = (item = {}) => {
  const fromItemsSnapshot = Array.isArray(item?.itemsSnapshot) ? item.itemsSnapshot : [];
  if (fromItemsSnapshot.length) return fromItemsSnapshot;
  return Array.isArray(item?.productSnapshot) ? item.productSnapshot : [];
};

const getBuyerInfo = (item = {}) => {
  if (item?.buyer && typeof item.buyer === 'object') return item.buyer;
  if (item?.buyerId && typeof item.buyerId === 'object') return item.buyerId;
  return null;
};

const getSellerInfo = (item = {}) => {
  if (item?.seller && typeof item.seller === 'object') return item.seller;
  if (item?.sellerId && typeof item.sellerId === 'object') return item.sellerId;
  if (item?.shopId && typeof item.shopId === 'object') {
    return {
      name: item.shopId.shopName || item.shopId.name || '',
      phone: item.shopId.phone || ''
    };
  }
  return null;
};

const getPickupAddress = (item = {}) =>
  String(
    item?.pickup?.address ||
      item?.seller?.shopAddress ||
      item?.seller?.address ||
      ''
  ).trim() || '—';

const getDropoffAddress = (item = {}) =>
  String(
    item?.dropoff?.address ||
      item?.order?.shippingAddressSnapshot?.addressLine ||
      item?.order?.shippingAddressSnapshot?.address ||
      item?.order?.deliveryAddress ||
      item?.buyer?.address ||
      ''
  ).trim();

const getCoordinatesDisplay = (coords) => {
  if (!coords?.coordinates || !Array.isArray(coords.coordinates) || coords.coordinates.length < 2) return null;
  const [lng, lat] = coords.coordinates;
  return `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`;
};

const extractUrlValue = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'object') {
    const candidate =
      value.url ||
      value.path ||
      value.photoUrl ||
      value.imageUrl ||
      value.signatureUrl ||
      value.src ||
      '';
    return typeof candidate === 'string' ? candidate.trim() : '';
  }
  return '';
};

const getProofPhotos = (proof = {}) => {
  const urls = [];
  const pushUrl = (input) => {
    const next = extractUrlValue(input);
    if (next) urls.push(next);
  };

  pushUrl(proof?.photoUrl);
  if (Array.isArray(proof?.photoUrls)) proof.photoUrls.forEach(pushUrl);
  if (Array.isArray(proof?.photos)) proof.photos.forEach(pushUrl);
  if (Array.isArray(proof?.images)) proof.images.forEach(pushUrl);

  return Array.from(new Set(urls));
};

const getProofSignature = (proof = {}) => {
  const direct = extractUrlValue(proof?.signatureUrl);
  if (direct) return direct;
  const image = extractUrlValue(proof?.signatureImage);
  if (image) return image;
  return extractUrlValue(proof?.signature);
};

/** Price to show: order/request price if set (> 0), otherwise admin/founder rule price. */
const getDisplayDeliveryPrice = (item = {}) => {
  const orderPrice = Number(item.deliveryPrice ?? 0);
  const adminRulePrice = item.adminRuleDeliveryPrice != null ? Number(item.adminRuleDeliveryPrice) : null;
  if (orderPrice > 0) return { price: orderPrice, source: 'order' };
  return { price: adminRulePrice != null ? adminRulePrice : 0, source: 'adminRule' };
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
  const [orphanOrders, setOrphanOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [liveSyncPulse, setLiveSyncPulse] = useState(false);
  const [lastLiveSyncAt, setLastLiveSyncAt] = useState(0);

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
  const [proofPreview, setProofPreview] = useState(null);
  const [priceModalOpen, setPriceModalOpen] = useState(false);
  const [priceDraft, setPriceDraft] = useState('');
  const [priceReason, setPriceReason] = useState('');
  const [priceSaving, setPriceSaving] = useState(false);
  const [priceError, setPriceError] = useState('');
  const [creatingForOrderId, setCreatingForOrderId] = useState('');
  const [capturingCoords, setCapturingCoords] = useState({ requestId: '', type: null }); // 'pickup' | 'dropoff'

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
    if (statusTab && statusTab !== 'all') setFilterParam(params, 'status', statusTab);
    setFilterParam(params, 'city', cityFilter);
    setFilterParam(params, 'pickupCommune', pickupCommuneFilter);
    setFilterParam(params, 'dropoffCommune', dropoffCommuneFilter);
    setFilterParam(params, 'dateFrom', dateFromFilter);
    setFilterParam(params, 'dateTo', dateToFilter);
    setFilterParam(params, 'priceMin', priceMinFilter);
    setFilterParam(params, 'priceMax', priceMaxFilter);
    setFilterParam(params, 'shop', shopFilter);
    params.set('page', String(Math.max(1, Number(page) || 1)));
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
        setOrphanOrders(Array.isArray(data?.orphanOrders) ? data.orphanOrders : []);
        setMeta({
          total: Number(data?.total || list.length || 0),
          totalPages: Number(data?.totalPages || 1),
          pageSize: Number(data?.pageSize || 20)
        });
        return list;
      } catch (err) {
        setError(err.response?.data?.message || 'Impossible de charger les demandes de livraison.');
        return [];
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

  const handleCreateRequestForOrder = useCallback(
    async (orderId) => {
      if (!orderId) return;
      setCreatingForOrderId(orderId);
      setActionError('');
      try {
        await api.post(`/admin/delivery-requests/create-for-order/${orderId}`);
        await loadDeliveryRequests({ silent: true });
        setOrphanOrders((prev) => prev.filter((o) => String(o._id || o.orderId) !== String(orderId)));
      } catch (err) {
        setActionError(err.response?.data?.message || 'Impossible de créer la demande.');
      } finally {
        setCreatingForOrderId('');
      }
    },
    [loadDeliveryRequests]
  );

  const handleCapturePosition = useCallback(
    (requestId, type) => {
      if (!requestId || !type || !navigator.geolocation) {
        setActionError('La géolocalisation n\'est pas disponible.');
        return;
      }
      setCapturingCoords({ requestId, type });
      setActionError('');
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const body = type === 'pickup' ? { pickup: { latitude: lat, longitude: lng } } : { dropoff: { latitude: lat, longitude: lng } };
          try {
            await api.patch(`/admin/delivery-requests/${requestId}/coordinates`, body);
            await loadDeliveryRequests({ silent: true });
          } catch (err) {
            setActionError(err.response?.data?.message || 'Impossible d\'enregistrer la position.');
          } finally {
            setCapturingCoords({ requestId: '', type: null });
          }
        },
        () => {
          setActionError('Impossible d\'obtenir la position GPS.');
          setCapturingCoords({ requestId: '', type: null });
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    },
    [loadDeliveryRequests]
  );

  useEffect(() => {
    loadDeliveryRequests();
  }, [loadDeliveryRequests]);

  useEffect(() => {
    loadDeliveryAnalytics();
  }, [loadDeliveryAnalytics]);

  useEffect(() => {
    let refreshTimer = null;
    let pulseTimer = null;
    const scheduleSilentRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        loadDeliveryRequests({ silent: true });
        loadDeliveryAnalytics({ silent: true });
      }, 220);
    };
    const triggerLiveBadge = () => {
      setLiveSyncPulse(true);
      setLastLiveSyncAt(Date.now());
      if (pulseTimer) clearTimeout(pulseTimer);
      pulseTimer = setTimeout(() => setLiveSyncPulse(false), 1400);
    };

    const onOrderOrDeliveryRefresh = () => {
      triggerLiveBadge();
      scheduleSilentRefresh();
    };

    const onOrderStatusUpdated = (event) => {
      const payload = event?.detail || {};
      if (!String(payload?.orderId || '').trim()) return;
      triggerLiveBadge();
      scheduleSilentRefresh();
    };

    window.addEventListener('hdmarket:orders-refresh', onOrderOrDeliveryRefresh);
    window.addEventListener('hdmarket:orders-status-updated', onOrderStatusUpdated);

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      if (pulseTimer) clearTimeout(pulseTimer);
      window.removeEventListener('hdmarket:orders-refresh', onOrderOrDeliveryRefresh);
      window.removeEventListener('hdmarket:orders-status-updated', onOrderStatusUpdated);
    };
  }, [loadDeliveryAnalytics, loadDeliveryRequests]);

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
    setPriceModalOpen(false);
    setSelectedItem(null);
    resetActionState();
    setProofPhoto(null);
    setProofSignatureFile(null);
    setProofSignatureUrl('');
    setProofNote('');
    setProofError('');
    setProofSaving(false);
    setProofPreview(null);
    setPriceDraft('');
    setPriceReason('');
    setPriceError('');
    setPriceSaving(false);
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

  const DELIVERY_REQUEST_CLOSED_STATUSES = ['REJECTED', 'CANCELED', 'DELIVERED', 'FAILED'];

  const handleUnassign = async (item) => {
    if (!item?._id || savingAction) return;
    const status = String(item.status || 'PENDING').toUpperCase();
    if (DELIVERY_REQUEST_CLOSED_STATUSES.includes(status)) {
      setActionError('Impossible de retirer le livreur d\'une demande déjà clôturée.');
      await loadDeliveryRequests({ silent: true });
      return;
    }
    const confirmed = typeof window === 'undefined' ? true : await appConfirm('Retirer ce livreur de la demande ?');
    if (!confirmed) return;
    setSavingAction(true);
    setActionError('');
    try {
      await api.patch(`/admin/delivery-requests/${item._id}/unassign`, {
        reason: 'Unassign depuis la console admin'
      });
      await Promise.all([loadDeliveryRequests({ silent: true }), loadDeliveryAnalytics({ silent: true })]);
    } catch (err) {
      const message = err.response?.data?.message || 'Impossible de retirer le livreur.';
      setActionError(message);
      if (err.response?.status === 409) {
        await loadDeliveryRequests({ silent: true });
      }
    } finally {
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

  const openProofPreview = (url, label = 'Preuve') => {
    const normalizedUrl = normalizeFileUrl(url || '');
    if (!normalizedUrl) return;
    setProofPreview({
      url: normalizedUrl,
      label: String(label || 'Preuve')
    });
  };

  const openPriceModal = (item) => {
    setSelectedItem(item);
    const { price } = getDisplayDeliveryPrice(item);
    setPriceDraft(String(Math.max(0, price)));
    setPriceReason('');
    setPriceError('');
    setPriceModalOpen(true);
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

  const handleUpdatePrice = async () => {
    if (!selectedItem?._id) return;
    const nextPrice = Number(priceDraft);
    if (!Number.isFinite(nextPrice) || nextPrice < 0) {
      setPriceError('Saisissez un montant valide (>= 0).');
      return;
    }
    setPriceSaving(true);
    setPriceError('');
    try {
      const { data } = await api.patch(`/admin/delivery-requests/${selectedItem._id}/price`, {
        deliveryPrice: nextPrice,
        reason: priceReason.trim() || undefined
      });
      const updatedItem = data?.item;
      closeAllModals();
      const [list] = await Promise.all([
        loadDeliveryRequests({ silent: true }),
        loadDeliveryAnalytics({ silent: true })
      ]);
      if (updatedItem?._id && Array.isArray(list) && list.some((it) => it._id === updatedItem._id)) {
        setItems(list.map((it) => (it._id === updatedItem._id ? { ...it, ...updatedItem } : it)));
      }
    } catch (err) {
      setPriceError(err.response?.data?.message || 'Impossible de modifier le prix.');
      setPriceSaving(false);
    }
  };

  const hasActiveFilters = Boolean(
    statusTab !== 'all' ||
      cityFilter ||
      pickupCommuneFilter ||
      dropoffCommuneFilter ||
      dateFromFilter ||
      dateToFilter ||
      priceMinFilter ||
      priceMaxFilter ||
      shopFilter
  );

  const headerDateLabel = useMemo(
    () =>
      new Intl.DateTimeFormat('fr-FR', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      }).format(new Date()),
    []
  );

  const statusCounters = useMemo(() => {
    return items.reduce(
      (acc, entry) => {
        const key = String(entry?.status || 'PENDING').toUpperCase();
        acc.total += 1;
        if (!acc.byStatus[key]) acc.byStatus[key] = 0;
        acc.byStatus[key] += 1;
        return acc;
      },
      { total: 0, byStatus: {} }
    );
  }, [items]);

  const proofPreviewIsSignature = /signature/i.test(String(proofPreview?.label || ''));

  const resetAllFilters = useCallback(() => {
    setStatusTab('all');
    setCityFilter('');
    setPickupCommuneFilter('');
    setDropoffCommuneFilter('');
    setDateFromFilter('');
    setDateToFilter('');
    setPriceMinFilter('');
    setPriceMaxFilter('');
    setShopFilter('');
    setPage(1);
  }, []);

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
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100/70">
      <div className="mx-auto max-w-6xl space-y-4 px-3 pb-6 pt-3 sm:px-4 sm:pt-4">
        <header className="sticky top-0 z-20 -mx-3 border-b border-slate-200/80 bg-white/80 px-3 py-3 backdrop-blur-md sm:-mx-4 sm:px-4">
          <div className="mx-auto max-w-6xl">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Admin logistics</p>
                <h1 className="mt-1 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">Demandes de livraison</h1>
                <p className="mt-0.5 text-xs text-slate-500">{headerDateLabel}</p>
                <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                  <span
                    className={`h-2 w-2 rounded-full ${liveSyncPulse ? 'animate-pulse bg-emerald-500' : 'bg-emerald-500/80'}`}
                    aria-hidden="true"
                  />
                  Mise à jour en direct
                  {lastLiveSyncAt ? (
                    <span className="text-[10px] font-medium text-emerald-600/90">
                      · {Math.max(0, Math.floor((Date.now() - lastLiveSyncAt) / 1000))}s
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="flex w-full items-center gap-2 sm:w-auto">
                <button
                  type="button"
                  onClick={() =>
                    Promise.all([
                      loadDeliveryRequests({ silent: true }),
                      loadDeliveryAnalytics({ silent: true })
                    ])
                  }
                  disabled={refreshing || loading}
                  className="inline-flex min-h-[46px] flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60 sm:flex-none"
                >
                  <RefreshCcw size={15} className={refreshing ? 'animate-spin' : ''} />
                  Actualiser
                </button>
                <Link
                  to="/admin/delivery-guys"
                  className="inline-flex min-h-[46px] flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 sm:flex-none"
                >
                  <Truck size={15} />
                  Livreurs
                </Link>
              </div>
            </div>
          </div>
        </header>

        <section className="overflow-x-auto">
          <div className="flex min-w-max gap-2">
            {[
              { label: 'Demandes', value: analytics?.kpis?.totalRequests ?? statusCounters.total, tone: 'text-slate-900' },
              { label: 'En cours', value: analytics?.kpis?.inProgress ?? ((statusCounters.byStatus.IN_PROGRESS || 0) + (statusCounters.byStatus.ACCEPTED || 0)), tone: 'text-indigo-700' },
              { label: 'Livrées', value: analytics?.kpis?.delivered ?? (statusCounters.byStatus.DELIVERED || 0), tone: 'text-emerald-700' },
              { label: 'Revenu livré', value: fmtMoney(analytics?.kpis?.deliveredRevenue || 0), tone: 'text-slate-900' },
              { label: 'SLA breach', value: (analytics?.kpis?.slaBreachOpen || 0) + (analytics?.kpis?.slaBreachDelivered || 0), tone: 'text-red-700' }
            ].map((chip) => (
              <div
                key={chip.label}
                className="min-w-[132px] rounded-2xl bg-white px-3 py-2.5 shadow-sm ring-1 ring-slate-200/70"
              >
                <p className="text-[11px] font-medium text-slate-500">{chip.label}</p>
                <p className={`mt-1 text-base font-semibold ${chip.tone}`}>{chip.value}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200/70 sm:p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
            <BarChart3 size={15} />
            Analytics livraison
          </div>
          {analyticsLoading ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 size={14} className="animate-spin" />
              Chargement analytics...
            </div>
          ) : analytics?.kpis ? (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200/70">
                  <p className="text-[11px] text-slate-500">Acceptation</p>
                  <p className="text-lg font-semibold text-slate-900">{analytics.kpis.acceptanceRate || 0}%</p>
                </div>
                <div className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200/70">
                  <p className="text-[11px] text-slate-500">Completion</p>
                  <p className="text-lg font-semibold text-slate-900">{analytics.kpis.completionRate || 0}%</p>
                </div>
                <div className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200/70">
                  <p className="text-[11px] text-slate-500">Avg accept</p>
                  <p className="text-lg font-semibold text-slate-900">{analytics.kpis.avgAcceptanceMinutes || 0} min</p>
                </div>
                <div className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200/70">
                  <p className="text-[11px] text-slate-500">Avg delivery</p>
                  <p className="text-lg font-semibold text-slate-900">{analytics.kpis.avgDeliveryMinutes || 0} min</p>
                </div>
              </div>
              {Array.isArray(analytics.communes) && analytics.communes.length ? (
                <div className="mt-3 overflow-x-auto rounded-xl ring-1 ring-slate-200/70">
                  <table className="min-w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        <th className="px-2 py-2 font-semibold">Commune</th>
                        <th className="px-2 py-2 font-semibold">Demandes</th>
                        <th className="px-2 py-2 font-semibold">Livrées</th>
                        <th className="px-2 py-2 font-semibold">Revenu</th>
                        <th className="px-2 py-2 font-semibold">SLA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.communes.slice(0, 6).map((entry) => (
                        <tr key={`${entry.communeId || entry.communeName}-${entry.cityName}`} className="border-t border-slate-100">
                          <td className="px-2 py-2 text-slate-700">
                            <p className="font-semibold text-slate-900">{entry.communeName || '—'}</p>
                            <p className="text-[11px] text-slate-500">{entry.cityName || '—'}</p>
                          </td>
                          <td className="px-2 py-2 text-slate-700">{entry.requests || 0}</td>
                          <td className="px-2 py-2 text-emerald-700">{entry.delivered || 0}</td>
                          <td className="px-2 py-2 text-slate-700">{fmtMoney(entry.revenueDelivered || 0)}</td>
                          <td className="px-2 py-2 text-red-700">{entry.slaBreaches || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-slate-500">Aucune donnée analytics pour les filtres actuels.</p>
          )}
        </section>

        <section className="space-y-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200/70 sm:p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-800">Filtres</p>
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={resetAllFilters}
                className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-200"
              >
                Réinitialiser
              </button>
            ) : null}
          </div>

          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {STATUS_TABS.map((tab) => {
              const isActive = statusTab === tab.key;
              const activeStyles =
                tab.key === 'all'
                  ? 'bg-slate-900 text-white ring-slate-900'
                  : (STATUS_STYLES[tab.key] || 'bg-slate-100 text-slate-700 ring-slate-200');
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setStatusTab(tab.key)}
                  className={`min-h-[42px] shrink-0 rounded-xl px-4 text-sm font-semibold ring-1 transition ${
                    isActive ? activeStyles : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50'
                  }`}
                  aria-pressed={isActive}
                  aria-label={`Filtrer par ${tab.label}`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="min-h-[44px] rounded-xl bg-slate-50 px-3 text-sm text-slate-700 ring-1 ring-slate-200 focus:bg-white focus:outline-none"
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
              className="min-h-[44px] rounded-xl bg-slate-50 px-3 text-sm text-slate-700 ring-1 ring-slate-200 focus:bg-white focus:outline-none"
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
              className="min-h-[44px] rounded-xl bg-slate-50 px-3 text-sm text-slate-700 ring-1 ring-slate-200 focus:bg-white focus:outline-none"
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
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-slate-100 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-200"
            >
              <Filter size={14} />
              {showAdvanced ? 'Masquer avancés' : 'Filtres avancés'}
            </button>
          </div>

          {showAdvanced ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
              <input
                value={shopFilter}
                onChange={(e) => setShopFilter(e.target.value)}
                placeholder="Shop ID"
                className="min-h-[44px] rounded-xl bg-slate-50 px-3 text-sm text-slate-700 ring-1 ring-slate-200 focus:bg-white focus:outline-none"
              />
              <input
                type="date"
                value={dateFromFilter}
                onChange={(e) => setDateFromFilter(e.target.value)}
                className="min-h-[44px] rounded-xl bg-slate-50 px-3 text-sm text-slate-700 ring-1 ring-slate-200 focus:bg-white focus:outline-none"
              />
              <input
                type="date"
                value={dateToFilter}
                onChange={(e) => setDateToFilter(e.target.value)}
                className="min-h-[44px] rounded-xl bg-slate-50 px-3 text-sm text-slate-700 ring-1 ring-slate-200 focus:bg-white focus:outline-none"
              />
              <input
                value={priceMinFilter}
                onChange={(e) => setPriceMinFilter(e.target.value)}
                placeholder="Prix min"
                className="min-h-[44px] rounded-xl bg-slate-50 px-3 text-sm text-slate-700 ring-1 ring-slate-200 focus:bg-white focus:outline-none"
              />
              <input
                value={priceMaxFilter}
                onChange={(e) => setPriceMaxFilter(e.target.value)}
                placeholder="Prix max"
                className="min-h-[44px] rounded-xl bg-slate-50 px-3 text-sm text-slate-700 ring-1 ring-slate-200 focus:bg-white focus:outline-none"
              />
            </div>
          ) : null}
        </section>

        {error ? (
          <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
            {error}
          </div>
        ) : null}

        {actionError ? (
          <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200">
            {actionError}
          </div>
        ) : null}

        {orphanOrders.length > 0 ? (
          <section className="rounded-2xl bg-amber-50/80 p-4 shadow-sm ring-1 ring-amber-200">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-amber-900">
              <AlertCircle size={18} />
              Commandes REQUESTED sans demande
            </h3>
            <p className="mb-3 text-xs text-amber-800">
              Ces commandes doivent être synchronisées avec une demande de livraison.
            </p>
            <ul className="space-y-2">
              {orphanOrders.map((orphan) => {
                const oid = orphan._id || orphan.orderId;
                const isCreating = creatingForOrderId === oid;
                return (
                  <li
                    key={oid}
                    className="rounded-xl bg-white px-3 py-3 text-sm ring-1 ring-amber-200"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <span className="font-semibold text-slate-900">Commande #{String(oid).slice(-8)}</span>
                        {(orphan.deliveryAddress || orphan.deliveryCity) ? (
                          <p className="mt-1 text-xs text-slate-500">
                            {[orphan.deliveryAddress, orphan.deliveryCity].filter(Boolean).join(', ')}
                          </p>
                        ) : null}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Link
                          to={`/orders/detail/${oid}`}
                          className="inline-flex min-h-[40px] items-center justify-center rounded-lg bg-slate-100 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                        >
                          Voir commande
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleCreateRequestForOrder(oid)}
                          disabled={isCreating}
                          className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg bg-amber-600 px-3 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
                        >
                          {isCreating ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                          {isCreating ? 'Création...' : 'Créer'}
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        {loading ? (
          <div className="rounded-2xl bg-white p-6 text-center text-slate-500 shadow-sm ring-1 ring-slate-200/70">
            <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
            Chargement des demandes...
          </div>
        ) : (
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-3 py-2.5 text-sm text-slate-700 shadow-sm ring-1 ring-slate-200/70">
              <span className="font-semibold">
                {meta.total === 0 ? 'Aucune demande' : `${meta.total} demande${meta.total > 1 ? 's' : ''}`}
                {meta.totalPages > 1 ? ` (page ${page}/${meta.totalPages})` : ''}
              </span>
              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={resetAllFilters}
                  className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                >
                  Effacer filtres
                </button>
              ) : null}
            </div>

            {items.length === 0 ? (
              <div className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200/70">
                <ClipboardList className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                <p className="text-sm font-semibold text-slate-700">Aucune demande de livraison</p>
                <p className="mt-1 text-xs text-slate-500">
                  {hasActiveFilters
                    ? 'Aucun résultat pour les filtres sélectionnés.'
                    : 'Les demandes apparaîtront ici une fois créées pour des commandes en livraison plateforme.'}
                </p>
              </div>
            ) : null}

            {items.map((item, index) => {
              const status = String(item.status || 'PENDING').toUpperCase();
              const canAccept = status === 'PENDING';
              const canReject = !['REJECTED', 'DELIVERED', 'CANCELED'].includes(status);
              const assignmentStatusUpper = String(item.assignmentStatus || 'PENDING').toUpperCase();
              const courierHasAccepted = assignmentStatusUpper === 'ACCEPTED';
              const orderRef = item?.orderId && typeof item.orderId === 'object' ? item.orderId : null;
              const deliveryFeeLockedByFullPayment =
                Boolean(orderRef?.deliveryFeeLocked) &&
                String(orderRef?.deliveryFeeWaiverReason || '') === 'FULL_PAYMENT';
              const canAssign = ['ACCEPTED', 'IN_PROGRESS', 'PENDING'].includes(status);
              const canEditPrice =
                !['REJECTED', 'CANCELED', 'DELIVERED', 'FAILED'].includes(status) &&
                !courierHasAccepted &&
                !deliveryFeeLockedByFullPayment;
              const canUnassign =
                item.assignedDeliveryGuyId &&
                !DELIVERY_REQUEST_CLOSED_STATUSES.includes(status) &&
                !courierHasAccepted;
              const sellerInfo = getSellerInfo(item);
              const buyerInfo = getBuyerInfo(item);
              const requestItems = getRequestItems(item);
              const pickupAddress = getPickupAddress(item);
              const dropoffAddress = getDropoffAddress(item);
              const pickupGps = getCoordinatesDisplay(item.pickup?.coordinates);
              const dropoffGps = getCoordinatesDisplay(item.dropoff?.coordinates);
              const isCapturingPickup = capturingCoords.requestId === item._id && capturingCoords.type === 'pickup';
              const isCapturingDropoff = capturingCoords.requestId === item._id && capturingCoords.type === 'dropoff';
              const pickupProofPhotos = getProofPhotos(item?.pickupProof || {});
              const deliveryProofPhotos = getProofPhotos(item?.deliveryProof || {});
              const pickupSignatureUrl = normalizeFileUrl(getProofSignature(item?.pickupProof || {}));
              const deliverySignatureUrl = normalizeFileUrl(getProofSignature(item?.deliveryProof || {}));
              const pickupNote = String(item?.pickupProof?.note || '').trim();
              const deliveryNote = String(item?.deliveryProof?.note || '').trim();
              return (
                <article
                  key={item._id ? String(item._id) : `delivery-req-${index}`}
                  className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                        Order #{String(item.orderId?._id || item.orderId).slice(-6)}
                      </p>
                      <p className="mt-0.5 text-sm font-semibold text-slate-900">
                        {item.shopId?.shopName || item.shopId?.name || item.sellerId?.shopName || item.sellerId?.name || 'Boutique'}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-500">
                        Étape: {String(item.currentStage || 'ASSIGNED').toUpperCase()} · Assignation: {String(item.assignmentStatus || 'PENDING').toUpperCase()}
                      </p>
                    </div>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${STATUS_STYLES[status] || STATUS_STYLES.PENDING}`}>
                      {status}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-slate-700 sm:grid-cols-2">
                    <div className="rounded-xl bg-slate-50 p-2.5 ring-1 ring-slate-200/70">
                      <p className="text-[11px] uppercase tracking-wide text-slate-500">Pickup (vendeur)</p>
                      <p className="font-medium">{item.pickup?.communeName || '—'} · {item.pickup?.cityName || '—'}</p>
                      <p className="mt-1 text-xs font-medium text-slate-700">
                        Vendeur: {sellerInfo?.name || item.shopId?.shopName || item.shopId?.name || item.sellerId?.name || '—'}
                      </p>
                      {sellerInfo?.phone ? (
                        <p className="text-xs text-slate-600">Tel: {sellerInfo.phone}</p>
                      ) : null}
                      <p className="text-xs text-slate-500">Adresse: {pickupAddress || '—'}</p>
                      {pickupGps ? <p className="mt-1 text-[11px] text-emerald-600">GPS: {pickupGps}</p> : null}
                      <button
                        type="button"
                        onClick={() => handleCapturePosition(item._id, 'pickup')}
                        disabled={isCapturingPickup}
                        className="mt-2 inline-flex min-h-[34px] items-center gap-1 rounded-lg bg-white px-2.5 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100 disabled:opacity-60"
                      >
                        {isCapturingPickup ? <Loader2 size={10} className="animate-spin" /> : <MapPin size={10} />}
                        {isCapturingPickup ? 'Capture...' : 'Capturer GPS'}
                      </button>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-2.5 ring-1 ring-slate-200/70">
                      <p className="text-[11px] uppercase tracking-wide text-slate-500">Dropoff (acheteur)</p>
                      <p className="font-medium">{item.dropoff?.communeName || '—'} · {item.dropoff?.cityName || '—'}</p>
                      <p className="mt-1 text-xs font-medium text-slate-700">Acheteur: {buyerInfo?.name || '—'}</p>
                      <p className="text-xs text-slate-500">Adresse: {dropoffAddress || '—'}</p>
                      {dropoffGps ? <p className="mt-1 text-[11px] text-emerald-600">GPS: {dropoffGps}</p> : null}
                      <button
                        type="button"
                        onClick={() => handleCapturePosition(item._id, 'dropoff')}
                        disabled={isCapturingDropoff}
                        className="mt-2 inline-flex min-h-[34px] items-center gap-1 rounded-lg bg-white px-2.5 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100 disabled:opacity-60"
                      >
                        {isCapturingDropoff ? <Loader2 size={10} className="animate-spin" /> : <MapPin size={10} />}
                        {isCapturingDropoff ? 'Capture...' : 'Capturer GPS'}
                      </button>
                      {buyerInfo?.phone ? <p className="mt-1 text-xs font-medium text-slate-700">Tel acheteur: {buyerInfo.phone}</p> : null}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-700">
                    <span className="inline-flex items-center gap-1" title={getDisplayDeliveryPrice(item).source === 'adminRule' ? 'Prix règle admin/fondateur' : 'Prix de la commande'}>
                      <MapPin size={14} />
                      {fmtMoney(getDisplayDeliveryPrice(item).price)} {item.currency || 'XAF'}
                      {getDisplayDeliveryPrice(item).source === 'adminRule' ? <span className="text-[10px] text-slate-500">(règle)</span> : null}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Package size={14} />
                      {requestItems.length} produit(s)
                    </span>
                    {item.invoiceUrl ? (
                      <a
                        href={item.invoiceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-semibold text-slate-700 underline"
                      >
                        Facture
                      </a>
                    ) : null}
                  </div>

                  {item.assignedDeliveryGuyId ? (
                    <div className="mt-2 flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600 ring-1 ring-slate-200/70">
                      <div className="h-7 w-7 overflow-hidden rounded-full bg-slate-200">
                        {resolveDeliveryGuyProfileImage(item.assignedDeliveryGuyId) ? (
                          <img
                            src={resolveDeliveryGuyProfileImage(item.assignedDeliveryGuyId)}
                            alt={item.assignedDeliveryGuyId.fullName || item.assignedDeliveryGuyId.name || 'Livreur'}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold text-slate-600">
                            {String(item.assignedDeliveryGuyId.fullName || item.assignedDeliveryGuyId.name || 'L')
                              .charAt(0)
                              .toUpperCase()}
                          </div>
                        )}
                      </div>
                      <p>
                        Livreur assigné:{' '}
                        <span className="font-semibold text-slate-700">
                          {item.assignedDeliveryGuyId.fullName || item.assignedDeliveryGuyId.name || '—'}
                        </span>
                      </p>
                    </div>
                  ) : null}

                  {requestItems.length ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {requestItems.slice(0, 4).map((entry, itemIdx) => {
                        const imageUrl = normalizeFileUrl(entry?.imageUrl || '');
                        const key = `${entry?.productId || 'p'}-${itemIdx}`;
                        return (
                          <div key={key} className="relative h-14 w-14 overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-200/70">
                            {imageUrl ? (
                              <img
                                src={imageUrl}
                                alt={entry?.name || entry?.title || 'Produit'}
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                            ) : null}
                            <span className="absolute bottom-0 right-0 rounded-tl-md bg-black/70 px-1 py-0.5 text-[10px] font-semibold text-white">
                              x{Math.max(1, Number(entry?.qty || 1))}
                            </span>
                          </div>
                        );
                      })}
                      {requestItems.length > 4 ? <span className="text-xs font-semibold text-slate-500">+{requestItems.length - 4}</span> : null}
                    </div>
                  ) : null}

                  {item.rejectionReason ? (
                    <p className="mt-2 rounded-lg bg-red-50 px-2.5 py-2 text-xs text-red-700 ring-1 ring-red-200">
                      Motif rejet: {item.rejectionReason}
                    </p>
                  ) : null}

                  <div className="mt-2 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                    <div className="rounded-lg bg-blue-50 px-2.5 py-2 ring-1 ring-blue-200">
                      <p className="font-semibold text-blue-800">Preuve pickup</p>
                      <div className="mt-1 space-y-2">
                        {pickupProofPhotos.length > 0 ? (
                          <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
                            {pickupProofPhotos.slice(0, 6).map((rawUrl, proofIndex) => {
                              const src = normalizeFileUrl(rawUrl);
                              if (!src) return null;
                              return (
                                <button
                                  key={`pickup-proof-${item._id || index}-${proofIndex}`}
                                  type="button"
                                  onClick={() => openProofPreview(src, `Preuve pickup - photo ${proofIndex + 1}`)}
                                  className="group relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-white ring-1 ring-blue-200"
                                >
                                  <img
                                    src={src}
                                    alt={`Preuve pickup ${proofIndex + 1}`}
                                    className="h-full w-full object-contain bg-slate-50 p-1"
                                    loading="lazy"
                                  />
                                  <span className="absolute inset-x-0 bottom-0 bg-black/55 px-1 py-0.5 text-[10px] font-semibold text-white">
                                    Photo {proofIndex + 1}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        ) : null}
                        {pickupSignatureUrl ? (
                          <div className="space-y-1">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-blue-700">Signature</p>
                            <button
                              type="button"
                              onClick={() => openProofPreview(pickupSignatureUrl, 'Preuve pickup - signature')}
                              className="block w-full overflow-hidden rounded-lg bg-white ring-1 ring-blue-200"
                            >
                              <img
                                src={pickupSignatureUrl}
                                alt="Signature pickup"
                                className="h-20 w-full object-contain bg-white p-1"
                                loading="lazy"
                              />
                            </button>
                          </div>
                        ) : null}
                        {pickupNote ? (
                          <p className="rounded-md bg-white px-2 py-1 text-[11px] text-blue-900 ring-1 ring-blue-200">
                            Note: {pickupNote}
                          </p>
                        ) : null}
                        {pickupProofPhotos.length === 0 && !pickupSignatureUrl && !pickupNote ? (
                          <span className="text-blue-600">Aucune preuve (livreur pas encore déposé)</span>
                        ) : null}
                      </div>
                    </div>
                    <div className="rounded-lg bg-emerald-50 px-2.5 py-2 ring-1 ring-emerald-200">
                      <p className="font-semibold text-emerald-800">Preuve livraison</p>
                      <div className="mt-1 space-y-2">
                        {deliveryProofPhotos.length > 0 ? (
                          <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
                            {deliveryProofPhotos.slice(0, 6).map((rawUrl, proofIndex) => {
                              const src = normalizeFileUrl(rawUrl);
                              if (!src) return null;
                              return (
                                <button
                                  key={`delivery-proof-${item._id || index}-${proofIndex}`}
                                  type="button"
                                  onClick={() => openProofPreview(src, `Preuve livraison - photo ${proofIndex + 1}`)}
                                  className="group relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-white ring-1 ring-emerald-200"
                                >
                                  <img
                                    src={src}
                                    alt={`Preuve livraison ${proofIndex + 1}`}
                                    className="h-full w-full object-contain bg-slate-50 p-1"
                                    loading="lazy"
                                  />
                                  <span className="absolute inset-x-0 bottom-0 bg-black/55 px-1 py-0.5 text-[10px] font-semibold text-white">
                                    Photo {proofIndex + 1}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        ) : null}
                        {deliverySignatureUrl ? (
                          <div className="space-y-1">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-emerald-700">Signature</p>
                            <button
                              type="button"
                              onClick={() => openProofPreview(deliverySignatureUrl, 'Preuve livraison - signature')}
                              className="block w-full overflow-hidden rounded-lg bg-white ring-1 ring-emerald-200"
                            >
                              <img
                                src={deliverySignatureUrl}
                                alt="Signature livraison"
                                className="h-20 w-full object-contain bg-white p-1"
                                loading="lazy"
                              />
                            </button>
                          </div>
                        ) : null}
                        {deliveryNote ? (
                          <p className="rounded-md bg-white px-2 py-1 text-[11px] text-emerald-900 ring-1 ring-emerald-200">
                            Note: {deliveryNote}
                          </p>
                        ) : null}
                        {deliveryProofPhotos.length === 0 && !deliverySignatureUrl && !deliveryNote ? (
                          <span className="text-emerald-600">Aucune preuve (livraison pas encore effectuée)</span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                    <Link
                      to={`/admin/orders?orderId=${encodeURIComponent(String(item.orderId?._id || item.orderId || ''))}`}
                      className="inline-flex min-h-[40px] items-center justify-center gap-1 rounded-lg bg-slate-100 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                    >
                      <ClipboardList size={12} />
                      Voir commande
                    </Link>
                    <button
                      type="button"
                      onClick={() => openAccept(item)}
                      disabled={!canAccept}
                      className="inline-flex min-h-[40px] items-center justify-center gap-1 rounded-lg bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-300 hover:bg-emerald-100 disabled:opacity-40"
                    >
                      <CheckCircle2 size={12} />
                      Accepter
                    </button>
                    <button
                      type="button"
                      onClick={() => openReject(item)}
                      disabled={!canReject}
                      className="inline-flex min-h-[40px] items-center justify-center gap-1 rounded-lg bg-red-50 px-3 text-xs font-semibold text-red-700 ring-1 ring-red-300 hover:bg-red-100 disabled:opacity-40"
                    >
                      <XCircle size={12} />
                      Rejeter
                    </button>
                    <button
                      type="button"
                      onClick={() => openAssign(item)}
                      disabled={!canAssign}
                      className="inline-flex min-h-[40px] items-center justify-center gap-1 rounded-lg bg-blue-50 px-3 text-xs font-semibold text-blue-700 ring-1 ring-blue-300 hover:bg-blue-100 disabled:opacity-40"
                    >
                      <UserCheck size={12} />
                      Assigner
                    </button>
                    <button
                      type="button"
                      onClick={() => openPriceModal(item)}
                      disabled={!canEditPrice}
                      title={
                        deliveryFeeLockedByFullPayment
                          ? 'Modification impossible : commande payée intégralement, frais verrouillés.'
                          : courierHasAccepted
                            ? 'Modification impossible : le livreur a accepté la livraison.'
                            : undefined
                      }
                      className="inline-flex min-h-[40px] items-center justify-center gap-1 rounded-lg bg-amber-50 px-3 text-xs font-semibold text-amber-800 ring-1 ring-amber-300 hover:bg-amber-100 disabled:opacity-40"
                    >
                      <Landmark size={12} />
                      Prix
                    </button>
                    {item.assignedDeliveryGuyId && !DELIVERY_REQUEST_CLOSED_STATUSES.includes(status) ? (
                      <button
                        type="button"
                        onClick={() => handleUnassign(item)}
                        disabled={!canUnassign || savingAction}
                        title={courierHasAccepted ? 'Désassigner impossible : le livreur a accepté la livraison.' : undefined}
                        className="inline-flex min-h-[40px] items-center justify-center gap-1 rounded-lg bg-orange-50 px-3 text-xs font-semibold text-orange-700 ring-1 ring-orange-300 hover:bg-orange-100 disabled:opacity-40"
                      >
                        <UserCheck size={12} />
                        Désassigner
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => openProofModal(item, 'pickup')}
                      disabled={['REJECTED', 'CANCELED', 'DELIVERED'].includes(status)}
                      className="inline-flex min-h-[40px] items-center justify-center gap-1 rounded-lg bg-indigo-50 px-3 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-300 hover:bg-indigo-100 disabled:opacity-40"
                    >
                      <Camera size={12} />
                      Preuve pickup
                    </button>
                    <button
                      type="button"
                      onClick={() => openProofModal(item, 'delivery')}
                      disabled={['REJECTED', 'CANCELED', 'DELIVERED', 'FAILED'].includes(status)}
                      className="inline-flex min-h-[40px] items-center justify-center gap-1 rounded-lg bg-violet-50 px-3 text-xs font-semibold text-violet-700 ring-1 ring-violet-300 hover:bg-violet-100 disabled:opacity-40"
                    >
                      <Camera size={12} />
                      Preuve livraison
                    </button>
                  </div>
                </article>
              );
            })}
          </section>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200/70">
          <p className="text-sm text-slate-600">{meta.total} demande(s)</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page <= 1}
              className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-40"
            >
              Précédent
            </button>
            <span className="text-xs text-slate-600">
              {page} / {meta.totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((prev) => Math.min(meta.totalPages, prev + 1))}
              disabled={page >= meta.totalPages}
              className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-40"
            >
              Suivant
            </button>
          </div>
        </div>
      </div>

      <BaseModal
        isOpen={acceptModalOpen}
        onClose={closeAllModals}
        panelClassName="w-full max-w-md"
      >
        <ModalHeader
          title="Accepter la demande"
          subtitle="Optionnel: assigner un livreur immédiatement"
          icon={<CheckCircle2 size={16} />}
          onClose={closeAllModals}
        />
        <ModalBody className="space-y-3">
          {Boolean(selectedItem?.orderId?.deliveryFeeLocked) &&
          String(selectedItem?.orderId?.deliveryFeeWaiverReason || '') === 'FULL_PAYMENT' ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
              Commande payée intégralement: les frais de livraison sont offerts et verrouillés.
            </div>
          ) : null}
          {selectedItem ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              <p className="font-semibold text-slate-900">
                #{String(selectedItem.orderId?._id || selectedItem.orderId || '').slice(-6)} ·{' '}
                {selectedItem.shopId?.shopName || selectedItem.shopId?.name || 'Boutique'}
              </p>
              <p className="mt-1">{selectedItem.pickup?.communeName || '—'} → {selectedItem.dropoff?.communeName || '—'}</p>
            </div>
          ) : null}

          {deliveryGuysLoading ? (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 size={14} className="animate-spin" />
              Chargement des livreurs...
            </div>
          ) : (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setSelectedDeliveryGuyId('')}
                className={`w-full rounded-2xl border px-3 py-2 text-left text-sm ${
                  !selectedDeliveryGuyId
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                    : 'border-slate-200 bg-white text-slate-700'
                }`}
              >
                Sans assignation immédiate
              </button>
              <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                {deliveryGuys.map((entry) => {
                  const isSelected = selectedDeliveryGuyId === entry._id;
                  return (
                    <button
                      key={entry._id}
                      type="button"
                      onClick={() => setSelectedDeliveryGuyId(entry._id)}
                      className={`w-full rounded-2xl border px-3 py-2 text-left transition ${
                        isSelected
                          ? 'border-emerald-300 bg-emerald-50'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <p className="text-sm font-semibold text-slate-900">{entry.fullName || entry.name}</p>
                      <p className="text-xs text-slate-500">{entry.phone || 'Téléphone non renseigné'}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {actionError ? <p className="text-xs text-red-600">{actionError}</p> : null}
        </ModalBody>
        <ModalFooter>
          <button
            type="button"
            onClick={handleAccept}
            disabled={savingAction}
            className="inline-flex w-full min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {savingAction ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            Confirmer l’acceptation
          </button>
        </ModalFooter>
      </BaseModal>

      <BaseModal
        isOpen={rejectModalOpen}
        onClose={closeAllModals}
        panelClassName="w-full max-w-md"
      >
        <ModalHeader
          title="Rejeter la demande"
          subtitle="Le motif est obligatoire"
          icon={<XCircle size={16} />}
          onClose={closeAllModals}
        />
        <ModalBody className="space-y-3">
          <textarea
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            placeholder="Raison du rejet"
            rows={5}
            data-autofocus
            className="w-full rounded-2xl border border-gray-300 px-3 py-2 text-sm"
          />
          {actionError ? <p className="text-xs text-red-600">{actionError}</p> : null}
        </ModalBody>
        <ModalFooter>
          <button
            type="button"
            onClick={handleReject}
            disabled={savingAction}
            className="inline-flex w-full min-h-11 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
          >
            {savingAction ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
            Rejeter la demande
          </button>
        </ModalFooter>
      </BaseModal>

      <BaseModal
        isOpen={assignModalOpen}
        onClose={closeAllModals}
        panelClassName="w-full max-w-md"
      >
        <ModalHeader
          title="Assigner un livreur"
          subtitle="Sélectionnez un livreur actif"
          icon={<UserCheck size={16} />}
          onClose={closeAllModals}
        />
        <ModalBody className="space-y-3">
          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {deliveryGuys.map((entry) => {
              const isSelected = selectedDeliveryGuyId === entry._id;
              return (
                <button
                  key={entry._id}
                  type="button"
                  onClick={() => setSelectedDeliveryGuyId(entry._id)}
                  className={`w-full rounded-2xl border px-3 py-2 text-left ${
                    isSelected
                      ? 'border-blue-300 bg-blue-50'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className="h-9 w-9 overflow-hidden rounded-full bg-slate-200">
                      {resolveDeliveryGuyProfileImage(entry) ? (
                        <img
                          src={resolveDeliveryGuyProfileImage(entry)}
                          alt={entry.fullName || entry.name || 'Livreur'}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-slate-600">
                          {String(entry.fullName || entry.name || 'L').charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{entry.fullName || entry.name}</p>
                      <p className="text-xs text-slate-500">{entry.phone || 'Téléphone non renseigné'}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          {actionError ? <p className="text-xs text-red-600">{actionError}</p> : null}
        </ModalBody>
        <ModalFooter>
          <button
            type="button"
            onClick={handleAssign}
            disabled={savingAction}
            className="inline-flex w-full min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {savingAction ? <Loader2 size={14} className="animate-spin" /> : <UserCheck size={14} />}
            Confirmer l’assignation
          </button>
        </ModalFooter>
      </BaseModal>

      <BaseModal
        isOpen={priceModalOpen}
        onClose={closeAllModals}
        panelClassName="w-full max-w-md"
      >
        <ModalHeader
          title="Modifier le prix livraison"
          subtitle="Mise à jour immédiate de la demande"
          icon={<Landmark size={16} />}
          onClose={closeAllModals}
        />
        <ModalBody className="space-y-3">
          {selectedItem ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              <p className="font-semibold text-slate-900">
                #{String(selectedItem.orderId?._id || selectedItem.orderId || '').slice(-6)} ·{' '}
                {selectedItem.shopId?.shopName || selectedItem.shopId?.name || 'Boutique'}
              </p>
              <p className="mt-1">
                Prix actuel: <span className="font-semibold">{fmtMoney(getDisplayDeliveryPrice(selectedItem).price)} {selectedItem.currency || 'XAF'}</span>
                {getDisplayDeliveryPrice(selectedItem).source === 'adminRule' ? (
                  <span className="ml-1 text-gray-500">(règle admin)</span>
                ) : null}
              </p>
            </div>
          ) : null}
          <label className="block text-xs font-semibold text-gray-700">
            Nouveau prix (FCFA)
            <input
              type="number"
              min="0"
              step="1"
              value={priceDraft}
              onChange={(e) => setPriceDraft(e.target.value)}
              data-autofocus
              disabled={
                Boolean(selectedItem?.orderId?.deliveryFeeLocked) &&
                String(selectedItem?.orderId?.deliveryFeeWaiverReason || '') === 'FULL_PAYMENT'
              }
              className="mt-1 w-full rounded-2xl border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs font-semibold text-gray-700">
            Motif (audit log)
            <textarea
              value={priceReason}
              onChange={(e) => setPriceReason(e.target.value)}
              rows={3}
              placeholder="Optionnel: raison de la modification"
              className="mt-1 w-full rounded-2xl border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          {priceError ? <p className="text-xs text-red-600">{priceError}</p> : null}
        </ModalBody>
        <ModalFooter>
          <button
            type="button"
            onClick={handleUpdatePrice}
            disabled={
              priceSaving ||
              (Boolean(selectedItem?.orderId?.deliveryFeeLocked) &&
                String(selectedItem?.orderId?.deliveryFeeWaiverReason || '') === 'FULL_PAYMENT')
            }
            className="inline-flex w-full min-h-11 items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
          >
            {priceSaving ? <Loader2 size={14} className="animate-spin" /> : <Landmark size={14} />}
            Enregistrer le nouveau prix
          </button>
        </ModalFooter>
      </BaseModal>

      <BaseModal
        isOpen={proofModalOpen}
        onClose={closeAllModals}
        panelClassName="w-full max-w-md"
      >
        <ModalHeader
          title={proofType === 'delivery' ? 'Preuve livraison' : 'Preuve pickup'}
          subtitle="Photo, signature ou note"
          icon={<Camera size={16} />}
          onClose={closeAllModals}
        />
        <ModalBody className="space-y-3">
          <label className="block text-xs font-semibold text-gray-700">
            Photo
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setProofPhoto(e.target.files?.[0] || null)}
              className="mt-1 block w-full rounded-2xl border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs font-semibold text-gray-700">
            Signature (fichier)
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setProofSignatureFile(e.target.files?.[0] || null)}
              className="mt-1 block w-full rounded-2xl border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <input
            value={proofSignatureUrl}
            onChange={(e) => setProofSignatureUrl(e.target.value)}
            placeholder="ou URL signature (optionnel)"
            data-autofocus
            className="w-full rounded-2xl border border-gray-300 px-3 py-2 text-sm"
          />
          <textarea
            value={proofNote}
            onChange={(e) => setProofNote(e.target.value)}
            placeholder="Note (optionnel)"
            rows={3}
            className="w-full rounded-2xl border border-gray-300 px-3 py-2 text-sm"
          />
          {proofError ? <p className="text-xs text-red-600">{proofError}</p> : null}
        </ModalBody>
        <ModalFooter>
          <button
            type="button"
            onClick={handleSubmitProof}
            disabled={proofSaving}
            className="inline-flex w-full min-h-11 items-center justify-center gap-2 rounded-xl bg-neutral-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-neutral-900 disabled:opacity-60"
          >
            {proofSaving ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
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
        panelClassName="max-h-[92dvh] border-none bg-transparent shadow-none p-0 sm:max-w-[92vw]"
        backdropClassName="bg-black/85 backdrop-blur-sm"
        ariaLabel={proofPreview?.label || 'Preuve'}
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
              alt={proofPreview?.label || 'Preuve livraison'}
              className={`max-h-[84dvh] max-w-[88vw] rounded-lg object-contain ${
                proofPreviewIsSignature ? 'bg-white' : 'bg-black/10'
              }`}
              loading="lazy"
            />
          </div>
        </div>
      </BaseModal>
    </div>
  );
}
