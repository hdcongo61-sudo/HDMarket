import mongoose from 'mongoose';

const assistantAuditLogSchema = new mongoose.Schema(
  {
    shop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    actorRole: {
      type: String,
      enum: ['owner', 'assistant'],
      required: true
    },
    action: {
      type: String,
      enum: [
        'assistant_invited',
        'assistant_accepted',
        'assistant_rejected',
        'assistant_removed',
        'assistant_left',
        'assistant_permissions_updated',
        'assistant_order_confirmed',
        'assistant_order_rejected',
        'assistant_order_status_updated',
        'assistant_comment_replied',
        'assistant_message_replied'
      ],
      required: true
    },
    targetType: { type: String, trim: true, default: '' },
    targetId: { type: String, trim: true, default: '' },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

assistantAuditLogSchema.index({ shop: 1, createdAt: -1 });
assistantAuditLogSchema.index({ actor: 1 });

export default mongoose.model('AssistantAuditLog', assistantAuditLogSchema);
