import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import Cart from '../models/cartModel.js';
import Product from '../models/productModel.js';
import { ensureModelSlugsForItems } from '../utils/slugUtils.js';
import { getWholesalePricing, normalizeWholesaleTiers } from '../utils/wholesaleUtils.js';
import { invalidateUserCache } from '../utils/cache.js';
import {
  getVerifiedProductIds,
  hasVerifiedPaymentForProduct
} from '../utils/publicProductVisibility.js';
import {
  buildSelectedAttributesSelectionKey,
  normalizeSelectedAttributes,
  validateSelectedAttributesForProduct
} from '../utils/productAttributes.js';

const productSelectFields =
  'title price discount priceBeforeDiscount images status category user city country whatsappClicks slug installmentEnabled installmentMinAmount installmentDuration installmentStartDate installmentEndDate installmentRequireGuarantor wholesaleEnabled wholesaleTiers deliveryAvailable pickupAvailable deliveryFee deliveryFeeEnabled attributes physical';

const getItemProductId = (item) => {
  if (!item) return null;
  const raw = item.product?._id || item.product;
  if (!raw) return null;
  return raw.toString();
};

const getItemSelectionKey = (item) =>
  String(
    item?.selectionKey ||
      buildSelectedAttributesSelectionKey(item?.selectedAttributes || [])
  ).trim();

const resolveRequestedSelectionKey = ({ selectionKey, selectedAttributes }) =>
  String(selectionKey || buildSelectedAttributesSelectionKey(selectedAttributes)).trim();

const sanitizeCart = async (cart) => {
  if (!cart) return null;
  const verifiedProductIds = await getVerifiedProductIds();
  const verifiedProductSet = new Set(verifiedProductIds.map((id) => String(id)));
  let modified = false;
  cart.items = cart.items.filter((item) => {
    if (!item.product) {
      modified = true;
      return false;
    }
    const productId = String(item.product?._id || item.product || '');
    const isApproved = String(item.product?.status || '') === 'approved';
    const hasVerifiedPayment = productId && verifiedProductSet.has(productId);
    if (!isApproved || !hasVerifiedPayment) {
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
      select: 'name phone accountType shopName freeDeliveryEnabled freeDeliveryNote'
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
      const pricing = getWholesalePricing(product, item.quantity);
      const unitPrice = Number(pricing.unitPrice || 0);
      const lineTotal = Number(pricing.lineTotal || 0);
      const seller =
        product.user && typeof product.user === 'object'
          ? {
              _id: product.user._id,
              name: product.user.name,
              phone: product.user.phone,
              accountType: product.user.accountType,
              shopName: product.user.shopName,
              freeDeliveryEnabled: Boolean(product.user.freeDeliveryEnabled),
              freeDeliveryNote: product.user.freeDeliveryNote || ''
            }
          : null;

      return {
        cartItemId: item._id ? String(item._id) : '',
        selectionKey: getItemSelectionKey(item),
        selectedAttributes: normalizeSelectedAttributes(item.selectedAttributes),
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
          installmentEnabled: Boolean(product.installmentEnabled),
          installmentMinAmount: Number(product.installmentMinAmount || 0),
          installmentDuration: Number(product.installmentDuration || 0),
          installmentStartDate: product.installmentStartDate || null,
          installmentEndDate: product.installmentEndDate || null,
          installmentRequireGuarantor: Boolean(product.installmentRequireGuarantor),
          wholesaleEnabled: Boolean(product.wholesaleEnabled),
          wholesaleTiers: normalizeWholesaleTiers(product.wholesaleTiers),
          deliveryAvailable: product.deliveryAvailable !== false,
          pickupAvailable: product.pickupAvailable !== false,
          deliveryFee: Number(product.deliveryFee || 0),
          deliveryFeeEnabled: product.deliveryFeeEnabled !== false,
          attributes: Array.isArray(product.attributes) ? product.attributes : [],
          physical: product.physical && typeof product.physical === 'object' ? product.physical : {},
          user: seller,
          contactPhone: seller?.phone || null
        },
        quantity: item.quantity,
        unitPrice,
        wholesale: {
          applied: Boolean(pricing.tierApplied),
          tier: pricing.tierApplied,
          savingsAmount: Number(pricing.savingsAmount || 0),
          savingsPercent: Number(pricing.savingsPercent || 0)
        },
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
  const { productId, quantity = 1, selectedAttributes } = req.body;
  if (!mongoose.isValidObjectId(productId)) {
    return res.status(400).json({ message: 'Invalid product id' });
  }
  const qty = Number(quantity) || 1;
  if (qty <= 0) {
    return res.status(400).json({ message: 'Quantity must be greater than zero' });
  }

  const product = await Product.findById(productId).select('status payment attributes');
  const hasVerifiedPayment = await hasVerifiedPaymentForProduct(product?.payment);
  if (!product || product.status !== 'approved' || !hasVerifiedPayment) {
    return res.status(404).json({ message: 'Product unavailable' });
  }

  const selectedAttributesValidation = validateSelectedAttributesForProduct({
    productAttributes: product.attributes,
    selectedAttributes
  });
  if (!selectedAttributesValidation.valid) {
    return res.status(400).json({ message: selectedAttributesValidation.message });
  }

  const cart = await ensureCart(req.user.id);
  const selectionKey = selectedAttributesValidation.selectionKey;
  const existing = cart.items.find(
    (item) =>
      getItemProductId(item) === productId &&
      getItemSelectionKey(item) === selectionKey
  );
  if (existing) {
    existing.quantity += qty;
  } else {
    cart.items.push({
      product: productId,
      quantity: qty,
      selectionKey,
      selectedAttributes: selectedAttributesValidation.selectedAttributes
    });
  }
  await cart.save();
  await invalidateUserCache(req.user.id, ['cart']);
  const populated = await populateCart(req.user.id);
  res.status(201).json(formatCart(populated));
});

export const updateItem = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  if (!mongoose.isValidObjectId(productId)) {
    return res.status(400).json({ message: 'Invalid product id' });
  }
  const { quantity, selectionKey, selectedAttributes } = req.body;
  const qty = Number(quantity);
  if (Number.isNaN(qty) || qty < 0) {
    return res.status(400).json({ message: 'Quantity must be zero or higher' });
  }

  const cart = await ensureCart(req.user.id);
  const requestedSelectionKey = resolveRequestedSelectionKey({ selectionKey, selectedAttributes });
  const existing = cart.items.find(
    (item) =>
      getItemProductId(item) === productId &&
      getItemSelectionKey(item) === requestedSelectionKey
  );
  if (!existing) {
    return res.status(404).json({ message: 'Item not found in cart' });
  }

  if (qty === 0) {
    cart.items = cart.items.filter((item) => getItemProductId(item) !== productId);
  } else {
    existing.quantity = qty;
  }

  await cart.save();
  await invalidateUserCache(req.user.id, ['cart']);
  const populated = await populateCart(req.user.id);
  res.json(formatCart(populated));
});

export const removeItem = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  if (!mongoose.isValidObjectId(productId)) {
    return res.status(400).json({ message: 'Invalid product id' });
  }

  const requestedSelectionKey = resolveRequestedSelectionKey({
    selectionKey: req.query?.selectionKey || req.body?.selectionKey,
    selectedAttributes: req.body?.selectedAttributes
  });
  const cart = await ensureCart(req.user.id);
  const beforeLength = cart.items.length;
  cart.items = cart.items.filter(
    (item) =>
      !(
        getItemProductId(item) === productId &&
        getItemSelectionKey(item) === requestedSelectionKey
      )
  );

  if (cart.items.length === beforeLength) {
    return res.status(404).json({ message: 'Item not found in cart' });
  }

  await cart.save();
  await invalidateUserCache(req.user.id, ['cart']);
  const populated = await populateCart(req.user.id);
  res.json(formatCart(populated));
});

export const clearCart = asyncHandler(async (req, res) => {
  const cart = await ensureCart(req.user.id);
  cart.items = [];
  await cart.save();
  await invalidateUserCache(req.user.id, ['cart']);
  res.json(formatCart(cart));
});
