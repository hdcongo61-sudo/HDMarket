// One-off migration: re-derive `playbackSources` for every product video from
// its stored `videoUrl`, upgrading the old eco/low-res sources (sp_hd HLS,
// q_auto:eco MP4s) to the current quality ladder (sp_full_hd HLS, 1080p/auto
// at q_auto:good, 720p save-data variant). Idempotent — safe to re-run.
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import ProductVideo from '../models/productVideoModel.js';

dotenv.config();
await connectDB();

const cloudinaryTransform = (url, transformation, extension = '') => {
  if (!url || !String(url).includes('/upload/')) return url || '';
  let transformed = String(url).replace('/upload/', `/upload/${transformation}/`);
  if (extension) transformed = transformed.replace(/\.[a-z0-9]+(?:\?.*)?$/i, `.${extension}`);
  return transformed;
};

const buildSources = (rawUrl) => {
  const url = String(rawUrl || '');
  if (!url.includes('/upload/')) return null;
  return [
    { quality: 'hls', url: cloudinaryTransform(url, 'sp_full_hd', 'm3u8'), type: 'application/x-mpegURL' },
    { quality: '1080p', url: cloudinaryTransform(url, 'w_1080,c_limit,q_auto:good,f_auto'), type: 'video/mp4' },
    { quality: 'auto', url: cloudinaryTransform(url, 'q_auto:good,f_auto'), type: 'video/mp4' },
    { quality: '720p', url: cloudinaryTransform(url, 'w_720,c_limit,q_auto:good,f_auto'), type: 'video/mp4' }
  ];
};

const ALLOWED_STATUSES = new Set(['pending', 'approved', 'hidden', 'rejected']);
const BATCH_SIZE = 200;

try {
  const videos = await ProductVideo.find({}).select('_id videoUrl status').lean();
  let updated = 0;
  let skipped = 0;

  for (let index = 0; index < videos.length; index += BATCH_SIZE) {
    const batch = videos.slice(index, index + BATCH_SIZE);
    await Promise.all(
      batch.map(async (video) => {
        if (!ALLOWED_STATUSES.has(video.status)) {
          skipped += 1;
          return;
        }
        const sources = buildSources(video.videoUrl);
        if (!sources) {
          skipped += 1;
          return;
        }
        await ProductVideo.updateOne({ _id: video._id }, { $set: { playbackSources: sources } });
        updated += 1;
      })
    );
    console.log(`Progress: ${Math.min(index + BATCH_SIZE, videos.length)}/${videos.length}`);
  }

  console.log(`Done. Updated ${updated} video(s), skipped ${skipped} (no Cloudinary URL or non-migratable status).`);
} catch (error) {
  console.error('Migration failed:', error?.message || error);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
  process.exit(0);
}
