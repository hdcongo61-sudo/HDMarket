import crypto from 'crypto';
import { getFirebaseAdminStorage } from '../utils/firebaseAdmin.js';

export class ImageStudioStorageService {
  async storeProcessedImage({ sourceUrl, userId, operation, contentType = 'image/webp' }) {
    const storage = getFirebaseAdminStorage();
    if (!storage || !sourceUrl) return { url: sourceUrl, storage: 'managed-provider' };
    const response = await fetch(sourceUrl);
    if (!response.ok) throw new Error('Impossible de transférer l’image traitée vers le stockage HDMarket.');
    const buffer = Buffer.from(await response.arrayBuffer());
    const safeOperation = String(operation || 'edit').replace(/[^a-z0-9-]/gi, '-');
    const extension = String(contentType).includes('png') ? 'png' : String(contentType).includes('jpeg') ? 'jpg' : 'webp';
    const objectPath = `products/image-studio/${String(userId || 'seller')}/${Date.now()}-${safeOperation}-${crypto.randomUUID()}.${extension}`;
    const file = storage.bucket(process.env.FIREBASE_STORAGE_BUCKET).file(objectPath);
    await file.save(buffer, {
      resumable: false,
      contentType,
      metadata: { cacheControl: 'public,max-age=31536000,immutable', metadata: { source: 'hdmarket-image-studio', operation: safeOperation } }
    });
    const [url] = await file.getSignedUrl({ action: 'read', expires: '2038-01-01' });
    return { url, storage: 'firebase', objectPath, bytes: buffer.length };
  }
}

export default new ImageStudioStorageService();
