import cloudinary from './cloudinary.js';

export const isCloudinaryConfigured = () =>
  Boolean(process.env.CLOUDINARY_CLOUD_NAME) &&
  Boolean(process.env.CLOUDINARY_API_KEY) &&
  Boolean(process.env.CLOUDINARY_API_SECRET);

const getBaseFolder = () => process.env.CLOUDINARY_FOLDER_PREFIX?.trim() || 'hdmarket';

const ensureConfigured = () => {
  if (!isCloudinaryConfigured()) {
    throw new Error('Cloudinary n\'est pas configuré. Définissez les variables CLOUDINARY_*.');
  }
};

export const getCloudinaryFolder = (segments = []) => {
  const sanitizedSegments = Array.isArray(segments)
    ? segments.filter((seg) => typeof seg === 'string' && seg.trim()).map((seg) => seg.trim())
    : [];
  return [getBaseFolder(), ...sanitizedSegments].join('/');
};

export const uploadToCloudinary = ({ buffer, resourceType = 'auto', folder, options = {} }) => {
  ensureConfigured();
  return new Promise((resolve, reject) => {
    const uploadFolder = folder || getBaseFolder();
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: uploadFolder,
        resource_type: resourceType,
        ...options
      },
      (error, result) => {
        if (error) {
          return reject(error);
        }
        resolve(result);
      }
    );
    uploadStream.end(buffer);
  });
};
