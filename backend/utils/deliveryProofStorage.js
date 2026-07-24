import fs from 'fs/promises';
import {
  getCloudinaryFolder,
  isCloudinaryConfigured,
  uploadToCloudinary
} from './cloudinaryUploader.js';

const normalizeCategory = (value = '') =>
  String(value || 'general')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'general';

const localProofUrl = (file = {}) =>
  file?.filename ? `uploads/delivery-proofs/${file.filename}` : '';

export const persistDeliveryProofFile = async (
  file,
  { category = 'general' } = {}
) => {
  if (!file) return '';
  const localUrl = localProofUrl(file);
  if (!isCloudinaryConfigured()) return localUrl;

  const buffer = file.buffer || (file.path ? await fs.readFile(file.path) : null);
  if (!buffer) {
    throw Object.assign(new Error('Le fichier de preuve est illisible.'), { statusCode: 422 });
  }

  const uploaded = await uploadToCloudinary({
    buffer,
    resourceType: 'image',
    folder: getCloudinaryFolder(['delivery-proofs', normalizeCategory(category)]),
    options: {
      quality: 'auto',
      fetch_format: 'auto',
      flags: 'progressive'
    }
  });
  const url = String(uploaded?.secure_url || uploaded?.url || '').trim();
  if (!url) {
    throw Object.assign(new Error('Le stockage de la preuve n’a retourné aucune URL.'), {
      statusCode: 502
    });
  }

  if (file.path) {
    await fs.unlink(file.path).catch(() => {});
  }
  return url;
};

export default persistDeliveryProofFile;
