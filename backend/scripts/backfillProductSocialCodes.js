import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import Product from '../models/productModel.js';

// Backfills `socialCode` on every existing product that doesn't have one
// yet. Idempotent (only ever targets products missing the field — a second
// run finds nothing to do), never overwrites an existing code, and reuses
// the exact same generation logic products already run through on save
// (Product's pre('validate') hook — see socialCommerce/socialCodeService.js)
// rather than duplicating the collision-retry logic here.
//
// Run: node scripts/backfillProductSocialCodes.js [--dry-run] [--batch-size=200]
//
// Safe to interrupt and re-run — already-backfilled products are skipped on
// the next pass since they no longer match the query.

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const batchSizeArg = process.argv.find((arg) => arg.startsWith('--batch-size='));
const batchSize = Math.max(1, Number(batchSizeArg?.split('=')[1]) || 200);

const run = async () => {
  await connectDB();

  const totalMissing = await Product.countDocuments({
    $or: [{ socialCode: { $exists: false } }, { socialCode: null }, { socialCode: '' }]
  });
  console.log(`Products missing a socialCode: ${totalMissing}`);
  if (!totalMissing) return;
  if (dryRun) {
    console.log('Dry run — no changes made.');
    return;
  }

  let processed = 0;
  let failed = 0;
  const cursor = Product.find({
    $or: [{ socialCode: { $exists: false } }, { socialCode: null }, { socialCode: '' }]
  }).cursor();

  let batch = [];
  const flushBatch = async () => {
    if (!batch.length) return;
    await Promise.all(
      batch.map(async (product) => {
        try {
          await product.save();
        } catch (error) {
          failed += 1;
          console.error(`Failed to backfill product ${product._id}:`, error?.message || error);
        }
      })
    );
    processed += batch.length;
    console.log(`Progress: ${processed}/${totalMissing}`);
    batch = [];
  };

  for await (const product of cursor) {
    batch.push(product);
    if (batch.length >= batchSize) {
      await flushBatch();
    }
  }
  await flushBatch();

  console.log(`Done. Backfilled: ${processed - failed}. Failed: ${failed}.`);
};

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
