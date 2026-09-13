import ProductDraft from '../models/productDraftModel.js';
import Product from '../models/productModel.js';
import { createNotification } from '../utils/notificationService.js';

const HOUR_MS = 60 * 60 * 1000;

// A seller who started creating a listing and never came back gets reminded
// after STALE_AFTER_HOURS of inactivity (default 24h, per product requirement).
const STALE_AFTER_HOURS = Number(process.env.PRODUCT_DRAFT_REMINDER_HOURS || 24);
const REMINDER_COOLDOWN_HOURS = Number(process.env.PRODUCT_DRAFT_REMINDER_COOLDOWN_HOURS || 24);
const MAX_REMINDERS = Number(process.env.PRODUCT_DRAFT_MAX_REMINDERS || 2);

const RESUME_LINK = '/seller/products';

/**
 * Called by the ProductForm while the seller is actively working on a new
 * listing draft — keeps `lastActiveAt` fresh so the sweep never fires on an
 * active session.
 */
export const recordProductDraftActivity = async ({ userId, title = '' }) => {
  if (!userId) return null;
  const now = new Date();
  return ProductDraft.findOneAndUpdate(
    { user: userId },
    {
      $set: {
        lastActiveAt: now,
        ...(title ? { title: String(title).trim().slice(0, 200) } : {})
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();
};

/** Clears the draft tracking row once the listing is published or discarded. */
export const clearProductDraft = async (userId) => {
  if (!userId) return { acknowledged: true, deletedCount: 0 };
  return ProductDraft.deleteOne({ user: userId });
};

/**
 * Sweep for draft rows that have been inactive for STALE_AFTER_HOURS or more
 * and push a reminder notification to the seller. Skips users who published a
 * product since their last draft activity (the draft is stale by then).
 */
export const runProductDraftReminderSweep = async ({ limit = 200, source = 'schedule' } = {}) => {
  const now = Date.now();
  const staleBefore = new Date(now - STALE_AFTER_HOURS * HOUR_MS);
  const cooldownBefore = new Date(now - REMINDER_COOLDOWN_HOURS * HOUR_MS);

  const drafts = await ProductDraft.find({
    lastActiveAt: { $lte: staleBefore },
    reminderCount: { $lt: MAX_REMINDERS },
    $or: [{ reminderSentAt: null }, { reminderSentAt: { $lte: cooldownBefore } }]
  })
    .sort({ lastActiveAt: 1 })
    .limit(Math.max(1, Number(limit) || 200))
    .lean();

  if (!drafts.length) {
    return { source, scanned: 0, reminded: 0, notificationsSent: 0, clearedStale: 0 };
  }

  let reminded = 0;
  let notificationsSent = 0;
  let clearedStale = 0;

  for (const draft of drafts) {
    const userId = String(draft.user || '');
    if (!userId) {
      await ProductDraft.deleteOne({ _id: draft._id });
      clearedStale += 1;
      continue;
    }

    // If the seller already published something after their last draft activity,
    // the draft is obsolete — drop it and don't bother them.
    const publishedSince = await Product.exists({
      user: draft.user,
      createdAt: { $gt: draft.lastActiveAt }
    });
    if (publishedSince) {
      await ProductDraft.deleteOne({ _id: draft._id });
      clearedStale += 1;
      continue;
    }

    const inactiveHours = Math.max(
      1,
      Math.floor((now - new Date(draft.lastActiveAt).getTime()) / HOUR_MS)
    );
    const round = Number(draft.reminderCount || 0) + 1;
    const titleSnippet = String(draft.title || '').trim();

    const notification = await createNotification({
      userId: draft.user,
      actorId: draft.user,
      allowSelf: true,
      type: 'product_draft_reminder',
      priority: 'NORMAL',
      deepLink: RESUME_LINK,
      actionLink: RESUME_LINK,
      entityType: 'product',
      title: 'Votre annonce vous attend',
      message: `Reprenez la création de votre annonce${
        titleSnippet ? ` « ${titleSnippet} »` : ''
      } : elle est en brouillon depuis ${inactiveHours}h.`,
      metadata: {
        title: titleSnippet,
        inactiveHours,
        reminderRound: round,
        deepLink: RESUME_LINK,
        source
      },
      dedupeKey: `product-draft-reminder:${userId}:${round}`
    });

    if (notification) notificationsSent += 1;
    reminded += 1;

    await ProductDraft.updateOne(
      { _id: draft._id },
      { $set: { reminderSentAt: new Date(), reminderCount: round } }
    );
  }

  return {
    source,
    scanned: drafts.length,
    reminded,
    notificationsSent,
    clearedStale
  };
};
