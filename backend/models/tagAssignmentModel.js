import mongoose from 'mongoose';
import { TAG_ASSIGNMENT_SOURCES, normalizeEntityType } from '../constants/tagConstants.js';

const tagAssignmentSchema = new mongoose.Schema(
  {
    tag: { type: mongoose.Schema.Types.ObjectId, ref: 'Tag', required: true, index: true },
    entityType: { type: String, required: true, trim: true, lowercase: true, index: true },
    entityId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    source: { type: String, enum: TAG_ASSIGNMENT_SOURCES, default: 'manual', index: true },
    confidence: { type: Number, min: 0, max: 1, default: null },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: undefined }
  },
  { timestamps: true }
);

tagAssignmentSchema.index({ tag: 1, entityType: 1, entityId: 1 }, { unique: true });
tagAssignmentSchema.index({ entityType: 1, entityId: 1, source: 1, createdAt: -1 });
tagAssignmentSchema.index({ tag: 1, entityType: 1, createdAt: -1 });

tagAssignmentSchema.pre('validate', function normalizeAssignment(next) {
  this.entityType = normalizeEntityType(this.entityType);
  if (!this.entityType) return next(new Error('Entity type is required.'));
  return next();
});

export default mongoose.model('TagAssignment', tagAssignmentSchema);
