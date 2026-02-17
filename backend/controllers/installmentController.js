import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import Order from '../models/orderModel.js';
import Product from '../models/productModel.js';
import User from '../models/userModel.js';
import Cart from '../models/cartModel.js';
import { createNotification } from '../utils/notificationService.js';
import { ensureModelSlugsForItems } from '../utils/slugUtils.js';
import {
  addDays,
  generateInstallmentSchedule,
  getInstallmentProgress,
  getRiskLevelByScore,
  isProductInstallmentActive
} from '../utils/installmentUtils.js';
import { calculateProductSalesCount } from '../utils/salesCalculator.js';
import { getRestrictionMessage, isRestricted } from '../utils/restrictionCheck.js';

const ensureObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const resolveItemShopId = (item) =>
  item?.snapshot?.shopId ||
  item?.product?.user ||
  item?.product?.user?._id ||
  null;

const baseOrderQuery = () =>
  Order.find()
    .populate('customer', 'name email phone address city')
    .populate({
      path: 'items.product',
      select: 'title price images status user slug',
      populate: { path: 'user', select: 'name shopName phone' }
    })
    .populate('deliveryGuy', 'name phone active')
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
  const installmentProgress =
    obj.paymentType === 'installment' ? getInstallmentProgress(obj.installmentPlan || {}) : null;
  return {
    ...obj,
    items: Array.isArray(obj.items)
      ? obj.items.map((item) => ({
          ...item,
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
          city: obj.customer.city
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
          name: obj.deliveryGuy.name,
          phone: obj.deliveryGuy.phone,
          active: obj.deliveryGuy.active
        }
      : null,
    installmentProgress
  };
};

const generateDeliveryCode = async () => {
  let attempts = 0;
  while (attempts < 10) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    // eslint-disable-next-line no-await-in-loop
    const existing = await Order.findOne({ deliveryCode: code }).select('_id').lean();
    if (!existing) return code;
    attempts += 1;
  }
  return String(Date.now()).slice(-6);
};

const calculateInstallmentEligibilityScore = async (customerId) => {
  const [totals, overdueCount] = await Promise.all([
    Order.aggregate([
      { $match: { customer: new mongoose.Types.ObjectId(customerId), isDraft: { $ne: true } } },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          deliveredOrders: {
            $sum: {
              $cond: [{ $in: ['$status', ['delivered', 'completed']] }, 1, 0]
            }
          },
          cancelledOrders: {
            $sum: {
              $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0]
            }
          },
          completedInstallments: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$paymentType', 'installment'] },
                    { $eq: ['$status', 'completed'] }
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
    Order.countDocuments({
      customer: customerId,
      paymentType: 'installment',
      status: 'overdue_installment',
      isDraft: { $ne: true }
    })
  ]);

  const summary = totals[0] || {
    totalOrders: 0,
    deliveredOrders: 0,
    cancelledOrders: 0,
    completedInstallments: 0
  };

  const completionRate =
    summary.totalOrders > 0 ? summary.deliveredOrders / summary.totalOrders : 0;
  const cancellationRate =
    summary.totalOrders > 0 ? summary.cancelledOrders / summary.totalOrders : 0;

  let score = 55;
  score += Math.round(completionRate * 30);
  score += Math.min(10, Number(summary.completedInstallments || 0) * 2);
  score -= Math.round(cancellationRate * 25);
  score -= Math.min(20, Number(overdueCount || 0) * 4);

  score = Math.max(0, Math.min(100, score));
  return score;
};

const getNextDueDate = (schedule = []) => {
  const next = schedule.find((entry) =>
    ['pending', 'proof_uploaded', 'overdue'].includes(entry.status)
  );
  return next?.dueDate || null;
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

export const checkoutInstallmentOrder = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.user?._id;
  const { productId, quantity = 1, firstPaymentAmount, payerName, transactionCode } = req.body;
  const guarantor = parseGuarantorPayload(req.body);
  const cleanPayerName = String(payerName || '').trim();
  const cleanTransactionCode = String(transactionCode || '').replace(/\D/g, '');

  if (!ensureObjectId(productId)) {
    return res.status(400).json({ message: 'Produit invalide.' });
  }
  if (!cleanPayerName || cleanTransactionCode.length !== 10) {
    return res.status(400).json({ message: 'Le nom du payeur et un ID transaction valide sont requis.' });
  }

  const [customer, product] = await Promise.all([
    User.findById(userId).select('name email phone address city restrictions'),
    Product.findById(productId).populate('user', 'shopName name slug accountType')
  ]);

  if (!customer) {
    return res.status(404).json({ message: 'Client introuvable.' });
  }
  if (isRestricted(customer, 'canOrder')) {
    return res.status(403).json({
      message: getRestrictionMessage('canOrder'),
      restrictionType: 'canOrder'
    });
  }
  if (!product || product.status !== 'approved') {
    return res.status(404).json({ message: 'Produit introuvable ou non disponible.' });
  }
  if (!isProductInstallmentActive(product)) {
    return res.status(400).json({ message: 'Le paiement par tranche n’est pas disponible pour ce produit.' });
  }
  const qty = Math.max(1, Number(quantity) || 1);
  const totalAmount = Number((Number(product.price || 0) * qty).toFixed(2));
  const firstPayment = Number(firstPaymentAmount || 0);
  if (!Number.isFinite(firstPayment) || firstPayment < Number(product.installmentMinAmount || 0)) {
    return res.status(400).json({
      message: `Le premier paiement minimum est de ${Number(product.installmentMinAmount || 0).toLocaleString(
        'fr-FR'
      )} FCFA.`
    });
  }
  if (firstPayment > totalAmount) {
    return res.status(400).json({ message: 'Le premier paiement ne peut pas dépasser le total de la commande.' });
  }

  if (product.installmentRequireGuarantor) {
    const missingGuarantor =
      !guarantor?.fullName || !guarantor?.phone || !guarantor?.relation || !guarantor?.address;
    if (missingGuarantor) {
      return res.status(400).json({
        message:
          'Les informations du garant sont requises (nom, téléphone, relation et adresse).'
      });
    }
  }

  let createdOrder = null;
  try {
    const eligibilityScore = await calculateInstallmentEligibilityScore(customer._id);
    const riskLevel = getRiskLevelByScore(eligibilityScore);
    const now = new Date();
    const remainingAfterFirstPayment = Number((totalAmount - firstPayment).toFixed(2));
    const futureSchedule = generateInstallmentSchedule({
      remainingAmount: remainingAfterFirstPayment,
      durationDays: Number(product.installmentDuration || 30),
      firstPaymentDate: now
    });
    const schedule = [
      {
        dueDate: now,
        amount: Number(firstPayment.toFixed(2)),
        status: 'proof_uploaded',
        transactionProof: {
          senderName: cleanPayerName,
          transactionCode: cleanTransactionCode,
          amount: Number(firstPayment.toFixed(2)),
          submittedAt: now,
          submittedBy: customer._id
        },
        penaltyAmount: 0
      },
      ...futureSchedule
    ];

    const orderItem = {
      product: product._id,
      quantity: qty,
      snapshot: {
        title: product.title,
        price: product.price,
        image: Array.isArray(product.images) ? product.images[0] : null,
        shopName: product.user?.shopName || product.user?.name || '',
        shopId: product.user?._id || null,
        confirmationNumber: product.confirmationNumber || '',
        slug: product.slug || null
      }
    };

    createdOrder = await Order.create({
      items: [orderItem],
      customer: customer._id,
      createdBy: customer._id,
      status: 'pending_installment',
      paymentType: 'installment',
      deliveryAddress: customer.address?.trim() || 'À préciser',
      deliveryCity: customer.city || 'Brazzaville',
      totalAmount,
      paidAmount: 0,
      remainingAmount: totalAmount,
      paymentName: cleanPayerName,
      paymentTransactionCode: cleanTransactionCode,
      deliveryCode: await generateDeliveryCode(),
      installmentPlan: {
        totalAmount,
        amountPaid: 0,
        remainingAmount: totalAmount,
        nextDueDate: null,
        firstPaymentMinAmount: Number(product.installmentMinAmount || 0),
        schedule,
        eligibilityScore,
        riskLevel,
        latePenaltyRate: Number(product.installmentLatePenaltyRate || 0),
        totalPenaltyAccrued: 0,
        overdueCount: 0,
        guarantor: {
          required: Boolean(product.installmentRequireGuarantor),
          fullName: guarantor?.fullName?.trim() || '',
          phone: guarantor?.phone?.trim() || '',
          relation: guarantor?.relation?.trim() || '',
          nationalId: guarantor?.nationalId?.trim() || '',
          address: guarantor?.address?.trim() || ''
        }
      }
    });

    await Cart.updateOne(
      { user: customer._id },
      { $pull: { items: { product: product._id } } }
    );

    await createNotification({
      userId: product.user?._id,
      actorId: customer._id,
      productId: product._id,
      type: 'installment_sale_confirmation_required',
      metadata: {
        orderId: createdOrder._id,
        payerName: cleanPayerName || customer.name || '',
        transactionCode: cleanTransactionCode,
        firstPaymentAmount: firstPayment,
        totalAmount
      }
    });

    await createNotification({
      userId: customer._id,
      actorId: customer._id,
      productId: product._id,
      type: 'order_created',
      metadata: {
        orderId: createdOrder._id,
        status: 'pending_installment',
        paymentType: 'installment'
      },
      allowSelf: true
    });
  } catch (error) {
    throw error;
  }

  const populated = await baseOrderQuery().findById(createdOrder._id);
  await ensureOrderProductSlugs([populated]);
  res.status(201).json(buildOrderResponse(populated));
});

export const uploadInstallmentPaymentProof = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.user?._id;
  const { id, scheduleIndex } = req.params;
  const { payerName, transactionCode, amount } = req.body;
  const cleanPayerName = String(payerName || '').trim();
  const cleanTransactionCode = String(transactionCode || '').replace(/\D/g, '');
  const submittedAmount = Number(amount || 0);

  if (!ensureObjectId(id)) {
    return res.status(400).json({ message: 'Commande invalide.' });
  }
  const index = Number(scheduleIndex);
  if (!Number.isInteger(index) || index < 0) {
    return res.status(400).json({ message: 'Index de tranche invalide.' });
  }
  if (!cleanPayerName || cleanTransactionCode.length !== 10 || !Number.isFinite(submittedAmount) || submittedAmount <= 0) {
    return res.status(400).json({ message: 'Nom, ID transaction (10 chiffres) et montant valides sont requis.' });
  }

  const order = await Order.findOne({
    _id: id,
    customer: userId,
    paymentType: 'installment',
    isDraft: { $ne: true }
  });
  if (!order) {
    return res.status(404).json({ message: 'Commande introuvable.' });
  }
  const schedule = Array.isArray(order.installmentPlan?.schedule)
    ? order.installmentPlan.schedule
    : [];
  if (!schedule[index]) {
    return res.status(404).json({ message: 'Tranche introuvable.' });
  }
  if (['paid', 'waived'].includes(schedule[index].status)) {
    return res.status(400).json({ message: 'Cette tranche est déjà finalisée.' });
  }
  if (schedule[index].status === 'proof_uploaded') {
    return res.status(400).json({
      message: 'Cette tranche est déjà soumise. Attendez la validation du vendeur.'
    });
  }
  const hasBlockingPreviousInstallment = schedule.some(
    (entry, entryIndex) => entryIndex < index && !['paid', 'waived'].includes(entry?.status)
  );
  if (hasBlockingPreviousInstallment) {
    return res.status(400).json({
      message:
        'La tranche précédente doit être validée avant de soumettre la suivante.'
    });
  }
  if (!order.installmentPlan?.saleConfirmationConfirmedAt) {
    return res.status(400).json({
      message: 'La tranche ne peut pas être soumise avant la confirmation de vente par le vendeur.'
    });
  }

  const expectedAmount = Number(Number(schedule[index].amount || 0).toFixed(2));
  const normalizedAmount = Number(submittedAmount.toFixed(2));
  if (normalizedAmount !== expectedAmount) {
    return res.status(400).json({
      message: `Le montant de la preuve doit être ${expectedAmount.toLocaleString('fr-FR')} FCFA.`
    });
  }

  schedule[index].transactionProof = {
    senderName: cleanPayerName,
    transactionCode: cleanTransactionCode,
    amount: normalizedAmount,
    submittedAt: new Date(),
    submittedBy: userId
  };
  if (schedule[index].status !== 'paid') {
    schedule[index].status = 'proof_uploaded';
  }
  order.markModified('installmentPlan');
  await order.save();

  const sellerId = resolveItemShopId(order.items?.[0]);
  if (sellerId) {
    await createNotification({
      userId: sellerId,
      actorId: userId,
      productId: order.items?.[0]?.product || null,
      type: 'installment_payment_submitted',
      metadata: {
        orderId: order._id,
        scheduleIndex: index,
        amount: schedule[index].amount,
        dueDate: schedule[index].dueDate,
        payerName: cleanPayerName,
        transactionCode: cleanTransactionCode
      }
    });
  }

  const populated = await baseOrderQuery().findById(order._id);
  await ensureOrderProductSlugs([populated]);
  res.json(buildOrderResponse(populated));
});

export const sellerConfirmInstallmentSale = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.user?._id;
  const { id } = req.params;
  const { approve } = req.body;

  if (!ensureObjectId(id)) {
    return res.status(400).json({ message: 'Commande invalide.' });
  }
  const order = await Order.findOne({
    _id: id,
    paymentType: 'installment',
    isDraft: { $ne: true },
    'items.snapshot.shopId': userId
  });
  if (!order) {
    return res.status(404).json({ message: 'Commande introuvable.' });
  }

  if (!approve) {
    order.status = 'cancelled';
    order.cancelledAt = new Date();
    order.cancelledBy = userId;
    order.cancellationReason = 'Preuve de vente rejetée par le vendeur.';
    await order.save();
    return res.json({ message: 'Commande annulée.' });
  }

  order.installmentPlan.saleConfirmationConfirmedAt = new Date();
  order.installmentPlan.saleConfirmationConfirmedBy = userId;
  order.installmentPlan.nextDueDate = getNextDueDate(order.installmentPlan.schedule || []);
  if (order.status === 'pending_installment') {
    order.status = 'installment_active';
  }
  order.markModified('installmentPlan');
  await order.save();

  await createNotification({
    userId: order.customer,
    actorId: userId,
    productId: order.items?.[0]?.product || null,
    type: 'installment_sale_confirmed',
    metadata: {
      orderId: order._id,
      nextDueDate: order.installmentPlan.nextDueDate
    },
    allowSelf: true
  });

  const populated = await baseOrderQuery().findById(order._id);
  await ensureOrderProductSlugs([populated]);
  res.json(buildOrderResponse(populated));
});

export const sellerValidateInstallmentPayment = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.user?._id;
  const { id, scheduleIndex } = req.params;
  const { approve } = req.body;

  if (!ensureObjectId(id)) {
    return res.status(400).json({ message: 'Commande invalide.' });
  }
  const index = Number(scheduleIndex);
  if (!Number.isInteger(index) || index < 0) {
    return res.status(400).json({ message: 'Index de tranche invalide.' });
  }

  const order = await Order.findOne({
    _id: id,
    paymentType: 'installment',
    isDraft: { $ne: true },
    'items.snapshot.shopId': userId
  });
  if (!order) {
    return res.status(404).json({ message: 'Commande introuvable.' });
  }
  if (!order.installmentPlan?.saleConfirmationConfirmedAt) {
    return res.status(400).json({
      message: 'La vente doit être confirmée avant la validation des paiements.'
    });
  }

  const schedule = Array.isArray(order.installmentPlan?.schedule)
    ? order.installmentPlan.schedule
    : [];
  const current = schedule[index];
  if (!current) {
    return res.status(404).json({ message: 'Tranche introuvable.' });
  }

  if (!approve) {
    current.status = 'pending';
    current.transactionProof = {};
    current.validatedBy = null;
    current.validatedAt = null;
    current.paidAt = null;
    order.installmentPlan.nextDueDate = getNextDueDate(schedule);
    order.markModified('installmentPlan');
    await order.save();
    const populated = await baseOrderQuery().findById(order._id);
    await ensureOrderProductSlugs([populated]);
    return res.json(buildOrderResponse(populated));
  }
  if (!current?.transactionProof?.senderName || !current?.transactionProof?.transactionCode) {
    return res.status(400).json({ message: 'Aucune preuve transactionnelle valide pour cette tranche.' });
  }

  const now = new Date();
  const isLate = current.dueDate && new Date(current.dueDate) < now;
  const baseAmount = Number(current.amount || 0);
  const penalty = isLate
    ? Number(((baseAmount * Number(order.installmentPlan.latePenaltyRate || 0)) / 100).toFixed(2))
    : 0;

  current.status = 'paid';
  current.validatedBy = userId;
  current.validatedAt = now;
  current.paidAt = now;
  current.penaltyAmount = penalty;

  const paidIncrement = Number((baseAmount + penalty).toFixed(2));
  order.installmentPlan.amountPaid = Number(
    (Number(order.installmentPlan.amountPaid || 0) + paidIncrement).toFixed(2)
  );
  order.installmentPlan.totalPenaltyAccrued = Number(
    (Number(order.installmentPlan.totalPenaltyAccrued || 0) + penalty).toFixed(2)
  );
  order.installmentPlan.remainingAmount = Math.max(
    0,
    Number((Number(order.installmentPlan.totalAmount || 0) - Number(order.installmentPlan.amountPaid || 0)).toFixed(2))
  );
  order.installmentPlan.nextDueDate = getNextDueDate(schedule);
  order.markModified('installmentPlan');

  order.paidAmount = Number(order.installmentPlan.amountPaid || 0);
  order.remainingAmount = Number(order.installmentPlan.remainingAmount || 0);

  if (order.installmentPlan.remainingAmount <= 0) {
    order.status = 'completed';
    if (!order.installmentSaleStatus) {
      order.installmentSaleStatus = 'confirmed';
    }
    if (!Array.isArray(order.items) || !order.items.length) {
      await order.save();
    } else {
      await order.save();
      await Promise.all(
        order.items.map(async (item) => {
          if (!item?.product) return;
          const salesCount = await calculateProductSalesCount(item.product);
          await Product.updateOne({ _id: item.product }, { $set: { salesCount } });
        })
      );
    }
  } else {
    order.status = 'installment_active';
    await order.save();
  }

  await createNotification({
    userId: order.customer,
    actorId: userId,
    productId: order.items?.[0]?.product || null,
    type: 'installment_payment_validated',
    metadata: {
      orderId: order._id,
      scheduleIndex: index,
      amount: baseAmount,
      penalty
    },
    allowSelf: true
  });

  if (order.status === 'completed') {
    await createNotification({
      userId: order.customer,
      actorId: userId,
      productId: order.items?.[0]?.product || null,
      type: 'installment_completed',
      metadata: {
        orderId: order._id,
        invoiceEligible: true
      },
      allowSelf: true
    });
  }

  const populated = await baseOrderQuery().findById(order._id);
  await ensureOrderProductSlugs([populated]);
  res.json(buildOrderResponse(populated));
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
            $cond: [{ $eq: ['$status', 'completed'] }, 1, 0]
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
