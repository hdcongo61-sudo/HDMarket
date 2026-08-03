import mongoose from 'mongoose';
import Product from '../models/productModel.js';
import Tag from '../models/tagModel.js';
import TagAssignment from '../models/tagAssignmentModel.js';
import {
  MAX_MANUAL_PRODUCT_TAGS,
  TAG_ASSIGNMENT_SOURCES,
  normalizeEntityType
} from '../constants/tagConstants.js';
import { withVerifiedPublicProductFilter } from '../utils/publicProductVisibility.js';

const makeError = (message, statusCode = 400, code = 'TAG_VALIDATION_ERROR') => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
};

export const parseTagIds = (value) => {
  let candidate = value;
  if (typeof candidate === 'string') {
    const trimmed = candidate.trim();
    if (!trimmed) return [];
    try {
      candidate = JSON.parse(trimmed);
    } catch {
      candidate = trimmed.split(',');
    }
  }
  const list = Array.isArray(candidate) ? candidate : candidate ? [candidate] : [];
  return Array.from(new Set(list.map((item) => String(item?._id || item).trim()).filter(Boolean)));
};

const assertObjectIds = (values, label = 'tag') => {
  const invalid = values.find((value) => !mongoose.Types.ObjectId.isValid(value));
  if (invalid) throw makeError(`Identifiant ${label} invalide: ${invalid}.`);
};

const getUsableTags = async (tagIds, { publicOnly = false } = {}) => {
  assertObjectIds(tagIds);
  const filter = {
    _id: { $in: tagIds },
    status: 'active',
    deletedAt: null
  };
  if (publicOnly) filter.visibility = 'public';
  const tags = await Tag.find(filter).lean();
  if (tags.length !== tagIds.length) {
    throw makeError('Un ou plusieurs tags sont inactifs, supprimés ou non autorisés.', 400, 'TAG_NOT_USABLE');
  }
  return tags;
};

export const validateTagSelection = async (tagIds, options = {}) => {
  const normalizedIds = parseTagIds(tagIds);
  if (normalizedIds.length > MAX_MANUAL_PRODUCT_TAGS && options.enforceManualLimit !== false) {
    throw makeError(`Un produit accepte au maximum ${MAX_MANUAL_PRODUCT_TAGS} tags manuels.`, 400, 'MANUAL_TAG_LIMIT');
  }
  if (!normalizedIds.length) return [];
  const tags = await getUsableTags(normalizedIds, options);
  return tags.map((tag) => tag._id);
};

export const refreshUsageMetrics = async (tagIds) => {
  const uniqueIds = Array.from(new Set(tagIds.map(String))).filter(mongoose.Types.ObjectId.isValid);
  await Promise.all(
    uniqueIds.map(async (tagId) => {
      const usageCount = await TagAssignment.countDocuments({ tag: tagId });
      const tag = await Tag.findById(tagId).select('searchCount clickCount conversionCount');
      if (!tag) return;
      const popularityScore =
        usageCount * 3 +
        Number(tag.searchCount || 0) * 1.5 +
        Number(tag.clickCount || 0) * 2 +
        Number(tag.conversionCount || 0) * 8;
      await Tag.updateOne({ _id: tagId }, { $set: { usageCount, popularityScore } });
    })
  );
};

export const refreshEntityTagProjection = async (entityType, entityId) => {
  const normalizedType = normalizeEntityType(entityType);
  if (normalizedType !== 'product') return;
  const assignments = await TagAssignment.find({ entityType: 'product', entityId }).select('tag').lean();
  const tagIds = assignments.map((item) => item.tag);
  await Product.updateOne({ _id: entityId }, { $set: { tags: tagIds } });
};

export const replaceEntityTags = async ({
  entityType,
  entityId,
  tagIds,
  source = 'manual',
  assignedBy = null,
  publicOnly = false,
  metadata
}) => {
  const normalizedType = normalizeEntityType(entityType);
  const normalizedIds = parseTagIds(tagIds);
  if (!normalizedType) throw makeError('Type d’entité requis.');
  if (!mongoose.Types.ObjectId.isValid(entityId)) throw makeError('Identifiant d’entité invalide.');
  if (!TAG_ASSIGNMENT_SOURCES.includes(source)) throw makeError('Source de tag invalide.');
  if (normalizedType === 'product' && source === 'manual' && normalizedIds.length > MAX_MANUAL_PRODUCT_TAGS) {
    throw makeError(
      `Un produit accepte au maximum ${MAX_MANUAL_PRODUCT_TAGS} tags manuels.`,
      400,
      'MANUAL_TAG_LIMIT'
    );
  }
  if (normalizedIds.length) await getUsableTags(normalizedIds, { publicOnly });

  const existing = await TagAssignment.find({
    entityType: normalizedType,
    entityId,
    source
  })
    .select('_id tag')
    .lean();
  const desired = new Set(normalizedIds);
  const existingByTag = new Map(existing.map((item) => [String(item.tag), item]));
  const removed = existing.filter((item) => !desired.has(String(item.tag)));
  const occupiedByOtherSources = normalizedIds.length
    ? await TagAssignment.find({
        entityType: normalizedType,
        entityId,
        source: { $ne: source },
        tag: { $in: normalizedIds }
      }).select('tag').lean()
    : [];
  const occupiedIds = new Set(occupiedByOtherSources.map((item) => String(item.tag)));
  const addedIds = normalizedIds.filter((tagId) => !existingByTag.has(tagId) && !occupiedIds.has(tagId));

  if (removed.length) {
    await TagAssignment.deleteMany({ _id: { $in: removed.map((item) => item._id) } });
  }
  if (addedIds.length) {
    await TagAssignment.insertMany(
      addedIds.map((tag) => ({
        tag,
        entityType: normalizedType,
        entityId,
        source,
        assignedBy,
        metadata
      })),
      { ordered: false }
    );
  }

  const affectedIds = [...removed.map((item) => item.tag), ...addedIds];
  await Promise.all([
    refreshEntityTagProjection(normalizedType, entityId),
    refreshUsageMetrics(affectedIds)
  ]);
  return getEntityTags({ entityType: normalizedType, entityId, publicOnly: false });
};

export const addEntityTags = async ({
  entityType,
  entityId,
  tagIds,
  source = 'system',
  assignedBy = null,
  publicOnly = false,
  metadata
}) => {
  const normalizedType = normalizeEntityType(entityType);
  const normalizedIds = parseTagIds(tagIds);
  if (!mongoose.Types.ObjectId.isValid(entityId)) throw makeError('Identifiant d’entité invalide.');
  if (!TAG_ASSIGNMENT_SOURCES.includes(source)) throw makeError('Source de tag invalide.');
  if (!normalizedIds.length) return getEntityTags({ entityType: normalizedType, entityId });
  await getUsableTags(normalizedIds, { publicOnly });

  const existing = await TagAssignment.find({
    entityType: normalizedType,
    entityId,
    tag: { $in: normalizedIds }
  })
    .select('tag')
    .lean();
  const existingIds = new Set(existing.map((item) => String(item.tag)));
  const addedIds = normalizedIds.filter((tagId) => !existingIds.has(tagId));
  if (normalizedType === 'product' && source === 'manual') {
    const manualCount = await TagAssignment.countDocuments({ entityType: 'product', entityId, source: 'manual' });
    if (manualCount + addedIds.length > MAX_MANUAL_PRODUCT_TAGS) {
      throw makeError(`Un produit accepte au maximum ${MAX_MANUAL_PRODUCT_TAGS} tags manuels.`, 400, 'MANUAL_TAG_LIMIT');
    }
  }
  if (addedIds.length) {
    await TagAssignment.insertMany(
      addedIds.map((tag) => ({ tag, entityType: normalizedType, entityId, source, assignedBy, metadata })),
      { ordered: false }
    );
  }
  await Promise.all([
    refreshEntityTagProjection(normalizedType, entityId),
    refreshUsageMetrics(addedIds)
  ]);
  return getEntityTags({ entityType: normalizedType, entityId });
};

export const removeEntityTags = async ({ entityType, entityId, tagIds }) => {
  const normalizedType = normalizeEntityType(entityType);
  const normalizedIds = parseTagIds(tagIds);
  assertObjectIds(normalizedIds);
  const result = await TagAssignment.deleteMany({
    entityType: normalizedType,
    entityId,
    tag: { $in: normalizedIds }
  });
  await Promise.all([
    refreshEntityTagProjection(normalizedType, entityId),
    refreshUsageMetrics(normalizedIds)
  ]);
  return result.deletedCount || 0;
};

export const removeAllEntityTags = async ({ entityType, entityId }) => {
  const normalizedType = normalizeEntityType(entityType);
  const assignments = await TagAssignment.find({ entityType: normalizedType, entityId }).select('tag').lean();
  const tagIds = assignments.map((assignment) => assignment.tag);
  if (assignments.length) {
    await TagAssignment.deleteMany({ entityType: normalizedType, entityId });
    await refreshUsageMetrics(tagIds);
  }
  return assignments.length;
};

export const getEntityTags = async ({ entityType, entityId, publicOnly = false }) => {
  const normalizedType = normalizeEntityType(entityType);
  if (!mongoose.Types.ObjectId.isValid(entityId)) throw makeError('Identifiant d’entité invalide.');
  const assignments = await TagAssignment.find({ entityType: normalizedType, entityId })
    .populate({
      path: 'tag',
      match: {
        deletedAt: null,
        status: 'active',
        ...(publicOnly ? { visibility: 'public' } : {})
      },
      select: 'name slug description category type color icon visibility status priority popularityScore featured campaignStartsAt campaignEndsAt'
    })
    .sort({ createdAt: 1 })
    .lean();
  const now = new Date();
  return assignments
    .filter(({ tag }) => {
      if (!tag) return false;
      if (!publicOnly) return true;
      if (tag.campaignStartsAt && new Date(tag.campaignStartsAt) > now) return false;
      if (tag.campaignEndsAt && new Date(tag.campaignEndsAt) < now) return false;
      return true;
    })
    .map(({ tag, source, confidence }) => ({ ...tag, assignmentSource: source, confidence }));
};

export const resolveTagFilter = async (value) => {
  const terms = parseTagIds(value).map((item) => item.toLocaleLowerCase('fr'));
  if (!terms.length) return [];
  const objectIds = terms.filter(mongoose.Types.ObjectId.isValid);
  const slugs = terms.filter((item) => !mongoose.Types.ObjectId.isValid(item));
  const tags = await Tag.find({
    status: 'active',
    visibility: 'public',
    deletedAt: null,
    $or: [{ _id: { $in: objectIds } }, { slug: { $in: slugs } }, { normalizedName: { $in: slugs } }]
  })
    .select('_id')
    .lean();
  return tags.map((tag) => tag._id);
};

const tokenize = (value) =>
  new Set(
    String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('fr')
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length >= 2)
  );

export const suggestTags = async ({ title = '', description = '', category = '', brand = '', limit = 12 }) => {
  const titleTokens = tokenize(title);
  const descriptionTokens = tokenize(description);
  const categoryTokens = tokenize(category);
  const brandTokens = tokenize(brand);
  const allTokens = new Set([...titleTokens, ...descriptionTokens, ...categoryTokens, ...brandTokens]);
  const candidates = await Tag.find({
    status: 'active',
    visibility: 'public',
    deletedAt: null,
    type: { $nin: ['internal', 'beta'] }
  })
    .sort({ popularityScore: -1, priority: -1 })
    .limit(300)
    .lean();

  return candidates
    .map((tag) => {
      const tagTokens = tokenize([tag.name, tag.slug, ...(tag.aliases || [])].join(' '));
      const matched = [...tagTokens].filter((token) => allTokens.has(token));
      let score = 0;
      matched.forEach((token) => {
        if (brandTokens.has(token)) score += 0.45;
        if (titleTokens.has(token)) score += 0.35;
        if (categoryTokens.has(token)) score += 0.25;
        if (descriptionTokens.has(token)) score += 0.12;
      });
      score += Math.min(0.15, Math.log10(Number(tag.popularityScore || 0) + 1) / 30);
      return {
        ...tag,
        confidence: Math.min(0.99, Number(score.toFixed(2))),
        matchedSignals: matched
      };
    })
    .filter((tag) => tag.confidence >= 0.12)
    .sort((a, b) => b.confidence - a.confidence || b.popularityScore - a.popularityScore)
    .slice(0, Math.max(1, Math.min(30, Number(limit) || 12)));
};

export const findRelatedProductsByTags = async (product, { limit = 12, userInterests = [] } = {}) => {
  const tagIds = (product.tags || []).map(String);
  if (!tagIds.length) return [];
  const interestSet = new Set(userInterests.map(String));
  const visibleFilter = await withVerifiedPublicProductFilter({
    _id: { $ne: product._id },
    status: 'approved',
    tags: { $in: tagIds }
  });
  const candidates = await Product.find(visibleFilter)
    .populate('tags', 'name slug color icon visibility status')
    .populate('user', 'name shopName shopLogo shopVerified slug')
    .limit(80)
    .lean();
  return candidates
    .map((candidate) => {
      const candidateTagIds = (candidate.tags || []).map((tag) => String(tag._id || tag));
      const matchingTags = candidateTagIds.filter((tagId) => tagIds.includes(tagId));
      const interestMatches = candidateTagIds.filter((tagId) => interestSet.has(tagId)).length;
      const recommendationScore =
        matchingTags.length * 10 +
        (candidate.category === product.category ? 5 : 0) +
        (candidate.city === product.city ? 3 : 0) +
        (String(candidate.user?._id || candidate.user) === String(product.user?._id || product.user) ? 2 : 0) +
        interestMatches * 4 +
        Math.min(5, Math.log10(Number(candidate.viewsCount || 0) + Number(candidate.salesCount || 0) * 10 + 1));
      return { ...candidate, matchingTagCount: matchingTags.length, recommendationScore };
    })
    .sort((a, b) => b.recommendationScore - a.recommendationScore)
    .slice(0, Math.max(1, Math.min(30, Number(limit) || 12)));
};

export const updateTagMetric = async (tagId, metric, amount = 1) => {
  const allowed = new Set(['searchCount', 'clickCount', 'conversionCount']);
  if (!mongoose.Types.ObjectId.isValid(tagId) || !allowed.has(metric)) throw makeError('Métrique de tag invalide.');
  await Tag.updateOne({ _id: tagId, deletedAt: null }, { $inc: { [metric]: Math.max(1, Number(amount) || 1) } });
  await refreshUsageMetrics([tagId]);
};

export { makeError };
