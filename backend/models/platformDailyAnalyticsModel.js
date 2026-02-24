import mongoose from 'mongoose';

const platformDailyAnalyticsSchema = new mongoose.Schema(
  {
    day: { type: String, required: true, unique: true, index: true }, // YYYY-MM-DD
    date: { type: Date, required: true, index: true },
    dau: { type: Number, default: 0, min: 0 },
    wau: { type: Number, default: 0, min: 0 },
    peakConcurrent: { type: Number, default: 0, min: 0 },
    avgSessionDurationSeconds: { type: Number, default: 0, min: 0 },
    sessionsCount: { type: Number, default: 0, min: 0 },
    deviceDistribution: {
      mobile: { type: Number, default: 0, min: 0 },
      tablet: { type: Number, default: 0, min: 0 },
      desktop: { type: Number, default: 0, min: 0 },
      unknown: { type: Number, default: 0, min: 0 }
    },
    topCities: {
      type: [
        {
          city: { type: String, default: '', trim: true },
          count: { type: Number, default: 0, min: 0 }
        }
      ],
      default: []
    },
    hourlyActivity: {
      type: [
        {
          hour: { type: Number, min: 0, max: 23 },
          count: { type: Number, default: 0, min: 0 }
        }
      ],
      default: []
    },
    generatedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

platformDailyAnalyticsSchema.index({ date: -1 });

export default mongoose.model('PlatformDailyAnalytics', platformDailyAnalyticsSchema);
