const FORMAT_MAP = new Map([['image/jpeg', 'jpg'], ['image/png', 'png'], ['image/webp', 'webp'], ['image/avif', 'avif']]);

export class ImageOptimizationService {
  normalizeParameters(parameters = {}) {
    const width = Math.min(6000, Math.max(320, Number(parameters.width || 1600)));
    const height = Math.min(6000, Math.max(320, Number(parameters.height || width)));
    const mimeType = FORMAT_MAP.has(parameters.format) ? parameters.format : 'image/webp';
    const quality = { low: 92, medium: 80, high: 66 }[parameters.compression] || 80;
    return { width, height, mimeType, format: FORMAT_MAP.get(mimeType), quality };
  }

  createDerivatives() {
    return {
      original: { preserve: true },
      medium: { width: 1200, height: 1200, fit: 'inside' },
      mobile: { width: 720, height: 720, fit: 'inside' },
      preview: { width: 480, height: 480, fit: 'inside' },
      thumbnail: { width: 240, height: 240, fit: 'cover' }
    };
  }
}

export default new ImageOptimizationService();
