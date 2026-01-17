import mongoose from 'mongoose';

const slugifyText = (value) => {
  if (!value) return '';
  return value
    .toString()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
};

export const generateUniqueSlug = async (Model, baseValue, excludeId = null, slugField = 'slug') => {
  if (!Model || typeof Model.exists !== 'function') {
    throw new Error('Model is required to generate slug.');
  }
  const fallbackBase = slugifyText(baseValue) || `${Date.now()}`;
  let candidate = fallbackBase;
  let suffix = 0;
  const buildQuery = (slug) => ({
    [slugField]: slug,
    ...(excludeId ? { _id: { $ne: excludeId } } : {})
  });
  // eslint-disable-next-line no-await-in-loop
  while (await Model.exists(buildQuery(candidate))) {
    suffix += 1;
    candidate = `${fallbackBase}-${suffix}`;
  }
  return candidate;
};

export const ensureDocumentSlug = async ({ document, sourceValue, slugField = 'slug' }) => {
  if (!document) return null;
  if (document[slugField]) return document[slugField];
  const value = typeof sourceValue === 'function' ? sourceValue(document) : sourceValue;
  const slug = await generateUniqueSlug(document.constructor, value, document._id, slugField);
  document[slugField] = slug;
  await document.constructor.updateOne(
    { _id: document._id },
    { $set: { [slugField]: slug } }
  );
  return slug;
};

export const isIdentifierObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

export const ensureModelSlugsForItems = async ({
  Model,
  items = [],
  slugField = 'slug',
  sourceValueKey = 'title',
  sourceValue
} = {}) => {
  if (!Model || typeof Model.find !== 'function') return items;
  const list = Array.isArray(items) ? items : [];
  const missingIds = list
    .filter((item) => item && !item[slugField] && item._id)
    .map((item) => item._id);
  if (!missingIds.length) return list;

  const docs = await Model.find({ _id: { $in: missingIds } });
  const slugMap = new Map();
  for (const doc of docs) {
    const value =
      typeof sourceValue === 'function'
        ? sourceValue(doc)
        : sourceValue ?? doc[sourceValueKey];
    // eslint-disable-next-line no-await-in-loop
    await ensureDocumentSlug({ document: doc, sourceValue: value, slugField });
    slugMap.set(String(doc._id), doc[slugField]);
  }

  list.forEach((item) => {
    const slug = slugMap.get(String(item?._id));
    if (slug) item[slugField] = slug;
  });

  return list;
};
