import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hasAnyPermission } from '../services/rbacService.js';

const backendDirectory = fileURLToPath(new URL('../', import.meta.url));
export const privateUploadDirectory = (kind) => path.join(backendDirectory, 'private-uploads', kind);
export const legacyUploadDirectory = (kind) => path.join(backendDirectory, 'uploads', kind);
export const attachmentKinds = new Set(['complaints', 'disputes']);

export const validAttachmentFilename = (filename) =>
  typeof filename === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(filename);

// Run before express.static, including for encoded paths to historical files.
export const blockPrivateUploads = (req, res, next) => {
  let pathname;
  try {
    pathname = path.posix.normalize(decodeURIComponent(req.path).replace(/\\/g, '/'));
  } catch {
    return res.status(400).end();
  }
  const folder = pathname.split('/').filter(Boolean)[0]?.toLowerCase();
  if (attachmentKinds.has(folder)) {
    res.set('Cache-Control', 'private, no-store');
    return res.status(404).end();
  }
  return next();
};

export const canManageEvidence = (user, countryId) => {
  if (!user) return false;
  if (user.role === 'founder') return true;
  if (!(user.role === 'manager' || user.canManageComplaints === true ||
    hasAnyPermission(user, ['manage_complaints']))) return false;
  const country = String(countryId || '');
  const countries = (user.adminCountryIds || []).map(String);
  // An admin's personal location does not grant administrative authority.
  if (user.role !== 'admin' && user.countryId) countries.push(String(user.countryId));
  return Boolean(country) && countries.includes(country);
};
