const localeModules = import.meta.glob('../locales/*/*.json');

const DEFAULT_NAMESPACES = ['common', 'orders'];

const resolveLanguageCandidates = (languageCode = 'fr') => {
  const normalized = String(languageCode || 'fr').toLowerCase().trim();
  if (!normalized) return ['fr'];
  const base = normalized.split('-')[0];
  return base && base !== normalized ? [normalized, base] : [normalized];
};

export const loadLanguageResources = async (languageCode = 'fr', namespaces = DEFAULT_NAMESPACES) => {
  const candidates = resolveLanguageCandidates(languageCode);
  const loaded = {};

  await Promise.all(
    namespaces.map(async (namespace) => {
      for (const candidate of candidates) {
        const key = `../locales/${candidate}/${namespace}.json`;
        const loader = localeModules[key];
        if (!loader) continue;
        const mod = await loader();
        loaded[namespace] = mod?.default || mod || {};
        break;
      }
    })
  );

  return loaded;
};

export const getNestedTranslation = (resources, key, fallback = '') => {
  if (!key) return fallback;
  const chunks = key.split('.');
  let cursor = resources;
  for (const chunk of chunks) {
    if (!cursor || typeof cursor !== 'object' || !(chunk in cursor)) {
      return fallback || key;
    }
    cursor = cursor[chunk];
  }
  return typeof cursor === 'string' ? cursor : fallback || key;
};

export const I18N_NAMESPACES = DEFAULT_NAMESPACES;
