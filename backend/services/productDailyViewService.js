import ProductDailyView from '../models/productDailyViewModel.js';

export const recordCountedProductView = async (product, now = new Date()) => {
  if (!product?.user) return;
  const day = new Date(now);
  day.setUTCHours(0, 0, 0, 0);
  const filter = { product: product._id, day };
  const update = { $inc: { views: 1 }, $setOnInsert: { seller: product.user } };
  try {
    await ProductDailyView.updateOne(filter, update, { upsert: true });
  } catch (error) {
    if (error?.code !== 11000) throw error;
    await ProductDailyView.updateOne(filter, { $inc: { views: 1 } });
  }
};
