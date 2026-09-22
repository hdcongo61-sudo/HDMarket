import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';
import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import Media from '../models/buyForMeMediaModel.js';
import Order from '../models/buyForMeOrderModel.js';
import Receipt from '../models/buyForMeReceiptModel.js';
import Driver from '../models/deliveryGuyModel.js';
import cloudinary from '../utils/cloudinary.js';
import { isCloudinaryConfigured, uploadToCloudinary, getCloudinaryFolder } from '../utils/cloudinaryUploader.js';
import { privateUploadDirectory, legacyUploadDirectory, validAttachmentFilename } from '../utils/privateAttachments.js';
import { shoppingAdminFilter } from '../services/buyForMeAccessService.js';

const imageType = buffer => {
  if (buffer.subarray(0, 3).equals(Buffer.from([255, 216, 255]))) return ['jpg', 'image/jpeg'];
  if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return ['png', 'image/png'];
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return ['webp', 'image/webp'];
  if (buffer.toString('ascii', 4, 8) === 'ftyp') {
    if (buffer.toString('ascii', 8, 12) === 'avif') return ['avif', 'image/avif'];
    if (/^(heic|heix|hevc|hevx|mif1)$/.test(buffer.toString('ascii', 8, 12))) return ['heic', 'image/heic'];
  }
  throw Object.assign(new Error('Utilisez une photo JPG, PNG, WebP ou HEIC valide.'), { statusCode: 400 });
};
export const shoppingReceiptUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 6 } });

export const persistShoppingMedia = async ({ file, orderId, uploadedBy }) => {
  const [extension, contentType] = imageType(file.buffer);
  const filename = `${crypto.randomUUID()}.${extension}`;
  let publicId = '';
  if (isCloudinaryConfigured()) {
    const uploaded = await uploadToCloudinary({ buffer: file.buffer, resourceType: 'raw', folder: getCloudinaryFolder(['shopping-private']),
      options: { type: 'authenticated', public_id: filename } });
    publicId = uploaded.public_id;
  } else {
    const directory = privateUploadDirectory('shopping');
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(path.join(directory, filename), file.buffer, { flag: 'wx', mode: 0o600 });
  }
  const media = await Media.create({ orderId, uploadedBy, filename, contentType, publicId });
  return `api/buy-for-me/media/${media._id}`;
};

const authorized = async (order, user) => {
  const userId = String(user.id || user._id);
  if (String(order.customerId) === userId) return true;
  if (order.driverId && await Driver.exists({ _id: order.driverId, userId, countryId: order.countryId })) return true;
  try { return Boolean(await Order.exists({ _id: order._id, ...await shoppingAdminFilter(user) })); } catch { return false; }
};

export const getShoppingMedia = asyncHandler(async (req, res) => {
  res.set({ 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).end();
  const media = await Media.findById(req.params.id).select('+publicId').lean();
  const order = media && await Order.findById(media.orderId).lean();
  if (!order || !await authorized(order, req.user)) return res.status(404).end();
  let buffer;
  if (media.publicId) {
    const url = cloudinary.url(media.publicId, { resource_type: 'raw', type: 'authenticated', sign_url: true, secure: true });
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000), redirect: 'error' });
    if (!response.ok) return res.status(502).end();
    buffer = Buffer.from(await response.arrayBuffer());
  } else {
    if (!validAttachmentFilename(media.filename)) return res.status(404).end();
    const target = path.join(privateUploadDirectory('shopping'), media.filename);
    const stat = await fs.lstat(target).catch(() => null);
    if (!stat?.isFile() || stat.isSymbolicLink()) return res.status(404).end();
    buffer = await fs.readFile(target);
  }
  res.type(media.contentType).set('Content-Disposition', `inline; filename="${media.filename}"`);
  return res.send(buffer);
});

// Deny historical receipt paths before express.static. Other delivery photos
// retain their existing behavior; shopping receipts require migration below.
export const blockLegacyShoppingReceipts = async (req, res, next) => {
  try {
    const pathname = path.posix.normalize(decodeURIComponent(req.path).replace(/\\/g, '/'));
    if (!pathname.startsWith('/delivery-proofs/')) return next();
    const filename = path.basename(pathname);
    if (!validAttachmentFilename(filename)) return res.status(404).end();
    const url = `uploads/delivery-proofs/${filename}`;
    if (await Receipt.exists({ $or: [{ receiptImageUrl: url }, { productPhotoUrls: url }] }) || await Media.exists({ legacyUrl: url })) {
      res.set('Cache-Control', 'private, no-store'); return res.status(404).end();
    }
    return next();
  } catch (error) { return next(error); }
};

// Read old receipts only through an authorized order route. Restrict the
// source to our local directory or our own Cloudinary account (no arbitrary URL).
export const getLegacyShoppingReceipt = asyncHandler(async (req, res) => {
  res.set({ 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).end();
  const order = await Order.findById(req.params.id).lean();
  if (!order || !await authorized(order, req.user)) return res.status(404).end();
  const receipt = await Receipt.findById(order.receiptId).lean();
  const index = req.params.index;
  const url = index === 'receipt' ? receipt?.receiptImageUrl : receipt?.productPhotoUrls?.[Number(index)];
  if (!url || url.startsWith('api/buy-for-me/media/')) return res.status(404).end();
  let buffer;
  if (url.startsWith('uploads/delivery-proofs/')) {
    const filename = url.slice('uploads/delivery-proofs/'.length);
    if (!validAttachmentFilename(filename)) return res.status(404).end();
    const target = path.join(legacyUploadDirectory('delivery-proofs'), filename);
    const stat = await fs.lstat(target).catch(() => null);
    if (!stat?.isFile() || stat.isSymbolicLink()) return res.status(404).end();
    buffer = await fs.readFile(target);
  } else {
    const parsed = new URL(url);
    const account = process.env.CLOUDINARY_CLOUD_NAME;
    if (!account || parsed.protocol !== 'https:' || parsed.hostname !== 'res.cloudinary.com' || !parsed.pathname.startsWith(`/${account}/image/upload/`)) return res.status(404).end();
    const response = await fetch(parsed.href, { redirect: 'error', signal: AbortSignal.timeout(15_000) });
    if (!response.ok) return res.status(502).end();
    buffer = Buffer.from(await response.arrayBuffer());
  }
  const [, contentType] = imageType(buffer);
  return res.type(contentType).send(buffer);
});
