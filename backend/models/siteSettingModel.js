import mongoose from 'mongoose';

const siteSettingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    heroBanner: { type: String, default: '' },
    appLogo: { type: String, default: '' },
    appLogoDesktop: { type: String, default: '' },
    appLogoMobile: { type: String, default: '' },
    promoBanner: { type: String, default: '' },
    promoBannerMobile: { type: String, default: '' },
    promoBannerLink: { type: String, default: '' },
    promoBannerStartAt: { type: Date, default: null },
    promoBannerEndAt: { type: Date, default: null },
    splashImage: { type: String, default: '' },
    splashDurationSeconds: { type: Number, default: 3, min: 1, max: 30 },
    splashEnabled: { type: Boolean, default: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

export default mongoose.model('SiteSetting', siteSettingSchema);
