import multer from 'multer';
import path from 'path';

const IMAGE_EXTENSIONS = ['.webp', '.jpg', '.jpeg', '.png', '.heic', '.heif', '.avif'];
const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.avi', '.webm', '.mkv'];
const PDF_EXTENSIONS = ['.pdf'];
const IMAGE_MIMES = [
  'image/webp',
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif',
  'image/avif'
];
const VIDEO_MIMES = [
  'video/mp4',
  'video/quicktime',
  'video/x-msvideo',
  'video/webm',
  'video/x-matroska',
  'video/x-ms-wmv'
];

const PDF_MIMES = ['application/pdf'];

const IMAGE_EXTENSION_SET = new Set(IMAGE_EXTENSIONS);
const VIDEO_EXTENSION_SET = new Set(VIDEO_EXTENSIONS);
const PDF_EXTENSION_SET = new Set(PDF_EXTENSIONS);
const IMAGE_MIME_SET = new Set(IMAGE_MIMES);
const VIDEO_MIME_SET = new Set(VIDEO_MIMES);
const PDF_MIME_SET = new Set(PDF_MIMES);
const PROOF_FIELD_SET = new Set(['saleConfirmationProof', 'firstPaymentProof', 'proofOfPayment', 'proof']);

const storage = multer.memoryStorage();
const parsePositiveInt = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
};

const UPLOAD_LIMITS = {
  fileSize: parsePositiveInt(process.env.UPLOAD_MAX_FILE_SIZE_BYTES, 50 * 1024 * 1024),
  files: parsePositiveInt(process.env.UPLOAD_MAX_FILES, 24),
  fields: parsePositiveInt(process.env.UPLOAD_MAX_FIELDS, 80),
  parts: parsePositiveInt(process.env.UPLOAD_MAX_PARTS, 100)
};

const fileFilter = (req, file, cb) => {
  const extension = path.extname(file.originalname || '').toLowerCase();
  const mimetype = String(file.mimetype || '').split(';')[0].trim().toLowerCase();
  if (PROOF_FIELD_SET.has(file.fieldname)) {
    const isImage = IMAGE_EXTENSION_SET.has(extension) && IMAGE_MIME_SET.has(mimetype);
    const isPdf = PDF_EXTENSION_SET.has(extension) && PDF_MIME_SET.has(mimetype);
    if (isImage || isPdf) return cb(null, true);
    return cb(new Error('La preuve doit être une image (jpg/png/webp) ou un PDF valide.'));
  }
  if (file.fieldname === 'pdf') {
    const isPdf = PDF_EXTENSION_SET.has(extension) && PDF_MIME_SET.has(mimetype);
    if (isPdf) return cb(null, true);
    return cb(new Error('Le fichier doit être un PDF valide.'));
  }
  if (file.fieldname === 'video') {
    const isVideo = VIDEO_EXTENSION_SET.has(extension) && VIDEO_MIME_SET.has(mimetype);
    if (isVideo) return cb(null, true);
    return cb(new Error('Le fichier doit être une vidéo valide (mp4, mov, avi, webm, mkv).'));
  }
  const isImage = IMAGE_EXTENSION_SET.has(extension) && IMAGE_MIME_SET.has(mimetype);
  if (isImage) {
    return cb(null, true);
  }
  return cb(
    new Error('Les fichiers doivent être des images valides (webp, jpg, jpeg, png, heic, heif, avif).')
  );
};

export const upload = multer({ storage, fileFilter, limits: UPLOAD_LIMITS });
