import mongoose from 'mongoose';

const sourceSchema = new mongoose.Schema(
  {
    quality: { type: String, trim: true, default: 'auto' },
    url: { type: String, trim: true, required: true },
    type: { type: String, trim: true, default: 'video/mp4' }
  },
  { _id: false }
);

const productPinSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    startsAtSeconds: { type: Number, min: 0, default: 0 },
    endsAtSeconds: { type: Number, min: 0, default: null },
    label: { type: String, trim: true, maxlength: 100, default: '' }
  },
  { _id: false }
);

const countersSchema = new mongoose.Schema(
  {
    views: { type: Number, default: 0, min: 0 },
    uniqueViews: { type: Number, default: 0, min: 0 },
    watchTimeMs: { type: Number, default: 0, min: 0 },
    completions: { type: Number, default: 0, min: 0 },
    likes: { type: Number, default: 0, min: 0 },
    saves: { type: Number, default: 0, min: 0 },
    shares: { type: Number, default: 0, min: 0 },
    comments: { type: Number, default: 0, min: 0 },
    productClicks: { type: Number, default: 0, min: 0 },
    addToCarts: { type: Number, default: 0, min: 0 },
    purchases: { type: Number, default: 0, min: 0 },
    revenue: { type: Number, default: 0, min: 0 }
  },
  { _id: false }
);

const productVideoSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    uploadSessionId: { type: String, trim: true },
    productPins: { type: [productPinSchema], default: [] },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    contentType: { type: String, enum: ['product_video', 'live_replay'], default: 'product_video', index: true },
    liveShopping: {
      enabled: { type: Boolean, default: false },
      sessionId: { type: String, trim: true, default: '' },
      scheduledAt: { type: Date, default: null }
    },
    videoUrl: { type: String, trim: true, required: true },
    thumbnailUrl: { type: String, trim: true, default: '' },
    playbackSources: { type: [sourceSchema], default: [] },
    publicId: { type: String, trim: true, default: '' },
    durationSeconds: { type: Number, min: 0, default: 0 },
    width: { type: Number, min: 0, default: 0 },
    height: { type: Number, min: 0, default: 0 },
    aspectRatio: { type: Number, min: 0, default: 0 },
    bytes: { type: Number, min: 0, default: 0 },
    caption: { type: String, trim: true, maxlength: 500, default: '' },
    hashtags: { type: [String], default: [] },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'hidden', 'deleted'],
      default: 'pending',
      index: true
    },
    moderationReason: { type: String, trim: true, maxlength: 500, default: '' },
    moderatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    moderatedAt: { type: Date, default: null },
    featured: { type: Boolean, default: false, index: true },
    sponsored: { type: Boolean, default: false, index: true },
    sponsoredUntil: { type: Date, default: null },
    rankBoost: { type: Number, min: 0, max: 100, default: 0 },
    counters: { type: countersSchema, default: () => ({}) }
  },
  { timestamps: true }
);

productVideoSchema.index({ status: 1, sponsored: -1, featured: -1, createdAt: -1 });
productVideoSchema.index({ seller: 1, status: 1, createdAt: -1 });
productVideoSchema.index({ product: 1, status: 1, createdAt: -1 });
productVideoSchema.index(
  { uploadSessionId: 1 },
  { unique: true, partialFilterExpression: { uploadSessionId: { $type: 'string' } } }
);
productVideoSchema.index({ caption: 'text', hashtags: 'text' });

export default mongoose.model('ProductVideo', productVideoSchema);
