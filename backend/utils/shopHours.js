const WEEK_DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const WEEK_DAY_LABELS = {
  monday: 'Lundi',
  tuesday: 'Mardi',
  wednesday: 'Mercredi',
  thursday: 'Jeudi',
  friday: 'Vendredi',
  saturday: 'Samedi',
  sunday: 'Dimanche'
};

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

const isValidTime = (value) => TIME_REGEX.test(value);

const normalizeDayEntry = (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  const day = typeof raw.day === 'string' && WEEK_DAY_KEYS.includes(raw.day) ? raw.day : null;
  if (!day) return null;

  let closed = raw.closed;
  if (typeof closed === 'string') {
    closed = closed === 'true' || closed === '1';
  }
  closed = Boolean(closed);

  let open = typeof raw.open === 'string' ? raw.open.trim() : '';
  let close = typeof raw.close === 'string' ? raw.close.trim() : '';

  if (closed) {
    open = '';
    close = '';
  } else if (!isValidTime(open) || !isValidTime(close)) {
    closed = true;
    open = '';
    close = '';
  }

  return { day, open, close, closed };
};

const ensureFullWeek = (entries = []) => {
  const map = new Map();
  if (Array.isArray(entries)) {
    entries.forEach((entry) => {
      if (entry && WEEK_DAY_KEYS.includes(entry.day)) {
        map.set(entry.day, {
          day: entry.day,
          open: typeof entry.open === 'string' ? entry.open : '',
          close: typeof entry.close === 'string' ? entry.close : '',
          closed: typeof entry.closed === 'boolean' ? entry.closed : Boolean(entry.closed)
        });
      }
    });
  }

  return WEEK_DAY_KEYS.map((day) => {
    if (map.has(day)) {
      const saved = map.get(day);
      if (saved.closed) {
        return { day, open: '', close: '', closed: true };
      }
      return saved;
    }
    return { day, open: '', close: '', closed: true };
  });
};

const parsePayload = (value) => {
  if (!value) return [];
  let parsed;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      parsed = null;
    }
  } else if (Array.isArray(value)) {
    parsed = value;
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map((item) => normalizeDayEntry(item))
    .filter(Boolean);
};

export const WEEK_DAYS = WEEK_DAY_KEYS.map((day) => ({
  key: day,
  label: WEEK_DAY_LABELS[day] || day.charAt(0).toUpperCase() + day.slice(1)
}));
export const WEEK_DAY_ORDER = WEEK_DAY_KEYS;
export const hydrateShopHours = (value) => ensureFullWeek(parsePayload(value));
export const sanitizeShopHours = (value) => ensureFullWeek(value);
