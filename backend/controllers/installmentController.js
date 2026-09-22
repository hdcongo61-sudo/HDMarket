import asyncHandler from 'express-async-handler';
import { completeInstallmentCheckout, completeInstallmentPayment, quoteExistingInstallment, settleInstallmentEntry,
  installmentError, installmentOrderKey, cancelInstallmentOrder, assertNoInstallmentPaymentPending } from '../services/installmentPaymentService.js';
import { withCommerceOperation } from '../services/commerceOperationService.js';
import { recoverInstallmentRefundsForOrder } from '../services/installmentRefundService.js';
import { installmentIsClosed, isPastDueDate, isScheduleEntrySettled } from '../services/installmentPolicyService.js';
import { invalidateUserCache, invalidateSellerCache, invalidateAdminCache } from '../utils/cache.js';
import mongoose from 'mongoose';
import Order from '../models/orderModel.js';
import Product from '../models/productModel.js';
import { createNotification } from '../utils/notificationService.js';
import { ensureModelSlugsForItems } from '../utils/slugUtils.js';
import {
  getInstallmentProgress,
  getRiskLevelByScore
} from '../utils/installmentUtils.js';
import { calculateProductSalesCount } from '../utils/salesCalculator.js';
import {
  isTransactionCodeAlreadyUsed,
  normalizeTransactionCode,
  TRANSACTION_CODE_REUSED_MESSAGE
} from '../utils/transactionCodeService.js';
import { notifyBuyerOrderCancelled } from '../utils/orderCancellationNotification.js';
import { scheduleOrderReviewReminder } from '../services/orderReviewReminderService.js';
import { getOrderAllowedActions } from '../services/orderStatusFlowService.js';
import { emitOrderStatusUpdated } from '../sockets/chatSocket.js';
import { notifyBuyerDeliveryDistanceWarning } from '../utils/deliveryDistanceWarning.js';
import { getPawaPayConfig } from '../services/pawapayService.js';
import { calculateInstallmentEligibilityScore } from '../services/installmentEligibilityService.js';

const ensureObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const resolveItemShopId = (item) =>
  item?.snapshot?.shopId ||
  item?.product?.user ||
  item?.product?.user?._id ||
  null;

const baseOrderQuery = () =>
  Order.find()
    .populate('customer', 'name email phone address city commune')
    .populate({
      path: 'items.product',
      select: 'title price images status user slug',
      populate: { path: 'user', select: 'name shopName phone' }
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
          snapshot: item.snapshot || {}
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
    installmentProgress,
    allowedActions: orderActionState.allowedActions,
    nextAction: orderActionState.nextAction
  };
};


const parseGuarantorPayload = (body = {}) => {
  if (body?.guarantor && typeof body.guarantor === 'object') {
    return body.guarantor;
  }
  if (typeof body?.guarantor === 'string') {
    try {
      const parsed = JSON.parse(body.guarantor);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch (error) {
      // Ignore JSON parse errors and fallback to flat keys
    }
  }
  return {
    fullName: body['guarantor.fullName'] || body['guarantor[fullName]'] || '',
    phone: body['guarantor.phone'] || body['guarantor[phone]'] || '',
    relation: body['guarantor.relation'] || body['guarantor[relation]'] || '',
    nationalId: body['guarantor.nationalId'] || body['guarantor[nationalId]'] || '',
    address: body['guarantor.address'] || body['guarantor[address]'] || ''
  };
};

const emitInstallmentOrderUpdate = ({ order, updatedBy, updatedAt = new Date() }) => {
  if (!order) return;
  const sellerIds = Array.isArray(order.items)
    ? order.items.map((item) => resolveItemShopId(item)).filter(Boolean)
    : [];
  emitOrderStatusUpdated({
    orderId: order._id,
    status: order.status,
    installmentSaleStatus: order.installmentSaleStatus,
    customerId: order.customer,
    sellerIds,
    updatedBy,
    updatedAt: updatedAt instanceof Date ? updatedAt.toISOString() : new Date(updatedAt).toISOString()
  });
};

const notifyInstallmentChange = async (order, actorId, type, recipient) => {
  emitInstallmentOrderUpdate({ order, updatedBy: actorId });
  await createNotification({ userId: recipient || order.customer, actorId, type,
    productId: order.items?.[0]?.product, entityType: 'order', entityId: String(order._id),
    deepLink: recipient ? `/seller/orders/detail/${order._id}` : `/orders/detail/${order._id}`,
    metadata: { orderId: order._id, status: order.status }, allowSelf: true }).catch(() => {});
  await Promise.allSettled([
    invalidateUserCache(order.customer, ['orders', 'notifications']),
    invalidateSellerCache(order.items?.[0]?.snapshot?.shopId, ['orders', 'analytics', 'dashboard']),
    invalidateAdminCache(['orders', 'admin'])
  ]);
  if (order.status === 'installment_paid') {
    await Promise.allSettled(order.items.map(async item => Product.updateOne({ _id: item.product }, { $set: { salesCount: await calculateProductSalesCount(item.product) } })));
    await scheduleOrderReviewReminder(order._id).catch(() => {});
  }
};
const respondWithOrder = async (res, id, status = 200) => {
  const populated = await baseOrderQuery().findById(id);
  await ensureOrderProductSlugs([populated]);
  return res.status(status).json(buildOrderResponse(populated));
};
const manualProof = async (req) => {
  if (getPawaPayConfig().exclusiveMode) throw installmentError('Utilisez PawaPay pour régler cette tranche.', 403);
  const senderName = String(req.body.payerName || '').trim();
  const transactionCode = normalizeTransactionCode(req.body.transactionCode);
  if (!senderName || !/^\d{10}$/.test(transactionCode)) throw installmentError('Nom et ID transaction valides requis.', 400);
  if (await isTransactionCodeAlreadyUsed(transactionCode)) throw installmentError(TRANSACTION_CODE_REUSED_MESSAGE);
  return { senderName, transactionCode, paymentMethod: 'mobile_money' };
};

export const checkoutInstallmentOrder = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.user?._id;
  const proof = req.pawaPayCheckout ? null : await manualProof(req);
  const { order, created } = await completeInstallmentCheckout({
    checkout: req.pawaPayCheckout, userId, action: { ...req.body, guarantor: parseGuarantorPayload(req.body) }, manualProof: proof
  });
  if (created) {
    await notifyInstallmentChange(order, userId, 'installment_sale_confirmation_required', order.items[0].snapshot.shopId);
    await notifyBuyerDeliveryDistanceWarning({ order, buyerId: userId, actorId: userId, productId: order.items[0].product }).catch(() => {});
  }
  return respondWithOrder(res, order._id, created ? 201 : 200);
});

export const uploadInstallmentPaymentProof = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.user?._id;
  const action = { kind: 'INSTALLMENT_PAYMENT', orderId: req.params.id, scheduleIndex: Number(req.params.scheduleIndex), amount: Number(req.body.amount) };
  if (req.pawaPayCheckout) {
    const { order, changed, refundRequired } = await completeInstallmentPayment({ checkout: req.pawaPayCheckout, userId, action });
    if (order.installmentRefundRequired) await recoverInstallmentRefundsForOrder(order._id).catch(() => {});
    if (changed && !refundRequired) await notifyInstallmentChange(order, userId, 'installment_payment_validated', order.items[0].snapshot.shopId);
    return respondWithOrder(res, order._id);
  }
  const proof = await manualProof(req);
  const order = await withCommerceOperation(installmentOrderKey(action.orderId), async session => {
    const quote = await quoteExistingInstallment({ userId, action, amount: action.amount, session });
    await assertNoInstallmentPaymentPending(quote.order, session);
    const entry = quote.order.installmentPlan.schedule[action.scheduleIndex];
    entry.transactionProof = { ...proof, amount: quote.amount, submittedAt: new Date(), submittedBy: userId };
    entry.status = 'proof_uploaded';
    await quote.order.save({ session });
    return quote.order;
  });
  await notifyInstallmentChange(order, userId, 'installment_payment_submitted', order.items[0].snapshot.shopId);
  return respondWithOrder(res, order._id);
});

export const sellerConfirmInstallmentSale = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.user?._id;
  if (!ensureObjectId(req.params.id)) return res.status(400).json({ message: 'Commande invalide.' });
  if (!req.body.approve) {
    const order = await cancelInstallmentOrder({ orderId: req.params.id, actorId: userId, sellerId: userId, reason: 'Vente refusée par le vendeur.' });
    await recoverInstallmentRefundsForOrder(order._id).catch(() => {});
    await notifyBuyerOrderCancelled({ order, actorId: userId, cancelledBy: 'seller', reason: order.cancellationReason }).catch(() => {});
    await notifyInstallmentChange(order, userId, 'order_cancelled');
    return respondWithOrder(res, order._id);
  }
  const order = await withCommerceOperation(installmentOrderKey(req.params.id), async session => {
    const current = await Order.findOne({ _id: req.params.id, paymentType: 'installment', isDraft: { $ne: true }, 'items.snapshot.shopId': userId }).session(session);
    if (!current) throw installmentError('Commande introuvable.', 404);
    if (installmentIsClosed(current)) throw installmentError('Cette commande est clôturée.');
    current.installmentPlan.saleConfirmationConfirmedAt ||= new Date();
    current.installmentPlan.saleConfirmationConfirmedBy ||= userId;
    current.confirmedAt ||= new Date();
    await current.save({ session });
    return current;
  });
  await notifyInstallmentChange(order, userId, 'installment_sale_confirmed');
  return respondWithOrder(res, order._id);
});

export const sellerValidateInstallmentPayment = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.user?._id;
  const index = Number(req.params.scheduleIndex);
  if (!ensureObjectId(req.params.id) || !Number.isInteger(index) || index < 0) return res.status(400).json({ message: 'Tranche invalide.' });
  const order = await withCommerceOperation(installmentOrderKey(req.params.id), async session => {
    const current = await Order.findOne({ _id: req.params.id, paymentType: 'installment', isDraft: { $ne: true }, 'items.snapshot.shopId': userId }).session(session);
    if (!current) throw installmentError('Commande introuvable.', 404);
    if (installmentIsClosed(current)) throw installmentError('Cette commande est clôturée.');
    if (!current.installmentPlan?.saleConfirmationConfirmedAt) throw installmentError('Confirmez la vente avant de valider une tranche.');
    await assertNoInstallmentPaymentPending(current, session);
    const schedule = current.installmentPlan.schedule;
    const entry = schedule[index];
    if (!entry || isScheduleEntrySettled(entry)) throw installmentError('Cette tranche est déjà finalisée.');
    if (schedule.some((previous, i) => i < index && !isScheduleEntrySettled(previous))) throw installmentError('Validez la tranche précédente.');
    // Accept historical overdue proofs: the old reminder job changed their status.
    if (!['proof_uploaded', 'overdue'].includes(entry.status) || !entry.transactionProof?.senderName || !entry.transactionProof?.transactionCode ||
      entry.transactionProof.paymentMethod === 'pawapay' || Number(entry.transactionProof.amount) !== Number(entry.amount)) throw installmentError('Preuve transactionnelle valide requise.', 400);
    if (req.body.approve) settleInstallmentEntry(current, index, userId);
    else {
      entry.status = isPastDueDate(entry.dueDate) ? 'overdue' : 'pending';
      entry.transactionProof = {};
      entry.overdueNotifiedAt = null;
    }
    await current.save({ session });
    return current;
  });
  await notifyInstallmentChange(order, userId, req.body.approve ? 'installment_payment_validated' : 'installment_payment_submitted');
  return respondWithOrder(res, order._id);
});

export const sellerInstallmentAnalytics = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.user?._id;
  const objectUserId = new mongoose.Types.ObjectId(userId);

  const [summary] = await Order.aggregate([
    { $match: { paymentType: 'installment', isDraft: { $ne: true } } },
    { $unwind: '$items' },
    { $match: { 'items.snapshot.shopId': objectUserId } },
    {
      $group: {
        _id: null,
        totalInstallmentSales: { $sum: 1 },
        revenueInProgress: { $sum: { $ifNull: ['$installmentPlan.remainingAmount', 0] } },
        collectedAmount: { $sum: { $ifNull: ['$installmentPlan.amountPaid', 0] } },
        riskExposure: {
          $sum: {
            $cond: [
              {
                $or: [
                  { $eq: ['$status', 'overdue_installment'] },
                  { $gt: [{ $ifNull: ['$installmentPlan.overdueCount', 0] }, 0] }
                ]
              },
              { $ifNull: ['$installmentPlan.remainingAmount', 0] },
              0
            ]
          }
        },
        overdueOrders: {
          $sum: {
            $cond: [{ $eq: ['$status', 'overdue_installment'] }, 1, 0]
          }
        },
        completedOrders: {
          $sum: {
            $cond: [{ $in: ['$status', ['installment_paid', 'completed']] }, 1, 0]
          }
        }
      }
    }
  ]);

  res.json({
    totalInstallmentSales: Number(summary?.totalInstallmentSales || 0),
    revenueInProgress: Number(summary?.revenueInProgress || 0),
    collectedAmount: Number(summary?.collectedAmount || 0),
    riskExposure: Number(summary?.riskExposure || 0),
    overdueOrders: Number(summary?.overdueOrders || 0),
    completedOrders: Number(summary?.completedOrders || 0)
  });
});

export const getInstallmentEligibility = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.user?._id;
  const score = await calculateInstallmentEligibilityScore(userId);
  res.json({
    score,
    riskLevel: getRiskLevelByScore(score)
  });
});
