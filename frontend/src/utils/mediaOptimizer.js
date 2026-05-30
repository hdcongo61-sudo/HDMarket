const DEFAULT_IMAGE_OPTIONS = Object.freeze({
  maxWidth: 1600,
  maxHeight: 1600,
  quality: 0.82,
  type: 'image/webp',
  minSavingsRatio: 0.08
});

const IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/avif']);

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
    return createImageBitmap(file, { imageOrientation: 'from-image' });
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

export const shouldOptimizeImageFile = (file) =>
  Boolean(file instanceof File && IMAGE_TYPES.has(file.type) && file.size > 180 * 1024);

export const optimizeImageFile = async (file, options = {}) => {
  if (!shouldOptimizeImageFile(file) || !canUseCanvas()) {
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

  const blob = await canvasToBlob(canvas, config.type, config.quality);
  if (!blob) return { file, optimized: false, originalSize: file.size, outputSize: file.size };

  const savingsRatio = 1 - blob.size / file.size;
  if (blob.size >= file.size || savingsRatio < config.minSavingsRatio) {
    return { file, optimized: false, originalSize: file.size, outputSize: file.size };
  }

  const baseName = String(file.name || 'image').replace(/\.[^.]+$/, '');
  const extension = config.type === 'image/webp' ? 'webp' : 'jpg';
  const optimizedFile = new File([blob], `${baseName}.${extension}`, {
    type: blob.type || config.type,
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
  let savedBytes = 0;

  for (const file of list) {
    const result = await optimizeImageFile(file, options);
    results.push(result);
    savedBytes += Math.max(0, Number(result.originalSize || 0) - Number(result.outputSize || 0));
  }

  return {
    files: results.map((item) => item.file),
    results,
    savedBytes,
    optimizedCount: results.filter((item) => item.optimized).length
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
