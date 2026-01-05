const DEFAULT_GOAL = 6000;
const THRESHOLD_STEPS = [0.5, 0.75, 0.9, 1];

const parseGoal = (value) => {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) {
    return Math.round(numeric);
  }
  return DEFAULT_GOAL;
};

const DAILY_GOAL = parseGoal(process.env.DAILY_REQUEST_GOAL);

const buildThresholds = () =>
  THRESHOLD_STEPS.map((step) => Math.max(1, Math.floor(DAILY_GOAL * step)));

let stats = {
  date: '',
  count: 0,
  nextThresholdIdx: 0
};

const getTodayKey = () => new Date().toISOString().split('T')[0];

const thresholds = buildThresholds();

const logThreshold = (index, value) => {
  const percent = Math.round((value / DAILY_GOAL) * 100);
  const isFinal = index === thresholds.length - 1;
  const method = isFinal ? console.warn : console.info;
  const label =
    index === thresholds.length - 1
      ? 'Objectif journalier atteint'
      : `Objectif ${percent}%`;
  method(`[hdmarket] ${label} (${value}/${DAILY_GOAL} reqs)`);
};

const requestTracker = (req, res, next) => {
  const today = getTodayKey();
  if (stats.date !== today) {
    stats.date = today;
    stats.count = 0;
    stats.nextThresholdIdx = 0;
  }
  stats.count += 1;
  while (stats.nextThresholdIdx < thresholds.length && stats.count >= thresholds[stats.nextThresholdIdx]) {
    const value = thresholds[stats.nextThresholdIdx];
    logThreshold(stats.nextThresholdIdx, value);
    stats.nextThresholdIdx += 1;
  }
  next();
};

const getDailyRequestStats = () => ({
  date: stats.date || getTodayKey(),
  count: stats.count,
  goal: DAILY_GOAL,
  percent: Math.min(100, Math.round((stats.count / DAILY_GOAL) * 100)),
  nextThreshold: thresholds[stats.nextThresholdIdx] || null
});

export { requestTracker, getDailyRequestStats, DAILY_GOAL };
