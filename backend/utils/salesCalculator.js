import Order from '../models/orderModel.js';
import Product from '../models/productModel.js';

/**
 * Calculate and update salesCount for all products based on orders
 * Only counts orders with status: 'confirmed', 'delivering', 'delivered'
 */
export const updateProductSalesCount = async () => {
  try {
    // Aggregate sales from orders
    const salesData = await Order.aggregate([
      {
        $match: {
          status: { $in: ['confirmed', 'delivering', 'delivered'] }
        }
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product',
          totalQuantity: { $sum: '$items.quantity' }
        }
      }
    ]);

    // Create a map of productId -> salesCount
    const salesMap = new Map();
    salesData.forEach((item) => {
      if (item._id) {
        salesMap.set(String(item._id), item.totalQuantity);
      }
    });

    // Update all products
    const products = await Product.find({}).select('_id');
    const updatePromises = products.map((product) => {
      const salesCount = salesMap.get(String(product._id)) || 0;
      return Product.updateOne(
        { _id: product._id },
        { $set: { salesCount } }
      );
    });

    await Promise.all(updatePromises);

    return {
      updated: products.length,
      withSales: salesMap.size
    };
  } catch (error) {
    console.error('Error updating product sales count:', error);
    throw error;
  }
};

/**
 * Calculate salesCount for a specific product
 */
export const calculateProductSalesCount = async (productId) => {
  try {
    const result = await Order.aggregate([
      {
        $match: {
          status: { $in: ['confirmed', 'delivering', 'delivered'] },
          'items.product': productId
        }
      },
      { $unwind: '$items' },
      {
        $match: {
          'items.product': productId
        }
      },
      {
        $group: {
          _id: null,
          totalQuantity: { $sum: '$items.quantity' }
        }
      }
    ]);

    return result.length > 0 ? result[0].totalQuantity : 0;
  } catch (error) {
    console.error('Error calculating product sales count:', error);
    return 0;
  }
};
