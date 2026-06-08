import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import Product from '../models/productModel.js';
import Comment from '../models/commentModel.js';
import Rating from '../models/ratingModel.js';

await connectDB();

const [commentRows, ratingRows] = await Promise.all([
  Comment.aggregate([{ $group: { _id: '$product', count: { $sum: 1 } } }]),
  Rating.aggregate([
    { $group: { _id: '$product', count: { $sum: 1 }, average: { $avg: '$value' } } }
  ])
]);

const commentMap = new Map(commentRows.map((row) => [String(row._id), Number(row.count || 0)]));
const ratingMap = new Map(
  ratingRows.map((row) => [
    String(row._id),
    {
      ratingCount: Number(row.count || 0),
      ratingAverage: Number(row.average?.toFixed(2) || 0)
    }
  ])
);

let updated = 0;
const cursor = Product.find({}).select('_id').cursor();
for await (const product of cursor) {
  const id = String(product._id);
  const rating = ratingMap.get(id) || { ratingCount: 0, ratingAverage: 0 };
  await Product.updateOne(
    { _id: product._id },
    {
      $set: {
        commentCount: commentMap.get(id) || 0,
        ratingAverage: rating.ratingAverage,
        ratingCount: rating.ratingCount
      }
    }
  );
  updated += 1;
}

console.log(`Backfilled product stats for ${updated} products.`);
await mongoose.disconnect();
