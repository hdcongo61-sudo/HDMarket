import crypto from 'crypto';
import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import Product from '../models/productModel.js';
import ProductVideo from '../models/productVideoModel.js';
import ProductVideoComment from '../models/productVideoCommentModel.js';
import ProductVideoEngagement from '../models/productVideoEngagementModel.js';
import ProductVideoReport from '../models/productVideoReportModel.js';
import User from '../models/userModel.js';
import { getRuntimeConfig } from '../services/configService.js';
import { getVerifiedProductIds } from '../utils/publicProductVisibility.js';
import {
  destroyCloudinaryAsset,
  getCloudinaryFolder,
  isCloudinaryConfigured,
  uploadToCloudinary
} from '../utils/cloudinaryUploader.js';
import { createNotification } from '../utils/notificationService.js';

const MAX_PAGE_SIZE = 24;
const VIDEO_MIME_TYPES = new Set(['video/mp4', 'video/quicktime', 'video/webm']);
const ADMIN_ROLES = new Set(['admin', 'founder']);

const clamp = (value, min, max, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
};

const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const isValidId = (value) => mongoose.Types.ObjectId.isValid(value);
const userId = (req) => req.user?.id || req.user?._id || null;
const isAdmin = (req) => ADMIN_ROLES.has(String(req.user?.role || '').toLowerCase());

const viewerKeyFor = (req) => {
  const authenticated = userId(req);
  if (authenticated) return `u:${authenticated}`;
  const source =
    req.headers['x-device-id'] ||
    req.headers['x-session-id'] ||
    `${req.ip || ''}:${req.headers['user-agent'] || ''}`;
  return `a:${crypto.createHash('sha256').update(String(source)).digest('hex').slice(0, 32)}`;
};

const cloudinaryTransform = (url, transformation, extension = '') => {
  if (!url || !String(url).includes('/upload/')) return url || '';
  let transformed = String(url).replace('/upload/', `/upload/${transformation}/`);
  if (extension) transformed = transformed.replace(/\.[a-z0-9]+(?:\?.*)?$/i, `.${extension}`);
  return transformed;
};

const buildMediaFields = (upload) => {
  const url = upload.secure_url || upload.url || '';
  return {
    videoUrl: url,
    thumbnailUrl: cloudinaryTransform(url, 'so_1,w_720,h_1280,c_fill,g_auto,f_jpg,q_auto', 'jpg'),
    playbackSources: [
      // Adaptive bitrate stream (HLS); the eager sp_hd transformation starts
      // transcoding at upload time so the manifest is ready by first play.
      { quality: 'hls', url: cloudinaryTransform(url, 'sp_hd', 'm3u8'), type: 'application/x-mpegURL' },
      { quality: 'auto', url: cloudinaryTransform(url, 'q_auto:eco,f_auto'), type: 'video/mp4' },
      { quality: '720p', url: cloudinaryTransform(url, 'w_720,c_limit,q_auto:eco,f_auto'), type: 'video/mp4' }
    ],
    publicId: upload.public_id || '',
    durationSeconds: Number(upload.duration || 0),
    width: Number(upload.width || 0),
    height: Number(upload.height || 0),
    aspectRatio: upload.height ? Number(upload.width || 0) / Number(upload.height) : 0,
    bytes: Number(upload.bytes || 0)
  };
};

const uploadVideoFile = async (file) => {
  if (!file || !VIDEO_MIME_TYPES.has(String(file.mimetype || '').toLowerCase())) {
    const error = new Error('Format non pris en charge. Utilisez MP4, MOV ou WEBM.');
    error.status = 400;
    throw error;
  }
  if (!isCloudinaryConfigured()) {
    const error = new Error('Le stockage vidéo n’est pas configuré.');
    error.status = 503;
    throw error;
  }
  return uploadToCloudinary({
    buffer: file.buffer,
    resourceType: 'video',
    folder: getCloudinaryFolder(['products', 'short-videos']),
    options: {
      quality: 'auto:eco',
      format: 'mp4',
      // Pre-generate the HLS adaptive stream asynchronously so playback can
      // start on the manifest instead of the full-resolution MP4.
      eager: [{ streaming_profile: 'hd', format: 'm3u8' }],
      eager_async: true
    }
  });
};

const extractHashtags = (caption = '', supplied = '') => {
  const fromCaption = String(caption).match(/#[\p{L}\p{N}_-]+/gu) || [];
  const fromField = Array.isArray(supplied) ? supplied : String(supplied || '').split(',');
  return Array.from(
    new Set([...fromCaption, ...fromField].map((tag) => String(tag).trim().replace(/^#/, '').toLowerCase()).filter(Boolean))
  ).slice(0, 20);
};

const loadProductForSeller = async (productId, req) => {
  if (!isValidId(productId)) {
    const error = new Error('Produit invalide.');
    error.status = 400;
    throw error;
  }
  const product = await Product.findById(productId).select(
    '_id user title status images price discount category city listingFeeSettled payment deliveryAvailable deliveryFee wholesaleEnabled'
  );
  if (!product) {
    const error = new Error('Produit introuvable.');
    error.status = 404;
    throw error;
  }
  if (!isAdmin(req) && String(product.user) !== String(userId(req))) {
    const error = new Error('Vous ne pouvez publier une vidéo que pour vos propres produits.');
    error.status = 403;
    throw error;
  }
  return product;
};

const ownerOrAdmin = (video, req) => isAdmin(req) || String(video?.seller) === String(userId(req));

// Permanent removal: media asset + engagement trail + the video itself, so
// deleted content can't resurface anywhere. Used by both the seller's own
// delete and the admin moderation delete.
const purgeProductVideo = async (video) => {
  if (video.publicId && isCloudinaryConfigured()) {
    try {
      await destroyCloudinaryAsset(video.publicId, { resourceType: 'video' });
    } catch (error) {
      console.warn(`Cloudinary destroy failed for video ${video._id}:`, error.message);
    }
  }
  await Promise.all([
    ProductVideoComment.deleteMany({ video: video._id }),
    ProductVideoEngagement.deleteMany({ video: video._id }),
    ProductVideoReport.deleteMany({ video: video._id })
  ]);
  await video.deleteOne();
};

const serializeVideo = (video, engagement = null) => {
  const value = video?.toObject ? video.toObject() : { ...video };
  return {
    ...value,
    viewer: {
      liked: Boolean(engagement?.liked),
      saved: Boolean(engagement?.saved)
    }
  };
};

const populateVideoQuery = (query) =>
  query
    .populate(
      'product',
      'title slug price discount priceBeforeDiscount images category city country status user ratingAverage ratingCount viewsCount favoritesCount salesCount deliveryAvailable deliveryFee freeDeliveryEnabled wholesaleEnabled listingFeeSettled payment attributes'
    )
    .populate('seller', 'name shopName shopLogo profileImage shopVerified followersCount city country freeDeliveryEnabled');

const getEngagementMap = async (videos, req) => {
  if (!videos.length) return new Map();
  const records = await ProductVideoEngagement.find({
    video: { $in: videos.map((item) => item._id) },
    viewerKey: viewerKeyFor(req)
  }).lean();
  return new Map(records.map((item) => [String(item.video), item]));
};

const feedScore = (video, req) => {
  const counters = video.counters || {};
  const ageHours = Math.max(1, (Date.now() - new Date(video.createdAt).getTime()) / 3_600_000);
  const engagement =
    Number(counters.likes || 0) * 4 +
    Number(counters.saves || 0) * 6 +
    Number(counters.comments || 0) * 5 +
    Number(counters.completions || 0) * 3 +
    Number(counters.shares || 0) * 7;
  const views = Math.log10(Number(counters.views || 0) + 1) * 12;
  const quality = Number(video.product?.ratingAverage || 0) * 3 + Number(video.rankBoost || 0);
  const local = req.user?.city && video.product?.city === req.user.city ? 18 : 0;
  const following = (req.user?.followingShops || []).some((id) => String(id) === String(video.seller?._id)) ? 24 : 0;
  return engagement / Math.pow(ageHours + 2, 0.32) + views + quality + local + following + (video.featured ? 35 : 0);
};

export const getProductVideoCapabilities = asyncHandler(async (_req, res) => {
  const [maxDuration, maxUploads, preloadCount, autoplay, defaultMuted, sponsoredFrequency] = await Promise.all([
    getRuntimeConfig('product_video_max_duration_seconds', { fallback: 60 }),
    getRuntimeConfig('product_video_max_uploads_per_product', { fallback: 1 }),
    getRuntimeConfig('product_video_preload_count', { fallback: 1 }),
    getRuntimeConfig('product_video_autoplay_enabled', { fallback: true }),
    getRuntimeConfig('product_video_default_muted', { fallback: true }),
    getRuntimeConfig('product_video_sponsored_frequency', { fallback: 8 })
  ]);
  res.json({
    enabled: true,
    formats: ['video/mp4', 'video/quicktime', 'video/webm'],
    maxDurationSeconds: Number(maxDuration),
    maxUploadsPerProduct: Number(maxUploads),
    preloadCount: Number(preloadCount),
    autoplay: Boolean(autoplay),
    defaultMuted: Boolean(defaultMuted),
    sponsoredFrequency: Number(sponsoredFrequency)
  });
});

export const getProductVideoFeed = asyncHandler(async (req, res) => {
  const limit = clamp(req.query.limit, 1, MAX_PAGE_SIZE, 8);
  const offset = clamp(req.query.cursor, 0, 10000, 0);
  const filter = String(req.query.filter || 'for_you');
  const search = String(req.query.search || '').trim();
  const verifiedIds = await getVerifiedProductIds();
  const productFilter = { _id: { $in: verifiedIds }, status: 'approved' };
  if (filter === 'nearby' && req.user?.city) productFilter.city = req.user.city;
  if (filter === 'discounts') productFilter.discount = { $gt: 0 };
  if (filter === 'free_delivery') productFilter.deliveryFee = 0;
  if (filter === 'wholesale') productFilter.wholesaleEnabled = true;
  const visibleProductIds = await Product.find(productFilter).distinct('_id');
  if (!visibleProductIds.length) {
    return res.json({ items: [], nextCursor: null, hasMore: false });
  }

  const visibilityConditions = [{ status: 'approved' }];
  const viewerId = userId(req);
  if (viewerId) {
    // Sellers see their own videos while they wait for moderation.
    visibilityConditions.push({ seller: viewerId, status: 'pending' });
  }
  const videoFilter = { product: { $in: visibleProductIds }, $or: visibilityConditions };
  if (filter === 'featured') videoFilter.featured = true;
  if (filter === 'sponsored') videoFilter.sponsored = true;
  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i');
    const productMatches = await Product.find({
      _id: { $in: visibleProductIds },
      $or: [{ title: pattern }, { category: pattern }, { brand: pattern }]
    }).distinct('_id');
    videoFilter.$and = [
      {
        $or: [
          { product: { $in: productMatches } },
          { caption: pattern },
          { hashtags: pattern }
        ]
      }
    ];
  }
  const candidateLimit = Math.min(160, Math.max(48, offset + limit * 5));
  let videos = await populateVideoQuery(
    ProductVideo.find(videoFilter).sort({ sponsored: -1, featured: -1, createdAt: -1 }).limit(candidateLimit)
  ).lean();
  videos = videos.filter((video) => video.product && video.seller);
  if (filter === 'verified') videos = videos.filter((video) => video.seller?.shopVerified);
  if (filter === 'following' && req.user) {
    const followed = new Set((req.user.followingShops || []).map(String));
    videos = videos.filter((video) => followed.has(String(video.seller?._id)));
  }
  if (filter === 'newest') {
    videos.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } else {
    videos.sort((a, b) => feedScore(b, req) - feedScore(a, req));
  }
  if (filter !== 'sponsored') {
    const sponsoredFrequency = Number(
      await getRuntimeConfig('product_video_sponsored_frequency', { fallback: 8 })
    );
    const now = Date.now();
    const sponsored = videos.filter(
      (video) => video.sponsored && (!video.sponsoredUntil || new Date(video.sponsoredUntil).getTime() > now)
    );
    const organic = videos.filter((video) => !video.sponsored);
    sponsored.forEach((video, index) => {
      organic.splice(Math.min(organic.length, (index + 1) * sponsoredFrequency - 1), 0, video);
    });
    videos = organic;
  }
  const selected = videos.slice(offset, offset + limit);
  const engagementMap = await getEngagementMap(selected, req);
  const hasMore = offset + limit < videos.length;
  res.json({
    items: selected.map((video) => serializeVideo(video, engagementMap.get(String(video._id)))),
    nextCursor: hasMore ? offset + limit : null,
    hasMore
  });
});

export const getSavedProductVideos = asyncHandler(async (req, res) => {
  const page = clamp(req.query.page, 1, 10000, 1);
  const limit = clamp(req.query.limit, 1, MAX_PAGE_SIZE, 12);
  const saved = await ProductVideoEngagement.find({ user: userId(req), saved: true })
    .sort({ updatedAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();
  const videos = await populateVideoQuery(
    ProductVideo.find({ _id: { $in: saved.map((item) => item.video) }, status: 'approved' })
  ).lean();
  const byId = new Map(videos.map((video) => [String(video._id), video]));
  const items = saved.map((item) => byId.get(String(item.video))).filter(Boolean);
  res.json({ items: items.map((video) => serializeVideo(video, { saved: true })), page, hasMore: saved.length === limit });
});

export const listShopProductVideos = asyncHandler(async (req, res) => {
  const { sellerId } = req.params;
  if (!isValidId(sellerId)) return res.status(400).json({ message: 'Boutique invalide.' });
  const page = clamp(req.query.page, 1, 10000, 1);
  const limit = clamp(req.query.limit, 1, MAX_PAGE_SIZE, 12);
  const videos = await populateVideoQuery(
    ProductVideo.find({ seller: sellerId, status: 'approved' })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
  ).lean();
  const items = videos.filter((video) => video.product?.status === 'approved');
  const engagementMap = await getEngagementMap(items, req);
  res.json({
    items: items.map((video) => serializeVideo(video, engagementMap.get(String(video._id)))),
    page,
    hasMore: videos.length === limit
  });
});

export const getProductVideoById = asyncHandler(async (req, res) => {
  const video = await populateVideoQuery(ProductVideo.findOne({ _id: req.params.id, status: 'approved' })).lean();
  if (!video?.product || video.product.status !== 'approved') return res.status(404).json({ message: 'Vidéo introuvable.' });
  const engagement = await ProductVideoEngagement.findOne({ video: video._id, viewerKey: viewerKeyFor(req) }).lean();
  res.json(serializeVideo(video, engagement));
});

export const recordProductVideoView = asyncHandler(async (req, res) => {
  const video = await ProductVideo.findOne({ _id: req.params.id, status: 'approved' }).select('_id');
  if (!video) return res.status(404).json({ message: 'Vidéo introuvable.' });
  const watchTimeMs = clamp(req.body.watchTimeMs, 0, 600000, 0);
  const completed = Boolean(req.body.completed);
  const viewerKey = viewerKeyFor(req);
  const existing = await ProductVideoEngagement.findOne({ video: video._id, viewerKey }).select('_id');
  await ProductVideoEngagement.findOneAndUpdate(
    { video: video._id, viewerKey },
    {
      $set: { user: userId(req), lastViewedAt: new Date() },
      $inc: { viewCount: 1, watchTimeMs, completedCount: completed ? 1 : 0 }
    },
    { upsert: true, setDefaultsOnInsert: true }
  );
  await ProductVideo.updateOne(
    { _id: video._id },
    {
      $inc: {
        'counters.views': 1,
        'counters.uniqueViews': existing ? 0 : 1,
        'counters.watchTimeMs': watchTimeMs,
        'counters.completions': completed ? 1 : 0
      }
    }
  );
  res.json({ recorded: true });
});

const toggleEngagement = (field, counter) =>
  asyncHandler(async (req, res) => {
    const video = await ProductVideo.findOne({ _id: req.params.id, status: 'approved' }).select('_id seller product');
    if (!video) return res.status(404).json({ message: 'Vidéo introuvable.' });
    const viewerKey = viewerKeyFor(req);
    const engagement = await ProductVideoEngagement.findOneAndUpdate(
      { video: video._id, viewerKey },
      { $setOnInsert: { user: userId(req) } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    const active = !Boolean(engagement[field]);
    engagement[field] = active;
    engagement.user = userId(req);
    await engagement.save();
    await ProductVideo.updateOne(
      { _id: video._id },
      { $inc: { [`counters.${counter}`]: active ? 1 : -1 } }
    );
    if (active && video.seller) {
      // Tell the seller someone liked/saved their video (self-actions are
      // ignored by createNotification).
      const videoLink = `/videos?video=${video._id}`;
      await createNotification({
        userId: video.seller,
        actorId: userId(req),
        productId: video.product,
        type: field === 'liked' ? 'product_video_like' : 'product_video_save',
        priority: 'NORMAL',
        deepLink: videoLink,
        actionLink: videoLink,
        metadata: {
          videoId: String(video._id),
          deepLink: videoLink
        }
      });
    }
    res.json({ active });
  });

export const toggleProductVideoLike = toggleEngagement('liked', 'likes');
export const toggleProductVideoSave = toggleEngagement('saved', 'saves');

export const recordProductVideoAction = asyncHandler(async (req, res) => {
  const action = String(req.body.action || 'share');
  const fieldByAction = {
    share: 'shares',
    product_click: 'productClicks',
    add_to_cart: 'addToCarts',
    purchase: 'purchases'
  };
  const field = fieldByAction[action];
  if (!field) return res.status(400).json({ message: 'Action invalide.' });
  const increment = { [`counters.${field}`]: 1 };
  if (action === 'purchase') increment['counters.revenue'] = clamp(req.body.revenue, 0, 1000000000, 0);
  const result = await ProductVideo.updateOne({ _id: req.params.id, status: 'approved' }, { $inc: increment });
  if (!result.matchedCount) return res.status(404).json({ message: 'Vidéo introuvable.' });
  res.json({ recorded: true });
});

export const listProductVideoComments = asyncHandler(async (req, res) => {
  const page = clamp(req.query.page, 1, 10000, 1);
  const limit = clamp(req.query.limit, 1, 50, 30);
  const comments = await ProductVideoComment.find({ video: req.params.id, status: 'visible' })
    .populate('user', 'name profileImage shopName')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();
  const current = String(userId(req) || '');
  res.json({
    items: comments.map((comment) => ({
      ...comment,
      likesCount: comment.likedBy?.length || 0,
      viewerLiked: Boolean(current && comment.likedBy?.some((id) => String(id) === current)),
      likedBy: undefined
    })),
    page,
    hasMore: comments.length === limit
  });
});

export const createProductVideoComment = asyncHandler(async (req, res) => {
  const message = String(req.body.message || '').trim();
  if (!message || message.length > 1000) return res.status(400).json({ message: 'Commentaire invalide.' });
  const video = await ProductVideo.findOne({ _id: req.params.id, status: 'approved' }).select('_id');
  if (!video) return res.status(404).json({ message: 'Vidéo introuvable.' });
  const parent = req.body.parentId && isValidId(req.body.parentId)
    ? await ProductVideoComment.findOne({ _id: req.body.parentId, video: video._id, status: 'visible' }).select('_id')
    : null;
  const comment = await ProductVideoComment.create({ video: video._id, user: userId(req), parent: parent?._id || null, message });
  await ProductVideo.updateOne({ _id: video._id }, { $inc: { 'counters.comments': 1 } });
  await comment.populate('user', 'name profileImage shopName');
  res.status(201).json({ ...comment.toObject(), likesCount: 0, viewerLiked: false });
});

export const toggleProductVideoCommentLike = asyncHandler(async (req, res) => {
  const comment = await ProductVideoComment.findOne({ _id: req.params.commentId, status: 'visible' });
  if (!comment) return res.status(404).json({ message: 'Commentaire introuvable.' });
  const id = String(userId(req));
  const index = comment.likedBy.findIndex((item) => String(item) === id);
  if (index >= 0) comment.likedBy.splice(index, 1);
  else comment.likedBy.push(userId(req));
  await comment.save();
  res.json({ active: index < 0, likesCount: comment.likedBy.length });
});

export const reportProductVideo = asyncHandler(async (req, res) => {
  const video = await ProductVideo.findById(req.params.id).select('_id');
  if (!video) return res.status(404).json({ message: 'Vidéo introuvable.' });
  const commentId = req.body.commentId && isValidId(req.body.commentId) ? req.body.commentId : null;
  try {
    const report = await ProductVideoReport.create({
      video: video._id,
      comment: commentId,
      reporter: userId(req),
      category: req.body.category || 'other',
      reason: String(req.body.reason || '').trim()
    });
    if (commentId) await ProductVideoComment.updateOne({ _id: commentId }, { $inc: { reportsCount: 1 } });
    res.status(201).json(report);
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ message: 'Ce contenu a déjà été signalé.' });
    throw error;
  }
});

export const uploadProductVideos = asyncHandler(async (req, res) => {
  const product = await loadProductForSeller(req.body.productId, req);
  const files = Array.isArray(req.files) ? req.files : [];
  if (!files.length) return res.status(400).json({ message: 'Sélectionnez au moins une vidéo.' });
  const [maxUploads, maxDuration, requireModeration] = await Promise.all([
    getRuntimeConfig('product_video_max_uploads_per_product', { fallback: 1 }),
    getRuntimeConfig('product_video_max_duration_seconds', { fallback: 60 }),
    getRuntimeConfig('product_video_require_moderation', { fallback: false })
  ]);
  const currentCount = await ProductVideo.countDocuments({ product: product._id, status: { $ne: 'deleted' } });
  if (currentCount + files.length > Number(maxUploads)) {
    return res.status(400).json({ message: `Maximum ${maxUploads} vidéos par produit.` });
  }
  const uploaded = [];
  for (const file of files) {
    const result = await uploadVideoFile(file);
    if (Number(result.duration || 0) > Number(maxDuration)) {
      return res.status(400).json({ message: `La vidéo ne doit pas dépasser ${maxDuration} secondes.` });
    }
    uploaded.push(buildMediaFields(result));
  }
  const caption = String(req.body.caption || '').trim();
  const status = isAdmin(req) || !requireModeration ? 'approved' : 'pending';
  const records = await ProductVideo.insertMany(
    uploaded.map((media) => ({
      ...media,
      product: product._id,
      seller: product.user,
      caption,
      hashtags: extractHashtags(caption, req.body.hashtags),
      status
    }))
  );
  res.status(201).json({ items: records, moderationRequired: status === 'pending' });
});

export const listSellerProductVideos = asyncHandler(async (req, res) => {
  const query = isAdmin(req) && req.query.sellerId ? { seller: req.query.sellerId } : { seller: userId(req) };
  const videos = await ProductVideo.find(query)
    .populate('product', 'title slug images price status')
    .sort({ createdAt: -1 })
    .lean();
  res.json({ items: videos });
});

export const getSellerProductVideoAnalytics = asyncHandler(async (req, res) => {
  const match = { seller: new mongoose.Types.ObjectId(userId(req)) };
  const [summary] = await ProductVideo.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        videos: { $sum: 1 },
        views: { $sum: '$counters.views' },
        watchTimeMs: { $sum: '$counters.watchTimeMs' },
        completions: { $sum: '$counters.completions' },
        likes: { $sum: '$counters.likes' },
        saves: { $sum: '$counters.saves' },
        shares: { $sum: '$counters.shares' },
        productClicks: { $sum: '$counters.productClicks' },
        addToCarts: { $sum: '$counters.addToCarts' },
        purchases: { $sum: '$counters.purchases' },
        revenue: { $sum: '$counters.revenue' }
      }
    }
  ]);
  const value = summary || { videos: 0, views: 0, watchTimeMs: 0, completions: 0, likes: 0, saves: 0, shares: 0, productClicks: 0, addToCarts: 0, purchases: 0, revenue: 0 };
  value.averageWatchSeconds = value.views ? Math.round(value.watchTimeMs / value.views / 100) / 10 : 0;
  value.completionRate = value.views ? Math.round((value.completions / value.views) * 1000) / 10 : 0;
  value.clickThroughRate = value.views ? Math.round((value.productClicks / value.views) * 1000) / 10 : 0;
  res.json(value);
});

export const updateSellerProductVideo = asyncHandler(async (req, res) => {
  const video = await ProductVideo.findById(req.params.id);
  if (!video) return res.status(404).json({ message: 'Vidéo introuvable.' });
  if (!ownerOrAdmin(video, req)) return res.status(403).json({ message: 'Accès refusé.' });
  if (req.body.caption !== undefined) {
    video.caption = String(req.body.caption || '').trim();
    video.hashtags = extractHashtags(video.caption, req.body.hashtags);
  }
  if (req.file) {
    const maxDuration = await getRuntimeConfig('product_video_max_duration_seconds', { fallback: 60 });
    const upload = await uploadVideoFile(req.file);
    if (Number(upload.duration || 0) > Number(maxDuration)) {
      return res.status(400).json({ message: `La vidéo ne doit pas dépasser ${maxDuration} secondes.` });
    }
    Object.assign(video, buildMediaFields(upload));
    if (!isAdmin(req)) {
      const requireModeration = await getRuntimeConfig('product_video_require_moderation', { fallback: false });
      if (requireModeration) video.status = 'pending';
    }
  }
  await video.save();
  res.json(video);
});

export const deleteSellerProductVideo = asyncHandler(async (req, res) => {
  const video = await ProductVideo.findById(req.params.id);
  if (!video) return res.status(404).json({ message: 'Vidéo introuvable.' });
  if (!ownerOrAdmin(video, req)) return res.status(403).json({ message: 'Accès refusé.' });
  await purgeProductVideo(video);
  res.json({ deleted: true });
});

export const listAdminProductVideos = asyncHandler(async (req, res) => {
  const page = clamp(req.query.page, 1, 10000, 1);
  const limit = clamp(req.query.limit, 1, 50, 20);
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.sponsored === 'true') filter.sponsored = true;
  if (req.query.featured === 'true') filter.featured = true;
  const [items, total] = await Promise.all([
    populateVideoQuery(ProductVideo.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit)).lean(),
    ProductVideo.countDocuments(filter)
  ]);
  res.json({ items, total, page, pages: Math.ceil(total / limit) });
});

export const getAdminProductVideoAnalytics = asyncHandler(async (_req, res) => {
  const [summary] = await ProductVideo.aggregate([
    {
      $group: {
        _id: null,
        videos: { $sum: 1 },
        pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
        approved: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } },
        sponsored: { $sum: { $cond: ['$sponsored', 1, 0] } },
        views: { $sum: '$counters.views' },
        watchTimeMs: { $sum: '$counters.watchTimeMs' },
        completions: { $sum: '$counters.completions' },
        productClicks: { $sum: '$counters.productClicks' },
        addToCarts: { $sum: '$counters.addToCarts' },
        purchases: { $sum: '$counters.purchases' },
        revenue: { $sum: '$counters.revenue' }
      }
    }
  ]);
  const reports = await ProductVideoReport.countDocuments({ status: { $in: ['open', 'reviewing'] } });
  res.json({ ...(summary || {}), reports });
});

export const moderateProductVideo = asyncHandler(async (req, res) => {
  const video = await ProductVideo.findById(req.params.id);
  if (!video) return res.status(404).json({ message: 'Vidéo introuvable.' });
  const action = String(req.body.action || '');
  if (action === 'delete') {
    await purgeProductVideo(video);
    return res.json({ deleted: true, _id: String(video._id) });
  }
  const statusByAction = { approve: 'approved', reject: 'rejected', hide: 'hidden', restore: 'approved' };
  if (statusByAction[action]) video.status = statusByAction[action];
  else if (action === 'feature') video.featured = true;
  else if (action === 'unfeature') video.featured = false;
  else if (action === 'sponsor') {
    video.sponsored = true;
    video.sponsoredUntil = req.body.sponsoredUntil ? new Date(req.body.sponsoredUntil) : null;
  } else if (action === 'unsponsor') {
    video.sponsored = false;
    video.sponsoredUntil = null;
  } else if (action === 'ban_seller') {
    await User.updateOne(
      { _id: video.seller },
      { $set: { isBlocked: true, blockedReason: String(req.body.reason || 'Contenu vidéo non conforme') } }
    );
    video.status = 'hidden';
  } else return res.status(400).json({ message: 'Action de modération invalide.' });
  video.moderationReason = String(req.body.reason || '').trim();
  video.moderatedBy = userId(req);
  video.moderatedAt = new Date();
  await video.save();
  if (action === 'approve' || action === 'reject') {
    const approved = action === 'approve';
    await createNotification({
      userId: video.seller,
      actorId: userId(req),
      productId: video.product,
      type: approved ? 'product_video_approved' : 'product_video_rejected',
      allowSelf: true,
      title: approved ? 'Vidéo produit approuvée' : 'Vidéo produit à corriger',
      message: approved
        ? 'Votre vidéo est maintenant visible dans HDMarket Videos.'
        : video.moderationReason || 'Votre vidéo ne respecte pas encore les règles de publication.',
      actionLabel: 'Voir mes vidéos',
      deepLink: '/seller/videos',
      entityType: 'product',
      entityId: String(video.product),
      dedupeKey: `product-video:${video._id}:${action}`,
      metadata: { productVideoId: String(video._id), moderationReason: video.moderationReason }
    });
  }
  res.json(video);
});

export const listAdminProductVideoReports = asyncHandler(async (req, res) => {
  const status = req.query.status || { $in: ['open', 'reviewing'] };
  const items = await ProductVideoReport.find({ status })
    .populate({ path: 'video', populate: [{ path: 'product', select: 'title images' }, { path: 'seller', select: 'name shopName' }] })
    .populate('comment', 'message')
    .populate('reporter', 'name email')
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();
  res.json({ items });
});

export const resolveAdminProductVideoReport = asyncHandler(async (req, res) => {
  const report = await ProductVideoReport.findById(req.params.reportId);
  if (!report) return res.status(404).json({ message: 'Signalement introuvable.' });
  report.status = ['resolved', 'dismissed'].includes(req.body.status) ? req.body.status : 'resolved';
  report.resolution = String(req.body.resolution || '').trim();
  report.reviewedBy = userId(req);
  report.reviewedAt = new Date();
  await report.save();
  res.json(report);
});
