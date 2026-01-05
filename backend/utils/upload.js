import multer from 'multer';
import path from 'path';

const IMAGE_EXTENSIONS = ['.webp', '.jpg', '.jpeg', '.png', '.heic', '.heif', '.avif'];
const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.avi', '.webm', '.mkv'];
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

const ALLOWED_EXTENSIONS = new Set([...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS]);
const ALLOWED_MIMES = new Set([...IMAGE_MIMES, ...VIDEO_MIMES]);

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const extension = path.extname(file.originalname || '').toLowerCase();
  const allowedExtension = ALLOWED_EXTENSIONS.has(extension);
  const allowedMime = ALLOWED_MIMES.has(file.mimetype);
  if (allowedExtension && allowedMime) {
    cb(null, true);
  } else {
    cb(new Error('Les fichiers doivent être des images ou des vidéos valides (webp, jpg, jpeg, png, heic, heif, avif, mp4, mov, avi, webm, mkv).'));
  }
};

export const upload = multer({ storage, fileFilter });
