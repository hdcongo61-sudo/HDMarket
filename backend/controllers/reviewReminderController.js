import asyncHandler from 'express-async-handler';
import { sendReviewReminders, checkOrderReviewReminder } from '../utils/reviewReminder.js';

/**
 * Admin endpoint to manually trigger review reminders
 * POST /admin/review-reminders/send
 */
export const triggerReviewReminders = asyncHandler(async (req, res) => {
  const result = await sendReviewReminders();
  res.json({
    message: 'Review reminders processed',
    ...result
  });
});

/**
 * Check if a specific order needs a review reminder
 * GET /orders/:id/review-reminder-check
 */
export const checkOrderReviewReminderStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = await checkOrderReviewReminder(id);
  res.json(result);
});
