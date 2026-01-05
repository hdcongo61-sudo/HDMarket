import 'dotenv/config';
import mongoose from 'mongoose';
import Product from '../models/productModel.js';
import User from '../models/userModel.js';
import connectDB from '../config/db.js';
import { generateUniqueSlug } from '../utils/slugUtils.js';

const ensureProductSlug = async (product) => {
  if (!product || product.slug) return false;
  const slug = await generateUniqueSlug(Product, product.title || String(product._id), product._id, 'slug');
  await Product.updateOne({ _id: product._id }, { $set: { slug } });
  return true;
};

const ensureUserSlug = async (user) => {
  if (!user || user.slug) return false;
  const base = user.shopName || user.name || String(user._id);
  const slug = await generateUniqueSlug(User, base, user._id, 'slug');
  await User.updateOne({ _id: user._id }, { $set: { slug } });
  return true;
};

const run = async () => {
  await connectDB();
  try {
    const productCursor = Product.find({ slug: { $in: [null, ''] } }).cursor();
    let updated = 0;
    for await (const product of productCursor) {
      // eslint-disable-next-line no-await-in-loop
      if (await ensureProductSlug(product)) updated += 1;
    }
    console.log(`Products backfilled: ${updated}`);

    const userCursor = User.find({ accountType: 'shop', slug: { $in: [null, ''] } }).cursor();
    let userUpdated = 0;
    for await (const user of userCursor) {
      // eslint-disable-next-line no-await-in-loop
      if (await ensureUserSlug(user)) userUpdated += 1;
    }
    console.log(`Shop users backfilled: ${userUpdated}`);
  } catch (error) {
    console.error('Backfill error:', error);
  } finally {
    mongoose.disconnect();
  }
};

run().catch((error) => {
  console.error(error);
  mongoose.disconnect();
});
