import mongoose from 'mongoose';

/**
 * Server-side mirror of the client's "new product" form draft.
 *
 * The ProductForm auto-saves a draft to localStorage every 5s; the frontend also
 * heartbeats this collection so the backend can remind sellers who abandoned a
 * half-finished listing for too long (see services/productDraftReminderService.js).
 */
const productDraftSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true
    },
    // Last known title — only used to personalise the reminder message.
    title: { type: String, trim: true, maxlength: 200, default: '' },
    lastActiveAt: { type: Date, default: Date.now, index: true },
    reminderSentAt: { type: Date, default: null, index: true },
    reminderCount: { type: Number, min: 0, default: 0 }
  },
  { timestamps: true }
);

productDraftSchema.index({ lastActiveAt: 1, reminderSentAt: 1 });

export default mongoose.model('ProductDraft', productDraftSchema);
