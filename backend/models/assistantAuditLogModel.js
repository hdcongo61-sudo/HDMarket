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
        'assistant_order_viewed',
        'assistant_comment_replied',
        'assistant_message_replied',
        'assistant_conversation_viewed',
        'assistant_conversation_archived',
        'assistant_conversation_unarchived',
        'assistant_conversation_deleted',
        'assistant_message_reaction_added',
        'assistant_message_reaction_removed',
        'assistant_message_deleted',
        'assistant_products_viewed',
        'assistant_product_update_requested',
        'assistant_product_delete_requested'
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
