import mongoose from 'mongoose';

const searchAnalyticsSchema = new mongoose.Schema(
  {
    query: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    count: {
      type: Number,
      default: 1,
      min: 0
    },
    lastSearchedAt: {
      type: Date,
      default: Date.now,
      index: true
    },
    firstSearchedAt: {
      type: Date,
      default: Date.now
    },
    resultClicks: {
      type: Number,
      default: 0,
      min: 0
    },
    resultViews: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  { timestamps: true }
);

// Compound index for efficient queries
searchAnalyticsSchema.index({ query: 1, lastSearchedAt: -1 });
searchAnalyticsSchema.index({ count: -1, lastSearchedAt: -1 });

// Static method to increment search count
searchAnalyticsSchema.statics.incrementSearch = async function(query) {
  if (!query || !query.trim()) return null;
  
  const normalizedQuery = query.trim().toLowerCase();
  const analytics = await this.findOneAndUpdate(
    { query: normalizedQuery },
    {
      $inc: { count: 1 },
      $set: { lastSearchedAt: new Date() },
      $setOnInsert: { firstSearchedAt: new Date() }
    },
    { upsert: true, new: true }
  );
  
  return analytics;
};

// Static method to increment result clicks
searchAnalyticsSchema.statics.incrementResultClick = async function(query) {
  if (!query || !query.trim()) return null;
  
  const normalizedQuery = query.trim().toLowerCase();
  await this.findOneAndUpdate(
    { query: normalizedQuery },
    { $inc: { resultClicks: 1 } },
    { upsert: true }
  );
};

// Static method to increment result views
searchAnalyticsSchema.statics.incrementResultView = async function(query) {
  if (!query || !query.trim()) return null;
  
  const normalizedQuery = query.trim().toLowerCase();
  await this.findOneAndUpdate(
    { query: normalizedQuery },
    { $inc: { resultViews: 1 } },
    { upsert: true }
  );
};

export default mongoose.model('SearchAnalytics', searchAnalyticsSchema);
