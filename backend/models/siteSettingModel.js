import mongoose from 'mongoose';

const siteSettingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    heroBanner: { type: String, default: '' },
    appLogo: { type: String, default: '' },
    appLogoDesktop: { type: String, default: '' },
    appLogoMobile: { type: String, default: '' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

export default mongoose.model('SiteSetting', siteSettingSchema);
