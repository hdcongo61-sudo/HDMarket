export const TAG_TYPES = Object.freeze([
  'system',
  'seller',
  'campaign',
  'ai',
  'internal',
  'beta'
]);

export const TAG_VISIBILITIES = Object.freeze(['public', 'private', 'hidden', 'archived']);
export const TAG_STATUSES = Object.freeze(['active', 'draft', 'archived', 'disabled']);
export const TAG_ASSIGNMENT_SOURCES = Object.freeze(['manual', 'system', 'ai', 'import']);
export const MAX_MANUAL_PRODUCT_TAGS = 10;

export const DEFAULT_TAG_CATEGORIES = Object.freeze([
  'Electronics',
  'Fashion',
  'Furniture',
  'Home Decor',
  'Beauty',
  'Automotive',
  'Sports',
  'Food',
  'Services',
  'Marketplace',
  'Campaigns',
  'Collections',
  'Seasonal',
  'Technology',
  'Custom'
]);

export const TAG_ENTITY_TYPES = Object.freeze([
  'product',
  'shop',
  'service',
  'category',
  'order',
  'campaign',
  'collection',
  'advertisement',
  'help_article',
  'feature',
  'blog_post'
]);

export const normalizeEntityType = (value = '') =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 60);

