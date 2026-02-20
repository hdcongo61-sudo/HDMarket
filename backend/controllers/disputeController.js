import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import Dispute, {
  DISPUTE_REASONS,
  DISPUTE_RESOLUTION_TYPES,
  DISPUTE_STATUSES
} from '../models/disputeModel.js';
import DisputeActionLog from '../models/disputeActionLogModel.js';
import Order from '../models/orderModel.js';
import OrderMessage from '../models/orderMessageModel.js';
import User from '../models/userModel.js';
import { createNotification } from '../utils/notificationService.js';

const ORDER_DISPUTE_STATUS = 'dispute_opened';
const DISPUTE_WINDOW_HOURS = Math.max(24, Number(process.env.DISPUTE_WINDOW_HOURS || 72));
const SELLER_RESPONSE_HOURS = Math.max(12, Number(process.env.DISPUTE_SELLER_RESPONSE_HOURS || 48));
const CLIENT_MONTHLY_LIMIT = Math.max(1, Number(process.env.DISPUTE_CLIENT_MONTHLY_LIMIT || 5));
const CLIENT_SUSPICIOUS_THRESHOLD = Math.max(3, Number(process.env.DISPUTE_SUSPICIOUS_CLIENT_THRESHOLD || 4));
const SELLER_SUSPICIOUS_THRESHOLD = Math.max(6, Number(process.env.DISPUTE_SUSPICIOUS_SELLER_THRESHOLD || 10));

const toPublicFile = (file) => ({
  filename: file?.filename || '',
  originalName: file?.originalName || file?.originalname || '',
  mimetype: file?.mimetype || '',
  size: Number(file?.size || 0),
  path: file?.path || '',
  url: file?.url || file?.path || ''
});

const toUploadedFile = (file) => ({
  filename: file.filename,
  originalName: file.originalname,
  mimetype: file.mimetype,
  size: file.size,
  path: `uploads/disputes/${file.filename}`,
  url: `uploads/disputes/${file.filename}`
});

const monthRange = (value = new Date()) => {
  const start = new Date(value.getFullYear(), value.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(value.getFullYear(), value.getMonth() + 1, 1, 0, 0, 0, 0);
  return { start, end };
};

const getOrderSellerId = (orderDoc) => {
  const items = Array.isArray(orderDoc?.items) ? orderDoc.items : [];
  const fromSnapshot = items.find((item) => item?.snapshot?.shopId)?.snapshot?.shopId;
  if (fromSnapshot) return fromSnapshot;
  const fromProduct = items.find((item) => item?.product?.user)?.product?.user;
  if (fromProduct) return fromProduct;
  return null;
};

const computeClientSuccessRate = async (clientId) => {
  const resolved = await Dispute.aggregate([
    {
      $match: {
        clientId: new mongoose.Types.ObjectId(clientId),
        status: { $in: ['RESOLVED_CLIENT', 'RESOLVED_SELLER', 'REJECTED'] }
      }
    },
    {
      $group: {
        _id: null,
        totalResolved: { $sum: 1 },
        wonByClient: {
          $sum: {
            $cond: [{ $eq: ['$status', 'RESOLVED_CLIENT'] }, 1, 0]
          }
        }
      }
    }
  ]);
  const totalResolved = Number(resolved?.[0]?.totalResolved || 0);
  const wonByClient = Number(resolved?.[0]?.wonByClient || 0);
  if (!totalResolved) return 0;
  return Number((wonByClient / totalResolved).toFixed(4));
};

const buildAbuseSignals = async ({ clientId, sellerId, now = new Date() }) => {
  const { start, end } = monthRange(now);
  const [clientMonthlyCount, sellerMonthlyCount, clientSuccessRate] = await Promise.all([
    Dispute.countDocuments({ clientId, createdAt: { $gte: start, $lt: end } }),
    Dispute.countDocuments({ sellerId, createdAt: { $gte: start, $lt: end } }),
    computeClientSuccessRate(clientId)
  ]);

  const reasons = [];
  if (clientMonthlyCount >= CLIENT_SUSPICIOUS_THRESHOLD) {
    reasons.push('client_high_frequency');
  }
  if (sellerMonthlyCount >= SELLER_SUSPICIOUS_THRESHOLD) {
    reasons.push('seller_high_frequency');
  }
  if (clientMonthlyCount >= 3 && clientSuccessRate < 0.2) {
    reasons.push('client_low_success_rate');
  }

  return {
    clientMonthlyCount,
    clientSuccessRate,
    sellerMonthlyCount,
    suspicious: reasons.length > 0,
    reasons
  };
};

const getAdminRecipients = async () => {
  const recipients = await User.find({
    $or: [{ role: 'admin' }, { role: 'manager' }, { canManageComplaints: true }]
  })
    .select('_id')
    .lean();
  return recipients.map((entry) => String(entry._id));
};

const logDisputeAction = async ({ disputeId, orderId, actorId = null, actorRole, action, metadata = {} }) => {
  await DisputeActionLog.create({
    disputeId,
    orderId,
    actorId,
    actorRole,
    action,
    metadata
  });
};

const sendDisputeCreatedNotifications = async ({ dispute, actorId }) => {
  const adminIds = await getAdminRecipients();
  const notifications = [
    createNotification({
      userId: dispute.sellerId,
      actorId,
      type: 'dispute_created',
      metadata: { disputeId: dispute._id, orderId: dispute.orderId, reason: dispute.reason }
    })
  ];
  adminIds.forEach((adminId) => {
    notifications.push(
      createNotification({
        userId: adminId,
        actorId,
        type: 'dispute_created',
        metadata: { disputeId: dispute._id, orderId: dispute.orderId, reason: dispute.reason }
      })
    );
  });
  await Promise.allSettled(notifications);
};

const processDisputeDeadlines = async () => {
  const now = new Date();
  const reminderThreshold = new Date(now.getTime() + 6 * 60 * 60 * 1000);

  const dueSoon = await Dispute.find({
    status: 'OPEN',
    sellerDeadline: { $gt: now, $lte: reminderThreshold },
    deadlineReminderSentAt: null
  }).lean();

  for (const dispute of dueSoon) {
    await Dispute.updateOne(
      { _id: dispute._id, deadlineReminderSentAt: null, status: 'OPEN' },
      { $set: { deadlineReminderSentAt: now } }
    );
    await logDisputeAction({
      disputeId: dispute._id,
      orderId: dispute.orderId,
      actorRole: 'system',
      action: 'DEADLINE_REMINDER_SENT'
    });
    await createNotification({
      userId: dispute.sellerId,
      actorId: dispute.clientId,
      type: 'dispute_deadline_near',
      metadata: {
        disputeId: dispute._id,
        orderId: dispute.orderId,
        sellerDeadline: dispute.sellerDeadline
      }
    });
  }

  const overdue = await Dispute.find({
    status: 'OPEN',
    sellerDeadline: { $lte: now }
  }).lean();

  for (const dispute of overdue) {
    const updated = await Dispute.findOneAndUpdate(
      { _id: dispute._id, status: 'OPEN' },
      { $set: { status: 'UNDER_REVIEW', escalatedAt: now } },
      { new: true }
    ).lean();
    if (!updated) continue;
    await logDisputeAction({
      disputeId: updated._id,
      orderId: updated.orderId,
      actorRole: 'system',
      action: 'AUTO_ESCALATED'
    });
    await createNotification({
      userId: updated.clientId,
      actorId: updated.sellerId,
      type: 'dispute_under_review',
      metadata: { disputeId: updated._id, orderId: updated.orderId }
    });
    await createNotification({
      userId: updated.sellerId,
      actorId: updated.clientId,
      type: 'dispute_under_review',
      metadata: { disputeId: updated._id, orderId: updated.orderId }
    });
    const adminIds = await getAdminRecipients();
    await Promise.allSettled(
      adminIds.map((adminId) =>
        createNotification({
          userId: adminId,
          actorId: updated.clientId,
          type: 'dispute_under_review',
          metadata: { disputeId: updated._id, orderId: updated.orderId }
        })
      )
    );
  }
};

const serializeDispute = (disputeDoc) => {
  const dispute = disputeDoc?.toObject ? disputeDoc.toObject() : disputeDoc;
  if (!dispute) return null;
  return {
    ...dispute,
    proofImages: (dispute.proofImages || []).map(toPublicFile),
    sellerProofImages: (dispute.sellerProofImages || []).map(toPublicFile)
  };
};

export const createDispute = asyncHandler(async (req, res) => {
  await processDisputeDeadlines();

  const userId = req.user.id;
  const { orderId, reason, description } = req.body;
  const reasonValue = String(reason || '').trim();
  const descriptionValue = String(description || '').trim();

  if (!mongoose.isValidObjectId(orderId)) {
    return res.status(400).json({ message: 'Commande invalide.' });
  }
  if (!DISPUTE_REASONS.includes(reasonValue)) {
    return res.status(400).json({ message: 'Motif invalide.' });
  }
  if (!descriptionValue || descriptionValue.length < 10) {
    return res.status(400).json({ message: 'Description trop courte (min 10 caractères).' });
  }

  const proofImages = (req.files || []).slice(0, 5).map(toUploadedFile);
  const now = new Date();
  const { start, end } = monthRange(now);
  const monthlyCount = await Dispute.countDocuments({
    clientId: userId,
    createdAt: { $gte: start, $lt: end }
  });
  if (monthlyCount >= CLIENT_MONTHLY_LIMIT) {
    return res.status(429).json({
      message: `Limite atteinte: ${CLIENT_MONTHLY_LIMIT} litiges max par mois.`,
      code: 'DISPUTE_MONTHLY_LIMIT'
    });
  }

  const existing = await Dispute.findOne({ orderId }).lean();
  if (existing) {
    return res.status(409).json({ message: 'Un litige existe déjà pour cette commande.' });
  }

  const order = await Order.findById(orderId)
    .populate({
      path: 'items.product',
      select: 'user title'
    })
    .lean();
  if (!order) {
    return res.status(404).json({ message: 'Commande introuvable.' });
  }
  if (String(order.customer) !== String(userId)) {
    return res.status(403).json({ message: 'Cette commande ne vous appartient pas.' });
  }
  if (!['delivery_proof_submitted', 'delivered', 'confirmed_by_client', 'completed'].includes(order.status)) {
    return res.status(400).json({ message: 'Le litige est possible uniquement après livraison.' });
  }

  const deliveredAt = order.deliveredAt ? new Date(order.deliveredAt) : new Date(order.updatedAt || order.createdAt);
  const disputeWindowEndsAt = new Date(deliveredAt.getTime() + DISPUTE_WINDOW_HOURS * 60 * 60 * 1000);
  if (now > disputeWindowEndsAt) {
    return res.status(400).json({
      message: `Le délai de litige est dépassé (${DISPUTE_WINDOW_HOURS}h après livraison).`,
      deliveredAt,
      disputeWindowEndsAt
    });
  }

  const sellerId = getOrderSellerId(order);
  if (!sellerId) {
    return res.status(400).json({ message: 'Impossible de déterminer le vendeur pour cette commande.' });
  }

  const abuseSignals = await buildAbuseSignals({ clientId: userId, sellerId, now });
  const sellerDeadline = new Date(now.getTime() + SELLER_RESPONSE_HOURS * 60 * 60 * 1000);

  const session = await mongoose.startSession();
  let createdDispute;
  try {
    await session.withTransaction(async () => {
      createdDispute = await Dispute.create(
        [
          {
            orderId,
            clientId: userId,
            sellerId,
            reason: reasonValue,
            description: descriptionValue,
            proofImages,
            status: 'OPEN',
            sellerDeadline,
            disputeWindowEndsAt,
            abuseSignals
          }
        ],
        { session }
      );

      const orderUpdate = await Order.updateOne(
        {
          _id: orderId,
          status: { $in: ['delivery_proof_submitted', 'delivered', 'confirmed_by_client', 'completed'] }
        },
        { $set: { status: ORDER_DISPUTE_STATUS } },
        { session }
      );
      if (!orderUpdate?.matchedCount) {
        throw new Error('Commande non éligible au litige.');
      }

      await User.updateOne(
        { _id: userId },
        { $inc: { 'disputeStats.openedAsClient': 1 } },
        { session }
      );
      await User.updateOne(
        { _id: sellerId },
        { $inc: { 'disputeStats.openedAgainstSeller': 1 } },
        { session }
      );
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ message: 'Un litige existe déjà pour cette commande.' });
    }
    if (error?.message === 'Commande non éligible au litige.') {
      return res.status(409).json({ message: 'La commande n’est plus éligible à l’ouverture de litige.' });
    }
    throw error;
  } finally {
    session.endSession();
  }

  const dispute = createdDispute?.[0];
  await logDisputeAction({
    disputeId: dispute._id,
    orderId,
    actorId: userId,
    actorRole: 'client',
    action: 'DISPUTE_CREATED',
    metadata: { reason: reasonValue }
  });
  await sendDisputeCreatedNotifications({ dispute, actorId: userId });

  return res.status(201).json({
    message: 'Litige créé avec succès.',
    dispute: serializeDispute(dispute)
  });
});

export const listClientDisputes = asyncHandler(async (req, res) => {
  await processDisputeDeadlines();
  const disputes = await Dispute.find({ clientId: req.user.id })
    .sort({ createdAt: -1 })
    .populate({
      path: 'orderId',
      select:
        'status deliveryAddress deliveryCity createdAt deliveredAt totalAmount paidAmount remainingAmount paymentType items paymentName paymentTransactionCode'
    })
    .populate('sellerId', 'name shopName phone')
    .lean();

  res.json(disputes.map(serializeDispute));
});

export const listSellerDisputes = asyncHandler(async (req, res) => {
  await processDisputeDeadlines();
  const { status } = req.query;
  const filter = { sellerId: req.user.id };
  if (status && DISPUTE_STATUSES.includes(status)) {
    filter.status = status;
  }

  const disputes = await Dispute.find(filter)
    .sort({ createdAt: -1 })
    .populate({
      path: 'orderId',
      select:
        'status deliveryAddress deliveryCity createdAt deliveredAt totalAmount paidAmount remainingAmount paymentType items paymentName paymentTransactionCode'
    })
    .populate('clientId', 'name phone email')
    .lean();

  res.json(disputes.map(serializeDispute));
});

export const respondSellerDispute = asyncHandler(async (req, res) => {
  await processDisputeDeadlines();
  const disputeId = req.params.id;
  if (!mongoose.isValidObjectId(disputeId)) {
    return res.status(400).json({ message: 'Litige invalide.' });
  }

  const responseText = String(req.body.sellerResponse || '').trim();
  const sellerProofImages = (req.files || []).slice(0, 5).map(toUploadedFile);
  if (!responseText && sellerProofImages.length === 0) {
    return res.status(400).json({ message: 'Ajoutez une réponse ou au moins une preuve.' });
  }

  const dispute = await Dispute.findById(disputeId);
  if (!dispute) {
    return res.status(404).json({ message: 'Litige introuvable.' });
  }
  if (String(dispute.sellerId) !== String(req.user.id)) {
    return res.status(403).json({ message: 'Accès refusé.' });
  }
  if (dispute.status !== 'OPEN') {
    return res.status(400).json({ message: 'Ce litige ne peut plus recevoir de réponse vendeur.' });
  }

  const now = new Date();
  if (dispute.sellerDeadline && now > new Date(dispute.sellerDeadline)) {
    dispute.status = 'UNDER_REVIEW';
    dispute.escalatedAt = now;
    await dispute.save();
    await logDisputeAction({
      disputeId: dispute._id,
      orderId: dispute.orderId,
      actorRole: 'system',
      action: 'AUTO_ESCALATED'
    });
    return res.status(409).json({
      message: 'Délai vendeur dépassé: litige passé en revue admin.',
      dispute: serializeDispute(dispute)
    });
  }

  dispute.sellerResponse = responseText || dispute.sellerResponse;
  if (sellerProofImages.length) {
    dispute.sellerProofImages = [...(dispute.sellerProofImages || []), ...sellerProofImages].slice(0, 5);
  }
  dispute.status = 'SELLER_RESPONDED';
  await dispute.save();

  await logDisputeAction({
    disputeId: dispute._id,
    orderId: dispute.orderId,
    actorId: req.user.id,
    actorRole: 'seller',
    action: 'SELLER_RESPONDED',
    metadata: { proofCount: sellerProofImages.length }
  });

  await Promise.allSettled([
    createNotification({
      userId: dispute.clientId,
      actorId: req.user.id,
      type: 'dispute_seller_responded',
      metadata: { disputeId: dispute._id, orderId: dispute.orderId }
    }),
    ...(
      await getAdminRecipients()
    ).map((adminId) =>
      createNotification({
        userId: adminId,
        actorId: req.user.id,
        type: 'dispute_seller_responded',
        metadata: { disputeId: dispute._id, orderId: dispute.orderId }
      })
    )
  ]);

  res.json({
    message: 'Réponse vendeur enregistrée.',
    dispute: serializeDispute(dispute)
  });
});

export const listAdminDisputes = asyncHandler(async (req, res) => {
  await processDisputeDeadlines();
  const { status, q } = req.query;
  const filter = {};
  if (status && DISPUTE_STATUSES.includes(status)) {
    filter.status = status;
  }

  let orderFilter = {};
  if (q && String(q).trim()) {
    const matcher = new RegExp(String(q).trim(), 'i');
    const orders = await Order.find({
      $or: [{ deliveryAddress: matcher }, { deliveryCity: matcher }, { paymentName: matcher }]
    })
      .select('_id')
      .lean();
    orderFilter = { orderId: { $in: orders.map((o) => o._id) } };
  }

  const disputes = await Dispute.find({ ...filter, ...orderFilter })
    .sort({ createdAt: -1 })
    .populate({
      path: 'orderId',
      select:
        'status deliveryAddress deliveryCity createdAt deliveredAt totalAmount paidAmount remainingAmount paymentType items paymentName paymentTransactionCode'
    })
    .populate('clientId', 'name phone email reputationScore disputeStats')
    .populate('sellerId', 'name shopName phone email reputationScore disputeStats')
    .lean();

  const orderIds = disputes
    .map((d) => d.orderId?._id)
    .filter(Boolean)
    .map((id) => new mongoose.Types.ObjectId(id));
  const chatSummary = orderIds.length
    ? await OrderMessage.aggregate([
        { $match: { order: { $in: orderIds } } },
        {
          $group: {
            _id: '$order',
            count: { $sum: 1 },
            lastMessageAt: { $max: '$createdAt' }
          }
        }
      ])
    : [];
  const chatMap = new Map(chatSummary.map((item) => [String(item._id), item]));

  res.json(
    disputes.map((item) => {
      const data = serializeDispute(item);
      const orderId = item.orderId?._id ? String(item.orderId._id) : '';
      const chat = chatMap.get(orderId);
      return {
        ...data,
        chatSummary: chat
          ? {
              count: Number(chat.count || 0),
              lastMessageAt: chat.lastMessageAt || null
            }
          : { count: 0, lastMessageAt: null }
      };
    })
  );
});

export const getDisputeDetails = asyncHandler(async (req, res) => {
  const id = req.params.id;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ message: 'Litige invalide.' });
  }
  const dispute = await Dispute.findById(id)
    .populate({
      path: 'orderId',
      select:
        'status deliveryAddress deliveryCity createdAt deliveredAt totalAmount paidAmount remainingAmount paymentType items paymentName paymentTransactionCode'
    })
    .populate('clientId', 'name phone email reputationScore disputeStats')
    .populate('sellerId', 'name shopName phone email reputationScore disputeStats')
    .lean();
  if (!dispute) {
    return res.status(404).json({ message: 'Litige introuvable.' });
  }

  const isParticipant =
    String(dispute.clientId?._id || dispute.clientId) === String(req.user.id) ||
    String(dispute.sellerId?._id || dispute.sellerId) === String(req.user.id);
  const isAdmin =
    req.user.role === 'admin' || req.user.role === 'manager' || req.user.canManageComplaints === true;
  if (!isParticipant && !isAdmin) {
    return res.status(403).json({ message: 'Accès refusé.' });
  }

  const [timeline, chatMessages] = await Promise.all([
    DisputeActionLog.find({ disputeId: id })
      .sort({ createdAt: 1 })
      .populate('actorId', 'name email')
      .lean(),
    dispute.orderId?._id
      ? OrderMessage.find({ order: dispute.orderId._id })
          .sort({ createdAt: -1 })
          .limit(20)
          .select('text from username createdAt attachments voiceMessage metadata')
          .lean()
      : []
  ]);

  res.json({
    dispute: serializeDispute(dispute),
    timeline,
    chatMessages
  });
});

export const resolveAdminDispute = asyncHandler(async (req, res) => {
  const id = req.params.id;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ message: 'Litige invalide.' });
  }

  const resolutionType = String(req.body.resolutionType || '').trim();
  const favor = String(req.body.favor || '').trim();
  const adminDecision = String(req.body.adminDecision || '').trim();
  if (!DISPUTE_RESOLUTION_TYPES.includes(resolutionType)) {
    return res.status(400).json({ message: 'Type de résolution invalide.' });
  }
  if (!adminDecision || adminDecision.length < 5) {
    return res.status(400).json({ message: 'Décision admin trop courte.' });
  }
  if (favor && !['client', 'seller'].includes(favor)) {
    return res.status(400).json({ message: 'Valeur "favor" invalide.' });
  }

  const dispute = await Dispute.findById(id);
  if (!dispute) {
    return res.status(404).json({ message: 'Litige introuvable.' });
  }
  if (!['OPEN', 'SELLER_RESPONDED', 'UNDER_REVIEW'].includes(dispute.status)) {
    return res.status(400).json({ message: 'Ce litige est déjà clôturé.' });
  }

  let nextStatus = 'RESOLVED_CLIENT';
  if (favor === 'seller') {
    nextStatus = 'RESOLVED_SELLER';
  } else if (resolutionType === 'reject') {
    nextStatus = 'REJECTED';
  }

  const now = new Date();
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      dispute.status = nextStatus;
      dispute.resolutionType = resolutionType;
      dispute.adminDecision = adminDecision;
      dispute.resolvedAt = now;
      await dispute.save({ session });

      const orderPatch =
        resolutionType === 'refund_full'
          ? { status: 'cancelled', cancelledAt: now, cancellationReason: `Litige ${dispute._id}` }
          : { status: 'completed' };
      await Order.updateOne({ _id: dispute.orderId }, { $set: orderPatch }, { session });

      if (!dispute.reputationImpactApplied) {
        if (nextStatus === 'RESOLVED_CLIENT') {
          await User.updateOne(
            { _id: dispute.sellerId },
            {
              $inc: {
                reputationScore: -2,
                'disputeStats.lostAsSeller': 1
              }
            },
            { session }
          );
          await User.updateOne(
            { _id: dispute.clientId },
            { $inc: { 'disputeStats.wonAsClient': 1, reputationScore: 1 } },
            { session }
          );
        } else if (nextStatus === 'RESOLVED_SELLER') {
          await User.updateOne(
            { _id: dispute.sellerId },
            { $inc: { reputationScore: 1, 'disputeStats.resolvedForSeller': 1 } },
            { session }
          );
        }
        dispute.reputationImpactApplied = true;
        await dispute.save({ session });
      }
    });
  } finally {
    session.endSession();
  }

  await logDisputeAction({
    disputeId: dispute._id,
    orderId: dispute.orderId,
    actorId: req.user.id,
    actorRole: 'admin',
    action: 'ADMIN_RESOLVED',
    metadata: { resolutionType, favor: favor || null, nextStatus }
  });

  await Promise.allSettled([
    createNotification({
      userId: dispute.clientId,
      actorId: req.user.id,
      type: 'dispute_resolved',
      metadata: {
        disputeId: dispute._id,
        orderId: dispute.orderId,
        status: nextStatus,
        resolutionType
      }
    }),
    createNotification({
      userId: dispute.sellerId,
      actorId: req.user.id,
      type: 'dispute_resolved',
      metadata: {
        disputeId: dispute._id,
        orderId: dispute.orderId,
        status: nextStatus,
        resolutionType
      }
    })
  ]);

  res.json({
    message: 'Litige résolu.',
    dispute: serializeDispute(dispute)
  });
});

export const runDisputeDeadlineChecks = asyncHandler(async (req, res) => {
  await processDisputeDeadlines();
  res.json({ ok: true });
});
