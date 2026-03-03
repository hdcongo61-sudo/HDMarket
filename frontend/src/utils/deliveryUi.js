export const DELIVERY_STATUS_STYLES = {
  NEW: 'bg-yellow-100 text-yellow-700',
  ACCEPTED: 'bg-blue-100 text-blue-700',
  PICKUP: 'bg-purple-100 text-purple-700',
  ON_ROUTE: 'bg-indigo-100 text-indigo-700',
  DELIVERED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  FAILED: 'bg-gray-200 text-gray-700'
};

export const WORKFLOW_LABELS = {
  NEW: 'Nouveau',
  ACCEPTED: 'Accepté',
  PICKUP: 'Pickup',
  ON_ROUTE: 'En route',
  DELIVERED: 'Livré',
  REJECTED: 'Rejeté',
  FAILED: 'Échec'
};

export const STAGE_ORDER = ['ASSIGNED', 'ACCEPTED', 'PICKUP_STARTED', 'PICKED_UP', 'IN_TRANSIT', 'ARRIVED', 'DELIVERED'];

export const STAGE_LABELS = {
  ASSIGNED: 'Assigned',
  ACCEPTED: 'Accepted',
  PICKUP_STARTED: 'Pickup started',
  PICKED_UP: 'Pickup confirmed',
  IN_TRANSIT: 'On route',
  ARRIVED: 'Arrived',
  DELIVERED: 'Delivered',
  FAILED: 'Failed'
};

export const NEXT_STAGE = {
  ASSIGNED: 'ACCEPTED',
  ACCEPTED: 'PICKUP_STARTED',
  PICKUP_STARTED: 'PICKED_UP',
  PICKED_UP: 'IN_TRANSIT',
  IN_TRANSIT: 'ARRIVED',
  ARRIVED: 'DELIVERED'
};

export const MAX_PROOF_PHOTOS = 3;

export const normalizeFileUrl = (url = '') => {
  const normalized = String(url || '').trim();
  if (!normalized) return '';
  if (/^https?:\/\//i.test(normalized)) return normalized;
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
  const host = apiBase.replace(/\/api\/?$/, '');
  return `${host}/${normalized.replace(/^\/+/, '')}`;
};

export const getLatLng = (geoPoint = null) => {
  const coordinates = Array.isArray(geoPoint?.coordinates) ? geoPoint.coordinates : null;
  if (!coordinates || coordinates.length !== 2) return null;
  const lng = Number(coordinates[0]);
  const lat = Number(coordinates[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
};

export const getCoordinatesDisplay = (geoPoint = null) => {
  const latLng = getLatLng(geoPoint);
  if (!latLng) return '';
  return `${latLng.lat.toFixed(6)}, ${latLng.lng.toFixed(6)}`;
};

export const buildGoogleMapHref = (geoPoint = null, fallbackAddress = '') => {
  const latLng = getLatLng(geoPoint);
  if (latLng) return `https://www.google.com/maps?q=${latLng.lat},${latLng.lng}`;
  const text = String(fallbackAddress || '').trim();
  if (!text) return '';
  return `https://www.google.com/maps?q=${encodeURIComponent(text)}`;
};

export const buildAppleMapHref = (geoPoint = null, fallbackAddress = '') => {
  const latLng = getLatLng(geoPoint);
  if (latLng) return `http://maps.apple.com/?q=${latLng.lat},${latLng.lng}`;
  const text = String(fallbackAddress || '').trim();
  if (!text) return '';
  return `http://maps.apple.com/?q=${encodeURIComponent(text)}`;
};

export const extractMessage = (error, fallback) =>
  error?.response?.data?.message || error?.response?.data?.details?.[0] || error?.message || fallback;

export const fmtShortDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short'
  });
};

export const fmtDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const formatCurrency = (value = 0, currency = 'XAF') =>
  `${Number(value || 0).toLocaleString('fr-FR')} ${currency || 'XAF'}`;

export const hasProofContent = (proof = {}) => {
  const submittedAt = proof?.submittedAt ? new Date(proof.submittedAt) : null;
  const hasValidSubmittedAt = submittedAt instanceof Date && !Number.isNaN(submittedAt.getTime());
  return Boolean(
    hasValidSubmittedAt ||
      String(proof?.photoUrl || '').trim() ||
      String(proof?.signatureUrl || '').trim() ||
      String(proof?.note || '').trim()
  );
};

export const dataUrlToFile = (dataUrl = '', filename = 'signature.png') => {
  const source = String(dataUrl || '');
  const [meta, payload] = source.split(',');
  if (!meta || !payload) return null;
  const mimeMatch = meta.match(/^data:(.*?);base64$/i);
  const mimeType = mimeMatch?.[1] || 'image/png';
  try {
    const binary = atob(payload);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return new File([bytes], filename, { type: mimeType });
  } catch (_error) {
    return null;
  }
};

export const workflowStatusOf = (item = null) => {
  const assignmentStatus = String(item?.assignmentStatus || '').toUpperCase();
  const status = String(item?.status || '').toUpperCase();
  const stage = String(item?.currentStage || '').toUpperCase();

  if (assignmentStatus === 'PENDING') return 'NEW';
  if (assignmentStatus === 'REJECTED' || status === 'REJECTED') return 'REJECTED';
  if (status === 'FAILED' || stage === 'FAILED') return 'FAILED';
  if (status === 'DELIVERED' || stage === 'DELIVERED') return 'DELIVERED';
  if (stage === 'PICKED_UP' || stage === 'PICKUP_STARTED') return 'PICKUP';
  if (stage === 'IN_TRANSIT' || stage === 'ARRIVED' || status === 'IN_PROGRESS') return 'ON_ROUTE';
  if (stage === 'ACCEPTED' || status === 'ACCEPTED' || assignmentStatus === 'ACCEPTED') return 'ACCEPTED';
  return 'NEW';
};

export const workflowLabelOf = (item = null) => {
  const key = workflowStatusOf(item);
  return WORKFLOW_LABELS[key] || key;
};

export const statusPillClassOf = (item = null) => {
  const key = workflowStatusOf(item);
  return DELIVERY_STATUS_STYLES[key] || DELIVERY_STATUS_STYLES.NEW;
};

export const isDoneDelivery = (item = null) => {
  const status = String(item?.status || '').toUpperCase();
  const assignmentStatus = String(item?.assignmentStatus || '').toUpperCase();
  return ['DELIVERED', 'FAILED', 'REJECTED', 'CANCELED'].includes(status) || assignmentStatus === 'REJECTED';
};

export const isNewDelivery = (item = null) => String(item?.assignmentStatus || '').toUpperCase() === 'PENDING';

export const isActiveDelivery = (item = null) => !isDoneDelivery(item) && !isNewDelivery(item);

export const isItemInTab = (item = null, tab = 'new') => {
  if (tab === 'new') return isNewDelivery(item);
  if (tab === 'active') return isActiveDelivery(item);
  if (tab === 'done') return isDoneDelivery(item);
  return true;
};

export const sortByPriority = (items = []) => {
  const rank = {
    NEW: 1,
    ACCEPTED: 2,
    PICKUP: 3,
    ON_ROUTE: 4,
    DELIVERED: 5,
    FAILED: 6,
    REJECTED: 7
  };
  return [...(Array.isArray(items) ? items : [])].sort((left, right) => {
    const leftRank = rank[workflowStatusOf(left)] || 99;
    const rightRank = rank[workflowStatusOf(right)] || 99;
    if (leftRank !== rightRank) return leftRank - rightRank;
    return new Date(left?.updatedAt || left?.createdAt || 0).getTime() - new Date(right?.updatedAt || right?.createdAt || 0).getTime();
  });
};

export const getRelativeTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 60) return `${abs}s`;
  if (abs < 3600) return `${Math.round(abs / 60)}m`;
  if (abs < 86400) return `${Math.round(abs / 3600)}h`;
  return `${Math.round(abs / 86400)}j`;
};

export const buildAssignmentRoute = ({ basePath = '/delivery', id = '' } = {}) => `${basePath}/assignment/${id}`;

export const buildHistoryRoute = (basePath = '/delivery') => `${basePath}/history`;

export const buildProfileRoute = (basePath = '/delivery') => `${basePath}/profile`;

export const getApiModeFromPath = (pathname = '') => {
  const legacy = String(pathname || '').startsWith('/courier');
  return {
    useLegacyCourierApi: legacy,
    apiPrefix: legacy ? '/courier' : '/delivery',
    routePrefix: legacy ? '/courier' : '/delivery'
  };
};
