import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Maximum file sizes
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_AUDIO_SIZE = 10 * 1024 * 1024; // 10MB

// Allowed file types
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain'
];
const ALLOWED_AUDIO_TYPES = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm'];

const fileFilter = (req, file, cb) => {
  const fileType = file.mimetype;
  
  // Check if it's an image
  if (ALLOWED_IMAGE_TYPES.includes(fileType)) {
    if (file.size > MAX_IMAGE_SIZE) {
      return cb(new Error('Image size exceeds 5MB limit'));
    }
    return cb(null, true);
  }
  
  // Check if it's a document
  if (ALLOWED_DOCUMENT_TYPES.includes(fileType)) {
    if (file.size > MAX_DOCUMENT_SIZE) {
      return cb(new Error('Document size exceeds 10MB limit'));
    }
    return cb(null, true);
  }
  
  // Check if it's audio (voice message)
  if (ALLOWED_AUDIO_TYPES.includes(fileType)) {
    if (file.size > MAX_AUDIO_SIZE) {
      return cb(new Error('Audio size exceeds 10MB limit'));
    }
    return cb(null, true);
  }
  
  cb(new Error('Invalid file type. Only images, documents, and audio files are allowed.'));
};

// Memory storage for chat files (will be uploaded to Cloudinary)
const storage = multer.memoryStorage();

export const chatUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_AUDIO_SIZE, // Use the largest limit
    files: 5 // Maximum 5 files per request
  }
});

// MIME headers are client controlled. Inspect bytes after Multer has finished
// receiving the bounded upload; file.size is unavailable in fileFilter.
export const validateChatUpload = (req, res, next) => {
  const file = req.file;
  if (!file?.buffer?.length) return res.status(400).json({ message: 'Fichier vide ou manquant.' });
  const b = file.buffer;
  const hex = b.subarray(0, 16).toString('hex');
  const ascii = b.subarray(0, 16).toString('ascii');
  const type = file.mimetype;
  const image = type.startsWith('image/');
  if (b.length > (image ? MAX_IMAGE_SIZE : MAX_DOCUMENT_SIZE)) {
    return res.status(413).json({ message: image ? 'Image limitée à 5 Mo.' : 'Fichier limité à 10 Mo.' });
  }
  const checks = {
    'image/jpeg': () => hex.startsWith('ffd8ff'),
    'image/jpg': () => hex.startsWith('ffd8ff'),
    'image/png': () => hex.startsWith('89504e470d0a1a0a'),
    'image/gif': () => /^GIF8[79]a/.test(ascii),
    'image/webp': () => ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP',
    'application/pdf': () => ascii.startsWith('%PDF-'),
    'application/msword': () => hex.startsWith('d0cf11e0a1b11ae1'),
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': () => hex.startsWith('504b0304'),
    'audio/wav': () => ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WAVE',
    'audio/ogg': () => ascii.startsWith('OggS'),
    'audio/webm': () => hex.startsWith('1a45dfa3'),
    'audio/mpeg': () => ascii.startsWith('ID3') || (b[0] === 255 && (b[1] & 224) === 224),
    'text/plain': () => !b.includes(0) && !/<\s*(?:!doctype|html|script|svg|iframe)\b/i.test(b.toString('utf8'))
  };
  checks['audio/mp3'] = checks['audio/mpeg'];
  if (!checks[type]?.()) return res.status(400).json({ message: 'Le contenu du fichier ne correspond pas au type autorisé.' });
  file.originalname = String(file.originalname || 'fichier').replace(/[\x00-\x1f\x7f/\\]/g, '_').slice(0, 255);
  next();
};
