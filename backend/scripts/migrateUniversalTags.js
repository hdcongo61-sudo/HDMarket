import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import Product from '../models/productModel.js';
import Tag from '../models/tagModel.js';
import TagCategory from '../models/tagCategoryModel.js';
import { DEFAULT_TAG_CATEGORIES } from '../constants/tagConstants.js';
import { addEntityTags } from '../services/tagService.js';

const dryRun = process.argv.includes('--dry-run');

await connectDB();

try {
  const categoriesByName = new Map();
  for (let index = 0; index < DEFAULT_TAG_CATEGORIES.length; index += 1) {
    const name = DEFAULT_TAG_CATEGORIES[index];
    let category = await TagCategory.findOne({ name, deletedAt: null });
    if (!category && !dryRun) {
      category = await TagCategory.create({ name, order: index });
    }
    if (category) categoriesByName.set(name, category);
  }

  const customCategory = categoriesByName.get('Custom') || null;
  const marketplaceCategory = categoriesByName.get('Marketplace') || customCategory;
  const tagCache = new Map();
  let productsScanned = 0;
  let assignmentsCreated = 0;

  const resolveTag = async (name, category = customCategory) => {
    const normalizedName = String(name || '').trim().toLocaleLowerCase('fr');
    if (!normalizedName) return null;
    if (tagCache.has(normalizedName)) return tagCache.get(normalizedName);
    let tag = await Tag.findOne({ normalizedName, deletedAt: null });
    if (!tag && !dryRun) {
      tag = await Tag.create({
        name: String(name).trim().slice(0, 80),
        category: category?._id || null,
        type: 'system',
        visibility: 'public',
        status: 'active',
        color: '#64748B'
      });
    }
    tagCache.set(normalizedName, tag);
    return tag;
  };

  const cursor = Product.find({}).select('_id category legacyCategoryName brand condition city tags').cursor();
  for await (const product of cursor) {
    productsScanned += 1;
    const candidates = [
      { name: product.legacyCategoryName || product.category, category: marketplaceCategory },
      { name: product.brand, category: customCategory },
      { name: product.condition === 'new' ? 'Neuf' : 'Occasion', category: marketplaceCategory },
      { name: product.city, category: marketplaceCategory }
    ].filter(({ name }) => String(name || '').trim());
    const resolved = [];
    for (const candidate of candidates) {
      const tag = await resolveTag(candidate.name, candidate.category);
      if (tag?._id) resolved.push(tag._id);
    }
    if (!dryRun && resolved.length) {
      const before = new Set((product.tags || []).map(String));
      await addEntityTags({ entityType: 'product', entityId: product._id, tagIds: resolved, source: 'system' });
      assignmentsCreated += resolved.filter((tagId) => !before.has(String(tagId))).length;
    }
  }

  console.log(
    `${dryRun ? '[DRY RUN] ' : ''}Universal tag migration complete: ${productsScanned} products scanned, ` +
      `${tagCache.size} tag candidates, ${assignmentsCreated} new assignments.`
  );
} finally {
  await mongoose.disconnect();
}

