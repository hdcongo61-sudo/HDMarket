import mongoose from 'mongoose';

const appSettingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true, unique: true },
    value: { type: mongoose.Schema.Types.Mixed, default: null },
    valueType: {
      type: String,
      enum: ['string', 'number', 'boolean', 'json', 'array'],
      default: 'string'
    },
    description: { type: String, trim: true, default: '' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { timestamps: true }
);

appSettingSchema.index({ key: 1, updatedAt: -1 });

export default mongoose.model('AppSetting', appSettingSchema);
