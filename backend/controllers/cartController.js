import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import Cart from '../models/cartModel.js';
import Product from '../models/productModel.js';
import { ensureModelSlugsForItems } from '../utils/slugUtils.js';

const productSelectFields =
  'title price discount priceBeforeDiscount images status category user city country whatsappClicks slug';

const getItemProductId = (item) => {
  if (!item) return null;
  const raw = item.product?._id || item.product;
  if (!raw) return null;
  return raw.toString();
};

const sanitizeCart = async (cart) => {
  if (!cart) return null;
  let modified = false;
  cart.items = cart.items.filter((item) => {
    if (!item.product) {
      modified = true;
      return false;
    }
    return true;
  });
  if (modified) {
    await cart.save();
  }
  return cart;
};

const populateCart = async (userId) => {
  const cart = await Cart.findOne({ user: userId }).populate({
    path: 'items.product',
    select: productSelectFields,
    populate: {
      path: 'user',
      select: 'name phone accountType shopName'
    }
  });
  if (!cart) return null;
  await sanitizeCart(cart);
  const productRefs = cart.items.map((item) => item.product).filter(Boolean);
  await ensureModelSlugsForItems({ Model: Product, items: productRefs, sourceValueKey: 'title' });
  return cart;
};

const ensureCart = async (userId) => {
  let cart = await populateCart(userId);
  if (!cart) {
    cart = await Cart.create({ user: userId, items: [] });
    cart = await populateCart(userId);
  }
  return cart;
};

const formatCart = (cart) => {
  if (!cart) {
    return {
      items: [],
      totals: { quantity: 0, subtotal: 0 },
      updatedAt: new Date().toISOString()
    };
  }

  const items = cart.items
    .filter((item) => item.product)
    .map((item) => {
      const product = item.product;
      const unitPrice = Number(product.price || 0);
      const lineTotal = Number((unitPrice * item.quantity).toFixed(2));
      const seller =
        product.user && typeof product.user === 'object'
          ? {
              _id: product.user._id,
              name: product.user.name,
              phone: product.user.phone,
              accountType: product.user.accountType,
              shopName: product.user.shopName
            }
          : null;

      return {
        product: {
          _id: product._id,
          slug: product.slug,
          title: product.title,
          price: product.price,
          discount: product.discount,
          priceBeforeDiscount: product.priceBeforeDiscount,
          images: product.images,
          category: product.category,
          status: product.status,
          city: product.city,
          country: product.country,
          whatsappClicks: product.whatsappClicks ?? 0,
          user: seller,
          contactPhone: seller?.phone || null
        },
        quantity: item.quantity,
        lineTotal
      };
    });

  const totals = items.reduce(
    (acc, item) => {
      acc.quantity += item.quantity;
      acc.subtotal = Number((acc.subtotal + item.lineTotal).toFixed(2));
      return acc;
    },
    { quantity: 0, subtotal: 0 }
  );

  return {
    items,
    totals,
    updatedAt: cart.updatedAt
  };
};

export const getCart = asyncHandler(async (req, res) => {
  const cart = await ensureCart(req.user.id);
  res.json(formatCart(cart));
});

export const addItem = asyncHandler(async (req, res) => {
  const { productId, quantity = 1 } = req.body;
  if (!mongoose.isValidObjectId(productId)) {
    return res.status(400).json({ message: 'Invalid product id' });
  }
  const qty = Number(quantity) || 1;
  if (qty <= 0) {
    return res.status(400).json({ message: 'Quantity must be greater than zero' });
  }

  const product = await Product.findById(productId).select('status');
  if (!product || product.status !== 'approved') {
    return res.status(404).json({ message: 'Product unavailable' });
  }

  const cart = await ensureCart(req.user.id);
  const existing = cart.items.find((item) => getItemProductId(item) === productId);
  if (existing) {
    existing.quantity += qty;
  } else {
    cart.items.push({ product: productId, quantity: qty });
  }
  await cart.save();
  const populated = await populateCart(req.user.id);
  res.status(201).json(formatCart(populated));
});

export const updateItem = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  if (!mongoose.isValidObjectId(productId)) {
    return res.status(400).json({ message: 'Invalid product id' });
  }
  const { quantity } = req.body;
  const qty = Number(quantity);
  if (Number.isNaN(qty) || qty < 0) {
    return res.status(400).json({ message: 'Quantity must be zero or higher' });
  }

  const cart = await ensureCart(req.user.id);
  const existing = cart.items.find((item) => getItemProductId(item) === productId);
  if (!existing) {
    return res.status(404).json({ message: 'Item not found in cart' });
  }

  if (qty === 0) {
    cart.items = cart.items.filter((item) => getItemProductId(item) !== productId);
  } else {
    existing.quantity = qty;
  }

  await cart.save();
  const populated = await populateCart(req.user.id);
  res.json(formatCart(populated));
});

export const removeItem = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  if (!mongoose.isValidObjectId(productId)) {
    return res.status(400).json({ message: 'Invalid product id' });
  }

  const cart = await ensureCart(req.user.id);
  const beforeLength = cart.items.length;
  cart.items = cart.items.filter((item) => getItemProductId(item) !== productId);

  if (cart.items.length === beforeLength) {
    return res.status(404).json({ message: 'Item not found in cart' });
  }

  await cart.save();
  const populated = await populateCart(req.user.id);
  res.json(formatCart(populated));
});

export const clearCart = asyncHandler(async (req, res) => {
  const cart = await ensureCart(req.user.id);
  cart.items = [];
  await cart.save();
  res.json(formatCart(cart));
});
