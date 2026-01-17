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

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const extension = path.extname(file.originalname || '').toLowerCase();
  const mimetype = file.mimetype || '';
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

export const upload = multer({ storage, fileFilter });
