import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import multer from 'multer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASE_UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
const DELIVERY_PROOF_DIR = path.join(BASE_UPLOAD_DIR, 'delivery-proofs');

const ensureDeliveryProofDir = () => {
  if (!fs.existsSync(DELIVERY_PROOF_DIR)) {
    fs.mkdirSync(DELIVERY_PROOF_DIR, { recursive: true });
  }
};

const sanitizeFileName = (value) => {
  const cleaned = String(value || '')
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '');
  return cleaned || `delivery-proof-${Date.now()}`;
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    ensureDeliveryProofDir();
    cb(null, DELIVERY_PROOF_DIR);
  },
  filename: (req, file, cb) => {
    const safeName = sanitizeFileName(file.originalname);
    cb(null, `${Date.now()}-${safeName}`);
  }
});

const ALLOWED_MIMES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif'
]);

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIMES.has(file.mimetype) || file.mimetype.startsWith('image/')) {
    return cb(null, true);
  }
  cb(new Error('Formats autorisés: images (jpg/png/webp/heic).'));
};

export const deliveryProofUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }
});
