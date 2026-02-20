import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import multer from 'multer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASE_UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
const DISPUTE_DIR = path.join(BASE_UPLOAD_DIR, 'disputes');

const ensureDisputeDir = () => {
  if (!fs.existsSync(DISPUTE_DIR)) {
    fs.mkdirSync(DISPUTE_DIR, { recursive: true });
  }
};

const sanitizeFileName = (value) => {
  const cleaned = String(value || '')
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '');
  return cleaned || `proof-${Date.now()}`;
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    ensureDisputeDir();
    cb(null, DISPUTE_DIR);
  },
  filename: (req, file, cb) => {
    const safeName = sanitizeFileName(file.originalname);
    cb(null, `${Date.now()}-${safeName}`);
  }
});

const ALLOWED_MIMES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp'
]);

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIMES.has(file.mimetype) || file.mimetype.startsWith('image/')) {
    return cb(null, true);
  }
  cb(new Error('Formats autorisés: image (jpg/png/webp) ou PDF.'));
};

export const disputeUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }
});
