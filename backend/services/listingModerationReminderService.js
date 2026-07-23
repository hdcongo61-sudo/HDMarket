import Payment from '../models/paymentModel.js';
import Product from '../models/productModel.js';
import User from '../models/userModel.js';
import { createNotification } from '../utils/notificationService.js';

const HOUR_MS = 60 * 60 * 1000;

// A listing-fee payment is considered "paid but untreated" once the seller has
// submitted/paid for the annonce (status 'waiting') yet no moderator has verified
// it, leaving the product in the 'pending' state. PawaPay payments auto-approve and
// never reach this state.
const STALE_AFTER_HOURS = Number(process.env.LISTING_MODERATION_STALE_HOURS || 24);
const REMINDER_COOLDOWN_HOURS = Number(process.env.LISTING_MODERATION_REMINDER_COOLDOWN_HOURS || 12);
const MAX_REMINDERS = Number(process.env.LISTING_MODERATION_MAX_REMINDERS || 3);

const PAYMENT_VERIFICATION_LINK = '/admin/payment-verification?status=waiting';

const getModeratorRecipients = async () =>
  User.find({
    $or: [
      { role: { $in: ['admin', 'founder', 'manager'] } },
      { canVerifyPayments: true },
      { permissions: 'verify_payments' }
    ],
    isActive: { $ne: false }
  })
    .select('_id role canVerifyPayments permissions')
    .lean();

const resolveAudience = (moderator) => {
  const role = String(moderator.role || '').toLowerCase();
  const hasVerifyPermission =
    Array.isArray(moderator.permissions) && moderator.permissions.includes('verify_payments');
  const isVerifier =
    (Boolean(moderator.canVerifyPayments) || hasVerifyPermission) &&
    !['admin', 'founder', 'manager'].includes(role);
  if (isVerifier) return 'ROLE_GROUP';
  if (role === 'founder') return 'FOUNDER';
  if (role === 'admin') return 'ADMIN';
  return 'ROLE_GROUP';
};

/**
 * Sweep for paid listing-fee payments whose annonce has been awaiting moderator
 * treatment for more than STALE_AFTER_HOURS, and re-notify admins/managers/founders
 * (and delegated payment verifiers) to process them. Reuses the existing
 * `payment_pending` validation task, so repeated reminders re-surface the same task
 * (marked unread + re-pushed) instead of creating duplicates.
 */
export const runStaleListingReminderSweep = async ({ limit = 200, source = 'schedule' } = {}) => {
  const now = Date.now();
  const staleBefore = new Date(now - STALE_AFTER_HOURS * HOUR_MS);
  const cooldownBefore = new Date(now - REMINDER_COOLDOWN_HOURS * HOUR_MS);

  const payments = await Payment.find({
    paymentType: 'LISTING_FEE',
    status: 'waiting',
    createdAt: { $lte: staleBefore },
    moderationReminderCount: { $lt: MAX_REMINDERS },
    $or: [
      { moderationReminderLastSentAt: null },
      { moderationReminderLastSentAt: { $lte: cooldownBefore } }
    ]
  })
    .sort({ createdAt: 1 })
    .limit(Math.max(1, Number(limit) || 200))
    .populate('product', 'title slug status user')
    .lean();

  if (!payments.length) {
    return { source, scanned: 0, remindedListings: 0, notificationsSent: 0 };
  }

  const moderators = await getModeratorRecipients();

  let remindedListings = 0;
  let notificationsSent = 0;

  for (const payment of payments) {
    const product = payment.product;
    // Only chase annonces still awaiting treatment. If the product moved on
    // (approved/rejected/removed), stop reminding for this payment.
    if (!product || product.status !== 'pending') continue;

    const sellerId = product.user || payment.user;
    if (!sellerId) continue;

    const ageHours = Math.floor((now - new Date(payment.createdAt).getTime()) / HOUR_MS);
    const reminderRound = Number(payment.moderationReminderCount || 0) + 1;
    const productTitle = product.title || '';

    const metadata = {
      paymentId: String(payment._id),
      productId: String(product._id),
      productSlug: product.slug || '',
      productTitle,
      amount: Number(payment.amount || 0),
      paymentType: 'LISTING_FEE',
      operator: payment.operator || '',
      payerName: payment.payerName || '',
      reminder: true,
      reminderRound,
      ageHours,
      deepLink: PAYMENT_VERIFICATION_LINK,
      message: `Rappel : l'annonce${
        productTitle ? ` "${productTitle}"` : ''
      } est payée depuis ${ageHours}h et attend toujours une vérification. Vérifiez le paiement et validez ou refusez l'annonce.`
    };

    const recipients = moderators.filter((moderator) => String(moderator._id) !== String(sellerId));

    const results = await Promise.all(
      recipients.map((moderator) =>
        createNotification({
          userId: moderator._id,
          actorId: sellerId,
          productId: product._id,
          type: 'payment_pending',
          audience: resolveAudience(moderator),
          targetRole: [String(moderator.role || '').toUpperCase()],
          actionRequired: true,
          actionType: 'VERIFY',
          actionStatus: 'PENDING',
          deepLink: PAYMENT_VERIFICATION_LINK,
          actionLink: PAYMENT_VERIFICATION_LINK,
          entityType: 'payment',
          entityId: String(payment._id),
          validationType: 'productValidation',
          metadata
        }).catch(() => null)
      )
    );

    const sent = results.filter(Boolean).length;
    notificationsSent += sent;

    await Payment.updateOne(
      { _id: payment._id },
      {
        $set: { moderationReminderLastSentAt: new Date() },
        $inc: { moderationReminderCount: 1 }
      }
    );
    remindedListings += 1;
  }

  return { source, scanned: payments.length, remindedListings, notificationsSent };
};

export default { runStaleListingReminderSweep };
