import mongoose from 'mongoose';

// A conversation is a buyer<->seller thread. `orderId` is optional context:
// present for order-anchored threads (logistics, "where's my package"), null
// for a general/pre-sale thread with that shop. Each real order gets its own
// distinct conversation (kept separate from general chat on purpose — order
// logistics shouldn't get mixed into "do you have this in blue?"), but there
// is only ever ONE general (orderId: null) conversation per buyer/seller
// pair — this is what replaces the old "fake draft order per product
// question" hack (see orderController.js's now-unused createInquiryOrder).
const conversationSchema = new mongoose.Schema(
  {
    buyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null, index: true },
    // Last product referenced in a general (non-order) conversation — a
    // display hint only, never part of the dedup key.
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
    lastMessageAt: { type: Date, default: null, index: true },
    lastMessagePreview: { type: String, trim: true, default: '' },
    lastMessageSenderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    archivedBy: { type: [mongoose.Schema.Types.ObjectId], ref: 'User', default: [] },
    deletedBy: { type: [mongoose.Schema.Types.ObjectId], ref: 'User', default: [] }
  },
  { timestamps: true }
);

// Exactly one order-anchored conversation per (buyer, seller, order).
conversationSchema.index(
  { buyerId: 1, sellerId: 1, orderId: 1 },
  { unique: true, partialFilterExpression: { orderId: { $type: 'objectId' } } }
);
// Exactly one general (orderId: null) conversation per (buyer, seller).
conversationSchema.index(
  { buyerId: 1, sellerId: 1 },
  { unique: true, partialFilterExpression: { orderId: { $type: 'null' } } }
);
conversationSchema.index({ buyerId: 1, lastMessageAt: -1 });
conversationSchema.index({ sellerId: 1, lastMessageAt: -1 });

export default mongoose.model('Conversation', conversationSchema);
