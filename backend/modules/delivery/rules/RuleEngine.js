const normalizeContribution = (value) => {
  if (!value || !value.label) return null;
  if (value.fixed != null && Number(value.fixed) > 0) {
    return { label: value.label, fixed: Number(value.fixed) };
  }
  if (value.percent != null && Number(value.percent) > 0) {
    return { label: value.label, percent: Number(value.percent) };
  }
  return null;
};

export default class RuleEngine {
  constructor(rules = []) {
    this.rules = Array.isArray(rules) ? rules.filter(Boolean) : [];
  }

  evaluate(context = {}) {
    const contributions = [];
    this.rules.forEach((rule) => {
      if (rule.enabled === false) return;
      if (typeof rule.matches === 'function' && !rule.matches(context)) return;
      const raw = typeof rule.contribute === 'function'
        ? rule.contribute(context)
        : rule.contribution;
      const values = Array.isArray(raw) ? raw : [raw];
      values.forEach((value) => {
        const normalized = normalizeContribution(value);
        if (normalized) contributions.push(normalized);
      });
    });
    return contributions;
  }
}
