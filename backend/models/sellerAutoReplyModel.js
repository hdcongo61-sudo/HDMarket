import mongoose from 'mongoose';

const sellerAutoReplySchema = new mongoose.Schema(
  {
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    // The auto-reply message text sent to buyers
    message: { type: String, required: true, trim: true, maxlength: 500 },
    isActive: { type: Boolean, default: true },
    // Schedule: null = always on (away message). If set, only triggers within schedule.
    schedule: {
      enabled: { type: Boolean, default: false },
      // Day-of-week schedule (0=Sun, 1=Mon, ... 6=Sat)
      daysOfWeek: { type: [Number], default: [] },
      startHour: { type: Number, min: 0, max: 23, default: null },
      endHour: { type: Number, min: 0, max: 23, default: null }
    },
    // Cooldown: don't auto-reply again to the same conversation within N minutes
    cooldownMinutes: { type: Number, default: 30, min: 5, max: 1440 },
    lastTriggeredAt: { type: Date, default: null }
  },
  { timestamps: true }
);

sellerAutoReplySchema.index({ sellerId: 1, isActive: 1 });

export default mongoose.model('SellerAutoReply', sellerAutoReplySchema);
