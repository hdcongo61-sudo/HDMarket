import mongoose from 'mongoose';

const chatTemplateSchema = new mongoose.Schema(
  {
    // Legacy fields kept for backward compatibility
    question: { type: String, trim: true, default: '' },
    response: { type: String, trim: true, default: '' },
    // Structured template fields
    title: { type: String, trim: true, default: '' },
    type: {
      type: String,
      enum: ['question', 'info', 'action', 'link'],
      default: 'question'
    },
    category: { type: String, trim: true, default: '' },
    content: { type: String, trim: true, default: '' },
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatTemplate', default: null },
    order: { type: Number, default: 0 },
    entityType: {
      type: String,
      enum: ['', 'order', 'product', 'dispute', 'payment', 'shop', 'external_link'],
      default: ''
    },
    entityId: { type: String, trim: true, default: '' },
    priority: { type: Number, default: 0 },
    usageCount: { type: Number, default: 0 },
    lastUsedAt: { type: Date, default: null },
    roles: {
      type: [String],
      default: []
    },
    active: { type: Boolean, default: true },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

chatTemplateSchema.pre('validate', function onValidate(next) {
  if (!this.title && this.question) this.title = this.question;
  if (!this.question && this.title) this.question = this.title;
  if (!this.content && this.response) this.content = this.response;
  if (!this.response && this.content) this.response = this.content;
  next();
});

chatTemplateSchema.index({ parentId: 1, order: 1, priority: -1 });
chatTemplateSchema.index({ active: 1, parentId: 1, priority: -1 });
chatTemplateSchema.index({ roles: 1, active: 1, parentId: 1 });

export default mongoose.model('ChatTemplate', chatTemplateSchema);
