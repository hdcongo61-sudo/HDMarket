const DAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_LABELS = {
  monday: 'Lundi',
  tuesday: 'Mardi',
  wednesday: 'Mercredi',
  thursday: 'Jeudi',
  friday: 'Vendredi',
  saturday: 'Samedi',
  sunday: 'Dimanche'
};
const WEEKDAY_TO_KEY = {
  monday: 'monday',
  tuesday: 'tuesday',
  wednesday: 'wednesday',
  thursday: 'thursday',
  friday: 'friday',
  saturday: 'saturday',
  sunday: 'sunday'
};

const numberFormatter = new Intl.NumberFormat('fr-FR');
const SHOP_SNAPSHOT_PREFIX = 'hdmarket:shop-snapshot:';

export const formatCount = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '0';
  return numberFormatter.format(parsed);
};

export const formatRatingLabel = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '0,0';
  return parsed.toFixed(1).replace('.', ',');
};

export const formatDate = (value) => {
  if (!value) return 'Date inconnue';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Date inconnue';
  return parsed.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const coerceFlag = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return ['true', '1', 'yes', 'oui', 'verified', 'certified'].includes(normalized);
  }
  return false;
};

export const normalizeTimeLabel = (value) => {
  if (!value) return '';
  const str = String(value).trim();
  const match = str.match(/^(\d{1,2}):(\d{1,2})$/);
  if (!match) return str;
  const hours = Math.max(0, Math.min(23, Number(match[1])));
  const minutes = Math.max(0, Math.min(59, Number(match[2])));
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const toMinutes = (timeValue) => {
  const normalized = normalizeTimeLabel(timeValue);
  const match = normalized.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return hour * 60 + minute;
};

export const getTimeZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Brazzaville';
  } catch {
    return 'Africa/Brazzaville';
  }
};

const getNowInTimeZone = (timeZone) => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  const parts = formatter.formatToParts(new Date());
  const weekday = String(parts.find((part) => part.type === 'weekday')?.value || '').toLowerCase();
  const hour = Number(parts.find((part) => part.type === 'hour')?.value || 0);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value || 0);
  const dayKey = WEEKDAY_TO_KEY[weekday] || 'monday';
  return { dayKey, minutes: hour * 60 + minute };
};

export const getOpeningSummary = (hours, timeZone) => {
  const normalizedHours = DAY_ORDER.map((day) => {
    const entry = Array.isArray(hours) ? hours.find((item) => item?.day === day) : null;
    return {
      day,
      dayLabel: DAY_LABELS[day],
      closed: Boolean(entry?.closed),
      open: normalizeTimeLabel(entry?.open || ''),
      close: normalizeTimeLabel(entry?.close || '')
    };
  });

  const { dayKey: todayKey, minutes: currentMinutes } = getNowInTimeZone(timeZone);
  const todayIndex = Math.max(0, DAY_ORDER.indexOf(todayKey));
  const today = normalizedHours[todayIndex];

  let isOpen = false;
  let closesAt = null;
  if (today && !today.closed && today.open && today.close) {
    const openMinutes = toMinutes(today.open);
    const closeMinutes = toMinutes(today.close);
    if (openMinutes != null && closeMinutes != null) {
      if (closeMinutes > openMinutes) {
        isOpen = currentMinutes >= openMinutes && currentMinutes < closeMinutes;
      } else if (closeMinutes < openMinutes) {
        isOpen = currentMinutes >= openMinutes || currentMinutes < closeMinutes;
      }
      if (isOpen) closesAt = today.close;
    }
  }

  let nextOpen = null;
  if (!isOpen) {
    for (let offset = 0; offset < 7; offset += 1) {
      const index = (todayIndex + offset) % 7;
      const item = normalizedHours[index];
      if (!item || item.closed || !item.open) continue;
      const openMinutes = toMinutes(item.open);
      if (offset === 0 && openMinutes != null && openMinutes <= currentMinutes) continue;
      nextOpen = { ...item, offset };
      break;
    }
  }

  let statusText = 'Fermé';
  if (isOpen && closesAt) {
    statusText = `Ouvert · Ferme à ${closesAt}`;
  } else if (nextOpen) {
    if (nextOpen.offset === 0) statusText = `Fermé · Ouvre à ${nextOpen.open}`;
    else if (nextOpen.offset === 1) statusText = `Fermé · Ouvre demain à ${nextOpen.open}`;
    else statusText = `Fermé · Ouvre ${nextOpen.dayLabel} à ${nextOpen.open}`;
  }

  return {
    todayKey,
    statusText,
    isOpen,
    closesAt,
    nextOpen,
    normalizedHours
  };
};

export const parseGeoPoint = (location) => {
  const coordinates = location?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length !== 2) return null;
  const longitude = Number(coordinates[0]);
  const latitude = Number(coordinates[1]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
};

export const buildFullShopAddress = (shop = {}) =>
  Array.from(
    new Set(
      [shop?.shopAddress, shop?.commune, shop?.city]
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    )
  ).join(', ');

export const buildGoogleDirectionsUrl = ({ destination, origin = null }) => {
  if (!destination) return null;
  const url = new URL('https://www.google.com/maps/dir/');
  const destinationParam = `${destination.latitude},${destination.longitude}`;
  url.searchParams.set('api', '1');
  url.searchParams.set('destination', destinationParam);
  if (origin) url.searchParams.set('origin', `${origin.latitude},${origin.longitude}`);
  return url.toString();
};

export const buildAppleDirectionsUrl = ({ destination }) => {
  if (!destination) return null;
  const url = new URL('http://maps.apple.com/');
  url.searchParams.set('daddr', `${destination.latitude},${destination.longitude}`);
  return url.toString();
};

export const buildOsmEmbedUrl = (destination) => {
  if (!destination) return null;
  const lat = destination.latitude;
  const lon = destination.longitude;
  const minLat = lat - 0.01;
  const maxLat = lat + 0.01;
  const minLon = lon - 0.01;
  const maxLon = lon + 0.01;
  const url = new URL('https://www.openstreetmap.org/export/embed.html');
  url.searchParams.set('bbox', `${minLon},${minLat},${maxLon},${maxLat}`);
  url.searchParams.set('layer', 'mapnik');
  url.searchParams.set('marker', `${lat},${lon}`);
  return url.toString();
};

export const buildGoogleEmbedUrl = (destination) => {
  if (!destination) return null;
  const url = new URL('https://www.google.com/maps');
  url.searchParams.set('q', `${destination.latitude},${destination.longitude}`);
  url.searchParams.set('z', '15');
  url.searchParams.set('output', 'embed');
  return url.toString();
};

export const buildOsmDirectionsUrl = ({ destination, origin = null }) => {
  if (!destination) return null;
  const url = new URL('https://www.openstreetmap.org/directions');
  if (origin) {
    url.searchParams.set(
      'route',
      `${origin.latitude},${origin.longitude};${destination.latitude},${destination.longitude}`
    );
    url.searchParams.set('engine', 'fossgis_osrm_car');
  } else {
    url.searchParams.set('route', `${destination.latitude},${destination.longitude}`);
  }
  return url.toString();
};

export const readShopSnapshot = (slug) => {
  if (typeof window === 'undefined' || !slug) return undefined;
  try {
    const raw = window.localStorage.getItem(`${SHOP_SNAPSHOT_PREFIX}${slug}`);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return undefined;
    if (!parsed?.shop?._id) return undefined;
    return parsed;
  } catch {
    return undefined;
  }
};

export const writeShopSnapshot = (slug, payload) => {
  if (typeof window === 'undefined' || !slug || !payload?.shop?._id) return;
  try {
    window.localStorage.setItem(`${SHOP_SNAPSHOT_PREFIX}${slug}`, JSON.stringify(payload));
  } catch {
    // ignore storage failure
  }
};

