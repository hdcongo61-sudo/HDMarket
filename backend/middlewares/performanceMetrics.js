const MAX_SAMPLES = Math.max(1000, Number(process.env.PERF_METRICS_MAX_SAMPLES || 5000));
const SLOW_REQUEST_MS = Math.max(200, Number(process.env.PERF_SLOW_REQUEST_MS || 1200));

const state = {
  samples: []
};

const normalizePath = (path = '') =>
  String(path || '')
    .replace(/[a-f0-9]{24}/gi, ':id')
    .replace(/\b\d+\b/g, ':n');

const addSample = (sample) => {
  state.samples.push(sample);
  if (state.samples.length > MAX_SAMPLES) {
    state.samples.splice(0, state.samples.length - MAX_SAMPLES);
  }
};

const filterWindow = (windowMinutes = 60) => {
  const now = Date.now();
  const minTs = now - Math.max(1, Number(windowMinutes || 60)) * 60 * 1000;
  return state.samples.filter((sample) => Number(sample?.timestamp || 0) >= minTs);
};

const getPerformanceSnapshot = ({ windowMinutes = 60 } = {}) => {
  const samples = filterWindow(windowMinutes);
  const total = samples.length;
  if (!total) {
    return {
      total: 0,
      averageResponseMs: 0,
      failureRate: 0,
      slowRate: 0,
      slowEndpoints: []
    };
  }

  let durationSum = 0;
  let failures = 0;
  let slow = 0;
  const endpointMap = new Map();

  samples.forEach((sample) => {
    const duration = Math.max(0, Number(sample?.durationMs || 0));
    const status = Number(sample?.status || 0);
    durationSum += duration;
    if (status >= 400) failures += 1;
    if (duration >= SLOW_REQUEST_MS) slow += 1;

    const endpoint = `${sample.method || 'GET'} ${sample.path || '/'}`;
    const current = endpointMap.get(endpoint) || { count: 0, slowCount: 0, avgDurationMs: 0 };
    current.count += 1;
    current.avgDurationMs += duration;
    if (duration >= SLOW_REQUEST_MS) current.slowCount += 1;
    endpointMap.set(endpoint, current);
  });

  const slowEndpoints = Array.from(endpointMap.entries())
    .map(([endpoint, values]) => ({
      endpoint,
      count: values.count,
      slowCount: values.slowCount,
      averageMs: Math.round(values.avgDurationMs / Math.max(1, values.count))
    }))
    .sort((a, b) => b.slowCount - a.slowCount || b.averageMs - a.averageMs)
    .slice(0, 12);

  return {
    total,
    averageResponseMs: Math.round(durationSum / total),
    failureRate: Number(((failures / total) * 100).toFixed(2)),
    slowRate: Number(((slow / total) * 100).toFixed(2)),
    slowThresholdMs: SLOW_REQUEST_MS,
    slowEndpoints
  };
};

const performanceMetricsMiddleware = (req, res, next) => {
  const startedAt = Date.now();
  res.on('finish', () => {
    addSample({
      timestamp: Date.now(),
      method: String(req.method || 'GET').toUpperCase(),
      path: normalizePath(req.originalUrl || req.path || '/'),
      status: Number(res.statusCode || 0),
      durationMs: Math.max(0, Date.now() - startedAt)
    });
  });
  next();
};

export { performanceMetricsMiddleware, getPerformanceSnapshot };

