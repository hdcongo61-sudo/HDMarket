const STORAGE_KEY = 'hdmarket:network-metrics:v1';
const MAX_ITEMS = 600;

const safeParse = (raw) => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const readMetrics = () => {
  if (typeof window === 'undefined') return [];
  return safeParse(window.localStorage.getItem(STORAGE_KEY));
};

const writeMetrics = (entries = []) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-MAX_ITEMS)));
  } catch {
    // ignore storage errors
  }
};

export const recordNetworkMetric = (entry = {}) => {
  if (typeof window === 'undefined') return;
  const metric = {
    timestamp: Date.now(),
    source: String(entry.source || 'unknown'),
    method: String(entry.method || 'GET').toUpperCase(),
    endpoint: String(entry.endpoint || ''),
    status: Number(entry.status || 0),
    durationMs: Math.max(0, Number(entry.durationMs || 0)),
    success: Boolean(entry.success),
    timeout: Boolean(entry.timeout),
    networkError: Boolean(entry.networkError),
    retried: Math.max(0, Number(entry.retried || 0))
  };
  const next = [...readMetrics(), metric].slice(-MAX_ITEMS);
  writeMetrics(next);
  window.dispatchEvent(new CustomEvent('hdmarket:network-metric', { detail: metric }));
};

export const getNetworkMetrics = () => readMetrics();

export const clearNetworkMetrics = () => {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
};

export const getNetworkMetricsSummary = ({ windowMinutes = 60, slowMs = 1200 } = {}) => {
  const now = Date.now();
  const threshold = now - Math.max(1, Number(windowMinutes || 60)) * 60 * 1000;
  const metrics = readMetrics().filter((item) => Number(item?.timestamp || 0) >= threshold);
  const total = metrics.length;
  if (!total) {
    return {
      total: 0,
      averageResponseMs: 0,
      failureRate: 0,
      timeoutRate: 0,
      retryCount: 0,
      slowEndpoints: []
    };
  }

  let durationSum = 0;
  let failures = 0;
  let timeouts = 0;
  let retries = 0;
  const endpointStats = new Map();

  metrics.forEach((item) => {
    const duration = Math.max(0, Number(item?.durationMs || 0));
    durationSum += duration;
    if (!item?.success) failures += 1;
    if (item?.timeout) timeouts += 1;
    retries += Math.max(0, Number(item?.retried || 0));

    const endpoint = String(item?.endpoint || 'unknown');
    const current = endpointStats.get(endpoint) || { count: 0, slowCount: 0, avgDurationMs: 0 };
    current.count += 1;
    current.avgDurationMs += duration;
    if (duration >= slowMs) current.slowCount += 1;
    endpointStats.set(endpoint, current);
  });

  const slowEndpoints = Array.from(endpointStats.entries())
    .map(([endpoint, stats]) => ({
      endpoint,
      count: stats.count,
      averageMs: Math.round(stats.avgDurationMs / Math.max(1, stats.count)),
      slowCount: stats.slowCount
    }))
    .sort((a, b) => b.slowCount - a.slowCount || b.averageMs - a.averageMs)
    .slice(0, 8);

  return {
    total,
    averageResponseMs: Math.round(durationSum / total),
    failureRate: Number(((failures / total) * 100).toFixed(2)),
    timeoutRate: Number(((timeouts / total) * 100).toFixed(2)),
    retryCount: retries,
    slowEndpoints
  };
};

