const DEFAULT_IMAGE_OPTIONS = Object.freeze({
  maxWidth: 1600,
  maxHeight: 1600,
  quality: 0.82,
  type: 'image/webp',
  minSavingsRatio: 0.08
});

const IMAGE_TYPE_BY_EXTENSION = Object.freeze({
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  jfif: 'image/jpeg',
  pjpeg: 'image/jpeg',
  pjp: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
  heic: 'image/heic',
  heif: 'image/heif',
  bmp: 'image/bmp',
  gif: 'image/gif'
});
const NATIVE_IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/avif']);
const HEIC_IMAGE_TYPES = new Set(['image/heic', 'image/heif']);
const CONVERT_TO_WEB_TYPES = new Set(['image/bmp', 'image/gif']);
const IMAGE_TYPE_ALIASES = Object.freeze({
  'image/jpg': 'image/jpeg',
  'image/pjpeg': 'image/jpeg',
  'image/x-png': 'image/png',
  'image/x-ms-bmp': 'image/bmp',
  'image/heic-sequence': 'image/heic',
  'image/heif-sequence': 'image/heif'
});

export const PRODUCT_IMAGE_ACCEPT = '.jpg,.jpeg,.jfif,.pjpeg,.pjp,.png,.webp,.avif,.heic,.heif,.bmp,.gif,image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif,image/bmp,image/gif';

const extensionOf = (file) => String(file?.name || '').split('.').pop()?.toLowerCase() || '';
const inferImageType = (file) => {
  const declared = String(file?.type || '').split(';')[0].trim().toLowerCase();
  const normalizedDeclared = IMAGE_TYPE_ALIASES[declared] || declared;
  return normalizedDeclared.startsWith('image/') ? normalizedDeclared : IMAGE_TYPE_BY_EXTENSION[extensionOf(file)] || '';
};

export const isSupportedProductImageFile = (file) => {
  const type = inferImageType(file);
  return NATIVE_IMAGE_TYPES.has(type) || HEIC_IMAGE_TYPES.has(type) || CONVERT_TO_WEB_TYPES.has(type);
};

const withNormalizedIdentity = (file, type) => {
  const extension = extensionOf(file);
  const jpegAlias = ['jfif', 'pjpeg', 'pjp'].includes(extension);
  const name = jpegAlias ? String(file.name).replace(/\.[^.]+$/, '.jpg') : file.name;
  if (file.type === type && name === file.name) return file;
  return new File([file], name || `image.${type === 'image/jpeg' ? 'jpg' : extension || 'bin'}`, {
    type,
    lastModified: file.lastModified || Date.now()
  });
};

export const normalizeProductImageFile = async (file) => {
  if (!(file instanceof File) || !isSupportedProductImageFile(file)) {
    throw new Error(`Format non pris en charge${file?.name ? ` : ${file.name}` : ''}. Utilisez JPG, PNG, WEBP, AVIF, HEIC, HEIF, BMP ou GIF.`);
  }
  const type = inferImageType(file);
  if (!HEIC_IMAGE_TYPES.has(type)) {
    return { file: withNormalizedIdentity(file, type), converted: false, forceWebConversion: CONVERT_TO_WEB_TYPES.has(type) };
  }

  try {
    const { default: heic2any } = await import('heic2any');
    const output = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 });
    const blob = Array.isArray(output) ? output[0] : output;
    if (!(blob instanceof Blob) || !blob.size) throw new Error('Résultat HEIC vide');
    const baseName = String(file.name || 'photo').replace(/\.[^.]+$/, '');
    return {
      file: new File([blob], `${baseName}.jpg`, { type: 'image/jpeg', lastModified: file.lastModified || Date.now() }),
      converted: true,
      forceWebConversion: false
    };
  } catch {
    throw new Error(`Impossible de convertir ${file.name || 'cette photo'} depuis HEIC/HEIF. Essayez de l’exporter en JPG.`);
  }
};

export const formatFileSize = (bytes = 0) => {
  const value = Number(bytes || 0);
  if (!Number.isFinite(value) || value <= 0) return '0 Ko';
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} Ko`;
  return `${(value / (1024 * 1024)).toFixed(value >= 10 * 1024 * 1024 ? 0 : 1)} Mo`;
};

const canUseCanvas = () =>
  typeof document !== 'undefined' &&
  typeof File !== 'undefined' &&
  typeof Blob !== 'undefined';

const loadImageBitmap = async (file) => {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      // Some desktop engines expose createImageBitmap but do not decode every
      // image type it accepts. The HTMLImageElement path is more permissive.
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
};

const canvasToBlob = (canvas, type, quality) =>
  new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });

export const shouldOptimizeImageFile = (file, { force = false } = {}) =>
  Boolean(file instanceof File && (NATIVE_IMAGE_TYPES.has(file.type) || CONVERT_TO_WEB_TYPES.has(file.type)) && (force || file.size > 180 * 1024));

export const optimizeImageFile = async (file, options = {}) => {
  if (!shouldOptimizeImageFile(file, options) || !canUseCanvas()) {
    return { file, optimized: false, originalSize: file?.size || 0, outputSize: file?.size || 0 };
  }

  const config = { ...DEFAULT_IMAGE_OPTIONS, ...options };
  const bitmap = await loadImageBitmap(file);
  const sourceWidth = bitmap.naturalWidth || bitmap.width;
  const sourceHeight = bitmap.naturalHeight || bitmap.height;
  const scale = Math.min(1, config.maxWidth / sourceWidth, config.maxHeight / sourceHeight);
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) {
    bitmap.close?.();
    return { file, optimized: false, originalSize: file.size, outputSize: file.size };
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  let blob = await canvasToBlob(canvas, config.type, config.quality);
  if (!blob && config.type !== 'image/jpeg') {
    blob = await canvasToBlob(canvas, 'image/jpeg', config.quality);
  }
  if (!blob) return { file, optimized: false, originalSize: file.size, outputSize: file.size };

  const savingsRatio = 1 - blob.size / file.size;
  if (!config.force && (blob.size >= file.size || savingsRatio < config.minSavingsRatio)) {
    return { file, optimized: false, originalSize: file.size, outputSize: file.size };
  }

  const baseName = String(file.name || 'image').replace(/\.[^.]+$/, '');
  const outputType = blob.type || config.type;
  const extension = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/avif': 'avif' }[outputType] || 'jpg';
  const optimizedFile = new File([blob], `${baseName}.${extension}`, {
    type: outputType,
    lastModified: Date.now()
  });

  return {
    file: optimizedFile,
    optimized: true,
    originalSize: file.size,
    outputSize: optimizedFile.size,
    width,
    height
  };
};

export const optimizeImageFiles = async (files = [], options = {}) => {
  const list = Array.from(files || []);
  const results = [];
  const errors = [];
  let savedBytes = 0;

  for (const file of list) {
    try {
      const normalized = await normalizeProductImageFile(file);
      const result = await optimizeImageFile(normalized.file, {
        ...options,
        force: normalized.forceWebConversion || options.force
      });
      results.push({ ...result, converted: normalized.converted || normalized.forceWebConversion });
      savedBytes += Math.max(0, Number(file.size || 0) - Number(result.outputSize || 0));
    } catch (error) {
      errors.push({ file, message: error?.message || `Impossible de lire ${file?.name || 'cette photo'}.` });
    }
  }

  return {
    files: results.map((item) => item.file),
    results,
    errors,
    savedBytes,
    optimizedCount: results.filter((item) => item.optimized || item.converted).length
  };
};

export const estimateFormDataBytes = (formData) => {
  if (!(formData instanceof FormData)) return 0;
  let total = 0;
  for (const [, value] of formData.entries()) {
    if (value instanceof Blob) {
      total += value.size;
    } else {
      total += String(value || '').length;
    }
  }
  return total;
};
