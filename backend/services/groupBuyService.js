/**
 * Group buying / achat groupé (Taobao gap analysis B.1).
 *
 * Scoped to fit HDMarket's actual payment model: there is no stored payment
 * method to auto-charge members when a team fills, so — unlike Pinduoduo's
 * fully automatic conversion — joining a team is a free reservation, and the
 * group price only ever gets applied when a member completes a *normal*
 * checkout (COD / Mobile Money) while the team is
 * `filled`. This keeps the real growth mechanic (share a link, fill your
 * team, price unlocks) without inventing an auto-charge system the
 * platform's manual-payment reality can't actually support.
 */
import GroupBuy from '../models/groupBuyModel.js';
import Product from '../models/productModel.js';
import { getRuntimeConfig } from './configService.js';
import { createNotification } from '../utils/notificationService.js';

const createHttpError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

export const createGroupBuy = async ({ productId, userId, targetSize, durationHours }) => {
  const enabled = await getRuntimeConfig('enable_group_buying', { fallback: false });
  if (!enabled) throw createHttpError('Les achats groupés sont désactivés.', 403);

  const product = await Product.findOne({ _id: productId, status: 'approved', isActive: { $ne: false } })
    .select('_id title price user images')
    .lean();
  if (!product) throw createHttpError('Produit introuvable ou indisponible.', 404);

  const [defaultTargetSize, defaultDurationHours, discountPercent, maxActive] = await Promise.all([
    getRuntimeConfig('group_buy_default_target_size', { fallback: 3 }),
    getRuntimeConfig('group_buy_default_duration_hours', { fallback: 24 }),
    getRuntimeConfig('group_buy_discount_percent', { fallback: 20 }),
    getRuntimeConfig('group_buy_max_active_per_product', { fallback: 5 })
  ]);

  const activeCount = await GroupBuy.countDocuments({ productId, status: 'open' });
  if (activeCount >= Number(maxActive || 5)) {
    throw createHttpError('Trop d’achats groupés actifs pour ce produit. Réessayez plus tard.', 409);
  }

  const resolvedTargetSize = Math.max(2, Math.round(Number(targetSize) || defaultTargetSize));
  const resolvedDurationHours = Math.max(1, Number(durationHours) || defaultDurationHours);
  const originalPrice = Number(product.price || 0);
  const groupPrice = Math.round(originalPrice * (1 - Number(discountPercent || 0) / 100));
  const deadline = new Date(Date.now() + resolvedDurationHours * 60 * 60 * 1000);

  const groupBuy = await GroupBuy.create({
    productId,
    sellerId: product.user,
    groupPrice,
    originalPrice,
    targetSize: resolvedTargetSize,
    deadline,
    status: 'open',
    members: [{ userId, joinedAt: new Date() }],
    createdBy: userId
  });

  return groupBuy;
};

export const joinGroupBuy = async ({ groupBuyId, userId }) => {
  const enabled = await getRuntimeConfig('enable_group_buying', { fallback: false });
  if (!enabled) throw createHttpError('Les achats groupés sont désactivés.', 403);

  const groupBuy = await GroupBuy.findById(groupBuyId).populate('productId', 'title');
  if (!groupBuy) throw createHttpError('Achat groupé introuvable.', 404);
  if (groupBuy.status !== 'open') throw createHttpError('Cet achat groupé n’accepte plus de membres.', 409);
  if (groupBuy.deadline.getTime() <= Date.now()) throw createHttpError('Cet achat groupé a expiré.', 409);

  const alreadyMember = groupBuy.members.some((member) => String(member.userId) === String(userId));
  if (alreadyMember) return groupBuy;

  if (groupBuy.members.length >= groupBuy.targetSize) {
    throw createHttpError('Cette équipe est déjà complète.', 409);
  }

  groupBuy.members.push({ userId, joinedAt: new Date() });

  const justFilled = groupBuy.members.length >= groupBuy.targetSize;
  if (justFilled) {
    groupBuy.status = 'filled';
  }

  await groupBuy.save();

  if (justFilled) {
    await Promise.all(
      groupBuy.members.map((member) =>
        createNotification({
          userId: member.userId,
          actorId: userId,
          type: 'group_buy_filled',
          allowSelf: true,
          priority: 'HIGH',
          pushEnabled: true,
          metadata: {
            title: 'Équipe complète !',
            message: `Votre achat groupé pour « ${groupBuy.productId?.title || 'un produit'} » est complet. Finalisez votre commande au prix groupé.`,
            groupBuyId: String(groupBuy._id)
          },
          entityType: 'product',
          entityId: String(groupBuy.productId?._id || groupBuy.productId),
          deepLink: `/product/${groupBuy.productId?._id || groupBuy.productId}?groupBuy=${groupBuy._id}`,
          actionLink: `/product/${groupBuy.productId?._id || groupBuy.productId}?groupBuy=${groupBuy._id}`
        }).catch(() => {})
      )
    );
  } else {
    createNotification({
      userId: groupBuy.createdBy,
      actorId: userId,
      type: 'group_buy_joined',
      allowSelf: false,
      priority: 'MEDIUM',
      pushEnabled: true,
      metadata: {
        title: 'Quelqu’un a rejoint votre équipe',
        message: `${groupBuy.members.length}/${groupBuy.targetSize} — plus que ${groupBuy.targetSize - groupBuy.members.length} acheteur(s).`,
        groupBuyId: String(groupBuy._id)
      },
      entityType: 'product',
      entityId: String(groupBuy.productId?._id || groupBuy.productId),
      deepLink: `/product/${groupBuy.productId?._id || groupBuy.productId}?groupBuy=${groupBuy._id}`,
      actionLink: `/product/${groupBuy.productId?._id || groupBuy.productId}?groupBuy=${groupBuy._id}`
    }).catch(() => {});
  }

  return groupBuy;
};

export const getGroupBuyById = async (id) =>
  GroupBuy.findById(id)
    .populate('productId', 'title price images slug')
    .populate('members.userId', 'name')
    .lean();

export const listActiveGroupBuysForProduct = async (productId) =>
  GroupBuy.find({ productId, status: { $in: ['open', 'filled'] } })
    .sort({ createdAt: -1 })
    .populate('members.userId', 'name')
    .lean();

export const listActiveGroupBuys = async ({ limit = 20 } = {}) =>
  GroupBuy.find({ status: 'open' })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('productId', 'title price images slug')
    .lean();

/**
 * Server-side checkout override: if the buyer is a member of a `filled`
 * group buy for one of their cart items, that item's price is overridden to
 * the group price. Never trusts a client-shown group price.
 */
export const applyGroupBuyPricing = async ({ orderItems, groupBuyId, userId }) => {
  if (!groupBuyId || !Array.isArray(orderItems) || !orderItems.length) return orderItems;

  const groupBuy = await GroupBuy.findById(groupBuyId).select('productId status groupPrice members');
  if (!groupBuy || groupBuy.status !== 'filled') return orderItems;

  const isMember = groupBuy.members.some((member) => String(member.userId) === String(userId));
  if (!isMember) return orderItems;

  const targetProductId = String(groupBuy.productId);
  orderItems.forEach((item) => {
    if (String(item.product) !== targetProductId) return;
    const discountedUnitPrice = Number(groupBuy.groupPrice || 0);
    item.unitPrice = discountedUnitPrice;
    item.lineTotal = Number((discountedUnitPrice * item.quantity).toFixed(2));
    item.snapshot = {
      ...item.snapshot,
      groupBuyApplied: true,
      groupBuyId: groupBuy._id
    };
  });

  return orderItems;
};

/**
 * Periodic sweep (see engagementQueue/'sweep-group-buys'): expires open
 * group buys past their deadline that never filled, notifying members so
 * they know the deal didn't happen (no charge was ever taken, so there is
 * nothing to refund — see module docblock).
 */
export const sweepGroupBuys = async ({ limit = 200 } = {}) => {
  const expired = await GroupBuy.find({ status: 'open', deadline: { $lte: new Date() } })
    .limit(limit)
    .populate('productId', 'title');

  let expiredCount = 0;
  for (const groupBuy of expired) {
    groupBuy.status = 'expired';
    // eslint-disable-next-line no-await-in-loop
    await groupBuy.save();
    expiredCount += 1;

    // eslint-disable-next-line no-await-in-loop
    await Promise.all(
      groupBuy.members.map((member) =>
        createNotification({
          userId: member.userId,
          actorId: member.userId,
          type: 'group_buy_expired',
          allowSelf: true,
          priority: 'LOW',
          pushEnabled: true,
          metadata: {
            title: 'Achat groupé expiré',
            message: `Votre équipe pour « ${groupBuy.productId?.title || 'un produit'} » n’a pas atteint le nombre requis à temps.`,
            groupBuyId: String(groupBuy._id)
          },
          entityType: 'product',
          entityId: String(groupBuy.productId?._id || groupBuy.productId),
          deepLink: `/product/${groupBuy.productId?._id || groupBuy.productId}`,
          actionLink: `/product/${groupBuy.productId?._id || groupBuy.productId}`
        }).catch(() => {})
      )
    );
  }

  return { expired: expiredCount, checked: expired.length };
};
