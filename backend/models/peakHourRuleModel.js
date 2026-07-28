import mongoose from 'mongoose';

// Named time-window surcharges (Morning Rush, Evening Rush, Night,
// Weekend...). Day-of-week + start/end time (24h "HH:mm"); "Weekend" rules
// use daysOfWeek only (0=Sunday..6=Saturday) and can omit start/end to cover
// the whole day.
const peakHourRuleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    daysOfWeek: { type: [Number], default: [0, 1, 2, 3, 4, 5, 6] },
    startTime: { type: String, trim: true, default: '' },
    endTime: { type: String, trim: true, default: '' },
    surchargeType: { type: String, enum: ['PERCENT', 'FIXED'], default: 'PERCENT' },
    surchargeValue: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true, index: true },
    order: { type: Number, default: 0, min: 0 },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { timestamps: true }
);

const isValidTime = (value) => !value || /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

peakHourRuleSchema.pre('validate', function validatePeakHourTimes(next) {
  if (!isValidTime(this.startTime) || !isValidTime(this.endTime)) {
    return next(new Error('Heure invalide (format HH:mm attendu).'));
  }
  this.daysOfWeek = Array.from(
    new Set((this.daysOfWeek || []).map((day) => Number(day)).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))
  );
  next();
});

peakHourRuleSchema.index({ isActive: 1, order: 1 });

export default mongoose.model('PeakHourRule', peakHourRuleSchema);
