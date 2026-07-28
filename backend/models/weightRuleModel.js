import mongoose from 'mongoose';

// Weight brackets (0-1kg, 1-3kg...) each applying either a multiplier to the
// running price or a flat extra — admin picks one mode per rule.
const weightRuleSchema = new mongoose.Schema(
  {
    minKg: { type: Number, required: true, min: 0 },
    maxKg: { type: Number, required: true, min: 0 },
    mode: { type: String, enum: ['MULTIPLIER', 'FIXED_EXTRA'], default: 'FIXED_EXTRA' },
    multiplier: { type: Number, default: 1, min: 0 },
    fixedExtra: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true, index: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { timestamps: true }
);

weightRuleSchema.pre('validate', function validateWeightRange(next) {
  if (this.maxKg < this.minKg) {
    return next(new Error('Le poids maximum doit être supérieur ou égal au poids minimum.'));
  }
  next();
});

weightRuleSchema.index({ isActive: 1, minKg: 1 });

export default mongoose.model('WeightRule', weightRuleSchema);
