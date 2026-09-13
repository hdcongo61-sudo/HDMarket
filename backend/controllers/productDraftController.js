import asyncHandler from 'express-async-handler';
import {
  clearProductDraft,
  recordProductDraftActivity
} from '../services/productDraftReminderService.js';

/**
 * Heartbeat from the ProductForm autosave loop — keeps the seller's draft
 * "active" so the 24h inactivity reminder only fires when they really stop.
 */
export const saveProductDraftActivity = asyncHandler(async (req, res) => {
  const title = String(req.body?.title || '').trim().slice(0, 200);
  await recordProductDraftActivity({ userId: req.user.id, title });
  res.json({ ok: true });
});

/** Called when the seller publishes or discards the draft. */
export const clearProductDraftActivity = asyncHandler(async (req, res) => {
  await clearProductDraft(req.user.id);
  res.json({ ok: true });
});
