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
