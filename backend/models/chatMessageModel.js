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
    text: { type: String, required: true, trim: true },
    metadata: { type: mongoose.Schema.Types.Mixed }
  },
  { timestamps: true }
);

export default mongoose.model('ChatMessage', chatMessageSchema);
