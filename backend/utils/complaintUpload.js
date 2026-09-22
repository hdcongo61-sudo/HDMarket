import fs from 'fs';
import multer from 'multer';
import crypto from 'node:crypto';
import { privateUploadDirectory } from './privateAttachments.js';

const COMPLAINT_DIR = privateUploadDirectory('complaints');

const ensureComplaintDir = () => {
  if (!fs.existsSync(COMPLAINT_DIR)) {
    fs.mkdirSync(COMPLAINT_DIR, { recursive: true });
  }
};

const sanitizeFileName = (value) => {
  const cleaned = value.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9._-]/g, '');
  return cleaned || 'attachment';
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    ensureComplaintDir();
    cb(null, COMPLAINT_DIR);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const safeName = sanitizeFileName(file.originalname || `file-${timestamp}`);
    cb(null, `${crypto.randomUUID()}-${safeName}`);
  }
});

const ALLOWED_MIMES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'application/zip'
]);

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/') || ALLOWED_MIMES.has(file.mimetype)) {
    return cb(null, true);
  }
  cb(
    new Error(
      'Les fichiers doivent être des images ou des documents (PDF, DOC, DOCX, XLS, XLSX, TXT, ZIP).'
    )
  );
};

export const complaintUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }
});
