import mongoose from 'mongoose';

const appSettingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true, unique: true },
    baseKey: { type: String, trim: true, default: '' },
    value: { type: mongoose.Schema.Types.Mixed, default: null },
    valueType: {
      type: String,
      enum: ['string', 'number', 'boolean', 'json', 'array'],
      default: 'string'
    },
    category: { type: String, trim: true, default: 'general' },
    description: { type: String, trim: true, default: '' },
    isPublic: { type: Boolean, default: false },
    environment: {
      type: String,
      enum: ['all', 'production', 'staging', 'dev'],
      default: 'all'
    },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { timestamps: true }
);

appSettingSchema.index({ key: 1, updatedAt: -1 });
appSettingSchema.index({ baseKey: 1, environment: 1 });

export default mongoose.model('AppSetting', appSettingSchema);
