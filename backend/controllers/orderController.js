import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import Order from '../models/orderModel.js';
import DeliveryLog from '../models/deliveryLogModel.js';
import OrderMessage from '../models/orderMessageModel.js';
import Product from '../models/productModel.js';
import User from '../models/userModel.js';
import City from '../models/cityModel.js';
import Commune from '../models/communeModel.js';
import DeliveryGuy from '../models/deliveryGuyModel.js';
import Cart from '../models/cartModel.js';
import { createNotification } from '../utils/notificationService.js';
import { isTwilioMessagingConfigured, sendSms } from '../utils/twilioMessaging.js';
import { ensureModelSlugsForItems } from '../utils/slugUtils.js';
import { calculateProductSalesCount } from '../utils/salesCalculator.js';
import { getRestrictionMessage, isRestricted } from '../utils/restrictionCheck.js';
import { getInstallmentProgress } from '../utils/installmentUtils.js';
import {
  consumeMarketplacePromoForOrder,
  rollbackConsumedMarketplacePromo
} from '../utils/marketplacePromoCodeService.js';
import { DELIVERY_FEE_SOURCE, resolveDeliveryPricing } from '../utils/deliveryPricing.js';
import { getWholesalePricing } from '../utils/wholesaleUtils.js';
import {
  findUsedTransactionCodes,
  normalizeTransactionCode,
  TRANSACTION_CODE_REUSED_MESSAGE
} from '../utils/transactionCodeService.js';
import {
  invalidateAdminCache,
  invalidateSellerCache,
  invalidateUserCache
} from '../utils/cache.js';
import { buildAdminOrderFilter as buildAdvancedAdminOrderFilter } from '../services/adminOrderAutomationService.js';
import { getRuntimeConfig } from '../services/configService.js';
import {
  assertSellerCanSubmitDeliveryProof,
  assertSellerStatusTransition,
  getOrderAllowedActions,
  isPlatformDeliveryOrder
} from '../services/orderStatusFlowService.js';
import { getVerifiedProductIds } from '../utils/publicProductVisibility.js';
import { safeAsync } from '../utils/safeAsync.js';
import { applyDeliveryFeeToOrder } from '../services/orderDeliveryFeeService.js';
import {
  cancelOrderReviewReminder,
  isOrderEligibleForReviewReminder,
  scheduleOrderReviewReminder
} from '../services/orderReviewReminderService.js';
import { emitOrderStatusUpdated } from '../sockets/chatSocket.js';
import { validateSelectedAttributesForProduct } from '../utils/productAttributes.js';
import { dispatchSideEffect } from '../utils/dispatchSideEffect.js';
import {
  buildDeliveryDistanceWarningPayload,
  notifyBuyerDeliveryDistanceWarning
} from '../utils/deliveryDistanceWarning.js';

const ORDER_STATUS = [
  'pending_payment',
  'paid',
  'ready_for_pickup',
  'picked_up_confirmed',
  'ready_for_delivery',
  'out_for_delivery',
  'delivery_proof_submitted',
  'confirmed_by_client',
  'pending',
  'pending_installment',
  'installment_active',
  'overdue_installment',
  'dispute_opened',
  'confirmed',
  'delivering',
  'delivered',
  'completed',
  'cancelled'
];

const INSTALLMENT_SALE_STATUS_FILTERS = new Set(['confirmed', 'delivering', 'delivered', 'cancelled']);
const ORDER_STATUS_GROUPS = {
  buyer: {
    payment_due: ['pending_payment'],
    awaiting_seller: ['pending', 'paid', 'confirmed', 'ready_for_delivery'],
    active: ['pending', 'paid', 'confirmed', 'ready_for_delivery', 'pending_installment', 'installment_active'],
    pickup: ['ready_for_pickup', 'picked_up_confirmed'],
    delivery: ['out_for_delivery', 'delivering', 'delivery_proof_submitted'],
    proof: ['delivery_proof_submitted'],
    installments: ['pending_installment', 'installment_active', 'overdue_installment', 'completed'],
    completed: ['confirmed_by_client', 'delivered', 'completed'],
    cancelled: ['cancelled']
  },
  seller: {
    new: ['pending_payment', 'paid', 'pending', 'pending_installment'],
    prepare: ['confirmed', 'ready_for_delivery'],
    handoff: ['ready_for_pickup', 'out_for_delivery', 'delivering', 'delivery_proof_submitted'],
    pickup: ['ready_for_pickup', 'picked_up_confirmed'],
    proof: ['delivery_proof_submitted'],
    payment: ['pending_payment', 'paid', 'pending_installment', 'installment_active', 'overdue_installment'],
    installments: ['pending_installment', 'installment_active', 'overdue_installment', 'completed'],
    late: ['overdue_installment'],
    completed: ['picked_up_confirmed', 'confirmed_by_client', 'delivered', 'completed'],
    cancelled: ['cancelled'],
    problems: ['overdue_installment', 'dispute_opened', 'cancelled']
  }
};

const applyOrderStatusFilter = (filter, { status, statusGroup, role = 'buyer' } = {}) => {
  if (status && ORDER_STATUS.includes(status)) {
    if (INSTALLMENT_SALE_STATUS_FILTERS.has(status)) {
      filter.$and = [
        ...(Array.isArray(filter.$and) ? filter.$and : []),
        {
          $or: [
            { status },
            { paymentType: 'installment', status: 'completed', installmentSaleStatus: status }
          ]
        }
      ];
    } else {
      filter.status = status;
    }
    return filter;
  }

  const groupStatuses = ORDER_STATUS_GROUPS[role]?.[String(statusGroup || '').trim()];
  if (Array.isArray(groupStatuses) && groupStatuses.length) {
    filter.status = { $in: groupStatuses };
  }
  return filter;
};

const buildOrderSummary = async ({ baseFilter, role = 'buyer' }) => {
  const match = { ...baseFilter, isDraft: false };
  const [summaryRows, statusRows] = await Promise.all([
    Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          totalAmount: { $sum: { $ifNull: ['$totalAmount', 0] } },
          paymentPending: {
            $sum: {
              $cond: [{ $in: ['$status', ORDER_STATUS_GROUPS[role]?.payment || ORDER_STATUS_GROUPS.buyer.payment_due] }, 1, 0]
            }
          },
          urgentCount: {
            $sum: {
              $cond: [{ $in: ['$status', ['pending_payment', 'overdue_installment', 'dispute_opened']] }, 1, 0]
            }
          },
          activeCount: {
            $sum: {
              $cond: [
                {
                  $in: [
                    '$status',
                    ['pending_payment', 'paid', 'ready_for_pickup', 'ready_for_delivery', 'out_for_delivery', 'pending', 'confirmed', 'delivering', 'installment_active']
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      }
    ]),
    Order.aggregate([
      { $match: match },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ])
  ]);

  const row = summaryRows[0] || {};
  const byStatus = statusRows.reduce((acc, entry) => {
    if (entry?._id) acc[entry._id] = Number(entry.count || 0);
    return acc;
  }, {});
  const byGroup = Object.entries(ORDER_STATUS_GROUPS[role] || {}).reduce((acc, [groupKey, statuses]) => {
    acc[groupKey] = statuses.reduce((sum, status) => sum + Number(byStatus[status] || 0), 0);
    return acc;
  }, { all: Number(row.total || 0) });

  return {
    total: Number(row.total || 0),
    totalAmount: Number(row.totalAmount || 0),
    paymentPending: Number(row.paymentPending || 0),
    urgentCount: Number(row.urgentCount || 0),
    activeCount: Number(row.activeCount || 0),
    byStatus,
    byGroup
  };
};
const getDeliveryProofResubmissionLimit = async () => {
  const fallback = Math.max(1, Number(process.env.DELIVERY_PROOF_RESUBMISSION_LIMIT || 3));
  const configured = await getRuntimeConfig('delivery_proof_resubmission_limit', { fallback });
  const parsed = Number(configured);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, parsed);
};

const getMaxDeliveryProofPhotos = async () => {
  const fallback = Math.max(1, Number(process.env.MAX_DELIVERY_PROOF_PHOTOS || 3));
  const configured = await getRuntimeConfig('max_delivery_proof_photos', { fallback });
  const parsed = Number(configured);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, parsed);
};

const formatSmsAmount = (value) =>
  Number(value || 0).toLocaleString('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });

const buildSmsItemsSummary = (items = [], limit = 2) => {
  const list = Array.isArray(items) ? items : [];
  const parts = list.slice(0, limit).map((item) => {
    const title = item?.snapshot?.title || item?.product?.title || 'Produit';
    const qty = Number(item?.quantity || 0);
    const price = item?.snapshot?.price;
    const priceLabel = Number.isFinite(Number(price)) ? `${formatSmsAmount(price)} FCFA` : '';
    const qtyLabel = qty > 1 ? ` x${qty}` : '';
    return [title + qtyLabel, priceLabel].filter(Boolean).join(' @ ');
  });
  if (!parts.length) return '';
  const remaining = list.length - parts.length;
  return `Articles : ${parts.join(', ')}${remaining > 0 ? ` +${remaining}` : ''}`;
};

const buildOrderSmsDetails = (order) => {
  if (!order) return '';
  const itemsSummary = buildSmsItemsSummary(order.items);
  const total = `Total : ${formatSmsAmount(order.totalAmount)} FCFA`;
  const fullyPaid =
    String(order?.paymentMode || '').toUpperCase() === 'FULL_PAYMENT' ||
    String(order?.paymentStatus || '').toUpperCase() === 'PAID_FULL';
  const deliveryFeeTotal = Number(order?.deliveryFeeTotal || 0);
  const baseOrderAmount = Math.max(0, Number(order?.totalAmount || 0) - deliveryFeeTotal);
  const paidAmount = fullyPaid
    ? Number(order.totalAmount || 0)
    : Number(order.paidAmount || 0) || Math.round(baseOrderAmount * 0.25);
  const deposit = paidAmount
    ? fullyPaid
      ? `Paiement intégral : ${formatSmsAmount(paidAmount)} FCFA`
      : `Acompte : ${formatSmsAmount(paidAmount)} FCFA`
    : '';
  const delivery = order.deliveryAddress
    ? `Livraison : ${order.deliveryAddress}${order.deliveryCity ? `, ${order.deliveryCity}` : ''}`
    : '';
  return [itemsSummary, total, deposit, delivery].filter(Boolean).join(' | ');
};

const buildOrderPendingMessage = (order) => {
  if (!order) return '';
  const deliveryCode = order.deliveryCode ? ` Code de livraison: ${order.deliveryCode}` : '';
  let orderId = '';
  if (order._id) {
    try {
      orderId = String(order._id).slice(-6);
    } catch (e) {
      orderId = String(order._id).substring(String(order._id).length - 6);
    }
  }
  if (
    String(order?.paymentMode || '').toUpperCase() === 'FULL_PAYMENT' ||
    String(order?.paymentStatus || '').toUpperCase() === 'PAID_FULL'
  ) {
    return `HDMarket : Votre commande ${orderId} est entièrement réglée. Livraison offerte activée.${deliveryCode} ${buildOrderSmsDetails(order)}`;
  }
  return `HDMarket : Votre commande ${orderId} est en attente.${deliveryCode} ${buildOrderSmsDetails(order)}`;
};

const buildOrderDeliveringMessage = (order) => {
  if (!order) return '';
  const deliveryCode = order.deliveryCode ? ` Code de livraison: ${order.deliveryCode}` : '';
  let orderId = '';
  if (order._id) {
    try {
      orderId = String(order._id).slice(-6);
    } catch (e) {
      orderId = String(order._id).substring(String(order._id).length - 6);
    }
  }
  return `HDMarket : Votre commande ${orderId} est en cours de livraison.${deliveryCode} ${buildOrderSmsDetails(order)}`;
};

const normalizeCheckoutPaymentMode = (value) =>
  String(value || '').trim().toUpperCase() === 'FULL_PAYMENT' ? 'FULL_PAYMENT' : 'STANDARD';

const sendOrderSms = async ({ phone, message, context }) => {
  if (!phone || !isTwilioMessagingConfigured()) return;
  try {
    await sendSms(phone, message);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Order SMS failed', context, error?.message || error);
  }
};

const baseOrderQuery = () =>
  Order.find()
    .populate('customer', 'name email phone address city commune')
    .populate({
      path: 'items.product',
      select: 'title price images status user slug',
      populate: { path: 'user', select: 'name shopName phone shopAddress city commune' }
    })
    .populate({
      path: 'deliveryGuy',
      select: 'name fullName phone active isActive photoUrl userId',
      populate: { path: 'userId', select: '_id name shopLogo' }
    })
    .populate('createdBy', 'name email');

const collectOrderProductRefs = (orders = []) => {
  const list = Array.isArray(orders) ? orders : [orders];
  const seen = new Set();
  const products = [];
  list.forEach((order) => {
    const items = Array.isArray(order?.items) ? order.items : [];
    items.forEach((item) => {
      const product = item?.product;
      if (!product || typeof product !== 'object') return;
      const id = String(product._id || '');
      if (!id || seen.has(id)) return;
      seen.add(id);
      products.push(product);
    });
  });
  return products;
};

const ensureOrderProductSlugs = async (orders = []) => {
  const productRefs = collectOrderProductRefs(orders);
  if (!productRefs.length) return;
  await ensureModelSlugsForItems({ Model: Product, items: productRefs, sourceValueKey: 'title' });
};

const ensureObjectId = (id) => mongoose.Types.ObjectId.isValid(id);
const toIdSet = (values = []) => new Set((Array.isArray(values) ? values : []).map((value) => String(value)));
const isPurchasableProduct = (product, verifiedProductSet) =>
  Boolean(
    product &&
      String(product.status || '') === 'approved' &&
      verifiedProductSet?.has(String(product._id || ''))
  );

const invalidateOrderCachesForMutation = async ({ customerId, sellerIds = [], includeAdmin = true }) => {
  const sellerIdList = Array.from(new Set((Array.isArray(sellerIds) ? sellerIds : []).map((id) => String(id || '')).filter(Boolean)));

  if (customerId) {
    await invalidateUserCache(customerId, ['orders', 'notifications', 'dashboard', 'analytics']);
  }

  if (sellerIdList.length) {
    await Promise.all(
      sellerIdList.map((sellerId) =>
        invalidateSellerCache(sellerId, ['orders', 'dashboard', 'analytics'])
      )
    );
  }

  if (includeAdmin) {
    await invalidateAdminCache(['admin', 'dashboard', 'analytics']);
  }
};

const getRequestIp = (req) =>
  (req.headers['x-forwarded-for'] || req.ip || '')
    .toString()
    .split(',')[0]
    .trim();

const normalizeDeliveryProofFiles = (files = []) =>
  (Array.isArray(files) ? files : []).slice(0, 5).map((file) => ({
    url: `uploads/delivery-proofs/${file.filename}`,
    path: `uploads/delivery-proofs/${file.filename}`,
    originalName: file.originalname || '',
    mimeType: file.mimetype || '',
    size: Number(file.size || 0),
    uploadedAt: new Date()
  }));

const hasValidDeliveryEvidence = (order) =>
  Array.isArray(order?.deliveryProofImages) &&
  order.deliveryProofImages.length > 0 &&
  Boolean(String(order?.clientSignatureImage || '').trim()) &&
  Boolean(order?.deliveryDate);

const hasMinimumDeliveryProofImages = (order, minCount = 1) =>
  Array.isArray(order?.deliveryProofImages) && order.deliveryProofImages.length >= Math.max(1, Number(minCount) || 1);

const extractDeliveryLocation = (body = {}) => {
  const location = body?.location || {};
  const latitude = Number(location.latitude ?? body.locationLatitude);
  const longitude = Number(location.longitude ?? body.locationLongitude);
  const accuracy = Number(location.accuracy ?? body.locationAccuracy);
  const hasLat = Number.isFinite(latitude);
  const hasLng = Number.isFinite(longitude);
  const hasAccuracy = Number.isFinite(accuracy);
  if (!hasLat && !hasLng && !hasAccuracy) return null;
  return {
    latitude: hasLat ? latitude : null,
    longitude: hasLng ? longitude : null,
    accuracy: hasAccuracy ? accuracy : null
  };
};

const generateDeliveryCode = async () => {
  let code;
  let isUnique = false;
  let attempts = 0;
  const maxAttempts = 10;
  
  while (!isUnique && attempts < maxAttempts) {
    // Generate a 6-digit code
    code = String(Math.floor(100000 + Math.random() * 900000));
    
    // Check if code already exists
    const existing = await Order.findOne({ deliveryCode: code });
    if (!existing) {
      isUnique = true;
    }
    attempts++;
  }
  
  if (!isUnique) {
    // Fallback: use timestamp-based code if all attempts fail
    code = String(Date.now()).slice(-6);
  }
  
  return code;
};

const resolveItemShopId = (item) =>
  item?.snapshot?.shopId ||
  item?.product?.user ||
  item?.product?.user?._id ||
  null;

const filterOrderItemsForSeller = (order, sellerId) => {
  if (!order) return [];
  const sellerKey = String(sellerId);
  const items = Array.isArray(order.items) ? order.items : [];
  return items.filter((item) => {
    const shopId = resolveItemShopId(item);
    return shopId && String(shopId) === sellerKey;
  });
};

const normalizeDeliveryMode = (value) =>
  String(value || 'PICKUP').toUpperCase() === 'DELIVERY' ? 'DELIVERY' : 'PICKUP';

const isPickupOnlyProduct = (product = {}) =>
  product?.deliveryAvailable === false && product?.pickupAvailable !== false;

const buildOrderItemFromProduct = (product, quantity = 1, selectedAttributes = []) => {
  const qty = Math.max(1, Number(quantity) || 1);
  const pricing = getWholesalePricing(product, qty);
  const unitPrice = Number(pricing.unitPrice || 0);
  const lineTotal = Number(pricing.lineTotal || 0);
  const tier = pricing.tierApplied || null;

  return {
    product: product._id,
    quantity: qty,
    unitPrice,
    lineTotal,
    selectedAttributes,
    snapshot: {
      title: product.title,
      price: unitPrice,
      basePrice: Number(product.price || 0),
      image: Array.isArray(product.images) ? product.images[0] : null,
      shopName: product.user?.shopName || product.user?.name || '',
      shopId: product.user?._id || product.user || null,
      shopAddress: product.user?.shopAddress || '',
      shopCity: product.user?.city || '',
      shopCommune: product.user?.commune || '',
      wholesaleEnabled: Boolean(product.wholesaleEnabled),
      wholesaleApplied: Boolean(tier),
      wholesaleTierMinQty: Number(tier?.minQty || 0),
      wholesaleTierLabel: String(tier?.label || ''),
      warrantyEnabled: Boolean(product.warrantyEnabled),
      warrantyPeriodValue: product.warrantyPeriodValue || null,
      warrantyPeriodUnit: product.warrantyPeriodUnit || 'months',
      deliveryAvailable: product.deliveryAvailable !== false,
      pickupAvailable: product.pickupAvailable !== false,
      deliveryFeeEnabled: product.deliveryFeeEnabled !== false,
      deliveryFee: Number(product.deliveryFee || 0),
      confirmationNumber: product.confirmationNumber || '',
      slug: product.slug || null
    }
  };
};

const calculateOrderItemsSubtotal = (items = []) =>
  Number(
    (Array.isArray(items) ? items : []).reduce(
      (sum, item) => {
        const fallbackLineTotal =
          Number(item?.unitPrice ?? item?.snapshot?.price ?? 0) * Number(item?.quantity || 1);
        const lineTotal = item?.lineTotal ?? fallbackLineTotal;
        return sum + Number(lineTotal || 0);
      },
      0
    ).toFixed(2)
  );

const resolveCheckoutAddress = async ({ deliveryMode, shippingAddress = {}, customer }) => {
  const phone =
    String(shippingAddress?.phone || customer?.phone || '')
      .trim()
      .slice(0, 30) || '';

  if (deliveryMode === 'PICKUP') {
    return {
      cityDoc: null,
      communeDoc: null,
      deliveryAddress: 'Retrait en boutique',
      deliveryCity: customer?.city || '',
      snapshot: {
        cityId: null,
        cityName: customer?.city || '',
        communeId: null,
        communeName: customer?.commune || '',
        addressLine: 'Retrait en boutique',
        phone
      }
    };
  }

  const cityId = String(shippingAddress?.cityId || '').trim();
  const communeId = String(shippingAddress?.communeId || '').trim();
  const addressLine = String(shippingAddress?.addressLine || '').trim();
  if (!ensureObjectId(cityId)) {
    const error = new Error('Ville de livraison invalide.');
    error.statusCode = 400;
    throw error;
  }
  if (!ensureObjectId(communeId)) {
    const error = new Error('Commune de livraison invalide.');
    error.statusCode = 400;
    throw error;
  }
  if (!addressLine) {
    const error = new Error('Adresse de livraison requise.');
    error.statusCode = 400;
    throw error;
  }
  if (!phone) {
    const error = new Error('Numéro de téléphone requis pour la livraison.');
    error.statusCode = 400;
    throw error;
  }

  const [cityDoc, communeDoc] = await Promise.all([
    City.findOne({ _id: cityId, isActive: true }).lean(),
    Commune.findOne({ _id: communeId, isActive: true }).lean()
  ]);
  if (!cityDoc) {
    const error = new Error('Ville de livraison introuvable.');
    error.statusCode = 400;
    throw error;
  }
  if (!communeDoc) {
    const error = new Error('Commune de livraison introuvable.');
    error.statusCode = 400;
    throw error;
  }
  if (String(communeDoc.cityId) !== String(cityDoc._id)) {
    const error = new Error('La commune sélectionnée ne correspond pas à la ville.');
    error.statusCode = 400;
    throw error;
  }

  return {
    cityDoc,
    communeDoc,
    deliveryAddress: addressLine,
    deliveryCity: cityDoc.name || customer?.city || '',
    snapshot: {
      cityId: cityDoc._id,
      cityName: cityDoc.name || '',
      communeId: communeDoc._id,
      communeName: communeDoc.name || '',
      addressLine,
      phone
    }
  };
};

// Check if order is within 30-minute cancellation window (returns false if buyer has skipped it)
const isWithinCancellationWindow = (order) => {
  if (!order || !order.createdAt) return false;
  if (
    [
      'cancelled',
      'delivery_proof_submitted',
      'delivered',
      'confirmed_by_client',
      'completed'
    ].includes(order.status)
  ) {
    return false;
  }
  if (order.cancellationWindowSkippedAt) return false; // Buyer confirmed they won't cancel

  const createdAt = new Date(order.createdAt);
  const now = new Date();
  const diffMs = now - createdAt;
  const diffMinutes = diffMs / (1000 * 60);

  return diffMinutes <= 30;
};

// Get remaining cancellation time in milliseconds
const getCancellationWindowRemaining = (order) => {
  if (!order || !order.createdAt) return 0;
  if (
    [
      'cancelled',
      'delivery_proof_submitted',
      'delivered',
      'confirmed_by_client',
      'completed'
    ].includes(order.status)
  ) {
    return 0;
  }
  if (order.cancellationWindowSkippedAt) return 0;

  const createdAt = new Date(order.createdAt);
  const cancellationDeadline = new Date(createdAt.getTime() + 30 * 60 * 1000); // 30 minutes
  const now = new Date();
  const remaining = cancellationDeadline - now;

  return Math.max(0, remaining);
};

const buildOrderResponse = (order) => {
  if (!order) return null;
  const obj = order.toObject ? order.toObject() : order;
  const orderActionState = getOrderAllowedActions(obj);
  const installmentProgress =
    obj.paymentType === 'installment' ? getInstallmentProgress(obj.installmentPlan || {}) : null;
  return {
    ...obj,
    items: Array.isArray(obj.items)
      ? obj.items.map((item) => ({
          ...item,
          selectedAttributes: Array.isArray(item.selectedAttributes) ? item.selectedAttributes : [],
          snapshot: {
            ...(item.snapshot || {}),
            shopAddress:
              item?.snapshot?.shopAddress || item?.product?.user?.shopAddress || '',
            shopCity:
              item?.snapshot?.shopCity || item?.product?.user?.city || '',
            shopCommune:
              item?.snapshot?.shopCommune || item?.product?.user?.commune || ''
          }
        }))
      : [],
    customer: obj.customer
      ? {
          _id: obj.customer._id,
          name: obj.customer.name,
          email: obj.customer.email,
          phone: obj.customer.phone,
          address: obj.customer.address,
          city: obj.customer.city,
          commune: obj.customer.commune || ''
        }
      : null,
    createdBy: obj.createdBy
      ? {
          _id: obj.createdBy._id,
          name: obj.createdBy.name,
          email: obj.createdBy.email
        }
      : null,
    deliveryGuy: obj.deliveryGuy
      ? {
          _id: obj.deliveryGuy._id,
          name: obj.deliveryGuy.fullName || obj.deliveryGuy.name,
          phone: obj.deliveryGuy.phone,
          active:
            typeof obj.deliveryGuy.active === 'boolean'
              ? obj.deliveryGuy.active
              : Boolean(obj.deliveryGuy.isActive),
          photoUrl:
            obj.deliveryGuy.photoUrl ||
            obj.deliveryGuy.profileImage ||
            obj.deliveryGuy.userId?.shopLogo ||
            '',
          profileImage:
            obj.deliveryGuy.photoUrl ||
            obj.deliveryGuy.profileImage ||
            obj.deliveryGuy.userId?.shopLogo ||
            ''
        }
      : null,
    cancelledAt: obj.cancelledAt || null,
    cancellationReason: obj.cancellationReason || '',
    cancelledBy: obj.cancelledBy || null,
    refundStatus: obj.refundStatus || 'none',
    refundAmount: Number(obj.refundAmount || 0),
    refundRequestedBy: obj.refundRequestedBy || null,
    refundRequestedAt: obj.refundRequestedAt || null,
    deliveryCode: obj.deliveryCode || null,
    deliveryProofImages: Array.isArray(obj.deliveryProofImages) ? obj.deliveryProofImages : [],
    clientSignatureImage: obj.clientSignatureImage || '',
    deliveryNote: obj.deliveryNote || '',
    deliveryDate: obj.deliveryDate || null,
    deliverySubmittedBy: obj.deliverySubmittedBy || null,
    deliverySubmittedAt: obj.deliverySubmittedAt || null,
    clientDeliveryConfirmedAt: obj.clientDeliveryConfirmedAt || null,
    deliveryStatus: obj.deliveryStatus || 'not_submitted',
    deliveryProofAttemptCount: Number(obj.deliveryProofAttemptCount || 0),
    isDraft: obj.isDraft || false,
    draftPayments: Array.isArray(obj.draftPayments) ? obj.draftPayments : [],
    cancellationWindow: {
      isActive: isWithinCancellationWindow(obj),
      remainingMs: getCancellationWindowRemaining(obj),
      deadline: obj.createdAt ? new Date(new Date(obj.createdAt).getTime() + 30 * 60 * 1000).toISOString() : null,
      skippedAt: obj.cancellationWindowSkippedAt || null
    },
    installmentProgress,
    reviewState: {
      status: obj.reviewStatus || (obj.reviewGiven ? 'DONE' : 'PENDING'),
      disabled: Boolean(obj.reviewReminderDisabled),
      sentAt: obj.reviewReminderSentAt || obj?.reminderState?.reviewReminderSentAt || null,
      completedAt: obj.reviewCompletedAt || null,
      reminderCount: Number(obj.reviewReminderCount || 0)
    },
    allowedActions: orderActionState.allowedActions,
    nextAction: orderActionState.nextAction
  };
};

const syncReviewReminderForOrderLifecycle = async (order) => {
  if (!order?._id) return;
  if (isOrderEligibleForReviewReminder(order)) {
    await scheduleOrderReviewReminder(order._id);
    return;
  }
  await cancelOrderReviewReminder(order._id);
};

export const adminCreateOrder = asyncHandler(async (req, res) => {
  const { items, customerId, deliveryAddress, deliveryCity, trackingNote } = req.body;

  if (!ensureObjectId(customerId)) {
    return res.status(400).json({ message: 'Client invalide.' });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'Veuillez sélectionner au moins un produit.' });
  }

  const normalizedItems = items.map((item) => ({
    productId: item.productId,
    quantity: Number(item.quantity) > 0 ? Number(item.quantity) : 1,
    selectedAttributes: Array.isArray(item.selectedAttributes) ? item.selectedAttributes : []
  }));

  const productIds = normalizedItems.map((item) => item.productId);
  if (productIds.some((id) => !ensureObjectId(id))) {
    return res.status(400).json({ message: 'Produit invalide.' });
  }

  const [customer, productDocs, verifiedProductIds] = await Promise.all([
    User.findById(customerId).select('name email phone address city'),
    Product.find({ _id: { $in: productIds } }).populate('user', 'shopName name slug shopAddress city commune'),
    getVerifiedProductIds()
  ]);
  const verifiedProductSet = toIdSet(verifiedProductIds);

  if (!customer) {
    return res.status(404).json({ message: 'Client introuvable.' });
  }

  const productMap = new Map(productDocs.map((doc) => [doc._id.toString(), doc]));
  let orderItems;
  try {
    orderItems = normalizedItems.map((item) => {
      const product = productMap.get(item.productId);
      if (!isPurchasableProduct(product, verifiedProductSet)) {
        throw Object.assign(new Error('Produit indisponible ou non approuvé.'), { statusCode: 400 });
      }
      const selectedAttributesValidation = validateSelectedAttributesForProduct({
        productAttributes: product.attributes,
        selectedAttributes: item.selectedAttributes
      });
      if (!selectedAttributesValidation.valid) {
        throw Object.assign(new Error(selectedAttributesValidation.message), { statusCode: 400 });
      }
      return buildOrderItemFromProduct(
        product,
        item.quantity,
        selectedAttributesValidation.selectedAttributes
      );
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    throw error;
  }

  const totalAmount = calculateOrderItemsSubtotal(orderItems);

  const deliveryCode = await generateDeliveryCode();

  const order = await Order.create({
    items: orderItems,
    customer: customer._id,
    createdBy: req.user.id,
    deliveryAddress: deliveryAddress.trim(),
    deliveryCity,
    trackingNote: trackingNote?.trim() || '',
    totalAmount,
    paidAmount: 0,
    remainingAmount: totalAmount,
    deliveryCode
  });

  const populated = await baseOrderQuery().findById(order._id);
  await ensureOrderProductSlugs([populated]);

  await createNotification({
    userId: customer._id,
    actorId: req.user.id,
    type: 'order_created',
    metadata: {
      orderId: order._id,
      deliveryCity,
      deliveryAddress,
      status: 'pending'
    },
    allowSelf: true
  });
  await notifyBuyerDeliveryDistanceWarning({
    order,
    buyerId: customer._id,
    actorId: req.user.id,
    productId: orderItems[0]?.product || null
  }).catch(() => {});

  await sendOrderSms({
    phone: customer.phone,
    message: buildOrderPendingMessage(order),
    context: `order_created:${order._id}`
  });

  const sellerIds = Array.from(
    new Set(orderItems.map((item) => String(resolveItemShopId(item) || '')).filter(Boolean))
  );
  await invalidateUserCache(customer._id, ['orders']);
  await Promise.all(
    sellerIds.map((sellerId) => invalidateSellerCache(sellerId, ['orders', 'dashboard', 'analytics']))
  );
  await invalidateAdminCache(['admin', 'dashboard']);

  res.status(201).json(buildOrderResponse(populated));
});

// ─── Wallet Checkout (Proposal 6) ────────────────────────

export const walletCheckoutOrder = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.user?._id;
  const { items, deliveryMode, shippingAddress, promoEntries } = req.body;

  // Verify wallet payment is enabled
  const walletEnabled = await getRuntimeConfig('enable_wallet_payment', { fallback: false });
  if (!walletEnabled) {
    return res.status(403).json({ message: 'Le paiement par portefeuille est désactivé.' });
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'Aucun article dans la commande.' });
  }

  // Load wallet
  const { getOrCreateWallet } = await import('../services/walletService.js');
  const wallet = await getOrCreateWallet(userId);

  try {
  // Calculate total
  const productIds = items.map((i) => i.productId);
  const products = await Product.find({ _id: { $in: productIds }, status: 'approved' }).lean();
  if (products.length !== items.length) {
    return res.status(400).json({ message: 'Un ou plusieurs produits ne sont plus disponibles.' });
  }

  const productMap = new Map(products.map((p) => [String(p._id), p]));
  let totalAmount = 0;
  const orderItems = [];
  const consumedPromos = [];

  // Build promo entries map by sellerId (only non-empty codes)
  const promoEntriesMap = new Map();
  if (Array.isArray(promoEntries)) {
    promoEntries.forEach((pe) => {
      const code = String(pe?.promoCode || '').trim().toUpperCase();
      if (pe?.sellerId && code) {
        promoEntriesMap.set(String(pe.sellerId), code);
      }
    });
  }

  for (const item of items) {
    const product = productMap.get(String(item.productId));
    if (!product) continue;

    // Check per-shop wallet eligibility (by phone number)
    const shopId = String(product.user || product.shopId || '');
    const enabledPhonesStr = await getRuntimeConfig('wallet_enabled_shops', { fallback: '' });
    const enabledPhones = String(enabledPhonesStr)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (enabledPhones.length > 0) {
      const shop = await User.findById(shopId).select('phone').lean();
      const shopPhone = String(shop?.phone || '').trim();
      if (!shopPhone || !enabledPhones.includes(shopPhone)) {
        return res.status(400).json({
          message: `Le paiement par portefeuille n'est pas disponible pour la boutique de "${product.title}".`
        });
      }
    }

    const qty = Math.max(1, Number(item.quantity || 1));
    const price = Number(product.price || 0);
    const lineTotal = price * qty;
    totalAmount += lineTotal;

    orderItems.push({
      product: product._id,
      quantity: qty,
      unitPrice: price,
      lineTotal,
      snapshot: {
        title: product.title,
        price,
        image: Array.isArray(product.images) ? product.images[0] || '' : '',
        shopName: product.shopName || '',
        shopId: product.user || product.shopId,
        shopAddress: product.shopAddress || '',
        shopCity: product.city || '',
        shopCommune: product.commune || '',
        slug: product.slug || ''
      }
    });
  }

  // ── Apply promo codes per shop ──────────────────────────
  if (promoEntriesMap.size > 0) {
    // Group order items by shop
    const shopItemMap = new Map();
    orderItems.forEach((oi) => {
      const sid = String(oi.snapshot.shopId || 'unknown');
      if (!shopItemMap.has(sid)) shopItemMap.set(sid, []);
      shopItemMap.get(sid).push(oi);
    });

    for (const [sellerId, promoCode] of promoEntriesMap) {
      const sellerItems = shopItemMap.get(sellerId);
      if (!sellerItems || sellerItems.length === 0) continue;
      try {
        const promoResult = await consumeMarketplacePromoForOrder({
          code: promoCode,
          boutiqueId: sellerId,
          clientId: userId,
          items: sellerItems
        });
        if (promoResult?.applied) {
          consumedPromos.push({ promoId: promoResult.promo?._id, clientId: userId });
          const oldSubtotal = sellerItems.reduce((s, oi) => s + Number(oi.lineTotal || 0), 0);
          const newSubtotal = Number(promoResult.pricing?.finalAmount || oldSubtotal);
          const promoDiscount = Math.max(0, oldSubtotal - newSubtotal);
          totalAmount -= promoDiscount;
          // Apply discount proportionally across seller items
          if (promoDiscount > 0 && oldSubtotal > 0) {
            const ratio = newSubtotal / oldSubtotal;
            sellerItems.forEach((oi) => {
              oi.lineTotal = Math.round(Number(oi.lineTotal || 0) * ratio);
              oi.unitPrice = Math.round(Number(oi.unitPrice || 0) * ratio);
            });
          }
        }
      } catch {
        // Promo code invalid or expired — silently skip
      }
    }
  }

  // Apply wallet discount if configured
  const rawDiscountPercent = Number(await getRuntimeConfig('wallet_discount_percent', { fallback: 0 }));
  const walletDiscountPct = Math.min(100, Math.max(0, Number.isFinite(rawDiscountPercent) ? rawDiscountPercent : 0));
  const discountAmount = walletDiscountPct > 0 ? Math.round(totalAmount * (walletDiscountPct / 100)) : 0;
  const finalAmount = totalAmount - discountAmount;

  // Wallet must have enough balance for the discounted payment
  if (wallet.availableBalance < finalAmount) {
    return res.status(400).json({
      message: 'Solde portefeuille insuffisant pour finaliser cette commande.'
    });
  }

  // Deduct from wallet (discounted amount)
  const { purchaseFromWallet } = await import('../services/walletService.js');
  await purchaseFromWallet({
    userId,
    amount: finalAmount,
    reference: 'wallet-checkout'
  });

  // Create order(s) — one per shop
  const shopGroups = new Map();
  orderItems.forEach((oi) => {
    const sid = String(oi.snapshot.shopId || 'unknown');
    if (!shopGroups.has(sid)) shopGroups.set(sid, []);
    shopGroups.get(sid).push(oi);
  });

  // Distribute discount proportionally across shop groups
  const discountRate = totalAmount > 0 ? discountAmount / totalAmount : 0;

  const createdOrders = [];
  for (const [sellerId, sellerItems] of shopGroups) {
    const sellerSubtotal = sellerItems.reduce((s, i) => s + i.lineTotal, 0);
    const sellerDiscount = Math.round(sellerSubtotal * discountRate);
    const sellerTotal = sellerSubtotal - sellerDiscount;

    const order = await Order.create({
      customer: userId,
      createdBy: userId,
      items: sellerItems,
      deliveryAddress: shippingAddress?.addressLine || 'Adresse non spécifiée',
      deliveryCity: shippingAddress?.cityName || 'Brazzaville',
      shippingAddressSnapshot: {
        cityId: shippingAddress?.cityId || null,
        cityName: shippingAddress?.cityName || '',
        communeId: shippingAddress?.communeId || null,
        communeName: shippingAddress?.communeName || '',
        addressLine: shippingAddress?.addressLine || '',
        phone: shippingAddress?.phone || ''
      },
      status: 'paid',
      paymentType: 'full',
      paymentMode: 'FULL_PAYMENT',
      paymentSource: 'wallet',
      paymentStatus: 'PAID_FULL',
      paymentCompletedAt: new Date(),
      deliveryMode: deliveryMode || 'PICKUP',
      deliveryFeeSource: 'FULL_PAYMENT_WAIVER',
      deliveryFeeWaived: true,
      deliveryFeeLocked: true,
      itemsSubtotal: sellerSubtotal,
      deliveryFeeTotal: 0,
      discountTotal: sellerDiscount,
      totalAmount: sellerTotal,
      paidAmount: sellerTotal,
      remainingAmount: 0
    });
    createdOrders.push(order);
  }

  res.status(201).json({
    message: 'Commande payée via portefeuille HDMarket.',
    orders: createdOrders.map(buildOrderResponse)
  });
  } catch (err) {
    console.error('[walletCheckout] Error:', err?.message || err, err?.stack);
    return res.status(500).json({
      message: 'Erreur interne lors du paiement portefeuille. Veuillez réessayer.',
      error: process.env.NODE_ENV !== 'production' ? String(err?.message || err) : undefined
    });
  }
});

export const userCheckoutOrder = asyncHandler(async (req, res) => {
  const {
    payerName,
    transactionCode,
    payments,
    promoCode,
    paymentMode: rawPaymentMode,
    checkoutPromotionApplied,
    deliveryMode: rawDeliveryMode,
    shippingAddress
  } = req.body;
  const userId = req.user?.id || req.user?._id;
  const deliveryMode = normalizeDeliveryMode(rawDeliveryMode);
  const requestedPaymentMode = normalizeCheckoutPaymentMode(rawPaymentMode);

  const customer = await User.findById(userId).select(
    'name email phone address city commune restrictions'
  );
  if (!customer) {
    return res.status(404).json({ message: 'Client introuvable.' });
  }
  if (isRestricted(customer, 'canOrder')) {
    return res.status(403).json({
      message: getRestrictionMessage('canOrder'),
      restrictionType: 'canOrder'
    });
  }

  const cart = await Cart.findOne({ user: userId }).lean();
  if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
    return res.status(400).json({ message: 'Votre panier est vide.' });
  }

  const normalizedItems = cart.items.map((item) => ({
    productId: item.product,
    quantity: Number(item.quantity) > 0 ? Number(item.quantity) : 1,
    selectedAttributes: Array.isArray(item.selectedAttributes) ? item.selectedAttributes : []
  }));
  const productIds = normalizedItems.map((item) => item.productId);
  if (productIds.some((id) => !ensureObjectId(id))) {
    return res.status(400).json({ message: 'Produit invalide.' });
  }

  const [productDocs, verifiedProductIds] = await Promise.all([
    Product.find({ _id: { $in: productIds } }).populate(
      'user',
      'shopName name slug shopAddress city commune freeDeliveryEnabled freeDeliveryNote'
    ),
    getVerifiedProductIds()
  ]);
  const verifiedProductSet = toIdSet(verifiedProductIds);
  const productMap = new Map(productDocs.map((doc) => [doc._id.toString(), doc]));

  let orderItems;
  try {
    orderItems = normalizedItems.map((item) => {
      const product = productMap.get(item.productId.toString());
      if (!isPurchasableProduct(product, verifiedProductSet)) {
        throw Object.assign(new Error('Produit indisponible ou non approuvé.'), { statusCode: 400 });
      }
      const selectedAttributesValidation = validateSelectedAttributesForProduct({
        productAttributes: product.attributes,
        selectedAttributes: item.selectedAttributes
      });
      if (!selectedAttributesValidation.valid) {
        throw Object.assign(new Error(selectedAttributesValidation.message), { statusCode: 400 });
      }
      return buildOrderItemFromProduct(
        product,
        item.quantity,
        selectedAttributesValidation.selectedAttributes
      );
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    throw error;
  }

  const missingSellerItem = orderItems.find((item) => !resolveItemShopId(item));
  if (missingSellerItem) {
    return res.status(400).json({ message: 'Vendeur introuvable pour un produit.' });
  }

  const itemsBySeller = new Map();
  orderItems.forEach((item) => {
    const shopId = resolveItemShopId(item);
    if (!shopId) return;
    const shopKey = String(shopId);
    if (!itemsBySeller.has(shopKey)) {
      itemsBySeller.set(shopKey, []);
    }
    itemsBySeller.get(shopKey).push(item);
  });

  if (!itemsBySeller.size) {
    return res.status(400).json({ message: 'Aucun vendeur associé à la commande.' });
  }

  const hasPickupOnlyInCart = orderItems.some((item) =>
    isPickupOnlyProduct({
      deliveryAvailable: item?.snapshot?.deliveryAvailable,
      pickupAvailable: item?.snapshot?.pickupAvailable
    })
  );
  if (deliveryMode === 'DELIVERY' && hasPickupOnlyInCart) {
    return res.status(400).json({
      message:
        'Votre panier contient un produit disponible uniquement en retrait boutique. Passez en mode retrait.'
    });
  }

  const normalizedPayments = Array.isArray(payments) ? payments : [];
  const paymentsBySeller = new Map();
  if (normalizedPayments.length) {
    for (const payment of normalizedPayments) {
      if (!ensureObjectId(payment?.sellerId)) {
        return res.status(400).json({ message: 'Vendeur invalide.' });
      }
      paymentsBySeller.set(String(payment.sellerId), {
        payerName: payment?.payerName?.trim() || '',
        transactionCode: normalizeTransactionCode(payment?.transactionCode),
        promoCode: payment?.promoCode?.trim() || ''
      });
    }
  }

  const fallbackPayer = payerName?.trim() || '';
  const fallbackTransaction = normalizeTransactionCode(transactionCode);
  const fallbackPromoCode = promoCode?.trim() || '';
  const usePaymentList = paymentsBySeller.size > 0;
  const shipping = await resolveCheckoutAddress({
    deliveryMode,
    shippingAddress,
    customer
  });
  const [fullPaymentPromotionEnabled, enableFullPaymentFreeDelivery] = await Promise.all([
    getRuntimeConfig('full_payment_promotion_enabled', { fallback: true }),
    getRuntimeConfig('enable_full_payment_free_delivery', { fallback: true })
  ]);
  const useFullPayment =
    requestedPaymentMode === 'FULL_PAYMENT' &&
    Boolean(fullPaymentPromotionEnabled) &&
    Boolean(enableFullPaymentFreeDelivery) &&
    String(rawDeliveryMode || '').trim().toUpperCase() !== 'INSTALLMENT';
  const sellerDocs = await User.find({ _id: { $in: Array.from(itemsBySeller.keys()) } })
    .select('_id freeDeliveryEnabled')
    .lean();
  const sellerMap = new Map(sellerDocs.map((seller) => [String(seller._id), seller]));

  if (!usePaymentList && itemsBySeller.size > 1) {
    return res
      .status(400)
      .json({ message: 'Veuillez renseigner le nom et le code de transaction pour chaque vendeur.' });
  }

  if (!usePaymentList && (!fallbackPayer || !fallbackTransaction)) {
    return res.status(400).json({ message: 'Veuillez renseigner le nom et le code de transaction.' });
  }

  if (usePaymentList) {
    const missingPayments = Array.from(itemsBySeller.keys()).filter((sellerId) => {
      const payment = paymentsBySeller.get(sellerId);
      return !payment || !payment.payerName || !payment.transactionCode;
    });
    if (missingPayments.length) {
      return res
        .status(400)
        .json({ message: 'Veuillez renseigner le nom et le code de transaction pour chaque vendeur.' });
    }
  }

  const transactionCodesForCheckout = usePaymentList
    ? Array.from(itemsBySeller.keys()).map(
        (sellerId) => normalizeTransactionCode(paymentsBySeller.get(sellerId)?.transactionCode)
      )
    : [normalizeTransactionCode(fallbackTransaction)];

  const hasInvalidTransactionCode = transactionCodesForCheckout.some((code) => !/^\d{10}$/.test(code));
  if (hasInvalidTransactionCode) {
    return res.status(400).json({ message: 'Le code de transaction doit contenir exactement 10 chiffres.' });
  }

  if (new Set(transactionCodesForCheckout).size !== transactionCodesForCheckout.length) {
    return res.status(409).json({ message: 'Chaque vendeur doit avoir un code transaction unique.' });
  }

  const usedTransactionCodes = await findUsedTransactionCodes(transactionCodesForCheckout);
  if (usedTransactionCodes.size > 0) {
    return res.status(409).json({ message: TRANSACTION_CODE_REUSED_MESSAGE });
  }

  // Delete existing draft orders for this user when confirming
  await Order.deleteMany({ customer: userId, isDraft: true });

  const consumedPromos = [];
  let orderPayloads = [];
  let createdOrders = [];

  try {
    // Generate unique delivery codes for each order
    orderPayloads = await Promise.all(
      Array.from(itemsBySeller.entries()).map(async ([sellerId, sellerItems]) => {
        const itemsSubtotal = calculateOrderItemsSubtotal(sellerItems);
        let discountedSubtotal = Number(itemsSubtotal || 0);
        const paymentInfo = usePaymentList
          ? paymentsBySeller.get(sellerId)
          : {
              payerName: fallbackPayer,
              transactionCode: fallbackTransaction,
              promoCode: fallbackPromoCode
            };
        const promoCodeValue = paymentInfo?.promoCode?.trim() || '';
        let appliedPromoCode = null;

        if (promoCodeValue) {
          const promoResult = await consumeMarketplacePromoForOrder({
            code: promoCodeValue,
            boutiqueId: sellerId,
            clientId: userId,
            items: sellerItems
          });
          if (promoResult?.applied) {
            consumedPromos.push({ promoId: promoResult.promo?._id, clientId: userId });
            discountedSubtotal = Number(promoResult.pricing?.finalAmount || discountedSubtotal);
            appliedPromoCode = {
              code: promoResult.promo.code,
              boutiqueId: promoResult.promo.boutiqueId,
              appliesTo: promoResult.promo.appliesTo,
              productId: promoResult.promo.productId || null,
              discountType: promoResult.promo.discountType,
              discountValue: Number(promoResult.promo.discountValue || 0),
              discountAmount: Number(promoResult.pricing?.discountAmount || 0)
            };
          }
        }

        const discountTotal = Math.max(0, Number(itemsSubtotal || 0) - Number(discountedSubtotal || 0));
        const deliveryPricing = resolveDeliveryPricing({
          deliveryMode,
          commune: shipping.communeDoc,
          shop: sellerMap.get(String(sellerId)) || null,
          items: sellerItems.map((item) => ({
            deliveryAvailable: item?.snapshot?.deliveryAvailable,
            pickupAvailable: item?.snapshot?.pickupAvailable,
            deliveryFee: item?.snapshot?.deliveryFee,
            deliveryFeeEnabled: item?.snapshot?.deliveryFeeEnabled !== false
          }))
        });
        const deliveryFeeTotal =
          useFullPayment && Boolean(enableFullPaymentFreeDelivery)
            ? 0
            : Number(deliveryPricing.deliveryFeeTotal || 0);
        const totalAmount = Number((Number(discountedSubtotal || 0) + deliveryFeeTotal).toFixed(2));
        const paidAmount = useFullPayment ? totalAmount : Math.round(Number(discountedSubtotal || 0) * 0.25);
        const remainingAmount = useFullPayment ? 0 : Math.max(0, totalAmount - paidAmount);
        const deliveryCode = await generateDeliveryCode();

        return {
          sellerId,
          items: sellerItems,
          customer: customer._id,
          createdBy: userId,
          deliveryAddress: shipping.deliveryAddress,
          deliveryCity: shipping.deliveryCity,
          shippingAddressSnapshot: shipping.snapshot,
          status: useFullPayment ? 'paid' : 'pending',
          paymentType: 'full',
          paymentMode: useFullPayment ? 'FULL_PAYMENT' : 'STANDARD',
          deliveryFeeWaived: useFullPayment,
          deliveryFeeLocked: useFullPayment,
          deliveryFeeWaiverReason: useFullPayment ? 'FULL_PAYMENT' : '',
          paymentStatus: useFullPayment ? 'PAID_FULL' : 'PARTIAL',
          paymentCompletedAt: useFullPayment ? new Date() : null,
          checkoutPromotionApplied: Boolean(checkoutPromotionApplied) && useFullPayment,
          deliveryMode,
          deliveryFeeSource:
            useFullPayment && Boolean(enableFullPaymentFreeDelivery)
              ? 'FULL_PAYMENT_WAIVER'
              : deliveryPricing.deliveryFeeSource || DELIVERY_FEE_SOURCE.PRODUCT_FEE,
          deliveryFeeTotal,
          itemsSubtotal: Number(itemsSubtotal.toFixed(2)),
          discountTotal: Number(discountTotal.toFixed(2)),
          trackingNote: '',
          totalAmount,
          paidAmount,
          remainingAmount,
          paymentName: paymentInfo.payerName,
          paymentTransactionCode: paymentInfo.transactionCode,
          deliveryCode,
          appliedPromoCode
        };
      })
    );

    createdOrders = await Order.create(
      orderPayloads.map(({ sellerId, ...payload }) => payload)
    );

    await Cart.updateOne({ user: userId }, { $set: { items: [] } });
  } catch (error) {
    if (consumedPromos.length) {
      await Promise.all(
        consumedPromos.map((entry) =>
          rollbackConsumedMarketplacePromo({ promoId: entry.promoId, clientId: entry.clientId })
        )
      );
    }
    if (error?.status) {
      return res.status(error.status).json({ message: error.message, reason: error.reason || undefined });
    }
    throw error;
  }

  const responseOrders = createdOrders.map(buildOrderResponse);
  if (responseOrders.length === 1) {
    res.status(201).json(responseOrders[0]);
  } else {
    res.status(201).json({ orders: responseOrders, count: responseOrders.length });
  }

  const affectedSellerIds = Array.from(
    new Set(orderPayloads.map((entry) => String(entry.sellerId || '')).filter(Boolean))
  );
  const checkoutNotifications = [
    ...createdOrders.map((order, index) => {
      const { sellerId, items } = orderPayloads[index];
      const itemCount = items.reduce((sum, item) => sum + Number(item.quantity || 1), 0);
      const totalAmount = Number(order.totalAmount || 0);
      const productId = items[0]?.product || null;
      return {
        userId: sellerId,
        actorId: userId,
        productId,
        type: 'order_received',
        metadata: {
          orderId: order._id,
          itemCount,
          totalAmount,
          paymentMode: order.paymentMode,
          deliveryFeeWaived: Boolean(order.deliveryFeeWaived),
          deliveryFeeLocked: Boolean(order.deliveryFeeLocked)
        }
      };
    }),
    ...createdOrders.map((order) => ({
      userId: customer._id,
      actorId: userId,
      type: 'order_created',
      metadata: {
        orderId: order._id,
        deliveryCity: order.deliveryCity,
        deliveryAddress: order.deliveryAddress,
        status: order.status,
        paymentMode: order.paymentMode,
        paymentStatus: order.paymentStatus,
        deliveryFeeWaived: Boolean(order.deliveryFeeWaived),
        deliveryFeeLocked: Boolean(order.deliveryFeeLocked)
      },
      allowSelf: true
    })),
    ...createdOrders
      .map((order, index) =>
        buildDeliveryDistanceWarningPayload({
          order,
          buyerId: customer._id,
          actorId: userId,
          productId: orderPayloads[index]?.items?.[0]?.product || null
        })
      )
      .filter(Boolean)
  ];

  if (useFullPayment) {
    checkoutNotifications.push(
      ...createdOrders.map((order) => ({
        userId: customer._id,
        actorId: userId,
        type: 'order_full_payment_waived',
        metadata: {
          orderId: order._id,
          totalAmount: Number(order.totalAmount || 0),
          deliveryFeeWaived: true,
          deliveryFeeLocked: true
        },
        allowSelf: true
      })),
      ...createdOrders.map((order, index) => ({
        userId: orderPayloads[index].sellerId,
        actorId: userId,
        type: 'order_full_payment_received',
        metadata: {
          orderId: order._id,
          totalAmount: Number(order.totalAmount || 0),
          deliveryFeeLocked: true
        }
      }))
    );
  }

  const fullPaymentAdminNotifications = useFullPayment
    ? createdOrders.map((order) => ({
        actorId: userId,
        type: 'order_full_payment_ready',
        metadata: {
          orderId: order._id,
          totalAmount: Number(order.totalAmount || 0),
          deliveryFeeWaived: true,
          deliveryFeeLocked: true,
          status: order.status
        }
      }))
    : [];
  const checkoutSmsMessages = createdOrders.map((order) => ({
    phone: customer.phone,
    message: buildOrderPendingMessage(order),
    context: `order_created:${order._id}`
  }));

  // Post-checkout side effects are best-effort and should never delay or fail the checkout response.
  void dispatchSideEffect(
    'checkout',
    {
      orderIds: createdOrders.map((order) => order._id),
      customerId: userId,
      sellerIds: affectedSellerIds,
      notifications: checkoutNotifications,
      smsMessages: checkoutSmsMessages,
      fullPaymentAdminNotifications
    },
    async () => {
    await safeAsync(
      async () => {
        const populated = await baseOrderQuery().find({
          _id: { $in: createdOrders.map((order) => order._id) }
        });
        await ensureOrderProductSlugs(populated);
      },
      { label: 'checkout_post_response_populate_and_slug_orders' }
    );

    await safeAsync(
      async () =>
        Promise.all(
          createdOrders.map((order, index) => {
            const { sellerId, items } = orderPayloads[index];
            const itemCount = items.reduce((sum, item) => sum + Number(item.quantity || 1), 0);
            const totalAmount = Number(order.totalAmount || 0);
            const productId = items[0]?.product || null;
            return createNotification({
              userId: sellerId,
              actorId: userId,
              productId,
              type: 'order_received',
              metadata: {
                orderId: order._id,
                itemCount,
                totalAmount,
                paymentMode: order.paymentMode,
                deliveryFeeWaived: Boolean(order.deliveryFeeWaived),
                deliveryFeeLocked: Boolean(order.deliveryFeeLocked)
              }
            });
          })
        ),
      { label: 'checkout_notify_sellers' }
    );

    await safeAsync(
      async () =>
        Promise.all(
          [
            ...createdOrders.map((order) => ({
              userId: customer._id,
              actorId: userId,
              type: 'order_created',
              metadata: {
                orderId: order._id,
                deliveryCity: order.deliveryCity,
                deliveryAddress: order.deliveryAddress,
                status: order.status,
                paymentMode: order.paymentMode,
                paymentStatus: order.paymentStatus,
                deliveryFeeWaived: Boolean(order.deliveryFeeWaived),
                deliveryFeeLocked: Boolean(order.deliveryFeeLocked)
              },
              allowSelf: true
            })),
            ...createdOrders
              .map((order, index) =>
                buildDeliveryDistanceWarningPayload({
                  order,
                  buyerId: customer._id,
                  actorId: userId,
                  productId: orderPayloads[index]?.items?.[0]?.product || null
                })
              )
              .filter(Boolean)
          ].map((payload) => createNotification(payload))
        ),
      { label: 'checkout_notify_customer' }
    );

    await safeAsync(
      async () =>
        Promise.all(
          createdOrders.map((order) =>
            sendOrderSms({
              phone: customer.phone,
              message: buildOrderPendingMessage(order),
              context: `order_created:${order._id}`
            })
          )
        ),
      { label: 'checkout_sms_customer' }
    );

    if (useFullPayment) {
      await safeAsync(
        async () =>
          Promise.all(
            createdOrders.map((order) =>
              createNotification({
                userId: customer._id,
                actorId: userId,
                type: 'order_full_payment_waived',
                metadata: {
                  orderId: order._id,
                  totalAmount: Number(order.totalAmount || 0),
                  deliveryFeeWaived: true,
                  deliveryFeeLocked: true
                },
                allowSelf: true
              })
            )
          ),
        { label: 'checkout_notify_full_payment_buyer' }
      );

      await safeAsync(
        async () =>
          Promise.all(
            createdOrders.map((order, index) =>
              createNotification({
                userId: orderPayloads[index].sellerId,
                actorId: userId,
                type: 'order_full_payment_received',
                metadata: {
                  orderId: order._id,
                  totalAmount: Number(order.totalAmount || 0),
                  deliveryFeeLocked: true
                }
              })
            )
          ),
        { label: 'checkout_notify_full_payment_seller' }
      );

      await safeAsync(
        async () => {
          const adminUsers = await User.find({ role: { $in: ['admin', 'manager', 'founder'] } })
            .select('_id')
            .lean();
          if (!adminUsers.length) return;
          await Promise.all(
            createdOrders.flatMap((order) =>
              adminUsers.map((adminUser) =>
                createNotification({
                  userId: adminUser._id,
                  actorId: userId,
                  type: 'order_full_payment_ready',
                  metadata: {
                    orderId: order._id,
                    totalAmount: Number(order.totalAmount || 0),
                    deliveryFeeWaived: true,
                    deliveryFeeLocked: true,
                    status: order.status
                  }
                })
              )
            )
          );
        },
        { label: 'checkout_notify_full_payment_admins' }
      );
    }

    await safeAsync(
      async () => invalidateUserCache(userId, ['orders', 'cart', 'notifications']),
      { label: 'checkout_invalidate_user_cache' }
    );
    await safeAsync(
      async () =>
        Promise.all(
          affectedSellerIds.map((sellerId) =>
            invalidateSellerCache(sellerId, ['orders', 'dashboard', 'analytics'])
          )
        ),
      { label: 'checkout_invalidate_seller_cache' }
    );
    await safeAsync(async () => invalidateAdminCache(['admin', 'dashboard']), {
      label: 'checkout_invalidate_admin_cache'
    });
    },
    { label: 'checkout_post_response_side_effects' }
  );
});

export const adminListOrders = asyncHandler(async (req, res) => {
  const {
    status,
    search = '',
    page = 1,
    limit = 20,
    orderId: orderIdParam,
    city,
    shop,
    shopId,
    dateFrom,
    dateTo,
    deliveryMode,
    paymentType,
    delayed,
    priority
  } = req.query || {};

  const filter = await buildAdvancedAdminOrderFilter({
    status,
    search,
    orderId: orderIdParam,
    city,
    shop,
    shopId,
    dateFrom,
    dateTo,
    deliveryMode,
    paymentType,
    delayed,
    priority
  });

  const pageNumber = Math.max(1, Number(page) || 1);
  const pageSize = Math.max(1, Math.min(Number(limit) || 20, 100));
  const skip = (pageNumber - 1) * pageSize;

  const [orders, total] = await Promise.all([
    baseOrderQuery()
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize),
    Order.countDocuments(filter)
  ]);
  await ensureOrderProductSlugs(orders);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  res.json({
    items: orders.map(buildOrderResponse),
    total,
    page: pageNumber,
    pageSize,
    totalPages
  });
});

export const adminUpdateOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!ensureObjectId(id)) {
    return res.status(400).json({ message: 'Commande inconnue.' });
  }

  const order = await Order.findById(id);
  if (!order) {
    return res.status(404).json({ message: 'Commande introuvable.' });
  }

  const { status, deliveryAddress, deliveryCity, trackingNote, deliveryGuyId, cancellationReason } = req.body;
  const previousStatus = order.status;
  let notifyPending = false;
  let notifyConfirmed = false;
  let notifyDelivering = false;
  let notifyDelivered = false;
  let notifyCancelled = false;
  let deliveredTimestampAdded = false;

  if (status) {
    const statusChangedAt = new Date();
    if (!ORDER_STATUS.includes(status)) {
      return res.status(400).json({ message: 'Statut invalide.' });
    }
    // Prevent cancelling already delivered orders
    if (
      status === 'cancelled' &&
      ['delivery_proof_submitted', 'delivered', 'confirmed_by_client', 'completed', 'picked_up_confirmed'].includes(order.status)
    ) {
      return res.status(400).json({ message: 'Impossible d\'annuler une commande déjà livrée.' });
    }
    if (status === 'delivered' && order.deliveryMode !== 'PICKUP' && !hasValidDeliveryEvidence(order)) {
      return res.status(400).json({
        message:
          'Impossible de marquer livrée sans preuve complète (photo + signature + date de livraison).'
      });
    }
    if (
      status === 'picked_up_confirmed' &&
      order.deliveryMode === 'PICKUP' &&
      (!hasValidDeliveryEvidence(order) || !hasMinimumDeliveryProofImages(order, 3))
    ) {
      return res.status(400).json({
        message: 'Retrait impossible sans preuve complète (signature + au moins 3 photos).'
      });
    }
    if (order.status !== status) {
      order.status = status;
      notifyPending = status === 'pending';
      notifyConfirmed = status === 'confirmed';
      notifyDelivering = status === 'delivering' || status === 'out_for_delivery';
      notifyDelivered = status === 'delivered';
      notifyCancelled = status === 'cancelled';
    }
    if (['confirmed', 'ready_for_delivery'].includes(status) && !order.confirmedAt) {
      order.confirmedAt = statusChangedAt;
    }
    if (status === 'ready_for_pickup' && !order.readyForPickupAt) {
      order.readyForPickupAt = statusChangedAt;
    }
    if ((status === 'delivering' || status === 'out_for_delivery') && !order.outForDeliveryAt) {
      order.outForDeliveryAt = statusChangedAt;
    }
    if ((status === 'delivering' || status === 'out_for_delivery') && !order.shippedAt) {
      order.shippedAt = statusChangedAt;
    }
    if (status === 'delivery_proof_submitted' && !order.deliverySubmittedAt) {
      order.deliverySubmittedAt = statusChangedAt;
    }
    if (status === 'delivered' && !order.deliveredAt) {
      order.deliveredAt = order.deliveryDate || statusChangedAt;
      notifyDelivered = true;
      deliveredTimestampAdded = true;
    }
    if (status === 'picked_up_confirmed' && !order.deliveredAt) {
      order.deliveredAt = statusChangedAt;
      notifyDelivered = true;
      deliveredTimestampAdded = true;
    }
    if (status === 'confirmed_by_client' && !order.clientDeliveryConfirmedAt) {
      order.clientDeliveryConfirmedAt = statusChangedAt;
    }
    if (status === 'completed' && !order.completedAt) {
      order.completedAt = statusChangedAt;
    }
    if (status === 'cancelled' && !order.cancelledAt) {
      order.cancelledAt = statusChangedAt;
      order.cancelledBy = req.user.id;
      if (cancellationReason && typeof cancellationReason === 'string') {
        order.cancellationReason = cancellationReason.trim();
      }
    }
  }

  if (typeof deliveryAddress !== 'undefined') {
    order.deliveryAddress = deliveryAddress.trim();
  }
  if (typeof deliveryCity !== 'undefined') {
    order.deliveryCity = deliveryCity;
  }
  if (typeof trackingNote !== 'undefined') {
    order.trackingNote = trackingNote.toString();
  }

  if (typeof deliveryGuyId !== 'undefined') {
    if (!deliveryGuyId) {
      order.deliveryGuy = undefined;
    } else if (!ensureObjectId(deliveryGuyId)) {
      return res.status(400).json({ message: 'Livreur invalide.' });
    } else {
      const deliveryGuy = await DeliveryGuy.findById(deliveryGuyId).select('_id');
      if (!deliveryGuy) {
        return res.status(404).json({ message: 'Livreur introuvable.' });
      }
      order.deliveryGuy = deliveryGuy._id;
    }
  }

  await order.save();
  await syncReviewReminderForOrderLifecycle(order);
  const baseMetadata = {
    orderId: order._id,
    deliveryAddress: order.deliveryAddress,
    deliveryCity: order.deliveryCity
  };

  if (notifyPending && previousStatus !== 'pending') {
    await createNotification({
      userId: order.customer,
      actorId: req.user.id,
      type: 'order_created',
      metadata: {
        ...baseMetadata,
        status: 'pending'
      },
      allowSelf: true
    });
  }
  if (notifyConfirmed && previousStatus !== 'confirmed') {
    // Update product salesCount when order is confirmed
    if (Array.isArray(order.items)) {
      for (const item of order.items) {
        if (item.product) {
          const salesCount = await calculateProductSalesCount(item.product);
          await Product.updateOne(
            { _id: item.product },
            { $set: { salesCount } }
          );
        }
      }
    }

    await createNotification({
      userId: order.customer,
      actorId: req.user.id,
      type: 'order_created',
      metadata: {
        ...baseMetadata,
        status: 'confirmed'
      },
      allowSelf: true
    });
  }
  if (notifyDelivering && previousStatus !== 'delivering') {
    await createNotification({
      userId: order.customer,
      actorId: req.user.id,
      type: 'order_delivering',
      metadata: {
        ...baseMetadata,
        status: 'delivering'
      },
      allowSelf: true
    });
  }
  if (notifyDelivered && (previousStatus !== 'delivered' || deliveredTimestampAdded)) {
    await createNotification({
      userId: order.customer,
      actorId: req.user.id,
      type: 'order_delivered',
      metadata: {
        ...baseMetadata,
        status: 'delivered',
        deliveredAt: order.deliveredAt
      },
      allowSelf: true
    });
  }

  if (notifyDelivering && isTwilioMessagingConfigured()) {
    const customer = await User.findById(order.customer).select('phone');
    await sendOrderSms({
      phone: customer?.phone,
      message: buildOrderDeliveringMessage(order),
      context: `order_delivering:${order._id}`
    });
  }

  if (notifyCancelled && previousStatus !== 'cancelled') {
    await createNotification({
      userId: order.customer,
      actorId: req.user.id,
      type: 'order_cancelled',
      metadata: {
        orderId: order._id,
        deliveryAddress: order.deliveryAddress,
        deliveryCity: order.deliveryCity,
        status: 'cancelled',
        cancelledBy: 'admin',
        reason: order.cancellationReason
      },
      allowSelf: true
    });

    // Update product salesCount when order is cancelled (decrease count)
    if (Array.isArray(order.items)) {
      for (const item of order.items) {
        if (item.product) {
          const salesCount = await calculateProductSalesCount(item.product);
          await Product.updateOne(
            { _id: item.product },
            { $set: { salesCount } }
          );
        }
      }
    }

    // Send SMS if configured
    if (isTwilioMessagingConfigured()) {
      const customer = await User.findById(order.customer).select('phone');
      if (customer?.phone) {
        const itemsSummary = buildSmsItemsSummary(order.items);
        const total = formatSmsAmount(order.totalAmount);
        const reasonText = order.cancellationReason ? ` Raison: ${order.cancellationReason}` : '';
        const orderId = order._id ? String(order._id).slice(-6) : '';
      const message = `HDMarket : Votre commande ${orderId} a été annulée.${reasonText} ${itemsSummary ? `| ${itemsSummary}` : ''} | Total: ${total} FCFA`;
        await sendOrderSms({
          phone: customer.phone,
          message,
          context: `order_cancelled:${order._id}`
        });
      }
    }
  }

  const populated = await baseOrderQuery().findById(order._id);
  await ensureOrderProductSlugs([populated]);
  await invalidateOrderCachesForMutation({
    customerId: order.customer,
    sellerIds: (order.items || []).map((item) => resolveItemShopId(item))
  });
  res.json(buildOrderResponse(populated));
});

export const adminSendOrderReminder = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!ensureObjectId(id)) {
    return res.status(400).json({ message: 'Commande inconnue.' });
  }

  const order = await Order.findById(id).lean();
  if (!order) {
    return res.status(404).json({ message: 'Commande introuvable.' });
  }
  if (['delivery_proof_submitted', 'delivered', 'confirmed_by_client', 'completed', 'picked_up_confirmed'].includes(order.status)) {
    return res.status(400).json({ message: 'Commande déjà livrée.' });
  }

  const items = Array.isArray(order.items) ? order.items : [];
  const sellerIds = new Set();
  items.forEach((item) => {
    const shopId = item?.snapshot?.shopId;
    if (shopId) sellerIds.add(String(shopId));
  });

  if (!sellerIds.size) {
    return res.status(400).json({ message: 'Aucun vendeur associé à cette commande.' });
  }

  await Promise.all(
    Array.from(sellerIds).map((sellerId) =>
      createNotification({
        userId: sellerId,
        actorId: req.user.id,
        type: 'order_reminder',
        metadata: {
          orderId: order._id,
          status: order.status,
          deliveryCity: order.deliveryCity,
          deliveryAddress: order.deliveryAddress
        }
      })
    )
  );

  res.json({ message: 'Rappel envoyé aux vendeurs.' });
});

export const adminDeleteOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!ensureObjectId(id)) {
    return res.status(400).json({ message: 'Commande inconnue.' });
  }

  const order = await Order.findById(id);
  if (!order) {
    return res.status(404).json({ message: 'Commande introuvable.' });
  }

  await OrderMessage.deleteMany({ order: order._id });

  const productIds = (order.items || [])
    .map((item) => item?.product)
    .filter(Boolean);

  await Order.findByIdAndDelete(id);

  for (const productId of productIds) {
    const salesCount = await calculateProductSalesCount(productId);
    await Product.updateOne({ _id: productId }, { $set: { salesCount } });
  }

  await invalidateOrderCachesForMutation({
    customerId: order.customer,
    sellerIds: (order.items || []).map((item) => resolveItemShopId(item))
  });
  res.json({ message: 'Commande supprimée.' });
});

export const adminOrderStats = asyncHandler(async (req, res) => {
  const matchStage = await buildAdvancedAdminOrderFilter(req.query || {});
  const pipeline = Object.keys(matchStage).length ? [{ $match: matchStage }] : [];

  const [statusAgg, recentAgg] = await Promise.all([
    Order.aggregate([
      ...pipeline,
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]),
    Order.aggregate([
      ...pipeline,
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } },
      { $limit: 12 }
    ])
  ]);

  const statusCounts = ORDER_STATUS.reduce(
    (acc, key) => ({
      ...acc,
      [key]: statusAgg.find((item) => item._id === key)?.count || 0
    }),
    {}
  );

  const timeline = recentAgg.map((item) => {
    const [year, month] = item._id.split('-');
    const date = new Date(Number(year), Number(month) - 1, 1);
    return {
      label: date.toLocaleString('fr-FR', { month: 'short', year: 'numeric' }),
      count: item.count
    };
  });

  res.json({
    statusCounts,
    total: statusAgg.reduce((sum, item) => sum + item.count, 0),
    timeline
  });
});

export const adminSearchCustomers = asyncHandler(async (req, res) => {
  const { search = '' } = req.query;
  const query = {};
  if (search.trim()) {
    const regex = new RegExp(search.trim(), 'i');
    query.$or = [{ name: regex }, { email: regex }, { phone: regex }];
  }
  const users = await User.find(query)
    .sort({ createdAt: -1 })
    .limit(20)
    .select('name email phone address city accountType');
  res.json(users);
});

export const adminSearchProducts = asyncHandler(async (req, res) => {
  const { search = '' } = req.query;
  const filter = { status: 'approved' };
  if (search.trim()) {
    const regex = new RegExp(search.trim(), 'i');
    filter.$or = [{ title: regex }, { description: regex }];
  }
  const products = await Product.find(filter)
    .sort({ createdAt: -1 })
    .limit(20)
    .select('title price images user status slug')
    .populate('user', 'shopName name slug shopAddress city commune');
  res.json(products);
});

export const userListOrders = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.user?._id;
  const { status, statusGroup, search = '', page = 1, limit = 6 } = req.query || {};

  const filter = userId ? { customer: userId, isDraft: false } : { customer: null, isDraft: false };
  applyOrderStatusFilter(filter, { status, statusGroup, role: 'buyer' });

  // Add search functionality for product names
  if (search.trim()) {
    const regex = new RegExp(search.trim(), 'i');
    filter.$or = [
      { 'items.snapshot.title': regex }, // Recherche par nom de produit
      { 'items.snapshot.shopName': regex }, // Recherche par nom de boutique
      { deliveryAddress: regex }, // Recherche par adresse
      { deliveryCode: regex } // Recherche par code de livraison
    ];
  }

  const pageNumber = Math.max(1, Number(page) || 1);
  const requestedLimit = Number(limit) || 6;
  const pageSize = Math.max(1, requestedLimit > 24 ? Math.min(requestedLimit, 500) : Math.min(requestedLimit, 24));
  const skip = (pageNumber - 1) * pageSize;

  const [orders, total] = await Promise.all([
    baseOrderQuery()
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize),
    Order.countDocuments(filter)
  ]);
  await ensureOrderProductSlugs(orders);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  res.json({
    items: orders.map(buildOrderResponse),
    total,
    page: pageNumber,
    pageSize,
    totalPages
  });
});

export const userOrdersSummary = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.user?._id;
  const buyerMatchIds = userId && ensureObjectId(userId) ? [String(userId), new mongoose.Types.ObjectId(userId)] : [String(userId || '')];
  const baseFilter = userId ? { customer: { $in: buyerMatchIds } } : { customer: null };
  const summary = await buildOrderSummary({ baseFilter, role: 'buyer' });
  res.json(summary);
});

// Get single order (buyer)
export const getUserOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user?.id || req.user?._id;
  if (!ensureObjectId(id)) {
    return res.status(400).json({ message: 'Commande inconnue.' });
  }

  // First try: user is the customer
  let order = await baseOrderQuery().findOne({ _id: id, customer: userId, isDraft: false });

  // Fallback: user is a seller of items in this order (e.g., shop user routed to buyer link)
  if (!order) {
    order = await baseOrderQuery().findOne({
      _id: id,
      'items.snapshot.shopId': userId,
      isDraft: false
    });
  }

  if (!order) {
    return res.status(404).json({ message: 'Commande introuvable.' });
  }
  await ensureOrderProductSlugs([order]);

  // If user is not the customer, filter items to only show their shop's items
  const userIdStr = String(userId);
  const isCustomer = String(order.customer?._id || order.customer) === userIdStr;
  if (!isCustomer) {
    const filteredItems = filterOrderItemsForSeller(order, userId);
    if (!filteredItems.length) {
      return res.status(404).json({ message: 'Commande introuvable.' });
    }
    const response = buildOrderResponse(order);
    response.items = filteredItems.map((item) => {
      const normalized = item.toObject ? item.toObject() : item;
      return { ...normalized, snapshot: normalized.snapshot || {} };
    });
    return res.json(response);
  }

  res.json(buildOrderResponse(order));
});

// Save draft order
export const saveDraftOrder = asyncHandler(async (req, res) => {
  const { payments } = req.body;
  const userId = req.user?.id || req.user?._id;

  const customer = await User.findById(userId).select('name email phone address city restrictions');
  if (!customer) {
    return res.status(404).json({ message: 'Client introuvable.' });
  }
  if (isRestricted(customer, 'canOrder')) {
    return res.status(403).json({
      message: getRestrictionMessage('canOrder'),
      restrictionType: 'canOrder'
    });
  }

  const cart = await Cart.findOne({ user: userId }).lean();
  if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
    return res.status(400).json({ message: 'Votre panier est vide.' });
  }

  const normalizedItems = cart.items.map((item) => ({
    productId: item.product,
    quantity: Number(item.quantity) > 0 ? Number(item.quantity) : 1,
    selectedAttributes: Array.isArray(item.selectedAttributes) ? item.selectedAttributes : []
  }));
  const productIds = normalizedItems.map((item) => item.productId);
  if (productIds.some((id) => !ensureObjectId(id))) {
    return res.status(400).json({ message: 'Produit invalide.' });
  }

  const [productDocs, verifiedProductIds] = await Promise.all([
    Product.find({ _id: { $in: productIds } }).populate(
      'user',
      'shopName name slug shopAddress city commune'
    ),
    getVerifiedProductIds()
  ]);
  const verifiedProductSet = toIdSet(verifiedProductIds);
  const productMap = new Map(productDocs.map((doc) => [doc._id.toString(), doc]));

  let orderItems;
  try {
    orderItems = normalizedItems.map((item) => {
      const product = productMap.get(item.productId.toString());
      if (!isPurchasableProduct(product, verifiedProductSet)) {
        throw Object.assign(new Error('Produit indisponible ou non approuvé.'), { statusCode: 400 });
      }
      const selectedAttributesValidation = validateSelectedAttributesForProduct({
        productAttributes: product.attributes,
        selectedAttributes: item.selectedAttributes
      });
      if (!selectedAttributesValidation.valid) {
        throw Object.assign(new Error(selectedAttributesValidation.message), { statusCode: 400 });
      }
      return buildOrderItemFromProduct(
        product,
        item.quantity,
        selectedAttributesValidation.selectedAttributes
      );
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    throw error;
  }

  const itemsBySeller = new Map();
  orderItems.forEach((item) => {
    const shopId = resolveItemShopId(item);
    if (!shopId) return;
    const shopKey = String(shopId);
    if (!itemsBySeller.has(shopKey)) {
      itemsBySeller.set(shopKey, []);
    }
    itemsBySeller.get(shopKey).push(item);
  });

  if (!itemsBySeller.size) {
    return res.status(400).json({ message: 'Aucun vendeur associé à la commande.' });
  }

  // Prepare draft payments
  const normalizedPayments = Array.isArray(payments) ? payments : [];
  const draftPayments = normalizedPayments.map((payment) => ({
    sellerId: payment?.sellerId || null,
    payerName: payment?.payerName?.trim() || '',
    transactionCode: normalizeTransactionCode(payment?.transactionCode),
    promoCode: payment?.promoCode?.trim()?.toUpperCase() || ''
  }));

  // Delete existing draft orders for this user
  await Order.deleteMany({ customer: userId, isDraft: true });

  // Create draft orders (one per seller)
  const draftOrderPayloads = Array.from(itemsBySeller.entries()).map(([sellerId, sellerItems]) => {
    const totalAmount = calculateOrderItemsSubtotal(sellerItems);
    const paidAmount = Math.round(totalAmount * 0.25);
    const remainingAmount = Math.max(0, totalAmount - paidAmount);

    return {
      items: sellerItems,
      customer: customer._id,
      createdBy: userId,
      deliveryAddress: customer.address || '',
      deliveryCity: customer.city || 'Brazzaville',
      trackingNote: '',
      totalAmount,
      paidAmount,
      remainingAmount,
      status: 'pending',
      isDraft: true,
      draftPayments: draftPayments.filter((p) => String(p.sellerId) === sellerId)
    };
  });

  const createdDrafts = await Order.insertMany(draftOrderPayloads);
  const populated = await baseOrderQuery().find({
    _id: { $in: createdDrafts.map((order) => order._id) }
  });
  await ensureOrderProductSlugs(populated);

  res.status(201).json({
    items: populated.map(buildOrderResponse),
    message: 'Commande enregistrée comme brouillon.'
  });
});

// Get draft orders
export const getDraftOrders = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.user?._id;

  const orders = await baseOrderQuery()
    .find({ customer: userId, isDraft: true })
    .sort({ createdAt: -1 });

  await ensureOrderProductSlugs(orders);

  res.json({
    items: orders.map(buildOrderResponse),
    total: orders.length
  });
});

// Delete draft order
export const deleteDraftOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user?.id || req.user?._id;

  if (!ensureObjectId(id)) {
    return res.status(400).json({ message: 'Commande inconnue.' });
  }

  const order = await Order.findOne({ _id: id, customer: userId, isDraft: true });
  if (!order) {
    return res.status(404).json({ message: 'Brouillon introuvable.' });
  }

  await Order.deleteOne({ _id: id });
  res.json({ message: 'Brouillon supprimé avec succès.' });
});

/**
 * Create an inquiry order (Alibaba-style: start a conversation about a product)
 * Creates a draft order with one item so buyer can message the seller with product context.
 */
export const createInquiryOrder = asyncHandler(async (req, res) => {
  const { productId } = req.body;
  const userId = req.user?.id || req.user?._id;

  if (!ensureObjectId(productId)) {
    return res.status(400).json({ message: 'Produit invalide.' });
  }

  const product = await Product.findById(productId).populate('user', 'shopName name slug _id shopAddress city commune');
  const verifiedProductSet = toIdSet(await getVerifiedProductIds());
  if (!isPurchasableProduct(product, verifiedProductSet)) {
    return res.status(404).json({ message: 'Produit introuvable ou non disponible.' });
  }

  const sellerId = product.user?._id || product.user?.id;
  if (!sellerId) {
    return res.status(400).json({ message: 'Vendeur introuvable pour ce produit.' });
  }

  if (String(sellerId) === String(userId)) {
    return res.status(400).json({ message: 'Vous ne pouvez pas ouvrir une conversation avec vous-même.' });
  }

  const customer = await User.findById(userId).select('name email phone address city');
  if (!customer) {
    return res.status(404).json({ message: 'Client introuvable.' });
  }

  const existingInquiry = await Order.findOne({
    customer: userId,
    isDraft: true,
    isInquiry: true,
    'items.snapshot.shopId': sellerId,
    'items.product': productId
  }).lean();

  if (existingInquiry) {
    const populated = await baseOrderQuery().findById(existingInquiry._id);
    await ensureOrderProductSlugs([populated]);
    return res.status(200).json(buildOrderResponse(populated));
  }

  const orderItem = buildOrderItemFromProduct(product, 1);

  const order = await Order.create({
    items: [orderItem],
    customer: userId,
    createdBy: userId,
    deliveryAddress: customer.address?.trim() || 'À préciser',
    deliveryCity: customer.city || 'Brazzaville',
    status: 'pending',
    totalAmount: 0,
    paidAmount: 0,
    remainingAmount: 0,
    isDraft: true,
    isInquiry: true
  });

  const populated = await baseOrderQuery().findById(order._id);
  await ensureOrderProductSlugs([populated]);
  res.status(201).json(buildOrderResponse(populated));
});

export const userUpdateOrderStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user?.id || req.user?._id;

  if (!ensureObjectId(id)) {
    return res.status(400).json({ message: 'Commande inconnue.' });
  }

  const order = await Order.findOne({ _id: id, customer: userId });
  if (!order) {
    return res.status(404).json({ message: 'Commande introuvable.' });
  }

  const { status } = req.body;
  const previousStatus = order.status;
  if (!ORDER_STATUS.includes(status)) {
    return res.status(400).json({ message: 'Statut invalide.' });
  }
  if (status !== 'cancelled') {
    return res.status(400).json({
      message: "Le client ne peut modifier que le statut d'annulation."
    });
  }

  // Prevent cancelling already delivered orders
  if (
    status === 'cancelled' &&
    ['delivery_proof_submitted', 'delivered', 'confirmed_by_client', 'completed', 'picked_up_confirmed'].includes(order.status)
  ) {
    return res.status(400).json({ message: 'Impossible d\'annuler une commande déjà livrée.' });
  }

  // Only allow cancellation within 30 minutes of order creation
  if (status === 'cancelled') {
    if (!isWithinCancellationWindow(order)) {
      const createdAt = new Date(order.createdAt);
      const now = new Date();
      const diffMs = now - createdAt;
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      return res.status(403).json({ 
        message: `Le délai d'annulation de 30 minutes est expiré. Votre commande a été créée il y a ${diffMinutes} minute(s).`,
        code: 'CANCELLATION_WINDOW_EXPIRED',
        createdAt: order.createdAt
      });
    }
  }

  if (order.status !== status) {
    order.status = status;
    if (status === 'delivering' && !order.shippedAt) {
      order.shippedAt = new Date();
    }
    if (status === 'delivered' && !order.deliveredAt) {
      order.deliveredAt = new Date();
    }
    if (status === 'cancelled' && !order.cancelledAt) {
      order.cancelledAt = new Date();
      order.cancelledBy = userId;
    }
  }

  await order.save();
  const sellerIds = Array.isArray(order.items)
    ? order.items
        .map((item) => item?.snapshot?.shopId)
        .filter(Boolean)
    : [];
  emitOrderStatusUpdated({
    orderId: order._id,
    status: order.status,
    installmentSaleStatus: order.installmentSaleStatus,
    customerId: order.customer,
    sellerIds,
    updatedBy: userId,
    updatedAt: order.cancelledAt?.toISOString?.() || new Date().toISOString()
  });

  res.json(buildOrderResponse(order));

  const cancellationNotifications =
    status === 'cancelled' && previousStatus !== 'cancelled'
      ? [
          {
            userId: order.customer,
            actorId: userId,
            type: 'order_cancelled',
            metadata: {
              orderId: order._id,
              deliveryAddress: order.deliveryAddress,
              deliveryCity: order.deliveryCity,
              status: 'cancelled',
              cancelledBy: 'user'
            },
            allowSelf: true
          }
        ]
      : [];

  void dispatchSideEffect(
    'order-lifecycle',
    {
      orderId: order._id,
      customerId: order.customer,
      sellerIds: (order.items || []).map((item) => resolveItemShopId(item)),
      notifications: cancellationNotifications
    },
    async () => {
    await safeAsync(() => syncReviewReminderForOrderLifecycle(order), {
      label: 'buyer_order_status_sync_review_reminder'
    });
    await safeAsync(
      async () => {
        const populated = await baseOrderQuery().findById(order._id);
        await ensureOrderProductSlugs([populated]);
      },
      { label: 'buyer_order_status_populate_and_slug_order' }
    );

    if (status === 'cancelled' && previousStatus !== 'cancelled') {
      await safeAsync(
        () => Promise.all(cancellationNotifications.map((payload) => createNotification(payload))),
        { label: 'buyer_order_status_notify_cancelled' }
      );
    }

    await safeAsync(
      () =>
        invalidateOrderCachesForMutation({
          customerId: order.customer,
          sellerIds: (order.items || []).map((item) => resolveItemShopId(item))
        }),
      { label: 'buyer_order_status_invalidate_order_caches' }
    );
    },
    { label: 'buyer_order_status_side_effects' }
  );
});

/**
 * Update delivery address for an order (buyer only, before shipping)
 */
export const userUpdateOrderAddress = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user?.id || req.user?._id;

  if (!ensureObjectId(id)) {
    return res.status(400).json({ message: 'Commande inconnue.' });
  }

  const order = await Order.findById(id);
  if (!order) {
    return res.status(404).json({ message: 'Commande introuvable.' });
  }

  // Verify the order belongs to the user
  if (String(order.customer) !== String(userId)) {
    return res.status(403).json({ message: 'Vous n\'êtes pas autorisé à modifier cette commande.' });
  }

  // Address cannot be modified once order is "Prête à livrer" or "En cours de livraison"
  if (
    ['ready_for_delivery', 'delivering', 'out_for_delivery', 'delivery_proof_submitted', 'delivered', 'confirmed_by_client', 'completed', 'picked_up_confirmed'].includes(
      String(order.status)
    )
  ) {
    return res.status(400).json({
      message: 'Impossible de modifier l\'adresse de livraison. La commande est déjà en cours de livraison ou livrée.',
      code: 'ORDER_ALREADY_SHIPPED'
    });
  }

  if (order.status === 'cancelled') {
    return res.status(400).json({ 
      message: 'Impossible de modifier l\'adresse d\'une commande annulée.',
      code: 'ORDER_CANCELLED'
    });
  }

  const { deliveryAddress, deliveryCity } = req.body;
  const oldAddress = order.deliveryAddress;
  const oldCity = order.deliveryCity;

  // Update address
  order.deliveryAddress = deliveryAddress.trim();
  order.deliveryCity = deliveryCity;

  await order.save();
  const populated = await baseOrderQuery().findById(order._id);
  await ensureOrderProductSlugs([populated]);

  // Send notification to sellers about address change
  if (Array.isArray(order.items) && order.items.length > 0) {
    const sellerIds = new Set();
    order.items.forEach((item) => {
      const shopId = item?.snapshot?.shopId;
      if (shopId) sellerIds.add(String(shopId));
    });

    await Promise.all(
      Array.from(sellerIds).map((sellerId) =>
        createNotification({
          userId: sellerId,
          actorId: userId,
          type: 'order_address_updated',
          metadata: {
            orderId: order._id,
            oldAddress: oldAddress,
            newAddress: deliveryAddress.trim(),
            oldCity: oldCity,
            newCity: deliveryCity,
            status: order.status
          },
          allowSelf: true
        })
      )
    );
  }

  await invalidateOrderCachesForMutation({
    customerId: order.customer,
    sellerIds: (order.items || []).map((item) => resolveItemShopId(item))
  });
  res.json(buildOrderResponse(populated));
});

/**
 * Buyer confirms they won't cancel - skips the 30-minute window so the seller can process immediately
 */
export const userSkipCancellationWindow = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user?.id || req.user?._id;

  if (!ensureObjectId(id)) {
    return res.status(400).json({ message: 'Commande inconnue.' });
  }

  const order = await Order.findById(id);
  if (!order) {
    return res.status(404).json({ message: 'Commande introuvable.' });
  }

  if (String(order.customer) !== String(userId)) {
    return res.status(403).json({ message: 'Vous n\'êtes pas autorisé à modifier cette commande.' });
  }

  if (
    ['cancelled', 'delivery_proof_submitted', 'delivered', 'confirmed_by_client', 'completed', 'picked_up_confirmed'].includes(
      order.status
    )
  ) {
    return res.status(400).json({ message: 'Cette commande ne peut plus être modifiée.' });
  }

  if (order.cancellationWindowSkippedAt) {
    return res.status(400).json({ message: 'Le délai d\'annulation a déjà été levé pour cette commande.' });
  }

  if (!isWithinCancellationWindow(order)) {
    return res.status(400).json({ message: 'Le délai d\'annulation est déjà expiré.' });
  }

  order.cancellationWindowSkippedAt = new Date();
  await order.save();

  const populated = await baseOrderQuery().findById(order._id);
  await ensureOrderProductSlugs([populated]);

  const sellerIds = [
    ...new Set(
      (order.items || [])
        .map((item) => resolveItemShopId(item))
        .filter((id) => id)
        .map((id) => String(id))
    )
  ];
  await invalidateOrderCachesForMutation({
    customerId: order.customer,
    sellerIds
  });

  for (const sellerId of sellerIds) {
    await createNotification({
      userId: sellerId,
      actorId: userId,
      type: 'order_cancellation_window_skipped',
      metadata: {
        title: 'Délai d’annulation levé',
        message: 'Le client a autorisé le traitement immédiat de la commande.',
        orderId: String(order._id)
      },
      allowSelf: false,
      priority: 'HIGH'
    });
  }

  res.json(buildOrderResponse(populated));
});

export const sellerListOrders = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.user?._id;
  const { status, statusGroup, page = 1, limit = 6 } = req.query || {};

  const filter = { 'items.snapshot.shopId': userId, isDraft: false };
  applyOrderStatusFilter(filter, { status, statusGroup, role: 'seller' });

  const pageNumber = Math.max(1, Number(page) || 1);
  const requestedLimit = Number(limit) || 6;
  const pageSize = Math.max(1, requestedLimit > 24 ? Math.min(requestedLimit, 500) : Math.min(requestedLimit, 24));
  const skip = (pageNumber - 1) * pageSize;

  const [orders, total] = await Promise.all([
    baseOrderQuery()
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize),
    Order.countDocuments(filter)
  ]);
  await ensureOrderProductSlugs(orders);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const items = orders
    .map((order) => {
      const filteredItems = filterOrderItemsForSeller(order, userId);
      if (!filteredItems.length) return null;
      const response = buildOrderResponse(order);
      response.items = filteredItems.map((item) => {
        const normalized = item.toObject ? item.toObject() : item;
        return {
          ...normalized,
          snapshot: normalized.snapshot || {}
        };
      });
      return response;
    })
    .filter(Boolean);

  res.json({
    items,
    total,
    page: pageNumber,
    pageSize,
    totalPages
  });
});

export const sellerOrdersSummary = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.user?._id;
  const sellerMatchIds = ensureObjectId(userId) ? [String(userId), new mongoose.Types.ObjectId(userId)] : [String(userId)];
  const baseFilter = { 'items.snapshot.shopId': { $in: sellerMatchIds } };
  const summary = await buildOrderSummary({ baseFilter, role: 'seller' });
  res.json(summary);
});

// Get single order (seller)
export const sellerGetOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user?.id || req.user?._id;
  if (!ensureObjectId(id)) {
    return res.status(400).json({ message: 'Commande inconnue.' });
  }

  // First try: user is a seller of items in this order
  let order = await baseOrderQuery().findOne({ _id: id, 'items.snapshot.shopId': userId, isDraft: false });

  // Fallback: user is the customer (e.g., shop user bought from another shop, routed to seller link)
  if (!order) {
    order = await baseOrderQuery().findOne({ _id: id, customer: userId, isDraft: false });
    if (order) {
      // User is the customer — return full order (not filtered)
      await ensureOrderProductSlugs([order]);
      return res.json(buildOrderResponse(order));
    }
  }

  if (!order) {
    return res.status(404).json({ message: 'Commande introuvable.' });
  }

  await ensureOrderProductSlugs([order]);
  const filteredItems = filterOrderItemsForSeller(order, userId);
  if (!filteredItems.length) {
    return res.status(404).json({ message: 'Commande introuvable.' });
  }
  const response = buildOrderResponse(order);
  response.items = filteredItems.map((item) => {
    const normalized = item.toObject ? item.toObject() : item;
    return { ...normalized, snapshot: normalized.snapshot || {} };
  });
  res.json(response);
});

// Delivery fee cannot be modified once order is "Prête à livrer" or "En cours de livraison"
const SELLER_CAN_UPDATE_DELIVERY_FEE_STATUSES = new Set([
  'pending_payment',
  'paid',
  'pending',
  'pending_installment',
  'installment_active',
  'overdue_installment',
  'confirmed',
  'ready_for_pickup'
]);

export const sellerUpdateOrderDeliveryFee = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { deliveryFeeTotal: newFee } = req.body;
  const userId = req.user?.id || req.user?._id;
  if (!ensureObjectId(id)) {
    return res.status(400).json({ message: 'Commande inconnue.' });
  }
  const order = await Order.findOne({ _id: id, 'items.snapshot.shopId': userId, isDraft: false });
  if (!order) {
    return res.status(404).json({ message: 'Commande introuvable.' });
  }
  if (!SELLER_CAN_UPDATE_DELIVERY_FEE_STATUSES.has(String(order.status))) {
    return res.status(400).json({
      message: 'Les frais de livraison ne peuvent plus être modifiés pour cette commande.'
    });
  }
  const numFee = Number(newFee);
  if (!Number.isFinite(numFee) || numFee < 0) {
    return res.status(400).json({ message: 'Montant des frais de livraison invalide.' });
  }
  let previousFee;
  try {
    ({ previousFee } = applyDeliveryFeeToOrder({
      order,
      nextFee: numFee,
      actorId: userId,
      updatedAt: new Date()
    }));
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      message: error.message || 'Impossible de modifier les frais de livraison.',
      ...(error.code ? { code: error.code } : {})
    });
  }
  await order.save();
  const populated = await baseOrderQuery().findById(order._id);
  const response = buildOrderResponse(populated);
  const filteredItems = filterOrderItemsForSeller(populated, userId);
  if (filteredItems.length) {
    response.items = filteredItems.map((item) => {
      const normalized = item.toObject ? item.toObject() : item;
      return { ...normalized, snapshot: normalized.snapshot || {} };
    });
  }
  const customerId = order.customer && (order.customer._id || order.customer);
  if (customerId) {
    await createNotification({
      userId: customerId,
      actorId: userId,
      type: 'order_delivery_fee_updated',
      metadata: {
        orderId: order._id,
        previousFee,
        newFee: numFee,
        orderShortId: String(order._id).slice(-6),
        updatedByRole: 'seller'
      }
    });
  }
  res.json(response);
});

export const sellerSubmitDeliveryProof = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user?.id || req.user?._id;
  const deliveryProofResubmissionLimit = await getDeliveryProofResubmissionLimit();
  const maxProofPhotos = await getMaxDeliveryProofPhotos();
  if (!ensureObjectId(id)) {
    return res.status(400).json({ message: 'Commande inconnue.' });
  }

  const order = await Order.findOne({ _id: id, 'items.snapshot.shopId': userId, isDraft: false });
  if (!order) {
    return res.status(404).json({ message: 'Commande introuvable.' });
  }
  let proofFlow;
  try {
    proofFlow = assertSellerCanSubmitDeliveryProof({
      order,
      deliveryProofResubmissionLimit
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      message: error.message || 'Impossible de soumettre la preuve de livraison.',
      ...(error.code ? { code: error.code } : {})
    });
  }
  const {
    isPickupOrder,
    isPlatformDeliveryOrder: isPlatformDeliveryOrderFlow,
    minimumProofImages
  } = proofFlow;

  const signatureImage = String(req.body?.clientSignatureImage || '').trim();
  if (!signatureImage || !signatureImage.startsWith('data:image/')) {
    return res.status(400).json({ message: 'Signature client invalide ou manquante.' });
  }
  if (signatureImage.length > 2_000_000) {
    return res.status(400).json({ message: 'Signature trop volumineuse.' });
  }

  const proofImages = normalizeDeliveryProofFiles(req.files);
  const effectiveMin = Math.min(minimumProofImages, maxProofPhotos);
  if (proofImages.length < effectiveMin) {
    return res.status(400).json({
      message: isPickupOrder
        ? `Ajoutez au moins ${effectiveMin} photos de retrait (max ${maxProofPhotos}).`
        : `Ajoutez au moins ${effectiveMin} photo de livraison (max ${maxProofPhotos}).`
    });
  }
  const cappedProofImages = proofImages.slice(0, maxProofPhotos);

  const now = new Date();
  const location = extractDeliveryLocation(req.body);
  const noteValue = String(req.body?.deliveryNote || '').trim();

  order.deliveryProofImages = cappedProofImages;
  order.clientSignatureImage = signatureImage;
  order.deliveryNote = noteValue.slice(0, 1000);
  order.deliveryDate = now;
  order.deliverySubmittedBy = userId;
  order.deliverySubmittedAt = now;
  order.deliveryStatus = isPlatformDeliveryOrderFlow || isPickupOrder ? 'verified' : 'submitted';
  order.deliveryProofAttemptCount = Number(order.deliveryProofAttemptCount || 0) + 1;
  order.status = isPickupOrder
    ? 'picked_up_confirmed'
    : isPlatformDeliveryOrderFlow
    ? 'delivered'
    : 'delivery_proof_submitted';
  if (isPlatformDeliveryOrderFlow || isPickupOrder) {
    order.clientDeliveryConfirmedAt = order.clientDeliveryConfirmedAt || now;
  }
  if (isPickupOrder && !order.readyForPickupAt) {
    order.readyForPickupAt = now;
  }
  if (!order.outForDeliveryAt) {
    order.outForDeliveryAt = now;
  }
  if (!order.shippedAt) {
    order.shippedAt = now;
  }
  if (!order.deliveredAt) {
    order.deliveredAt = now;
  }
  await order.save();
  await syncReviewReminderForOrderLifecycle(order);

  const baseLog = {
    orderId: order._id,
    sellerId: userId,
    timestamp: now,
    ipAddress: getRequestIp(req),
    location: location || undefined
  };
  await Promise.all([
    DeliveryLog.create({
      ...baseLog,
      actionType: 'PROOF_UPLOADED',
      metadata: {
        proofCount: proofImages.length,
        attempt: order.deliveryProofAttemptCount
      }
    }),
    DeliveryLog.create({
      ...baseLog,
      actionType: 'SIGNATURE_CAPTURED',
      metadata: { hasSignature: true }
    })
  ]);

  await createNotification({
    userId: order.customer,
    actorId: userId,
    type: 'order_delivered',
    metadata: {
      orderId: order._id,
      deliveryAddress: order.deliveryAddress,
      deliveryCity: order.deliveryCity,
      status: isPickupOrder
        ? 'picked_up_confirmed'
        : isPlatformDeliveryOrderFlow
        ? 'delivered'
        : 'delivery_proof_submitted',
      deliveredAt: order.deliveredAt,
      deliveryProofSubmitted: true
    },
    allowSelf: true
  });

  const populated = await baseOrderQuery().findById(order._id);
  await ensureOrderProductSlugs([populated]);
  await invalidateOrderCachesForMutation({
    customerId: order.customer,
    sellerIds: (order.items || []).map((item) => resolveItemShopId(item))
  });
  const sellerIds = Array.isArray(order.items)
    ? order.items.map((item) => resolveItemShopId(item)).filter(Boolean)
    : [];
  emitOrderStatusUpdated({
    orderId: order._id,
    status: order.status,
    installmentSaleStatus: order.installmentSaleStatus,
    customerId: order.customer,
    sellerIds,
    updatedBy: userId,
    updatedAt: now.toISOString()
  });
  res.json({
    message: isPickupOrder
      ? 'Preuve de retrait enregistrée. Retrait confirmé.'
      : isPlatformDeliveryOrderFlow
      ? 'Preuve de livraison enregistrée. Livraison validée automatiquement (plateforme).'
      : 'Preuve de livraison soumise. En attente de confirmation client.',
    order: buildOrderResponse(populated)
  });
});

export const clientConfirmDelivery = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user?.id || req.user?._id;
  if (!ensureObjectId(id)) {
    return res.status(400).json({ message: 'Commande inconnue.' });
  }

  const order = await Order.findOne({ _id: id, customer: userId, isDraft: false });
  if (!order) {
    return res.status(404).json({ message: 'Commande introuvable.' });
  }
  if (order.status === 'cancelled') {
    return res.status(400).json({ message: 'Commande annulée.' });
  }
  if (order.status === 'dispute_opened') {
    return res.status(400).json({ message: 'Commande en litige, confirmation impossible.' });
  }
  const isPlatformDeliveryOrderFlow = isPlatformDeliveryOrder(order);
  if (isPlatformDeliveryOrderFlow) {
    const now = new Date();
    if (order.deliveryStatus !== 'verified') {
      order.deliveryStatus = 'verified';
    }
    if (!order.clientDeliveryConfirmedAt) {
      order.clientDeliveryConfirmedAt = now;
    }
    if (!order.deliveredAt) {
      order.deliveredAt = order.deliveryDate || now;
    }
    if (order.status === 'delivery_proof_submitted') {
      order.status = 'delivered';
    }
    await order.save();
    res.json({
      message: 'Livraison plateforme validée automatiquement. Aucune confirmation client requise.',
      order: buildOrderResponse(order)
    });

    void dispatchSideEffect(
      'order-lifecycle',
      {
        orderId: order._id,
        customerId: order.customer,
        sellerIds: (order.items || []).map((item) => resolveItemShopId(item))
      },
      async () => {
      await safeAsync(() => syncReviewReminderForOrderLifecycle(order), {
        label: 'platform_confirm_sync_review_reminder'
      });
      await safeAsync(
        async () => {
          const populated = await baseOrderQuery().findById(order._id);
          await ensureOrderProductSlugs([populated]);
        },
        { label: 'platform_confirm_populate_and_slug_order' }
      );
      await safeAsync(
        () =>
          invalidateOrderCachesForMutation({
            customerId: order.customer,
            sellerIds: (order.items || []).map((item) => resolveItemShopId(item))
          }),
        { label: 'platform_confirm_invalidate_order_caches' }
      );
      },
      { label: 'platform_confirm_side_effects' }
    );
    return;
  }
  if (req.body?.confirm === false) {
    return res.status(400).json({
      message: 'Confirmation refusée. Veuillez ouvrir un litige depuis la page réclamations.'
    });
  }
  if (!hasValidDeliveryEvidence(order)) {
    return res.status(400).json({
      message: 'Preuves de livraison incomplètes: photo, signature et date sont requises.'
    });
  }

  const now = new Date();
  if (order.deliveryStatus !== 'verified') {
    order.deliveryStatus = 'verified';
    order.clientDeliveryConfirmedAt = now;
  }
  if (!order.deliveredAt) {
    order.deliveredAt = order.deliveryDate || now;
  }

  const previousStatus = order.status;
  order.status = 'completed';
  order.clientDeliveryConfirmedAt = order.clientDeliveryConfirmedAt || now;
  if (!order.completedAt) {
    order.completedAt = now;
  }
  await order.save();

  const sellerIds = new Set();
  (order.items || []).forEach((item) => {
    if (item?.snapshot?.shopId) sellerIds.add(String(item.snapshot.shopId));
  });

  // Deduct platform commission from seller wallets (Proposal 6)
  const commissionRate = Number(process.env.PLATFORM_COMMISSION_RATE || 0.03);
  if (commissionRate > 0) {
    for (const sellerId of sellerIds) {
      const sellerItems = (order.items || []).filter(
        (item) => String(item?.snapshot?.shopId || '') === sellerId
      );
      const sellerTotal = sellerItems.reduce((sum, item) => sum + (Number(item?.lineTotal) || 0), 0);
      const commission = Math.round(sellerTotal * commissionRate);
      if (commission > 0) {
        const { deductCommission } = await import('../services/walletService.js');
        deductCommission({ userId: sellerId, amount: commission, orderId: String(order._id) }).catch(() => {});
      }
    }
  }

  res.json({
    message: 'Livraison confirmée. La commande est terminée.',
    order: buildOrderResponse(order)
  });

  const sellerIdList = Array.from(sellerIds);
  const confirmationNotification = sellerIdList.map((sellerId) => ({
    userId: sellerId,
    actorId: userId,
    type: 'order_created',
    metadata: {
      orderId: order._id,
      status: 'confirmed',
      deliveryStatus: 'verified',
      deliveryAddress: order.deliveryAddress,
      deliveryCity: order.deliveryCity
    }
  }));
  const confirmationDeliveryLog = {
    orderId: order._id,
    sellerId:
      order.deliverySubmittedBy ||
      (Array.isArray(order.items)
        ? order.items.find((item) => item?.snapshot?.shopId)?.snapshot?.shopId
        : null) ||
      order.createdBy,
    timestamp: now,
    ipAddress: getRequestIp(req),
    actionType: 'CONFIRMED',
    metadata: {
      previousStatus,
      transitionedTo: ['confirmed_by_client', 'completed'],
      confirmedByClientId: userId
    }
  };

  void dispatchSideEffect(
    'order-lifecycle',
    {
      orderId: order._id,
      customerId: order.customer,
      sellerIds: sellerIdList,
      deliveryLog: confirmationDeliveryLog,
      notifications: confirmationNotification
    },
    async () => {
    await safeAsync(() => syncReviewReminderForOrderLifecycle(order), {
      label: 'client_confirm_sync_review_reminder'
    });

    await safeAsync(
      () => DeliveryLog.create(confirmationDeliveryLog),
      { label: 'client_confirm_delivery_log' }
    );

    await safeAsync(
      () => Promise.all(confirmationNotification.map((payload) => createNotification(payload))),
      { label: 'client_confirm_notify_sellers' }
    );

    await safeAsync(
      async () => {
        const populated = await baseOrderQuery().findById(order._id);
        await ensureOrderProductSlugs([populated]);
      },
      { label: 'client_confirm_populate_and_slug_order' }
    );

    await safeAsync(
      () =>
        invalidateOrderCachesForMutation({
          customerId: order.customer,
          sellerIds: Array.from(sellerIds)
        }),
      { label: 'client_confirm_invalidate_order_caches' }
    );
    },
    { label: 'client_confirm_side_effects' }
  );
});

export const getOrderDeliveryLogs = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user?.id || req.user?._id;
  if (!ensureObjectId(id)) {
    return res.status(400).json({ message: 'Commande inconnue.' });
  }

  const order = await Order.findById(id).select('_id customer items');
  if (!order) {
    return res.status(404).json({ message: 'Commande introuvable.' });
  }

  const isAdmin =
    req.user?.role === 'admin' || req.user?.role === 'founder' || req.user?.role === 'manager';
  const isCustomer = String(order.customer) === String(userId);
  const isSeller = Array.isArray(order.items)
    ? order.items.some((item) => String(item?.snapshot?.shopId || '') === String(userId))
    : false;
  if (!isAdmin && !isCustomer && !isSeller) {
    return res.status(403).json({ message: 'Accès refusé.' });
  }

  const logs = await DeliveryLog.find({ orderId: order._id })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();
  res.json({ items: logs });
});

export const sellerUpdateOrderStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user?.id || req.user?._id;
  const { status } = req.body;

  if (!ensureObjectId(id)) {
    return res.status(400).json({ message: 'Commande inconnue.' });
  }

  const order = await Order.findOne({ _id: id, 'items.snapshot.shopId': userId });
  if (!order) {
    return res.status(404).json({ message: 'Commande introuvable.' });
  }

  if (order.paymentType === 'installment') {
    let transitionContext;
    try {
      transitionContext = assertSellerStatusTransition({ order, nextStatus: status });
    } catch (error) {
      return res.status(error.statusCode || 400).json({
        message: error.message || 'Transition de statut invalide.'
      });
    }

    const previousSaleStatus = transitionContext.previousSaleStatus || order.installmentSaleStatus || 'confirmed';
    order.installmentSaleStatus = previousSaleStatus;

    const notifyConfirmed = status === 'confirmed' && previousSaleStatus !== 'confirmed';
    const notifyDelivering = status === 'delivering' && previousSaleStatus !== 'delivering';
    const notifyDelivered = status === 'delivered' && previousSaleStatus !== 'delivered';
    const notifyCancelled = status === 'cancelled' && previousSaleStatus !== 'cancelled';
    const saleStatusChangedAt = new Date();

    if (status !== previousSaleStatus) {
      order.installmentSaleStatus = status;
      if (status === 'confirmed' && !order.confirmedAt) {
        order.confirmedAt = saleStatusChangedAt;
      }
      if (status === 'delivering' && !order.outForDeliveryAt) {
        order.outForDeliveryAt = saleStatusChangedAt;
      }
      if (status === 'delivering' && !order.shippedAt) {
        order.shippedAt = saleStatusChangedAt;
      }
      if (status === 'delivered' && !order.deliveredAt) {
        order.deliveredAt = order.deliveryDate || saleStatusChangedAt;
      }
      if (status === 'cancelled' && !order.cancelledAt) {
        order.cancelledAt = saleStatusChangedAt;
        order.cancelledBy = userId;
      }
    }

    await order.save();
    const installmentSellerIds = Array.isArray(order.items)
      ? order.items
          .map((item) => item?.snapshot?.shopId)
          .filter(Boolean)
      : [];
    emitOrderStatusUpdated({
      orderId: order._id,
      status: order.status,
      installmentSaleStatus: order.installmentSaleStatus,
      customerId: order.customer,
      sellerIds: installmentSellerIds,
      updatedBy: userId,
      updatedAt: saleStatusChangedAt.toISOString()
    });

    res.json(buildOrderResponse(order));

    const lifecycleNotifications = [];
    if (notifyConfirmed) {
      lifecycleNotifications.push({
        userId: order.customer,
        actorId: userId,
        type: 'order_created',
        metadata: {
          orderId: order._id,
          deliveryAddress: order.deliveryAddress,
          deliveryCity: order.deliveryCity,
          status: 'confirmed',
          paymentType: 'installment'
        },
        allowSelf: true
      });
    }
    if (notifyDelivering) {
      lifecycleNotifications.push({
        userId: order.customer,
        actorId: userId,
        type: 'order_delivering',
        metadata: {
          orderId: order._id,
          deliveryAddress: order.deliveryAddress,
          deliveryCity: order.deliveryCity,
          status: 'delivering',
          paymentType: 'installment'
        },
        allowSelf: true
      });
    }
    if (notifyDelivered) {
      lifecycleNotifications.push({
        userId: order.customer,
        actorId: userId,
        type: 'order_delivered',
        metadata: {
          orderId: order._id,
          deliveryAddress: order.deliveryAddress,
          deliveryCity: order.deliveryCity,
          status: 'delivered',
          deliveredAt: order.deliveredAt,
          paymentType: 'installment'
        },
        allowSelf: true
      });
    }
    if (notifyCancelled) {
      lifecycleNotifications.push({
        userId: order.customer,
        actorId: userId,
        type: 'order_cancelled',
        metadata: {
          orderId: order._id,
          deliveryAddress: order.deliveryAddress,
          deliveryCity: order.deliveryCity,
          status: 'cancelled',
          cancelledBy: 'seller',
          paymentType: 'installment'
        },
        allowSelf: true
      });
    }

    void dispatchSideEffect(
      'order-lifecycle',
      {
        orderId: order._id,
        customerId: order.customer,
        sellerIds: [userId],
        notifications: lifecycleNotifications,
        smsMessages:
          notifyDelivering && order.customer?.phone
            ? [
                {
                  phone: order.customer.phone,
                  message: buildOrderDeliveringMessage(order),
                  context: `order_delivering:${order._id}`
                }
              ]
            : notifyDelivering
            ? [
                {
                  userId: order.customer,
                  message: buildOrderDeliveringMessage(order),
                  context: `order_delivering:${order._id}`
                }
              ]
            : []
      },
      async () => {
      await safeAsync(() => syncReviewReminderForOrderLifecycle(order), {
        label: 'seller_installment_status_sync_review_reminder'
      });
      await safeAsync(
        async () => {
          const populatedInstallment = await baseOrderQuery().findById(order._id);
          await ensureOrderProductSlugs([populatedInstallment]);
        },
        { label: 'seller_installment_status_populate_and_slug_order' }
      );

      if (notifyConfirmed) {
        await safeAsync(
          () =>
            createNotification({
              userId: order.customer,
              actorId: userId,
              type: 'order_created',
              metadata: {
                orderId: order._id,
                deliveryAddress: order.deliveryAddress,
                deliveryCity: order.deliveryCity,
                status: 'confirmed',
                paymentType: 'installment'
              },
              allowSelf: true
            }),
          { label: 'seller_installment_status_notify_confirmed' }
        );
      }

      if (notifyDelivering && isTwilioMessagingConfigured()) {
        await safeAsync(
          async () => {
            const customer = await User.findById(order.customer).select('phone');
            await sendOrderSms({
              phone: customer?.phone,
              message: buildOrderDeliveringMessage(order),
              context: `order_delivering:${order._id}`
            });
          },
          { label: 'seller_installment_status_sms_delivering' }
        );
      }

      if (notifyDelivering) {
        await safeAsync(
          () =>
            createNotification({
              userId: order.customer,
              actorId: userId,
              type: 'order_delivering',
              metadata: {
                orderId: order._id,
                deliveryAddress: order.deliveryAddress,
                deliveryCity: order.deliveryCity,
                status: 'delivering',
                paymentType: 'installment'
              },
              allowSelf: true
            }),
          { label: 'seller_installment_status_notify_delivering' }
        );
      }

      if (notifyDelivered) {
        await safeAsync(
          () =>
            createNotification({
              userId: order.customer,
              actorId: userId,
              type: 'order_delivered',
              metadata: {
                orderId: order._id,
                deliveryAddress: order.deliveryAddress,
                deliveryCity: order.deliveryCity,
                status: 'delivered',
                deliveredAt: order.deliveredAt,
                paymentType: 'installment'
              },
              allowSelf: true
            }),
          { label: 'seller_installment_status_notify_delivered' }
        );
      }

      if (notifyCancelled) {
        await safeAsync(
          () =>
            createNotification({
              userId: order.customer,
              actorId: userId,
              type: 'order_cancelled',
              metadata: {
                orderId: order._id,
                deliveryAddress: order.deliveryAddress,
                deliveryCity: order.deliveryCity,
                status: 'cancelled',
                cancelledBy: 'seller',
                paymentType: 'installment'
              },
              allowSelf: true
            }),
          { label: 'seller_installment_status_notify_cancelled' }
        );
      }

      await safeAsync(
        () =>
          invalidateOrderCachesForMutation({
            customerId: order.customer,
            sellerIds: [userId]
          }),
        { label: 'seller_installment_status_invalidate_order_caches' }
      );
      },
      { label: 'seller_installment_status_side_effects' }
    );
    return;
  }

  // Prevent seller from changing order status within 30 minutes of creation
  if (isWithinCancellationWindow(order)) {
    const remainingMs = getCancellationWindowRemaining(order);
    const remainingMinutes = Math.ceil(remainingMs / (1000 * 60));
    return res.status(403).json({ 
      message: `Vous ne pouvez pas modifier le statut de cette commande pendant les 30 premières minutes. Temps restant: ${remainingMinutes} minute(s).`,
      code: 'CANCELLATION_WINDOW_ACTIVE',
      remainingMs,
      remainingMinutes
    });
  }

  const previousStatus = order.status;
  let notifyPending = false;
  let notifyConfirmed = false;
  let notifyDelivering = false;
  try {
    assertSellerStatusTransition({ order, nextStatus: status });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      message: error.message || 'Transition de statut invalide.'
    });
  }

  const statusChangedAt = new Date();
  if (order.status !== status) {
    order.status = status;
    notifyPending = status === 'pending' || status === 'pending_payment';
    notifyConfirmed = status === 'confirmed';
    notifyDelivering = status === 'delivering' || status === 'out_for_delivery';
  }
  if (['confirmed', 'ready_for_delivery'].includes(status) && !order.confirmedAt) {
    order.confirmedAt = statusChangedAt;
  }
  if (status === 'ready_for_pickup' && !order.readyForPickupAt) {
    order.readyForPickupAt = statusChangedAt;
  }
  if ((status === 'delivering' || status === 'out_for_delivery') && !order.outForDeliveryAt) {
    order.outForDeliveryAt = statusChangedAt;
  }
  if ((status === 'delivering' || status === 'out_for_delivery') && !order.shippedAt) {
    order.shippedAt = statusChangedAt;
  }
  if (status === 'delivery_proof_submitted' && !order.deliverySubmittedAt) {
    order.deliverySubmittedAt = statusChangedAt;
  }
  if (status === 'delivered' && !order.deliveredAt) {
    order.deliveredAt = order.deliveryDate || statusChangedAt;
  }
  if (status === 'picked_up_confirmed' && !order.deliveredAt) {
    order.deliveredAt = statusChangedAt;
  }
  if (status === 'confirmed_by_client' && !order.clientDeliveryConfirmedAt) {
    order.clientDeliveryConfirmedAt = statusChangedAt;
  }
  if (status === 'completed' && !order.completedAt) {
    order.completedAt = statusChangedAt;
  }
  if (status === 'cancelled' && !order.cancelledAt) {
    order.cancelledAt = statusChangedAt;
    order.cancelledBy = userId;
  }

  await order.save();
  const sellerIds = Array.isArray(order.items)
    ? order.items
        .map((item) => item?.snapshot?.shopId)
        .filter(Boolean)
    : [];
  emitOrderStatusUpdated({
    orderId: order._id,
    status: order.status,
    installmentSaleStatus: order.installmentSaleStatus,
    customerId: order.customer,
    sellerIds,
    updatedBy: userId,
    updatedAt: statusChangedAt.toISOString()
  });

  res.json(buildOrderResponse(order));

  const lifecycleNotifications = [];
  if (notifyPending && previousStatus !== 'pending') {
    lifecycleNotifications.push({
      userId: order.customer,
      actorId: userId,
      type: 'order_created',
      metadata: {
        orderId: order._id,
        deliveryAddress: order.deliveryAddress,
        deliveryCity: order.deliveryCity,
        status: 'pending'
      },
      allowSelf: true
    });
  }
  if (notifyConfirmed && previousStatus !== 'confirmed') {
    lifecycleNotifications.push({
      userId: order.customer,
      actorId: userId,
      type: 'order_created',
      metadata: {
        orderId: order._id,
        deliveryAddress: order.deliveryAddress,
        deliveryCity: order.deliveryCity,
        status: 'confirmed'
      },
      allowSelf: true
    });
  }
  if (status === 'delivered') {
    lifecycleNotifications.push({
      userId: order.customer,
      actorId: userId,
      type: 'order_delivered',
      metadata: {
        orderId: order._id,
        deliveryAddress: order.deliveryAddress,
        deliveryCity: order.deliveryCity,
        status: 'delivered',
        deliveredAt: order.deliveredAt
      },
      allowSelf: true
    });
  }
  if (notifyDelivering && previousStatus !== 'delivering') {
    lifecycleNotifications.push({
      userId: order.customer,
      actorId: userId,
      type: 'order_delivering',
      metadata: {
        orderId: order._id,
        deliveryAddress: order.deliveryAddress,
        deliveryCity: order.deliveryCity,
        status: 'delivering'
      },
      allowSelf: true
    });
  }
  if (status === 'cancelled' && previousStatus !== 'cancelled') {
    lifecycleNotifications.push({
      userId: order.customer,
      actorId: userId,
      type: 'order_cancelled',
      metadata: {
        orderId: order._id,
        deliveryAddress: order.deliveryAddress,
        deliveryCity: order.deliveryCity,
        status: 'cancelled',
        cancelledBy: 'seller'
      },
      allowSelf: true
    });
  }
  const recalculateSalesProductIds =
    (notifyConfirmed && previousStatus !== 'confirmed') ||
    (status === 'cancelled' && previousStatus !== 'cancelled')
      ? (order.items || []).map((item) => item.product).filter(Boolean)
      : [];

  void dispatchSideEffect(
    'order-lifecycle',
    {
      orderId: order._id,
      customerId: order.customer,
      sellerIds: [userId],
      notifications: lifecycleNotifications,
      smsMessages:
        notifyDelivering && previousStatus !== 'delivering'
          ? [
              {
                userId: order.customer,
                message: buildOrderDeliveringMessage(order),
                context: `order_delivering:${order._id}`
              }
            ]
          : [],
      recalculateSalesProductIds
    },
    async () => {
    await safeAsync(() => syncReviewReminderForOrderLifecycle(order), {
      label: 'seller_order_status_sync_review_reminder'
    });
    await safeAsync(
      async () => {
        const populated = await baseOrderQuery().findById(order._id);
        await ensureOrderProductSlugs([populated]);
      },
      { label: 'seller_order_status_populate_and_slug_order' }
    );

    if (notifyPending && previousStatus !== 'pending') {
      await safeAsync(
        () =>
          createNotification({
            userId: order.customer,
            actorId: userId,
            type: 'order_created',
            metadata: {
              orderId: order._id,
              deliveryAddress: order.deliveryAddress,
              deliveryCity: order.deliveryCity,
              status: 'pending'
            },
            allowSelf: true
          }),
        { label: 'seller_order_status_notify_pending' }
      );
    }

    if (notifyConfirmed && previousStatus !== 'confirmed') {
      await safeAsync(
        async () => {
          if (!Array.isArray(order.items)) return;
          for (const item of order.items) {
            if (item.product) {
              // eslint-disable-next-line no-await-in-loop
              const salesCount = await calculateProductSalesCount(item.product);
              // eslint-disable-next-line no-await-in-loop
              await Product.updateOne({ _id: item.product }, { $set: { salesCount } });
            }
          }
        },
        { label: 'seller_order_status_recalculate_sales_on_confirm' }
      );

      await safeAsync(
        () =>
          createNotification({
            userId: order.customer,
            actorId: userId,
            type: 'order_created',
            metadata: {
              orderId: order._id,
              deliveryAddress: order.deliveryAddress,
              deliveryCity: order.deliveryCity,
              status: 'confirmed'
            },
            allowSelf: true
          }),
        { label: 'seller_order_status_notify_confirmed' }
      );
    }

    if (status === 'delivered') {
      await safeAsync(
        () =>
          createNotification({
            userId: order.customer,
            actorId: userId,
            type: 'order_delivered',
            metadata: {
              orderId: order._id,
              deliveryAddress: order.deliveryAddress,
              deliveryCity: order.deliveryCity,
              status: 'delivered',
              deliveredAt: order.deliveredAt
            },
            allowSelf: true
          }),
        { label: 'seller_order_status_notify_delivered' }
      );
    }

    if (notifyDelivering && previousStatus !== 'delivering' && isTwilioMessagingConfigured()) {
      await safeAsync(
        async () => {
          const customer = await User.findById(order.customer).select('phone');
          await sendOrderSms({
            phone: customer?.phone,
            message: buildOrderDeliveringMessage(order),
            context: `order_delivering:${order._id}`
          });
        },
        { label: 'seller_order_status_sms_delivering' }
      );
    }

    if (notifyDelivering && previousStatus !== 'delivering') {
      await safeAsync(
        () =>
          createNotification({
            userId: order.customer,
            actorId: userId,
            type: 'order_delivering',
            metadata: {
              orderId: order._id,
              deliveryAddress: order.deliveryAddress,
              deliveryCity: order.deliveryCity,
              status: 'delivering'
            },
            allowSelf: true
          }),
        { label: 'seller_order_status_notify_delivering' }
      );
    }

    if (status === 'cancelled' && previousStatus !== 'cancelled') {
      await safeAsync(
        () =>
          createNotification({
            userId: order.customer,
            actorId: userId,
            type: 'order_cancelled',
            metadata: {
              orderId: order._id,
              deliveryAddress: order.deliveryAddress,
              deliveryCity: order.deliveryCity,
              status: 'cancelled',
              cancelledBy: 'seller'
            },
            allowSelf: true
          }),
        { label: 'seller_order_status_notify_cancelled' }
      );

      await safeAsync(
        async () => {
          if (!Array.isArray(order.items)) return;
          for (const item of order.items) {
            if (item.product) {
              // eslint-disable-next-line no-await-in-loop
              const salesCount = await calculateProductSalesCount(item.product);
              // eslint-disable-next-line no-await-in-loop
              await Product.updateOne({ _id: item.product }, { $set: { salesCount } });
            }
          }
        },
        { label: 'seller_order_status_recalculate_sales_on_cancel' }
      );
    }

    await safeAsync(
      () =>
        invalidateOrderCachesForMutation({
          customerId: order.customer,
          sellerIds: [userId]
        }),
      { label: 'seller_order_status_invalidate_order_caches' }
    );
    },
    { label: 'seller_order_status_side_effects' }
  );
});

export const sellerCancelOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user?.id || req.user?._id;
  const { reason, issueRefund = false } = req.body;

  if (!ensureObjectId(id)) {
    return res.status(400).json({ message: 'Commande inconnue.' });
  }

  const order = await Order.findOne({ _id: id, 'items.snapshot.shopId': userId });
  if (!order) {
    return res.status(404).json({ message: 'Commande introuvable.' });
  }

  // Prevent cancelling already delivered or cancelled orders
  if (['delivery_proof_submitted', 'delivered', 'confirmed_by_client', 'completed', 'picked_up_confirmed'].includes(order.status)) {
    return res.status(400).json({ message: 'Impossible d\'annuler une commande déjà livrée.' });
  }
  if (order.status === 'cancelled') {
    return res.status(400).json({ message: 'Cette commande est déjà annulée.' });
  }

  // Reason is required (validated by middleware, but double-check)
  if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
    return res.status(400).json({ message: 'La raison de l\'annulation est requise (minimum 5 caractères).' });
  }

  order.status = 'cancelled';
  order.cancelledAt = new Date();
  order.cancelledBy = userId;
  order.cancellationReason = reason.trim();
  const paidAmount = Number(order.paidAmount || 0);
  const refundAmount = issueRefund ? paidAmount : 0;
  if (issueRefund) {
    order.refundStatus = refundAmount > 0 ? 'pending' : 'none';
    order.refundAmount = refundAmount;
    order.refundRequestedBy = userId;
    order.refundRequestedAt = new Date();
  }

  await order.save();
  await syncReviewReminderForOrderLifecycle(order);
  const populated = await baseOrderQuery().findById(order._id);
  await ensureOrderProductSlugs([populated]);
  const sellerIds = Array.isArray(order.items)
    ? order.items
        .map((item) => item?.snapshot?.shopId)
        .filter(Boolean)
    : [];
  emitOrderStatusUpdated({
    orderId: order._id,
    status: order.status,
    installmentSaleStatus: order.installmentSaleStatus,
    customerId: order.customer,
    sellerIds,
    updatedBy: userId,
    updatedAt: order.cancelledAt?.toISOString?.() || new Date().toISOString()
  });

  // Update product salesCount when order is cancelled (decrease count)
  if (Array.isArray(order.items)) {
    for (const item of order.items) {
      if (item.product) {
        const salesCount = await calculateProductSalesCount(item.product);
        await Product.updateOne(
          { _id: item.product },
          { $set: { salesCount } }
        );
      }
    }
  }

  // Send notification to customer
  await createNotification({
    userId: order.customer,
    actorId: userId,
    type: 'order_cancelled',
    metadata: {
      orderId: order._id,
      deliveryAddress: order.deliveryAddress,
      deliveryCity: order.deliveryCity,
      status: 'cancelled',
      cancelledBy: 'seller',
      reason: order.cancellationReason,
      refundRequested: Boolean(issueRefund),
      refundAmount
    },
    allowSelf: true
  });

  if (issueRefund && refundAmount > 0) {
    const adminRecipients = await User.find({
      $or: [{ role: 'admin' }, { role: 'manager' }, { canVerifyPayments: true }]
    })
      .select('_id')
      .lean();
    await Promise.all(
      adminRecipients.map((recipient) =>
        createNotification({
          userId: recipient._id,
          actorId: userId,
          type: 'admin_broadcast',
          metadata: {
            message: `Remboursement demandé pour la commande #${String(order._id).slice(-6)}: ${formatCurrency(refundAmount)}.`,
            orderId: order._id,
            refundRequested: true,
            refundAmount
          }
        })
      )
    );
  }

  // Send SMS if configured
  if (isTwilioMessagingConfigured()) {
    const customer = await User.findById(order.customer).select('phone');
    if (customer?.phone) {
      const itemsSummary = buildSmsItemsSummary(order.items);
      const total = formatSmsAmount(order.totalAmount);
      const reasonText = order.cancellationReason ? ` Raison: ${order.cancellationReason}` : '';
      const refundText =
        issueRefund && refundAmount > 0
          ? ` Remboursement demandé: ${formatSmsAmount(refundAmount)} FCFA.`
          : '';
      const orderId = order._id ? String(order._id).slice(-6) : '';
      const message = `HDMarket : Votre commande ${orderId} a été annulée par le vendeur.${reasonText}${refundText} ${itemsSummary ? `| ${itemsSummary}` : ''} | Total: ${total} FCFA`;
      await sendOrderSms({
        phone: customer.phone,
        message,
        context: `order_cancelled:${order._id}`
      });
    }
  }

  await invalidateOrderCachesForMutation({
    customerId: order.customer,
    sellerIds: [userId]
  });
  res.json(buildOrderResponse(populated));
});

export const sellerDeliveryStatsOverview = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.user?._id;
  const from = req.query?.from ? new Date(req.query.from) : null;
  const to = req.query?.to ? new Date(req.query.to) : null;
  const createdAt = {};
  if (from && !Number.isNaN(from.getTime())) createdAt.$gte = from;
  if (to && !Number.isNaN(to.getTime())) {
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    createdAt.$lte = end;
  }
  const baseMatch = {
    isDraft: { $ne: true },
    'items.snapshot.shopId': new mongoose.Types.ObjectId(userId)
  };
  if (Object.keys(createdAt).length) {
    baseMatch.createdAt = createdAt;
  }

  const [overviewAgg, sourceAgg, communesAgg] = await Promise.all([
    Order.aggregate([
      { $match: baseMatch },
      {
        $addFields: {
          sellerItems: {
            $filter: {
              input: '$items',
              as: 'item',
              cond: { $eq: ['$$item.snapshot.shopId', new mongoose.Types.ObjectId(userId)] }
            }
          }
        }
      },
      {
        $project: {
          deliveryMode: 1,
          deliveryFeeTotal: { $ifNull: ['$deliveryFeeTotal', 0] },
          pickupOnlyFlag: {
            $gt: [
              {
                $size: {
                  $filter: {
                    input: '$sellerItems',
                    as: 'item',
                    cond: {
                      $and: [
                        { $eq: ['$$item.snapshot.deliveryAvailable', false] },
                        { $ne: ['$$item.snapshot.pickupAvailable', false] }
                      ]
                    }
                  }
                }
              },
              0
            ]
          }
        }
      },
      {
        $group: {
          _id: null,
          ordersTotal: { $sum: 1 },
          pickupOrdersCount: {
            $sum: { $cond: [{ $eq: ['$deliveryMode', 'PICKUP'] }, 1, 0] }
          },
          deliveryOrdersCount: {
            $sum: { $cond: [{ $eq: ['$deliveryMode', 'DELIVERY'] }, 1, 0] }
          },
          freeDeliveryOrdersCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$deliveryMode', 'DELIVERY'] },
                    { $lte: ['$deliveryFeeTotal', 0] }
                  ]
                },
                1,
                0
              ]
            }
          },
          totalDeliveryFeesCharged: {
            $sum: {
              $cond: [{ $eq: ['$deliveryMode', 'DELIVERY'] }, '$deliveryFeeTotal', 0]
            }
          },
          avgDeliveryFeeRaw: {
            $avg: {
              $cond: [{ $eq: ['$deliveryMode', 'DELIVERY'] }, '$deliveryFeeTotal', null]
            }
          },
          pickupOnlyOrdersCount: {
            $sum: { $cond: ['$pickupOnlyFlag', 1, 0] }
          }
        }
      }
    ]),
    Order.aggregate([
      { $match: { ...baseMatch, deliveryMode: 'DELIVERY' } },
      {
        $group: {
          _id: '$deliveryFeeSource',
          amount: { $sum: { $ifNull: ['$deliveryFeeTotal', 0] } },
          count: { $sum: 1 }
        }
      }
    ]),
    Order.aggregate([
      { $match: { ...baseMatch, deliveryMode: 'DELIVERY' } },
      {
        $group: {
          _id: {
            communeName: {
              $ifNull: ['$shippingAddressSnapshot.communeName', 'Commune inconnue']
            }
          },
          orders: { $sum: 1 }
        }
      },
      { $sort: { orders: -1 } },
      { $limit: 10 }
    ])
  ]);

  const row = overviewAgg[0] || {};
  const ordersTotal = Number(row.ordersTotal || 0);
  const pickupOrdersCount = Number(row.pickupOrdersCount || 0);
  const deliveryOrdersCount = Number(row.deliveryOrdersCount || 0);

  res.json({
    ordersTotal,
    pickupOrdersCount,
    deliveryOrdersCount,
    pickupRate: ordersTotal > 0 ? Number(((pickupOrdersCount / ordersTotal) * 100).toFixed(2)) : 0,
    deliveryRate:
      ordersTotal > 0 ? Number(((deliveryOrdersCount / ordersTotal) * 100).toFixed(2)) : 0,
    freeDeliveryOrdersCount: Number(row.freeDeliveryOrdersCount || 0),
    avgDeliveryFee: Number(row.avgDeliveryFeeRaw || 0),
    totalDeliveryFeesCharged: Number(row.totalDeliveryFeesCharged || 0),
    revenueByDeliverySource: sourceAgg.reduce(
      (acc, item) => ({
        ...acc,
        [String(item._id || DELIVERY_FEE_SOURCE.PRODUCT_FEE)]: {
          count: Number(item.count || 0),
          amount: Number(item.amount || 0)
        }
      }),
      {
        COMMUNE_FREE: { count: 0, amount: 0 },
        COMMUNE_FIXED: { count: 0, amount: 0 },
        SHOP_FREE: { count: 0, amount: 0 },
        PRODUCT_FEE: { count: 0, amount: 0 },
        PICKUP: { count: 0, amount: 0 }
      }
    ),
    topCommunesByOrders: communesAgg.map((item) => ({
      commune: item?._id?.communeName || 'Commune inconnue',
      orders: Number(item.orders || 0)
    })),
    pickupOnlyOrdersCount: Number(row.pickupOnlyOrdersCount || 0)
  });
});

export const sellerDeliveryStatsProducts = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.user?._id;
  const from = req.query?.from ? new Date(req.query.from) : null;
  const to = req.query?.to ? new Date(req.query.to) : null;
  const createdAt = {};
  if (from && !Number.isNaN(from.getTime())) createdAt.$gte = from;
  if (to && !Number.isNaN(to.getTime())) {
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    createdAt.$lte = end;
  }
  const baseMatch = {
    isDraft: { $ne: true },
    'items.snapshot.shopId': new mongoose.Types.ObjectId(userId)
  };
  if (Object.keys(createdAt).length) {
    baseMatch.createdAt = createdAt;
  }

  const rows = await Order.aggregate([
    { $match: baseMatch },
    { $unwind: '$items' },
    {
      $match: {
        'items.snapshot.shopId': new mongoose.Types.ObjectId(userId)
      }
    },
    {
      $group: {
        _id: '$items.product',
        name: { $first: '$items.snapshot.title' },
        deliveryAvailableFromSnapshot: { $first: '$items.snapshot.deliveryAvailable' },
        pickupAvailableFromSnapshot: { $first: '$items.snapshot.pickupAvailable' },
        ordersCountPickup: {
          $sum: { $cond: [{ $eq: ['$deliveryMode', 'PICKUP'] }, 1, 0] }
        },
        ordersCountDelivery: {
          $sum: { $cond: [{ $eq: ['$deliveryMode', 'DELIVERY'] }, 1, 0] }
        },
        revenue: {
          $sum: {
            $multiply: [
              { $ifNull: ['$items.snapshot.price', 0] },
              { $ifNull: ['$items.quantity', 1] }
            ]
          }
        }
      }
    },
    {
      $lookup: {
        from: 'products',
        localField: '_id',
        foreignField: '_id',
        as: 'productDoc'
      }
    },
    { $unwind: { path: '$productDoc', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        productId: '$_id',
        name: 1,
        deliveryAvailable: {
          $ifNull: ['$productDoc.deliveryAvailable', '$deliveryAvailableFromSnapshot']
        },
        pickupAvailable: { $ifNull: ['$productDoc.pickupAvailable', '$pickupAvailableFromSnapshot'] },
        ordersCountPickup: 1,
        ordersCountDelivery: 1,
        ordersCount: { $add: ['$ordersCountPickup', '$ordersCountDelivery'] },
        revenue: 1
      }
    },
    { $sort: { ordersCount: -1, revenue: -1 } },
    { $limit: 100 }
  ]);

  res.json(
    rows.map((row) => ({
      productId: row.productId,
      name: row.name || 'Produit',
      deliveryAvailable: row.deliveryAvailable !== false,
      pickupAvailable: row.pickupAvailable !== false,
      ordersCountPickup: Number(row.ordersCountPickup || 0),
      ordersCountDelivery: Number(row.ordersCountDelivery || 0),
      ordersCount: Number(row.ordersCount || 0),
      revenue: Number(row.revenue || 0),
      pickupOnly: row.deliveryAvailable === false && row.pickupAvailable !== false
    }))
  );
});
