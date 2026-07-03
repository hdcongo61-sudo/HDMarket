import 'dotenv/config';
import mongoose from 'mongoose';
import Product from '../models/productModel.js';
import connectDB from '../config/db.js';
import { generateUniqueSlug } from '../utils/slugUtils.js';

// Repairs products whose slug was clobbered with a Date.now() placeholder
// (13-digit timestamp, optionally suffixed "-N") by the old comments-endpoint
// bug, regenerating a proper title-based slug. Idempotent; skips products
// whose title can't produce a slug. Run with --dry to only count.
const TIMESTAMP_SLUG = /^\d{13}(-\d+)?$/;

const run = async () => {
  const dryRun = process.argv.includes('--dry');
  await connectDB();
  try {
    const cursor = Product.find({ slug: TIMESTAMP_SLUG }).select('_id title slug').cursor();
    let repaired = 0;
    let skipped = 0;
    for await (const product of cursor) {
      const title = String(product.title || '').trim();
      if (!title) {
        skipped += 1;
        continue;
      }
      if (dryRun) {
        repaired += 1;
        continue;
      }
      // eslint-disable-next-line no-await-in-loop
      const slug = await generateUniqueSlug(Product, title, product._id, 'slug');
      if (TIMESTAMP_SLUG.test(slug)) {
        skipped += 1;
        continue;
      }
      // eslint-disable-next-line no-await-in-loop
      await Product.updateOne({ _id: product._id }, { $set: { slug } });
      console.log(`${product._id}: "${product.slug}" -> "${slug}"`);
      repaired += 1;
    }
    console.log(`${dryRun ? '[DRY RUN] would repair' : 'Repaired'}: ${repaired}, skipped (no usable title): ${skipped}`);
  } catch (error) {
    console.error('Repair error:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
