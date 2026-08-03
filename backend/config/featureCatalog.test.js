import { describe, expect, it } from 'vitest';
import { catalogFeatureNames, getCatalogFeature } from './featureCatalog.js';

describe('HDMarket Videos feature catalog', () => {
  it('exposes the exact rollout key through the central feature system', () => {
    expect(catalogFeatureNames()).toContain('product_videos');
    expect(getCatalogFeature('product_videos')).toMatchObject({
      displayName: 'HDMarket Videos',
      category: 'discovery',
      enabled: true,
      releaseStage: 'released',
      rolloutPercentage: 100
    });
  });
});
