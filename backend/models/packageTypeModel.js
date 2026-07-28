import mongoose from 'mongoose';

// Configurable parcel categories (Documents, Food, Medicine...) — each adds
// a flat extra to the price and can carry courier-facing handling notes.
const packageTypeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    extraPrice: { type: Number, default: 0, min: 0 },
    priority: { type: Number, default: 0, min: 0 },
    specialNotes: { type: String, trim: true, default: '' },
    isActive: { type: Boolean, default: true, index: true },
    order: { type: Number, default: 0, min: 0 },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { timestamps: true }
);

packageTypeSchema.index({ isActive: 1, order: 1, name: 1 });

export default mongoose.model('PackageType', packageTypeSchema);
