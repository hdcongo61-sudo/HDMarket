import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import Category from '../models/categoryModel.js';
import CategoryAuditLog from '../models/categoryAuditLogModel.js';
import Product from '../models/productModel.js';
import { invalidateCategoryCache } from '../utils/cache.js';

const normalizeValue = (value = '') => String(value || '').trim();
const normalizeCountry = (value = '') => normalizeValue(value).toUpperCase();

const slugify = (value = '') =>
  normalizeValue(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

const toObjectId = (value) => {
  if (!value) return null;
  if (value instanceof mongoose.Types.ObjectId) return value;
  if (mongoose.Types.ObjectId.isValid(value)) return new mongoose.Types.ObjectId(value);
  return null;
};

const cleanCities = (cities) =>
  Array.isArray(cities)
    ? Array.from(
        new Set(
          cities
            .map((city) => normalizeValue(city))
            .filter(Boolean)
        )
      )
    : [];

const getClientMeta = (req) => ({
  ip: req.ip,
  userAgent: req.get('user-agent') || ''
});

const logAudit = async ({
  actorId,
  action,
  entityId = null,
  before = null,
  after = null,
  meta = {}
}) => {
  await CategoryAuditLog.create({
    actorId,
    action,
    entityType: 'Category',
    entityId,
    before,
    after,
    meta
  });
};

const isValidForScope = (node, country, city) => {
  if (country) {
    const nodeCountry = normalizeCountry(node.country || '');
    const requestedCountry = normalizeCountry(country);
    if (nodeCountry && nodeCountry !== requestedCountry) return false;
  }
  if (city) {
    const cities = Array.isArray(node.cities) ? node.cities : [];
    if (cities.length > 0 && !cities.includes(city)) return false;
  }
  return true;
};

const buildTree = (nodes, usageMap = new Map()) => {
  const map = new Map();
  nodes.forEach((node) => {
    map.set(String(node._id), {
      id: String(node._id),
      _id: node._id,
      name: node.name,
      slug: node.slug,
      parentId: node.parentId ? String(node.parentId) : null,
      level: node.level,
      order: node.order,
      path: node.path,
      isActive: Boolean(node.isActive),
      isDeleted: Boolean(node.isDeleted),
      iconKey: node.iconKey || '',
      imageUrl: node.imageUrl || '',
      description: node.description || '',
      country: node.country || '',
      cities: Array.isArray(node.cities) ? node.cities : [],
      directUsedByProducts: Number(usageMap.get(String(node._id)) || 0),
      usedByProducts: Number(usageMap.get(String(node._id)) || 0),
      createdAt: node.createdAt,
      updatedAt: node.updatedAt,
      children: []
    });
  });

  const roots = [];
  map.forEach((node) => {
    if (!node.parentId) {
      roots.push(node);
      return;
    }
    const parent = map.get(node.parentId);
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  });

  const sortNodes = (list) => {
    list.sort((a, b) => (a.order !== b.order ? a.order - b.order : a.name.localeCompare(b.name)));
    list.forEach((item) => sortNodes(item.children));
  };
  sortNodes(roots);

  const computeSubtreeUsage = (node) => {
    if (!node.children.length) return node.usedByProducts;
    const childTotal = node.children.reduce((sum, child) => sum + computeSubtreeUsage(child), 0);
    node.usedByProducts += childTotal;
    return node.usedByProducts;
  };
  roots.forEach((root) => computeSubtreeUsage(root));

  return roots;
};

const getTreeFilter = ({ includeDeleted = false, includeInactive = true }) => {
  const filter = {};
  if (!includeDeleted) filter.isDeleted = false;
  if (!includeInactive) filter.isActive = true;
  return filter;
};

const getCategoryUsageMap = async (nodes = []) => {
  if (!nodes.length) return new Map();
  const nodeIds = nodes.map((node) => node._id);
  const slugToNodeId = new Map();
  const nameToNodeId = new Map();

  nodes.forEach((node) => {
    slugToNodeId.set(String(node.slug || '').toLowerCase(), String(node._id));
    nameToNodeId.set(String(node.name || '').toLowerCase(), String(node._id));
  });

  const [categoryRefs, subcategoryRefs, legacyRefs] = await Promise.all([
    Product.aggregate([
      { $match: { categoryId: { $in: nodeIds } } },
      { $group: { _id: '$categoryId', count: { $sum: 1 } } }
    ]),
    Product.aggregate([
      { $match: { subcategoryId: { $in: nodeIds } } },
      { $group: { _id: '$subcategoryId', count: { $sum: 1 } } }
    ]),
    Product.aggregate([
      { $match: { category: { $type: 'string', $ne: '' } } },
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ])
  ]);

  const usage = new Map();
  const addUsage = (id, count) => {
    const key = String(id);
    usage.set(key, Number(usage.get(key) || 0) + Number(count || 0));
  };

  categoryRefs.forEach((entry) => addUsage(entry._id, entry.count));
  subcategoryRefs.forEach((entry) => addUsage(entry._id, entry.count));
  legacyRefs.forEach((entry) => {
    const legacyKey = String(entry._id || '').trim().toLowerCase();
    const matchId = slugToNodeId.get(legacyKey) || nameToNodeId.get(legacyKey);
    if (matchId) addUsage(matchId, entry.count);
  });

  return usage;
};

const ensureUniqueSlug = async ({ name, slug, country, excludeId = null }) => {
  const source = slugify(slug || name || '');
  if (!source) return '';
  let suffix = 1;
  let candidate = source;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const exists = await Category.findOne({
      _id: excludeId ? { $ne: excludeId } : { $exists: true },
      country: country || '',
      slug: candidate,
      isDeleted: false
    })
      .select('_id')
      .lean();
    if (!exists) return candidate;
    suffix += 1;
    candidate = `${source}-${suffix}`;
  }
};

const ensureNoDuplicateName = async ({ name, parentId, country, excludeId = null }) => {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const duplicate = await Category.findOne({
    _id: excludeId ? { $ne: excludeId } : { $exists: true },
    parentId: parentId || null,
    country: country || '',
    name: new RegExp(`^${escaped}$`, 'i'),
    isDeleted: false
  })
    .select('_id')
    .lean();
  return Boolean(duplicate);
};

const computePath = (parentPath, slug) => (parentPath ? `${parentPath}/${slug}` : slug);

const getNodeWithParent = async (id) =>
  Category.findById(id)
    .populate('parentId', 'name level path')
    .lean();

const applySearchFilter = (tree, search) => {
  if (!search) return tree;
  const matcher = search.toLowerCase();
  const walk = (node) => {
    const selfMatch =
      node.name.toLowerCase().includes(matcher) ||
      node.slug.toLowerCase().includes(matcher) ||
      node.path.toLowerCase().includes(matcher);
    const childMatches = node.children.map(walk).filter(Boolean);
    if (selfMatch || childMatches.length) {
      return { ...node, children: childMatches };
    }
    return null;
  };
  return tree.map(walk).filter(Boolean);
};

const toAdminCategoryPayload = async ({ includeDeleted, includeInactive, country, city, search }) => {
  const filter = getTreeFilter({ includeDeleted, includeInactive });
  if (country) {
    const normalized = normalizeCountry(country);
    filter.$or = [{ country: '' }, { country: normalized }];
  }

  const nodes = await Category.find(filter)
    .sort({ level: 1, parentId: 1, order: 1, name: 1 })
    .lean();

  const usageMap = await getCategoryUsageMap(nodes);
  const tree = buildTree(nodes, usageMap);
  const availabilityFiltered = city
    ? tree.filter((node) => isValidForScope(node, country, city))
    : tree;
  const searched = applySearchFilter(availabilityFiltered, search);

  return {
    tree: searched,
    totalNodes: nodes.length
  };
};

const toPublicCategoryPayload = async ({ country, city, includeInactive }) => {
  const filter = getTreeFilter({ includeDeleted: false, includeInactive });
  if (country) {
    const normalized = normalizeCountry(country);
    filter.$or = [{ country: '' }, { country: normalized }];
  }
  const nodes = await Category.find(filter).sort({ level: 1, parentId: 1, order: 1, name: 1 }).lean();
  const usageMap = await getCategoryUsageMap(nodes);
  const tree = buildTree(nodes, usageMap)
    .filter((node) => isValidForScope(node, country, city))
    .map((node) => ({
      ...node,
      children: node.children.filter((child) => isValidForScope(child, country, city))
    }));

  return { tree };
};

export const getPublicCategoryTree = asyncHandler(async (req, res) => {
  const includeInactive = req.query.includeInactive === true || req.query.includeInactive === 'true';
  const country = normalizeCountry(req.query.country || '');
  const city = normalizeValue(req.query.city || '');
  const payload = await toPublicCategoryPayload({ includeInactive, country, city });
  res.json(payload);
});

export const getAdminCategoryTree = asyncHandler(async (req, res) => {
  const includeInactive = req.query.includeInactive === true || req.query.includeInactive === 'true';
  const includeDeleted = req.query.includeDeleted === true || req.query.includeDeleted === 'true';
  const country = normalizeCountry(req.query.country || '');
  const city = normalizeValue(req.query.city || '');
  const search = normalizeValue(req.query.search || '');
  const payload = await toAdminCategoryPayload({
    includeDeleted,
    includeInactive,
    country,
    city,
    search
  });
  res.json(payload);
});

export const createCategoryAdmin = asyncHandler(async (req, res) => {
  const name = normalizeValue(req.body.name);
  const country = normalizeCountry(req.body.country || '');
  const parentId = toObjectId(req.body.parentId);
  const cities = cleanCities(req.body.cities);
  const iconKey = normalizeValue(req.body.iconKey);
  const imageUrl = normalizeValue(req.body.imageUrl);
  const description = normalizeValue(req.body.description);
  const isActive = req.body.isActive !== false;
  const order = Number.isFinite(Number(req.body.order)) ? Number(req.body.order) : 0;

  let parent = null;
  let level = 0;
  let parentPath = '';
  if (parentId) {
    parent = await Category.findById(parentId).lean();
    if (!parent || parent.isDeleted) {
      return res.status(404).json({ message: 'Catégorie parente introuvable.' });
    }
    if (parent.level !== 0) {
      return res.status(400).json({ message: 'Seules les catégories de niveau 0 peuvent avoir des sous-catégories.' });
    }
    level = 1;
    parentPath = parent.path;
  }

  const hasDuplicate = await ensureNoDuplicateName({
    name,
    parentId,
    country
  });
  if (hasDuplicate) {
    return res.status(409).json({ message: 'Une catégorie avec ce nom existe déjà dans ce niveau.' });
  }

  const slug = await ensureUniqueSlug({
    name,
    slug: req.body.slug,
    parentId,
    country
  });
  const path = computePath(parentPath, slug);

  const created = await Category.create({
    name,
    slug,
    parentId,
    level,
    order,
    path,
    isActive,
    isDeleted: false,
    iconKey,
    imageUrl,
    description,
    country,
    cities,
    createdBy: req.user.id,
    updatedBy: req.user.id
  });

  await logAudit({
    actorId: req.user.id,
    action: 'CREATE',
    entityId: created._id,
    before: null,
    after: created.toObject(),
    meta: getClientMeta(req)
  });
  invalidateCategoryCache();

  res.status(201).json({
    message: 'Catégorie créée.',
    category: created
  });
});

const updateChildrenPathsForRoot = async (rootCategory) => {
  if (!rootCategory || rootCategory.level !== 0) return;
  const children = await Category.find({ parentId: rootCategory._id }).lean();
  if (!children.length) return;

  const operations = children.map((child) => ({
    updateOne: {
      filter: { _id: child._id },
      update: { $set: { path: computePath(rootCategory.path, child.slug) } }
    }
  }));
  await Category.bulkWrite(operations);
};

export const updateCategoryAdmin = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) {
    return res.status(404).json({ message: 'Catégorie introuvable.' });
  }

  const before = category.toObject();
  const nextName = req.body.name !== undefined ? normalizeValue(req.body.name) : category.name;
  const nextCountry =
    req.body.country !== undefined ? normalizeCountry(req.body.country || '') : normalizeCountry(category.country || '');
  const requestedParentId =
    req.body.parentId !== undefined ? toObjectId(req.body.parentId) : category.parentId;
  const cities = req.body.cities !== undefined ? cleanCities(req.body.cities) : category.cities;

  if (requestedParentId && String(requestedParentId) === String(category._id)) {
    return res.status(400).json({ message: 'Une catégorie ne peut pas être son propre parent.' });
  }

  let parent = null;
  let nextLevel = 0;
  let parentPath = '';
  if (requestedParentId) {
    parent = await Category.findById(requestedParentId).lean();
    if (!parent || parent.isDeleted) {
      return res.status(404).json({ message: 'Catégorie parente introuvable.' });
    }
    if (parent.level !== 0) {
      return res.status(400).json({ message: 'Le parent doit être une catégorie principale.' });
    }
    if (category.level === 0) {
      const childCount = await Category.countDocuments({ parentId: category._id, isDeleted: false });
      if (childCount > 0) {
        return res
          .status(400)
          .json({ message: 'Déplacement refusé: une catégorie avec sous-catégories ne peut pas devenir sous-catégorie.' });
      }
    }
    nextLevel = 1;
    parentPath = parent.path;
  }

  const duplicate = await ensureNoDuplicateName({
    name: nextName,
    parentId: requestedParentId,
    country: nextCountry,
    excludeId: category._id
  });
  if (duplicate) {
    return res.status(409).json({ message: 'Une catégorie avec ce nom existe déjà dans ce niveau.' });
  }

  let slug = category.slug;
  if (
    req.body.slug !== undefined ||
    nextName !== category.name ||
    String(requestedParentId || '') !== String(category.parentId || '') ||
    nextCountry !== normalizeCountry(category.country || '')
  ) {
    slug = await ensureUniqueSlug({
      name: nextName,
      slug: req.body.slug,
      parentId: requestedParentId,
      country: nextCountry,
      excludeId: category._id
    });
  }

  category.name = nextName;
  category.slug = slug;
  category.parentId = requestedParentId;
  category.level = nextLevel;
  category.order = req.body.order !== undefined ? Number(req.body.order) : category.order;
  category.path = computePath(parentPath, slug);
  if (req.body.isActive !== undefined) category.isActive = Boolean(req.body.isActive);
  if (req.body.iconKey !== undefined) category.iconKey = normalizeValue(req.body.iconKey);
  if (req.body.imageUrl !== undefined) category.imageUrl = normalizeValue(req.body.imageUrl);
  if (req.body.description !== undefined) category.description = normalizeValue(req.body.description);
  if (req.body.country !== undefined) category.country = nextCountry;
  if (req.body.cities !== undefined) category.cities = cities;
  category.updatedBy = req.user.id;

  await category.save();
  if (category.level === 0) {
    await updateChildrenPathsForRoot(category.toObject());
  }

  const after = await getNodeWithParent(category._id);
  await logAudit({
    actorId: req.user.id,
    action: 'UPDATE',
    entityId: category._id,
    before,
    after,
    meta: {
      ...getClientMeta(req),
      reason: normalizeValue(req.body.reason)
    }
  });
  invalidateCategoryCache();

  res.json({
    message: 'Catégorie mise à jour.',
    category: after
  });
});

const getDescendantIds = async (id) => {
  const [result] = await Category.aggregate([
    { $match: { _id: toObjectId(id) } },
    {
      $graphLookup: {
        from: 'categories',
        startWith: '$_id',
        connectFromField: '_id',
        connectToField: 'parentId',
        as: 'descendants'
      }
    },
    { $project: { ids: '$descendants._id' } }
  ]);
  const ids = (result?.ids || []).map((item) => toObjectId(item)).filter(Boolean);
  ids.push(toObjectId(id));
  return ids;
};

const countProductsByCategoryIds = async (categoryIds = []) => {
  if (!categoryIds.length) return 0;
  return Product.countDocuments({
    $or: [{ categoryId: { $in: categoryIds } }, { subcategoryId: { $in: categoryIds } }]
  });
};

const resolveTargetCategoryPayload = async (targetId) => {
  const target = await Category.findById(targetId).lean();
  if (!target || target.isDeleted) return null;
  if (target.level === 1 && !target.parentId) return null;
  if (target.level === 1) {
    return {
      categoryId: target.parentId,
      subcategoryId: target._id,
      category: target.slug
    };
  }
  return {
    categoryId: target._id,
    subcategoryId: null,
    category: target.slug
  };
};

const executeProductReassignment = async ({ sourceId, targetId, includeChildren = true }) => {
  const sourceNode = await Category.findById(sourceId).lean();
  if (!sourceNode) {
    return { error: 'Catégorie source introuvable.', status: 404 };
  }

  const sourceIds = includeChildren ? await getDescendantIds(sourceId) : [sourceId];
  const targetPayload = await resolveTargetCategoryPayload(targetId);
  if (!targetPayload) {
    return { error: 'Catégorie cible introuvable.', status: 404 };
  }

  const result = await Product.updateMany(
    {
      $or: [{ categoryId: { $in: sourceIds } }, { subcategoryId: { $in: sourceIds } }]
    },
    [
      {
        $set: {
          legacyCategoryName: { $ifNull: ['$legacyCategoryName', '$category'] },
          categoryId: targetPayload.categoryId,
          subcategoryId: targetPayload.subcategoryId,
          category: targetPayload.category
        }
      }
    ]
  );

  return { result, sourceIds, targetPayload };
};

export const reassignCategoryProductsAdmin = asyncHandler(async (req, res) => {
  const sourceId = toObjectId(req.body.sourceId);
  const targetId = toObjectId(req.body.targetId);
  if (!sourceId || !targetId) {
    return res.status(400).json({ message: 'Catégorie source ou cible invalide.' });
  }
  if (String(sourceId) === String(targetId)) {
    return res.status(400).json({ message: 'La source et la cible doivent être différentes.' });
  }

  const includeChildren = req.body.includeChildren !== false;
  const reassignment = await executeProductReassignment({
    sourceId,
    targetId,
    includeChildren
  });
  if (reassignment.error) {
    return res.status(reassignment.status || 400).json({ message: reassignment.error });
  }
  const { result } = reassignment;

  await logAudit({
    actorId: req.user.id,
    action: 'REASSIGN',
    entityId: sourceId,
    before: { sourceId, includeChildren },
    after: { targetId, matched: result.matchedCount, modified: result.modifiedCount },
    meta: {
      ...getClientMeta(req),
      reason: normalizeValue(req.body.reason)
    }
  });
  invalidateCategoryCache();

  res.json({
    message: 'Produits réaffectés.',
    matched: result.matchedCount,
    modified: result.modifiedCount
  });
});

export const softDeleteCategoryAdmin = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id).lean();
  if (!category) {
    return res.status(404).json({ message: 'Catégorie introuvable.' });
  }
  if (category.isDeleted) {
    return res.status(400).json({ message: 'Cette catégorie est déjà supprimée.' });
  }

  const force = Boolean(req.body.force);
  const ids = await getDescendantIds(category._id);
  const inUseCount = await countProductsByCategoryIds(ids);

  if (inUseCount > 0 && !force) {
    return res.status(409).json({
      message: 'Des produits utilisent encore cette catégorie. Réassignez-les avant suppression.',
      usedByProducts: inUseCount
    });
  }

  if (inUseCount > 0 && force && req.body.reassignTargetId) {
    const reassignment = await executeProductReassignment({
      sourceId: category._id,
      targetId: toObjectId(req.body.reassignTargetId),
      includeChildren: true
    });
    if (reassignment.error) {
      return res.status(reassignment.status || 400).json({ message: reassignment.error });
    }
  }

  const before = await Category.find({ _id: { $in: ids } }).lean();
  await Category.updateMany(
    { _id: { $in: ids } },
    {
      $set: {
        isDeleted: true,
        isActive: false,
        updatedBy: req.user.id
      }
    }
  );
  const after = await Category.find({ _id: { $in: ids } }).lean();

  await logAudit({
    actorId: req.user.id,
    action: 'SOFT_DELETE',
    entityId: category._id,
    before,
    after,
    meta: {
      ...getClientMeta(req),
      usedByProducts: inUseCount,
      force,
      reason: normalizeValue(req.body.reason)
    }
  });
  invalidateCategoryCache();

  res.json({
    message: 'Catégorie supprimée (soft delete).',
    usedByProducts: inUseCount
  });
});

export const restoreCategoryAdmin = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id).lean();
  if (!category) return res.status(404).json({ message: 'Catégorie introuvable.' });
  if (!category.isDeleted) {
    return res.status(400).json({ message: 'Cette catégorie est déjà active.' });
  }

  const ids = await getDescendantIds(category._id);
  const before = await Category.find({ _id: { $in: ids } }).lean();
  await Category.updateMany(
    { _id: { $in: ids } },
    {
      $set: {
        isDeleted: false,
        updatedBy: req.user.id
      }
    }
  );
  const after = await Category.find({ _id: { $in: ids } }).lean();

  await logAudit({
    actorId: req.user.id,
    action: 'RESTORE',
    entityId: category._id,
    before,
    after,
    meta: {
      ...getClientMeta(req),
      reason: normalizeValue(req.body.reason)
    }
  });
  invalidateCategoryCache();

  res.json({ message: 'Catégorie restaurée.' });
});

export const reorderCategoriesAdmin = asyncHandler(async (req, res) => {
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  if (!items.length) return res.status(400).json({ message: 'Aucun élément à réordonner.' });
  const allowParentChange = Boolean(req.body.allowParentChange);
  const ids = items.map((item) => toObjectId(item.id)).filter(Boolean);

  const categories = await Category.find({ _id: { $in: ids } }).lean();
  if (categories.length !== ids.length) {
    return res.status(404).json({ message: 'Une ou plusieurs catégories sont introuvables.' });
  }

  const categoryMap = new Map(categories.map((item) => [String(item._id), item]));
  const before = categories;

  const updates = [];
  for (const item of items) {
    const current = categoryMap.get(String(item.id));
    if (!current) continue;
    const nextParentId = toObjectId(item.parentId);
    const parentChanged = String(nextParentId || '') !== String(current.parentId || '');
    if (parentChanged && !allowParentChange) {
      return res.status(400).json({
        message: 'Le changement de parent est bloqué. Activez allowParentChange pour confirmer.'
      });
    }
    if (parentChanged) {
      if (current.level === 0) {
        return res.status(400).json({ message: 'Une catégorie principale ne peut pas devenir sous-catégorie via ce mode.' });
      }
      if (nextParentId) {
        const parent = await Category.findById(nextParentId).lean();
        if (!parent || parent.level !== 0) {
          return res.status(400).json({ message: 'Parent invalide pour cette sous-catégorie.' });
        }
      }
    }

    updates.push({
      updateOne: {
        filter: { _id: current._id },
        update: {
          $set: {
            parentId: nextParentId,
            order: Number(item.order),
            path: nextParentId
              ? computePath(
                  (await Category.findById(nextParentId).select('path').lean())?.path || '',
                  current.slug
                )
              : current.slug,
            updatedBy: req.user.id
          }
        }
      }
    });
  }

  if (updates.length) {
    await Category.bulkWrite(updates);
  }
  const after = await Category.find({ _id: { $in: ids } }).lean();
  await logAudit({
    actorId: req.user.id,
    action: 'REORDER',
    entityId: null,
    before,
    after,
    meta: {
      ...getClientMeta(req),
      allowParentChange
    }
  });
  invalidateCategoryCache();

  res.json({ message: 'Ordre des catégories mis à jour.' });
});

const flattenImportNodes = (nodes = [], parentTempKey = null, level = 0, bucket = [], pathPrefix = '') => {
  nodes.forEach((node, index) => {
    const name = normalizeValue(node.name);
    const slug = normalizeValue(node.slug) || slugify(name);
    const tempKey = `${parentTempKey || 'root'}:${slug}:${index}`;
    const path = pathPrefix ? `${pathPrefix}/${slug}` : slug;
    bucket.push({
      tempKey,
      parentTempKey,
      name,
      slug,
      level,
      order: Number(node.order ?? index),
      iconKey: normalizeValue(node.iconKey),
      imageUrl: normalizeValue(node.imageUrl),
      description: normalizeValue(node.description),
      country: normalizeCountry(node.country || ''),
      cities: cleanCities(node.cities),
      isActive: node.isActive !== false,
      path
    });
    const children = Array.isArray(node.children) ? node.children : [];
    if (children.length && level < 1) {
      flattenImportNodes(children, tempKey, 1, bucket, path);
    }
  });
  return bucket;
};

export const importCategoriesAdmin = asyncHandler(async (req, res) => {
  const dryRun = req.query.dryRun === true || req.query.dryRun === 'true';
  const sourceTree = Array.isArray(req.body.tree) ? req.body.tree : req.body.nodes;
  const flat = flattenImportNodes(sourceTree);

  const diff = {
    added: [],
    updated: [],
    skipped: [],
    conflicts: []
  };

  const tempToReal = new Map();

  for (const item of flat) {
    const parentId = item.parentTempKey ? tempToReal.get(item.parentTempKey) || null : null;
    const existing = await Category.findOne({
      parentId,
      country: item.country || '',
      slug: item.slug
    }).lean();

    if (!existing) {
      diff.added.push({ slug: item.slug, name: item.name, parentId });
      if (!dryRun) {
        const created = await Category.create({
          name: item.name,
          slug: item.slug,
          parentId,
          level: item.level,
          order: item.order,
          path: item.path,
          iconKey: item.iconKey,
          imageUrl: item.imageUrl,
          description: item.description,
          country: item.country,
          cities: item.cities,
          isActive: item.isActive,
          isDeleted: false,
          createdBy: req.user.id,
          updatedBy: req.user.id
        });
        tempToReal.set(item.tempKey, created._id);
      }
      continue;
    }

    tempToReal.set(item.tempKey, existing._id);
    const changed =
      existing.name !== item.name ||
      existing.order !== item.order ||
      existing.iconKey !== item.iconKey ||
      existing.imageUrl !== item.imageUrl ||
      existing.description !== item.description ||
      Boolean(existing.isActive) !== Boolean(item.isActive) ||
      normalizeCountry(existing.country || '') !== normalizeCountry(item.country || '') ||
      JSON.stringify(existing.cities || []) !== JSON.stringify(item.cities || []);

    if (!changed) {
      diff.skipped.push({ id: String(existing._id), slug: existing.slug });
      continue;
    }

    diff.updated.push({ id: String(existing._id), slug: existing.slug, name: item.name });
    if (!dryRun) {
      await Category.updateOne(
        { _id: existing._id },
        {
          $set: {
            name: item.name,
            order: item.order,
            iconKey: item.iconKey,
            imageUrl: item.imageUrl,
            description: item.description,
            isActive: item.isActive,
            country: item.country,
            cities: item.cities,
            updatedBy: req.user.id
          }
        }
      );
    }
  }

  if (!dryRun) {
    await logAudit({
      actorId: req.user.id,
      action: 'IMPORT',
      entityId: null,
      before: null,
      after: diff,
      meta: {
        ...getClientMeta(req),
        dryRun: false
      }
    });
    invalidateCategoryCache();
  }

  res.json({
    dryRun,
    summary: {
      added: diff.added.length,
      updated: diff.updated.length,
      skipped: diff.skipped.length,
      conflicts: diff.conflicts.length
    },
    diff
  });
});

export const exportCategoriesAdmin = asyncHandler(async (req, res) => {
  const format = req.query.format || 'json';
  const country = normalizeCountry(req.query.country || '');
  const includeDeleted = req.query.includeDeleted === true || req.query.includeDeleted === 'true';
  const filter = getTreeFilter({ includeDeleted, includeInactive: true });
  if (country) filter.$or = [{ country: '' }, { country }];

  const nodes = await Category.find(filter).sort({ level: 1, parentId: 1, order: 1, name: 1 }).lean();
  const tree = buildTree(nodes);

  if (format === 'csv') {
    const rows = [
      'id,name,slug,parentId,level,order,path,isActive,isDeleted,country,cities,iconKey,imageUrl,description'
    ];
    nodes.forEach((node) => {
      const cols = [
        String(node._id),
        node.name,
        node.slug,
        node.parentId ? String(node.parentId) : '',
        node.level,
        node.order,
        node.path,
        node.isActive ? 'true' : 'false',
        node.isDeleted ? 'true' : 'false',
        node.country || '',
        (node.cities || []).join('|'),
        node.iconKey || '',
        node.imageUrl || '',
        (node.description || '').replace(/\n/g, ' ')
      ].map((value) => `"${String(value).replace(/"/g, '""')}"`);
      rows.push(cols.join(','));
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="categories-export.csv"');
    return res.send(rows.join('\n'));
  }

  return res.json({
    exportedAt: new Date().toISOString(),
    total: nodes.length,
    tree
  });
});

export const getCategoryAuditAdmin = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const skip = (page - 1) * limit;

  const filter = {};
  if (req.query.entityId) filter.entityId = req.query.entityId;
  if (req.query.action) filter.action = req.query.action;
  if (req.query.from || req.query.to) {
    filter.createdAt = {};
    if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
    if (req.query.to) filter.createdAt.$lte = new Date(req.query.to);
  }

  const [items, total] = await Promise.all([
    CategoryAuditLog.find(filter)
      .populate('actorId', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    CategoryAuditLog.countDocuments(filter)
  ]);

  res.json({
    items,
    pagination: {
      page,
      limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit))
    }
  });
});
