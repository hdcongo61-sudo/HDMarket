import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import Category from '../models/categoryModel.js';
import Product from '../models/productModel.js';
import DEFAULT_CATEGORY_TREE from '../data/defaultCategoryTree.js';

const normalizeText = (value = '') => String(value || '').trim();
const normalizeCountry = (value = '') => normalizeText(value).toUpperCase();
const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const slugify = (value = '') =>
  normalizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

const ensureUniqueSlug = async ({ baseSlug, country = '', excludeId = null }) => {
  let attempt = 1;
  let candidate = baseSlug || 'categorie';

  while (true) {
    // eslint-disable-next-line no-await-in-loop
    const existing = await Category.findOne({
      _id: excludeId ? { $ne: excludeId } : { $exists: true },
      country,
      slug: candidate,
      isDeleted: false
    })
      .select('_id')
      .lean();
    if (!existing) return candidate;
    attempt += 1;
    candidate = `${baseSlug}-${attempt}`;
  }
};

const ensureNode = async ({
  name,
  slug,
  parentId = null,
  level = 0,
  order = 0,
  iconKey = '',
  imageUrl = '',
  description = '',
  country = '',
  cities = [],
  createdBy = null
}) => {
  const normalizedCountry = normalizeCountry(country);
  const baseSlug = slugify(slug || name);
  if (!baseSlug) return null;

  const bySlug = await Category.findOne({
    parentId,
    country: normalizedCountry,
    slug: baseSlug,
    isDeleted: false
  });

  let doc = bySlug;
  if (!doc) {
    const byName = await Category.findOne({
      parentId,
      country: normalizedCountry,
      name: new RegExp(`^${escapeRegex(normalizeText(name))}$`, 'i'),
      isDeleted: false
    });
    doc = byName;
  }

  if (!doc) {
    const uniqueSlug = await ensureUniqueSlug({
      baseSlug,
      country: normalizedCountry
    });
    const path = parentId
      ? `${(await Category.findById(parentId).select('path').lean())?.path || ''}/${uniqueSlug}`
      : uniqueSlug;
    doc = await Category.create({
      name: normalizeText(name),
      slug: uniqueSlug,
      parentId,
      level,
      order,
      path: path.replace(/^\/+/, ''),
      isActive: true,
      isDeleted: false,
      iconKey: normalizeText(iconKey),
      imageUrl: normalizeText(imageUrl),
      description: normalizeText(description),
      country: normalizedCountry,
      cities: Array.isArray(cities) ? cities.filter(Boolean) : [],
      createdBy,
      updatedBy: createdBy
    });
    return { doc, created: true, updated: false };
  }

  const parentPath = parentId
    ? `${(await Category.findById(parentId).select('path').lean())?.path || ''}/${doc.slug}`
    : doc.slug;
  const nextPath = parentPath.replace(/^\/+/, '');

  let changed = false;
  if (doc.level !== level) {
    doc.level = level;
    changed = true;
  }
  if (doc.order !== order) {
    doc.order = order;
    changed = true;
  }
  if (doc.path !== nextPath) {
    doc.path = nextPath;
    changed = true;
  }
  if (normalizeText(iconKey) && doc.iconKey !== normalizeText(iconKey)) {
    doc.iconKey = normalizeText(iconKey);
    changed = true;
  }
  if (normalizeText(imageUrl) && doc.imageUrl !== normalizeText(imageUrl)) {
    doc.imageUrl = normalizeText(imageUrl);
    changed = true;
  }
  if (normalizeText(description) && doc.description !== normalizeText(description)) {
    doc.description = normalizeText(description);
    changed = true;
  }
  if (Array.isArray(cities) && cities.length && JSON.stringify(doc.cities || []) !== JSON.stringify(cities)) {
    doc.cities = cities;
    changed = true;
  }
  if (doc.isDeleted) {
    doc.isDeleted = false;
    changed = true;
  }
  if (!doc.isActive) {
    doc.isActive = true;
    changed = true;
  }
  if (changed) {
    doc.updatedBy = createdBy || doc.updatedBy;
    await doc.save();
  }

  return { doc, created: false, updated: changed };
};

const seedDefaultTree = async () => {
  const stats = { created: 0, updated: 0 };
  for (let i = 0; i < DEFAULT_CATEGORY_TREE.length; i += 1) {
    const root = DEFAULT_CATEGORY_TREE[i];
    // eslint-disable-next-line no-await-in-loop
    const ensuredRoot = await ensureNode({
      name: root.name,
      slug: root.slug,
      parentId: null,
      level: 0,
      order: i,
      iconKey: root.iconKey || ''
    });
    if (!ensuredRoot?.doc) continue;
    if (ensuredRoot.created) stats.created += 1;
    if (ensuredRoot.updated) stats.updated += 1;

    const children = Array.isArray(root.children) ? root.children : [];
    for (let j = 0; j < children.length; j += 1) {
      const child = children[j];
      // eslint-disable-next-line no-await-in-loop
      const ensuredChild = await ensureNode({
        name: child.name,
        slug: child.slug,
        parentId: ensuredRoot.doc._id,
        level: 1,
        order: j
      });
      if (!ensuredChild?.doc) continue;
      if (ensuredChild.created) stats.created += 1;
      if (ensuredChild.updated) stats.updated += 1;
    }
  }
  return stats;
};

const seedLegacyRootCategories = async () => {
  const legacyValues = await Product.distinct('category', { category: { $type: 'string', $ne: '' } });
  let created = 0;
  let updated = 0;

  for (const rawValue of legacyValues) {
    const label = normalizeText(rawValue);
    if (!label) continue;
    const ensured = await ensureNode({
      name: label,
      slug: slugify(label),
      parentId: null,
      level: 0
    });
    if (!ensured?.doc) continue;
    if (ensured.created) created += 1;
    if (ensured.updated) updated += 1;
  }

  return { created, updated };
};

const buildCategoryLookup = async () => {
  const nodes = await Category.find({ isDeleted: false, isActive: true })
    .select('_id name slug level parentId')
    .lean();

  const rootByKey = new Map();
  const subByKey = new Map();
  const parentBySubId = new Map();

  nodes.forEach((node) => {
    const slugKey = slugify(node.slug || '');
    const nameKey = slugify(node.name || '');
    const keyTargets = [slugKey, nameKey].filter(Boolean);

    if (node.level === 0) {
      keyTargets.forEach((key) => {
        if (!rootByKey.has(key)) rootByKey.set(key, node);
      });
    } else if (node.level === 1) {
      keyTargets.forEach((key) => {
        if (!subByKey.has(key)) subByKey.set(key, node);
      });
      parentBySubId.set(String(node._id), String(node.parentId || ''));
    }
  });

  return { rootByKey, subByKey, parentBySubId };
};

const migrateProducts = async () => {
  const { rootByKey, subByKey, parentBySubId } = await buildCategoryLookup();
  const cursor = Product.find({})
    .select('_id category legacyCategoryName legacySubcategoryName categoryId subcategoryId')
    .cursor();

  const ops = [];
  let scanned = 0;
  let updated = 0;
  let mappedWithIds = 0;

  const flush = async () => {
    if (!ops.length) return;
    const result = await Product.bulkWrite(ops, { ordered: false });
    updated += Number(result.modifiedCount || 0);
    ops.length = 0;
  };

  for await (const product of cursor) {
    scanned += 1;
    const categoryRaw = normalizeText(product.category);
    const legacyCategoryName = normalizeText(product.legacyCategoryName || categoryRaw);
    const legacySubcategoryName = normalizeText(product.legacySubcategoryName || '');
    const subKey = slugify(legacySubcategoryName || categoryRaw);
    const rootKey = slugify(legacyCategoryName || categoryRaw);

    const matchedSub = subByKey.get(subKey) || null;
    const matchedRoot = rootByKey.get(rootKey) || null;

    let nextCategoryId = product.categoryId || null;
    let nextSubcategoryId = product.subcategoryId || null;

    if (matchedSub) {
      nextSubcategoryId = matchedSub._id;
      const parentId = parentBySubId.get(String(matchedSub._id));
      if (parentId && mongoose.isValidObjectId(parentId)) {
        nextCategoryId = new mongoose.Types.ObjectId(parentId);
      }
    } else if (matchedRoot) {
      nextCategoryId = matchedRoot._id;
      nextSubcategoryId = null;
    }

    const hasIdChange =
      String(nextCategoryId || '') !== String(product.categoryId || '') ||
      String(nextSubcategoryId || '') !== String(product.subcategoryId || '');
    const needsLegacyUpdate =
      legacyCategoryName !== normalizeText(product.legacyCategoryName) ||
      legacySubcategoryName !== normalizeText(product.legacySubcategoryName);

    if (!hasIdChange && !needsLegacyUpdate) continue;
    if (nextCategoryId || nextSubcategoryId) mappedWithIds += 1;

    ops.push({
      updateOne: {
        filter: { _id: product._id },
        update: {
          $set: {
            legacyCategoryName,
            legacySubcategoryName,
            categoryId: nextCategoryId,
            subcategoryId: nextSubcategoryId
          }
        }
      }
    });

    if (ops.length >= 500) {
      // eslint-disable-next-line no-await-in-loop
      await flush();
    }
  }

  await flush();

  return { scanned, updated, mappedWithIds };
};

const run = async () => {
  await connectDB();
  console.log('Starting category migration...');

  const defaultStats = await seedDefaultTree();
  const legacyStats = await seedLegacyRootCategories();
  const productStats = await migrateProducts();

  console.log('Category migration completed.');
  console.log({
    defaultTree: defaultStats,
    legacyRoots: legacyStats,
    products: productStats
  });
};

run()
  .catch((error) => {
    console.error('Category migration failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
