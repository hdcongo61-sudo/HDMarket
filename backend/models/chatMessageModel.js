import mongoose from 'mongoose';

const chatMessageSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.Mixed, ref: 'User', required: false },
    username: { type: String, default: 'Utilisateur' },
    from: {
      type: String,
      enum: ['user', 'support'],
      default: 'user'
    },
    text: { type: String, required: false, trim: true },
    // Encrypted content (for E2E encryption)
    encryptedText: { type: String, required: false },
    encryptionKey: { type: String, required: false }, // Base64 encoded key
    // Attachments
    attachments: [{
      type: { type: String, enum: ['image', 'document', 'audio'], required: true },
      url: { type: String, required: true },
      filename: { type: String, required: true },
      size: { type: Number, required: false },
      mimeType: { type: String, required: false }
    }],
    // Voice messages
    voiceMessage: {
      url: { type: String, required: false },
      duration: { type: Number, required: false }, // in seconds
      waveform: { type: [Number], required: false } // audio waveform data
    },
    // Message reactions
    reactions: [{
      emoji: { type: String, required: true },
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      createdAt: { type: Date, default: Date.now }
    }],
    // Message status
    status: {
      type: String,
      enum: ['sent', 'delivered', 'read'],
      default: 'sent'
    },
    metadata: { type: mongoose.Schema.Types.Mixed }
  },
  { timestamps: true }
);

// Index for search
chatMessageSchema.index({ text: 'text', 'attachments.filename': 'text' });
chatMessageSchema.index({ createdAt: -1 });
chatMessageSchema.index({ user: 1, createdAt: -1 });

export default mongoose.model('ChatMessage', chatMessageSchema);
