import mongoose from 'mongoose';

const orderMessageSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: false, trim: true },
    // Encrypted content (for E2E encryption)
    encryptedText: { type: String, required: false },
    encryptionKey: { type: String, required: false }, // Base64 encoded key
    // Attachments
    attachments: [{
      type: { type: String, enum: ['image', 'document', 'audio'], required: true },
      url: { type: String, required: true },
      filename: { type: String, required: true },
      size: { type: Number },
      mimeType: { type: String }
    }],
    // Voice message
    voiceMessage: {
      url: { type: String },
      duration: { type: Number }, // in seconds
      type: { type: String, default: 'audio' }
    },
    // Reactions
    reactions: [{
      emoji: { type: String, required: true },
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      createdAt: { type: Date, default: Date.now }
    }],
    readAt: { type: Date, default: null },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  { timestamps: true }
);

// Indexes for efficient queries
orderMessageSchema.index({ order: 1, createdAt: -1 });
orderMessageSchema.index({ sender: 1, createdAt: -1 });
orderMessageSchema.index({ recipient: 1, readAt: 1 });

export default mongoose.model('OrderMessage', orderMessageSchema);
