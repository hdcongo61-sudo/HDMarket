import LocationProvider from './LocationProvider.js';

export default class HybridLocationProvider extends LocationProvider {
  constructor(providers = []) {
    super();
    this.providers = providers.filter(Boolean);
  }

  async resolve(location = {}, options = {}) {
    const attempts = [];
    for (const provider of this.providers) {
      try {
        // Providers are intentionally sequential: local data should win
        // before a paid or external geocoding provider is consulted.
        const result = await provider.resolve(location, options);
        attempts.push(result?.provider || provider.constructor.name);
        if (result?.coordinates) return { ...result, attempts };
      } catch {
        attempts.push(`${provider.constructor.name}:ERROR`);
      }
    }
    return {
      coordinates: null,
      resolvedFrom: 'UNRESOLVED',
      landmarkId: null,
      provider: 'HYBRID',
      attempts
    };
  }
}
