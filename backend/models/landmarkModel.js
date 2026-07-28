import mongoose from 'mongoose';

// Named reference points ("Total Station", "the hospital"...) so the pricing
// engine and request form can resolve GPS from free-text addresses when the
// requester has no GPS — e.g. "Near Total Station" matches this via aliases.
const landmarkSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    cityId: { type: mongoose.Schema.Types.ObjectId, ref: 'City', required: true, index: true },
    communeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Commune', default: null, index: true },
    latitude: { type: Number, required: true, min: -90, max: 90 },
    longitude: { type: Number, required: true, min: -180, max: 180 },
    aliases: { type: [String], default: [] },
    description: { type: String, trim: true, default: '' },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE', index: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { timestamps: true }
);

landmarkSchema.pre('validate', function normalizeLandmarkAliases(next) {
  this.aliases = Array.from(
    new Set((this.aliases || []).map((alias) => String(alias || '').trim().toLowerCase()).filter(Boolean))
  );
  next();
});

landmarkSchema.index({ cityId: 1, status: 1 });
landmarkSchema.index({ name: 'text', aliases: 'text' });

export default mongoose.model('Landmark', landmarkSchema);
