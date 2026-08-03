import 'dotenv/config';
import connectDB from '../config/db.js';
import Product from '../models/productModel.js';
import ProductVideo from '../models/productVideoModel.js';

const thumbnailFromVideo = (url = '') => {
  if (!String(url).includes('/upload/')) return '';
  return String(url)
    .replace('/upload/', '/upload/so_1,w_720,h_1280,c_fill,g_auto,f_jpg,q_auto/')
    .replace(/\.[a-z0-9]+(?:\?.*)?$/i, '.jpg');
};

const run = async () => {
  await connectDB();
  const products = await Product.find({ video: { $type: 'string', $ne: '' } })
    .select('_id user video title status')
    .lean();
  let created = 0;
  let skipped = 0;
  for (const product of products) {
    const exists = await ProductVideo.exists({ product: product._id, videoUrl: product.video });
    if (exists) {
      skipped += 1;
      continue;
    }
    await ProductVideo.create({
      product: product._id,
      seller: product.user,
      videoUrl: product.video,
      thumbnailUrl: thumbnailFromVideo(product.video),
      playbackSources: [{ quality: 'auto', url: product.video, type: 'video/mp4' }],
      caption: product.title || '',
      status: product.status === 'approved' ? 'approved' : 'pending'
    });
    created += 1;
  }
  console.log(`Migration HDMarket Videos terminée: ${created} créée(s), ${skipped} ignorée(s).`);
  process.exit(0);
};

run().catch((error) => {
  console.error('Échec de la migration HDMarket Videos:', error);
  process.exit(1);
});
