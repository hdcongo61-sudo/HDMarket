// Dry run by default. --apply copies each receipt into private storage and
// switches its reference. --revoke-public additionally invalidates ONLY the
// exact original Cloudinary asset after the private copy is durable.
import 'dotenv/config';
import mongoose from 'mongoose';
import fs from 'node:fs/promises';
import path from 'node:path';
import Receipt from '../models/buyForMeReceiptModel.js';
import Media from '../models/buyForMeMediaModel.js';
import { persistShoppingMedia } from '../controllers/buyForMeMediaController.js';
import { legacyUploadDirectory, validAttachmentFilename } from '../utils/privateAttachments.js';
import { destroyCloudinaryAsset } from '../utils/cloudinaryUploader.js';

const apply = process.argv.includes('--apply');
const revoke = apply && process.argv.includes('--revoke-public');
const cloudSource = raw => {
  const url = new URL(raw);
  const prefix = `/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/`;
  if (url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com' || !url.pathname.startsWith(prefix)) throw new Error('Unrecognized source');
  const suffix = url.pathname.slice(prefix.length);
  // Do not infer an asset id from transformation URLs.
  if (!/^v\d+\//.test(suffix)) throw new Error('Review transformed source manually');
  return { url: url.href, publicId: decodeURIComponent(suffix.replace(/^v\d+\//, '').replace(/\.[^.\/]+$/, '')) };
};
const load = async raw => {
  if (raw.startsWith('uploads/delivery-proofs/')) {
    const filename = raw.slice('uploads/delivery-proofs/'.length);
    if (!validAttachmentFilename(filename)) throw new Error('Invalid filename');
    const target = path.join(legacyUploadDirectory('delivery-proofs'), filename);
    const stat = await fs.lstat(target);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Invalid source');
    return fs.readFile(target);
  }
  const source = cloudSource(raw);
  const response = await fetch(source.url, { redirect: 'error', signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error('Source unavailable');
  return Buffer.from(await response.arrayBuffer());
};
await mongoose.connect(process.env.MONGO_URI);
const counts = { mode: apply ? 'apply' : 'dry-run', pending: 0, migrated: 0, revoked: 0, review: 0 };
try {
  for await (const receipt of Receipt.find().cursor()) {
    for (const [field, raw] of [['receiptImageUrl', receipt.receiptImageUrl], ...receipt.productPhotoUrls.map((url, index) => [`productPhotoUrls.${index}`, url])]) {
      if (!raw || raw.startsWith('api/buy-for-me/media/')) continue;
      counts.pending++;
      if (!apply) continue;
      try {
        const buffer = await load(raw);
        const privateUrl = await persistShoppingMedia({ file: { buffer }, orderId: receipt.orderId, uploadedBy: receipt.uploadedBy });
        await Media.updateOne({ _id: privateUrl.split('/').at(-1) }, { $set: { legacyUrl: raw } });
        const result = await Receipt.updateOne({ _id: receipt._id, [field]: raw }, { $set: { [field]: privateUrl } });
        if (result.modifiedCount) counts.migrated++;
      } catch { counts.review++; }
    }
  }
  if (revoke) {
    for await (const media of Media.find({ legacyRevokedAt: null, legacyUrl: /^https:\/\// }).select('+legacyUrl').cursor()) {
      try {
        // Never revoke while a receipt still points to the public copy.
        if (await Receipt.exists({ $or: [{ receiptImageUrl: media.legacyUrl }, { productPhotoUrls: media.legacyUrl }] })) continue;
        const { publicId } = cloudSource(media.legacyUrl);
        const result = await destroyCloudinaryAsset(publicId, { resourceType: 'image' });
        if (!['ok', 'not found'].includes(result?.result)) throw new Error('Revocation unconfirmed');
        await Media.updateOne({ _id: media._id }, { $set: { legacyRevokedAt: new Date() } }); counts.revoked++;
      } catch { counts.review++; }
    }
  }
  console.log(JSON.stringify(counts)); // Counts only; no customer data or URLs.
} finally { await mongoose.disconnect(); }
