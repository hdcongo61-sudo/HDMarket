import mongoose from 'mongoose';

const deliveryGuySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    active: { type: Boolean, default: true }
  },
  { timestamps: true }
);

deliveryGuySchema.index({ name: 1 });

export default mongoose.model('DeliveryGuy', deliveryGuySchema);
