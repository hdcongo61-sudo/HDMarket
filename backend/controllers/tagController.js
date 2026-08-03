import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import Product from '../models/productModel.js';
import Tag from '../models/tagModel.js';
import TagAssignment from '../models/tagAssignmentModel.js';
import TagCategory from '../models/tagCategoryModel.js';
import {
  DEFAULT_TAG_CATEGORIES,
  TAG_STATUSES,
  TAG_TYPES,
  TAG_VISIBILITIES,
  normalizeEntityType
} from '../constants/tagConstants.js';
import {
  addEntityTags,
  findRelatedProductsByTags,
  getEntityTags,
  makeError,
  parseTagIds,
  refreshEntityTagProjection,
  refreshUsageMetrics,
  removeEntityTags,
  replaceEntityTags,
  suggestTags,
  updateTagMetric
} from '../services/tagService.js';
import { withVerifiedPublicProductFilter } from '../utils/publicProductVisibility.js';

const ADMIN_ROLES = new Set(['admin', 'founder']);
const isAdmin = (user) => ADMIN_ROLES.has(String(user?.role || '').toLowerCase());
const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const asBoolean = (value, fallback = false) => {
  if (value === undefined) return fallback;
  return ['true', '1', 'yes', 'on'].includes(String(value).toLowerCase());
};
const asBoundedNumber = (value, fallback = 0, max = 100000) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(0, parsed)) : fallback;
};
const normalizeColor = (value, fallback = '#2563EB') => {
  const color = String(value || '').trim().toUpperCase();
  return /^#[0-9A-F]{6}$/.test(color) ? color : fallback;
};
const normalizeDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw makeError('Date de campagne invalide.');
  return date;
};

const serializeTagPayload = (body = {}, { partial = false, seller = false } = {}) => {
  const payload = {};
  const name = String(body.name || '').trim();
  if (!partial || body.name !== undefined) {
    if (name.length < 2 || name.length > 80) throw makeError('Le nom du tag doit contenir entre 2 et 80 caractères.');
    payload.name = name;
  }
  const stringFields = [
    ['description', 1000],
    ['icon', 100],
    ['homepageTitle', 100],
    ['rejectionReason', 500]
  ];
  stringFields.forEach(([field, max]) => {
    if (body[field] !== undefined) payload[field] = String(body[field] || '').trim().slice(0, max);
  });
  if (body.category !== undefined) {
    payload.category = body.category && mongoose.Types.ObjectId.isValid(body.category) ? body.category : null;
  }
  if (body.type !== undefined || !partial) {
    const type = seller ? 'seller' : String(body.type || 'system').toLowerCase();
    if (!TAG_TYPES.includes(type)) throw makeError('Type de tag invalide.');
    payload.type = type;
  }
  if (body.visibility !== undefined || !partial) {
    const visibility = seller ? 'private' : String(body.visibility || 'public').toLowerCase();
    if (!TAG_VISIBILITIES.includes(visibility)) throw makeError('Visibilité de tag invalide.');
    payload.visibility = visibility;
  }
  if (body.status !== undefined || !partial) {
    const status = seller ? 'draft' : String(body.status || 'active').toLowerCase();
    if (!TAG_STATUSES.includes(status)) throw makeError('Statut de tag invalide.');
    payload.status = status;
  }
  if (body.color !== undefined || !partial) payload.color = normalizeColor(body.color);
  if (body.priority !== undefined) payload.priority = asBoundedNumber(body.priority);
  if (body.featured !== undefined) payload.featured = asBoolean(body.featured);
  if (body.aliases !== undefined) {
    const aliases = Array.isArray(body.aliases)
      ? body.aliases
      : String(body.aliases || '').split(',');
    payload.aliases = aliases.map((item) => String(item).trim()).filter(Boolean).slice(0, 30);
  }
  if (body.campaignStartsAt !== undefined) payload.campaignStartsAt = normalizeDate(body.campaignStartsAt);
  if (body.campaignEndsAt !== undefined) payload.campaignEndsAt = normalizeDate(body.campaignEndsAt);
  if (
    payload.campaignStartsAt &&
    payload.campaignEndsAt &&
    payload.campaignEndsAt <= payload.campaignStartsAt
  ) {
    throw makeError('La fin de campagne doit être postérieure à son début.');
  }
  return payload;
};

const requireEntityWriteAccess = async (req) => {
  const entityType = normalizeEntityType(req.params.entityType);
  const entityId = req.params.entityId;
  if (!entityType || !mongoose.Types.ObjectId.isValid(entityId)) throw makeError('Entité invalide.');
  if (isAdmin(req.user)) return { entityType, entityId, publicOnly: false };
  if (entityType === 'product') {
    const product = await Product.findById(entityId).select('user').lean();
    if (!product) throw makeError('Produit introuvable.', 404, 'ENTITY_NOT_FOUND');
    if (String(product.user) !== String(req.user?.id || req.user?._id)) {
      throw makeError('Vous ne pouvez modifier que vos propres produits.', 403, 'TAG_ACCESS_DENIED');
    }
    return { entityType, entityId, publicOnly: true };
  }
  if (entityType === 'shop' && String(entityId) === String(req.user?.id || req.user?._id)) {
    return { entityType, entityId, publicOnly: true };
  }
  throw makeError('Vous n’avez pas accès aux tags de cette entité.', 403, 'TAG_ACCESS_DENIED');
};

export const listPublicTags = asyncHandler(async (req, res) => {
  const { q = '', category, type, featured, limit = 30, page = 1 } = req.query;
  const now = new Date();
  const filter = {
    status: 'active',
    visibility: 'public',
    deletedAt: null,
    $and: [
      { $or: [{ campaignStartsAt: null }, { campaignStartsAt: { $lte: now } }] },
      { $or: [{ campaignEndsAt: null }, { campaignEndsAt: { $gte: now } }] }
    ]
  };
  if (q) {
    const matcher = new RegExp(escapeRegex(String(q).trim()), 'i');
    filter.$and.push({ $or: [{ name: matcher }, { slug: matcher }, { aliases: matcher }] });
  }
  if (category && mongoose.Types.ObjectId.isValid(category)) filter.category = category;
  if (type && TAG_TYPES.includes(String(type))) filter.type = type;
  if (featured !== undefined) filter.featured = asBoolean(featured);
  const pageSize = Math.min(100, Math.max(1, Number(limit) || 30));
  const pageNumber = Math.max(1, Number(page) || 1);
  const [items, total] = await Promise.all([
    Tag.find(filter)
      .populate('category', 'name slug color icon')
      .sort({ featured: -1, priority: -1, popularityScore: -1, name: 1 })
      .skip((pageNumber - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    Tag.countDocuments(filter)
  ]);
  res.json({ items, pagination: { page: pageNumber, limit: pageSize, total, pages: Math.max(1, Math.ceil(total / pageSize)) } });
});

export const getPublicTag = asyncHandler(async (req, res) => {
  const identifier = req.params.identifier;
  const query = mongoose.Types.ObjectId.isValid(identifier) ? { _id: identifier } : { slug: String(identifier).toLowerCase() };
  const tag = await Tag.findOne({ ...query, status: 'active', visibility: 'public', deletedAt: null })
    .populate('category', 'name slug color icon')
    .lean();
  if (!tag) return res.status(404).json({ message: 'Tag introuvable.' });
  res.json(tag);
});

export const getFeaturedTagSections = asyncHandler(async (req, res) => {
  const now = new Date();
  const tags = await Tag.find({
    featured: true,
    status: 'active',
    visibility: 'public',
    deletedAt: null,
    $and: [
      { $or: [{ campaignStartsAt: null }, { campaignStartsAt: { $lte: now } }] },
      { $or: [{ campaignEndsAt: null }, { campaignEndsAt: { $gte: now } }] }
    ]
  })
    .sort({ priority: -1, popularityScore: -1 })
    .limit(Math.min(20, Math.max(1, Number(req.query.limit) || 8)))
    .lean();
  const sections = await Promise.all(
    tags.map(async (tag) => {
      const productFilter = await withVerifiedPublicProductFilter({ status: 'approved', tags: tag._id });
      return {
        tag,
        products: await Product.find(productFilter)
        .populate('user', 'name shopName shopLogo shopVerified slug')
        .sort({ boosted: -1, salesCount: -1, createdAt: -1 })
        .limit(Math.min(30, Math.max(1, Number(req.query.productsPerTag) || 12)))
        .lean()
      };
    })
  );
  res.json(sections);
});

export const getPublicEntityTags = asyncHandler(async (req, res) => {
  const tags = await getEntityTags({
    entityType: req.params.entityType,
    entityId: req.params.entityId,
    publicOnly: true
  });
  res.json(tags);
});

export const trackTagEvent = asyncHandler(async (req, res) => {
  const metricByEvent = { search: 'searchCount', click: 'clickCount', conversion: 'conversionCount' };
  const metric = metricByEvent[String(req.body?.event || '').toLowerCase()];
  if (!metric) return res.status(400).json({ message: 'Événement de tag invalide.' });
  await updateTagMetric(req.params.id, metric);
  res.status(204).send();
});

export const getTagSuggestions = asyncHandler(async (req, res) => {
  const suggestions = await suggestTags({ ...req.body, limit: req.body?.limit });
  res.json({ suggestions, analyzedSignals: ['title', 'description', 'category', 'brand'] });
});

export const requestSellerTag = asyncHandler(async (req, res) => {
  const payload = serializeTagPayload(req.body, { seller: true });
  const duplicate = await Tag.findOne({ normalizedName: payload.name.toLocaleLowerCase('fr'), deletedAt: null }).lean();
  if (duplicate) return res.status(409).json({ message: 'Un tag portant ce nom existe déjà.', tag: duplicate });
  const tag = await Tag.create({ ...payload, createdBy: req.user.id });
  res.status(201).json({ message: 'Tag soumis pour approbation.', tag });
});

export const replaceTagsOnEntity = asyncHandler(async (req, res) => {
  const access = await requireEntityWriteAccess(req);
  const tags = await replaceEntityTags({
    ...access,
    tagIds: req.body?.tagIds,
    source: isAdmin(req.user) ? String(req.body?.source || 'manual') : 'manual',
    assignedBy: req.user.id
  });
  res.json(tags);
});

export const addTagsToEntity = asyncHandler(async (req, res) => {
  const access = await requireEntityWriteAccess(req);
  const tags = await addEntityTags({
    ...access,
    tagIds: req.body?.tagIds,
    source: isAdmin(req.user) ? String(req.body?.source || 'system') : 'manual',
    assignedBy: req.user.id,
    metadata: req.body?.metadata
  });
  res.json(tags);
});

export const removeTagsFromEntity = asyncHandler(async (req, res) => {
  const access = await requireEntityWriteAccess(req);
  const deletedCount = await removeEntityTags({ ...access, tagIds: req.body?.tagIds });
  res.json({ deletedCount });
});

export const getRelatedTaggedProducts = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id).select('tags category city user').lean();
  if (!product) return res.status(404).json({ message: 'Produit introuvable.' });
  const items = await findRelatedProductsByTags(product, { limit: req.query.limit });
  res.json(items);
});

export const listAdminTags = asyncHandler(async (req, res) => {
  const { q = '', type, status, visibility, category, deleted = 'false', limit = 50, page = 1 } = req.query;
  const filter = { deletedAt: asBoolean(deleted) ? { $ne: null } : null };
  if (q) {
    const matcher = new RegExp(escapeRegex(String(q).trim()), 'i');
    filter.$or = [{ name: matcher }, { slug: matcher }, { aliases: matcher }];
  }
  if (type && TAG_TYPES.includes(String(type))) filter.type = type;
  if (status && TAG_STATUSES.includes(String(status))) filter.status = status;
  if (visibility && TAG_VISIBILITIES.includes(String(visibility))) filter.visibility = visibility;
  if (category && mongoose.Types.ObjectId.isValid(category)) filter.category = category;
  const pageSize = Math.min(200, Math.max(1, Number(limit) || 50));
  const pageNumber = Math.max(1, Number(page) || 1);
  const [items, total] = await Promise.all([
    Tag.find(filter)
      .populate('category', 'name slug color')
      .populate('createdBy approvedBy', 'name email role shopName')
      .sort({ createdAt: -1 })
      .skip((pageNumber - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    Tag.countDocuments(filter)
  ]);
  res.json({ items, pagination: { page: pageNumber, limit: pageSize, total, pages: Math.max(1, Math.ceil(total / pageSize)) } });
});

export const createAdminTag = asyncHandler(async (req, res) => {
  const payload = serializeTagPayload(req.body);
  const tag = await Tag.create({ ...payload, createdBy: req.user.id, updatedBy: req.user.id });
  res.status(201).json(tag);
});

export const updateAdminTag = asyncHandler(async (req, res) => {
  const tag = await Tag.findById(req.params.id);
  if (!tag || tag.deletedAt) return res.status(404).json({ message: 'Tag introuvable.' });
  const payload = serializeTagPayload(req.body, { partial: true });
  Object.assign(tag, payload, { updatedBy: req.user.id });
  await tag.save();
  res.json(tag);
});

export const softDeleteTag = asyncHandler(async (req, res) => {
  const tag = await Tag.findByIdAndUpdate(
    req.params.id,
    { $set: { deletedAt: new Date(), status: 'disabled', updatedBy: req.user.id } },
    { new: true }
  );
  if (!tag) return res.status(404).json({ message: 'Tag introuvable.' });
  res.json(tag);
});

export const restoreTag = asyncHandler(async (req, res) => {
  const tag = await Tag.findByIdAndUpdate(
    req.params.id,
    { $set: { deletedAt: null, status: 'draft', updatedBy: req.user.id } },
    { new: true }
  );
  if (!tag) return res.status(404).json({ message: 'Tag introuvable.' });
  res.json(tag);
});

export const reviewSellerTag = asyncHandler(async (req, res) => {
  const approved = asBoolean(req.body?.approved);
  const tag = await Tag.findOne({ _id: req.params.id, type: 'seller', deletedAt: null });
  if (!tag) return res.status(404).json({ message: 'Demande de tag introuvable.' });
  tag.status = approved ? 'active' : 'disabled';
  tag.visibility = approved ? String(req.body?.visibility || 'public') : 'private';
  tag.approvedBy = approved ? req.user.id : null;
  tag.approvedAt = approved ? new Date() : null;
  tag.rejectionReason = approved ? '' : String(req.body?.reason || '').trim().slice(0, 500);
  tag.updatedBy = req.user.id;
  await tag.save();
  res.json(tag);
});

export const mergeTags = asyncHandler(async (req, res) => {
  const sourceId = req.params.id;
  const targetId = String(req.body?.targetTagId || '');
  if (!mongoose.Types.ObjectId.isValid(targetId) || sourceId === targetId) {
    return res.status(400).json({ message: 'Tag cible invalide.' });
  }
  const [source, target, assignments] = await Promise.all([
    Tag.findById(sourceId),
    Tag.findOne({ _id: targetId, deletedAt: null, status: 'active' }),
    TagAssignment.find({ tag: sourceId }).lean()
  ]);
  if (!source || !target) return res.status(404).json({ message: 'Tag source ou cible introuvable.' });
  for (const assignment of assignments) {
    await TagAssignment.updateOne(
      { tag: targetId, entityType: assignment.entityType, entityId: assignment.entityId },
      {
        $setOnInsert: {
          source: assignment.source,
          assignedBy: assignment.assignedBy,
          confidence: assignment.confidence,
          metadata: assignment.metadata
        }
      },
      { upsert: true }
    );
  }
  await TagAssignment.deleteMany({ tag: sourceId });
  source.deletedAt = new Date();
  source.status = 'disabled';
  source.updatedBy = req.user.id;
  source.aliases = Array.from(new Set([...(source.aliases || []), source.name.toLocaleLowerCase('fr')]));
  target.aliases = Array.from(new Set([...(target.aliases || []), source.name.toLocaleLowerCase('fr'), source.slug]));
  target.updatedBy = req.user.id;
  await Promise.all([
    source.save(),
    target.save(),
    ...assignments.map((assignment) => refreshEntityTagProjection(assignment.entityType, assignment.entityId))
  ]);
  await refreshUsageMetrics([sourceId, targetId]);
  res.json({ source, target, migratedAssignments: assignments.length });
});

export const bulkTagAction = asyncHandler(async (req, res) => {
  const ids = parseTagIds(req.body?.ids);
  if (!ids.length || ids.some((id) => !mongoose.Types.ObjectId.isValid(id))) {
    return res.status(400).json({ message: 'Sélection de tags invalide.' });
  }
  const action = String(req.body?.action || '').toLowerCase();
  if (action === 'delete') {
    const result = await Tag.updateMany(
      { _id: { $in: ids } },
      { $set: { deletedAt: new Date(), status: 'disabled', updatedBy: req.user.id } }
    );
    return res.json({ modifiedCount: result.modifiedCount });
  }
  if (action === 'edit') {
    const allowedPatch = serializeTagPayload(req.body?.patch || {}, { partial: true });
    delete allowedPatch.name;
    const result = await Tag.updateMany({ _id: { $in: ids }, deletedAt: null }, { $set: { ...allowedPatch, updatedBy: req.user.id } });
    return res.json({ modifiedCount: result.modifiedCount });
  }
  if (action === 'assign') {
    const entityType = normalizeEntityType(req.body?.entityType);
    const entityIds = parseTagIds(req.body?.entityIds);
    if (!entityType || entityIds.some((id) => !mongoose.Types.ObjectId.isValid(id))) {
      return res.status(400).json({ message: 'Entités cibles invalides.' });
    }
    await Promise.all(
      entityIds.map((entityId) =>
        addEntityTags({ entityType, entityId, tagIds: ids, source: 'system', assignedBy: req.user.id })
      )
    );
    return res.json({ assignedTags: ids.length, entities: entityIds.length });
  }
  return res.status(400).json({ message: 'Action groupée invalide.' });
});

export const importTags = asyncHandler(async (req, res) => {
  const rows = Array.isArray(req.body) ? req.body : req.body?.tags;
  if (!Array.isArray(rows) || !rows.length || rows.length > 1000) {
    return res.status(400).json({ message: 'Fournissez entre 1 et 1000 tags.' });
  }
  const created = [];
  const errors = [];
  for (let index = 0; index < rows.length; index += 1) {
    try {
      const payload = serializeTagPayload(rows[index]);
      const tag = await Tag.create({ ...payload, createdBy: req.user.id, updatedBy: req.user.id });
      created.push(tag);
    } catch (error) {
      errors.push({ row: index + 1, name: rows[index]?.name || '', message: error?.message || 'Import impossible.' });
    }
  }
  res.status(errors.length ? 207 : 201).json({ created: created.length, errors });
});

const csvCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
export const exportTags = asyncHandler(async (req, res) => {
  const tags = await Tag.find({ deletedAt: null }).populate('category', 'name').sort({ name: 1 }).lean();
  const header = ['name', 'slug', 'category', 'type', 'visibility', 'status', 'priority', 'usageCount', 'searchCount', 'clickCount', 'conversionCount'];
  const csv = [
    header.join(','),
    ...tags.map((tag) =>
      [tag.name, tag.slug, tag.category?.name || '', tag.type, tag.visibility, tag.status, tag.priority, tag.usageCount, tag.searchCount, tag.clickCount, tag.conversionCount]
        .map(csvCell)
        .join(',')
    )
  ].join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="hdmarket-tags.csv"');
  res.send(`\uFEFF${csv}`);
});

export const getTagAnalytics = asyncHandler(async (req, res) => {
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
  const base = { deletedAt: null };
  const [mostUsed, trending, mostSearched, highestConversion, totals] = await Promise.all([
    Tag.find(base).sort({ usageCount: -1 }).limit(limit).select('name slug color usageCount type').lean(),
    Tag.find(base).sort({ popularityScore: -1 }).limit(limit).select('name slug color popularityScore usageCount searchCount clickCount').lean(),
    Tag.find(base).sort({ searchCount: -1 }).limit(limit).select('name slug color searchCount').lean(),
    Tag.find(base).sort({ conversionCount: -1 }).limit(limit).select('name slug color conversionCount clickCount').lean(),
    Tag.aggregate([
      { $match: base },
      { $group: { _id: null, tags: { $sum: 1 }, usage: { $sum: '$usageCount' }, searches: { $sum: '$searchCount' }, clicks: { $sum: '$clickCount' }, conversions: { $sum: '$conversionCount' } } }
    ])
  ]);
  res.json({ mostUsed, trending, mostSearched, highestConversion, totals: totals[0] || { tags: 0, usage: 0, searches: 0, clicks: 0, conversions: 0 } });
});

export const listTagCategories = asyncHandler(async (req, res) => {
  const filter = isAdmin(req.user) ? { deletedAt: null } : { deletedAt: null, isActive: true };
  res.json(await TagCategory.find(filter).sort({ order: 1, name: 1 }).lean());
});

export const createTagCategory = asyncHandler(async (req, res) => {
  const name = String(req.body?.name || '').trim();
  if (name.length < 2 || name.length > 80) return res.status(400).json({ message: 'Nom de catégorie invalide.' });
  const category = await TagCategory.create({
    name,
    description: String(req.body?.description || '').trim().slice(0, 500),
    color: normalizeColor(req.body?.color, '#64748B'),
    icon: String(req.body?.icon || '').trim().slice(0, 100),
    order: asBoundedNumber(req.body?.order),
    isActive: req.body?.isActive === undefined ? true : asBoolean(req.body.isActive),
    createdBy: req.user.id,
    updatedBy: req.user.id
  });
  res.status(201).json(category);
});

export const updateTagCategory = asyncHandler(async (req, res) => {
  const category = await TagCategory.findOne({ _id: req.params.id, deletedAt: null });
  if (!category) return res.status(404).json({ message: 'Catégorie de tag introuvable.' });
  if (req.body?.name !== undefined) category.name = String(req.body.name).trim().slice(0, 80);
  if (req.body?.description !== undefined) category.description = String(req.body.description || '').trim().slice(0, 500);
  if (req.body?.color !== undefined) category.color = normalizeColor(req.body.color, category.color);
  if (req.body?.icon !== undefined) category.icon = String(req.body.icon || '').trim().slice(0, 100);
  if (req.body?.order !== undefined) category.order = asBoundedNumber(req.body.order);
  if (req.body?.isActive !== undefined) category.isActive = asBoolean(req.body.isActive);
  category.updatedBy = req.user.id;
  await category.save();
  res.json(category);
});

export const deleteTagCategory = asyncHandler(async (req, res) => {
  const inUse = await Tag.countDocuments({ category: req.params.id, deletedAt: null });
  if (inUse) return res.status(409).json({ message: `Cette catégorie contient encore ${inUse} tag(s).` });
  const category = await TagCategory.findByIdAndUpdate(
    req.params.id,
    { $set: { deletedAt: new Date(), isActive: false, updatedBy: req.user.id } },
    { new: true }
  );
  if (!category) return res.status(404).json({ message: 'Catégorie de tag introuvable.' });
  res.json(category);
});

export const seedDefaultTagCategories = asyncHandler(async (req, res) => {
  let created = 0;
  for (let order = 0; order < DEFAULT_TAG_CATEGORIES.length; order += 1) {
    const name = DEFAULT_TAG_CATEGORIES[order];
    const existing = await TagCategory.findOne({ name, deletedAt: null }).select('_id').lean();
    if (!existing) {
      await TagCategory.create({ name, order, createdBy: req.user.id, updatedBy: req.user.id });
      created += 1;
    }
  }
  res.json({ created, categories: await TagCategory.find({ deletedAt: null }).sort({ order: 1, name: 1 }).lean() });
});
