import zlib from 'zlib';
import Product from '../models/productModel.js';
import ProductImageColor from '../models/productImageColorModel.js';
import { getRuntimeConfig } from './configService.js';

const CANDIDATE_LIMIT = 200;
const COLOR_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const FETCH_TIMEOUT_MS = 6000;
const MAX_COLOR_DISTANCE = 130;
const CONCURRENCY = 8;

const normalizeBoolean = (value) =>
  ['true', '1', 'yes', 'on'].includes(String(value ?? '').trim().toLowerCase()) ||
  value === true ||
  value === 1;

/** Admin-controlled gate — the whole feature stays off until enabled. */
export const isVisualSearchEnabled = async () =>
  normalizeBoolean(await getRuntimeConfig('enable_image_search', { fallback: false }));

const isCloudinaryUrl = (url = '') =>
  typeof url === 'string' && url.includes('res.cloudinary.com') && /\/image\/upload\/|\/upload\//.test(url);

/**
 * Cloudinary trick without any add-on: `e_pixelate:400` + a 1×1 crop returns a
 * single pixel whose color is the image average. Force PNG so we can decode it
 * server-side with built-in zlib (no deps).
 */
const buildAverageColorUrl = (url) => {
  const marker = url.includes('/image/upload/') ? '/image/upload/' : '/upload/';
  const [base, versionPath] = url.split(marker);
  const transforms = 'e_pixelate:400,c_crop,g_auto,w_1,h_1,f_png';
  return `${base}${marker}${transforms}/${versionPath}`;
};

/** Decodes the color of a (typically 1×1) PNG buffer without any dependency. */
const decodePngColor = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length < 33) return null;
  if (buffer.toString('ascii', 1, 4) !== 'PNG') return null;

  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let palette = null;
  const idat = [];
  let offset = 8;

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === 'PLTE') {
      palette = data;
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
    offset += 12 + length;
  }

  if (!width || !height || bitDepth !== 8) return null;
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
  if (!channels) return null;

  let raw;
  try {
    raw = zlib.inflateSync(Buffer.concat(idat));
  } catch {
    return null;
  }

  const stride = width * channels;
  if (raw.length < 1 + stride * height) return null;
  const row = Buffer.alloc(stride);
  const filterType = raw[0];
  for (let i = 0; i < stride; i += 1) {
    const x = raw[1 + i];
    const a = i >= channels ? row[i - channels] : 0;
    let value;
    switch (filterType) {
      case 0:
        value = x;
        break;
      case 1:
        value = (x + a) & 0xff;
        break;
      case 2:
        value = x;
        break;
      case 3:
        value = (x + (a >> 1)) & 0xff;
        break;
      case 4: {
        const p = a;
        const pa = Math.abs(p - a);
        value = (x + (pa <= p ? a : p)) & 0xff;
        break;
      }
      default:
        return null;
    }
    row[i] = value;
  }

  const px = (index) => row[index];
  if (colorType === 3 && palette && palette.length >= 3) {
    const index = px(0);
    return { r: palette[index * 3], g: palette[index * 3 + 1], b: palette[index * 3 + 2] };
  }
  if (colorType === 0 || colorType === 4) {
    const value = px(0);
    return { r: value, g: value, b: value };
  }
  if (colorType === 2 || colorType === 6) {
    return { r: px(0), g: px(1), b: px(2) };
  }
  return null;
};

const fetchAverageColor = async (imageUrl) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(buildAverageColorUrl(imageUrl), { signal: controller.signal });
    if (!response.ok) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    return decodePngColor(buffer);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
};

const getCachedColor = async (productId, imageUrl) => {
  const cached = await ProductImageColor.findOne({ productId, imageUrl }).lean();
  if (cached && Date.now() - new Date(cached.fetchedAt).getTime() < COLOR_CACHE_TTL_MS) {
    return cached.color;
  }
  const color = await fetchAverageColor(imageUrl);
  if (!color) return null;
  await ProductImageColor.updateOne(
    { productId, imageUrl },
    { $set: { color, fetchedAt: new Date() } },
    { upsert: true }
  ).catch(() => {});
  return color;
};

const colorDistance = (a, b) => {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  // Weighted like perceived luminance differences — green matters most.
  return Math.sqrt(0.3 * dr * dr + 0.59 * dg * dg + 0.11 * db * db);
};

const normalizeInputColor = (color) => {
  if (!Array.isArray(color)) return null;
  const [r, g, b] = color.map((value) => Math.round(Number(value)));
  if ([r, g, b].some((value) => !Number.isFinite(value) || value < 0 || value > 255)) return null;
  return { r, g, b };
};

/**
 * Image search MVP: the client extracts the dominant color of the photo the
 * user picked and sends RGB; we compare it against the cached average color of
 * recent products' primary images and return the visually closest matches.
 */
export const searchByColor = async ({ color: rawColor, limit = 12 } = {}) => {
  const color = normalizeInputColor(rawColor);
  if (!color) {
    const error = new Error('Couleur invalide.');
    error.statusCode = 400;
    throw error;
  }

  const candidates = await Product.find({
    status: 'approved',
    isActive: { $ne: false },
    'images.0': { $exists: true, $type: 'string', $ne: '' }
  })
    .select('_id slug title price priceBeforeDiscount discount images createdAt')
    .sort({ createdAt: -1 })
    .limit(CANDIDATE_LIMIT)
    .lean();

  const matches = [];
  let index = 0;
  const work = async () => {
    while (index < candidates.length) {
      const candidate = candidates[index];
      index += 1;
      const imageUrl = candidate.images?.[0];
      if (!isCloudinaryUrl(imageUrl)) continue;
      const avg = await getCachedColor(candidate._id, imageUrl);
      if (!avg) continue;
      const distance = colorDistance(color, avg);
      if (distance > MAX_COLOR_DISTANCE) continue;
      matches.push({ product: candidate, distance });
    }
  };

  await Promise.all(Array.from({ length: CONCURRENCY }, () => work()));

  matches.sort((a, b) => a.distance - b.distance);

  const results = matches.slice(0, Math.max(1, Number(limit) || 12)).map(({ product, distance }) => ({
    id: String(product._id),
    slug: product.slug || '',
    title: product.title || '',
    price: Number(product.price || 0),
    priceBeforeDiscount: Number(product.priceBeforeDiscount || 0),
    discount: Number(product.discount || 0),
    image: String(product.images?.[0] || ''),
    matchScore: Math.max(0, Math.round(100 - distance))
  }));

  return { color, results, scanned: candidates.length };
};
