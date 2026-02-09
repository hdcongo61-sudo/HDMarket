import mongoose from 'mongoose';

const networkSettingSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    phoneNumber: { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: true },
    order: { type: Number, default: 0 }
  },
  { timestamps: true }
);

networkSettingSchema.index({ name: 1 });
networkSettingSchema.index({ isActive: 1, order: 1 });

export default mongoose.model('NetworkSetting', networkSettingSchema);
