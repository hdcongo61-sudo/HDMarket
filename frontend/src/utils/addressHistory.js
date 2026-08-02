const ADDRESS_HISTORY_KEY = 'hd_address_history_v1';
const ADDRESS_HISTORY_LIMIT = 8;

const normalize = (value) => String(value || '').trim().toLowerCase();

export const addressHistoryKey = (entry) =>
  [entry?.cityId, entry?.communeId, entry?.address, entry?.contactPhone].map(normalize).join('|');

export const readAddressHistory = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(ADDRESS_HISTORY_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const saveAddressToHistory = (entry) => {
  const address = String(entry?.address || '').trim();
  if (!address || (!entry?.cityId && !entry?.communeId)) return readAddressHistory();
  const record = {
    cityId: entry.cityId || '',
    communeId: entry.communeId || '',
    address,
    contactName: String(entry.contactName || '').trim(),
    contactPhone: String(entry.contactPhone || '').trim(),
    usedAt: Date.now()
  };
  const key = addressHistoryKey(record);
  const history = [record, ...readAddressHistory().filter((item) => addressHistoryKey(item) !== key)].slice(0, ADDRESS_HISTORY_LIMIT);
  try {
    localStorage.setItem(ADDRESS_HISTORY_KEY, JSON.stringify(history));
  } catch {
    // storage full or unavailable: ignore
  }
  return history;
};

export const resolveAddressNames = (item, cities = [], communes = []) => ({
  cityName: cities.find((c) => c._id === item?.cityId)?.name || '',
  communeName: communes.find((c) => c._id === item?.communeId)?.name || ''
});
