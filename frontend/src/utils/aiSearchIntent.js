export function searchIntentPath(query, intent = {}) {
  const params = new URLSearchParams({ q: String(query).trim() });
  for (const key of ['minPrice', 'maxPrice']) {
    if (typeof intent[key] === 'number' && Number.isFinite(intent[key]) && intent[key] >= 0) params.set(key, String(intent[key]));
  }
  if (['new', 'used'].includes(intent.condition)) params.set('condition', intent.condition);
  return `/search?${params}`;
}
