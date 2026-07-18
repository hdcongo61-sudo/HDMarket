import { describe, expect, it } from 'vitest';
import { ImageAnalysisService, readImageDimensions } from './imageAnalysisService.js';
import { ImageComplianceService } from './imageComplianceService.js';
import { ImageOptimizationService } from './imageOptimizationService.js';

const createPngHeader = (width, height) => {
  const buffer = Buffer.alloc(32);
  buffer.write('PNG', 1, 'ascii');
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return buffer;
};

describe('Image Studio services', () => {
  it('reads PNG dimensions without decoding the full image', () => {
    expect(readImageDimensions(createPngHeader(1600, 1200), 'image/png')).toEqual({ width: 1600, height: 1200 });
  });

  it('returns quality and marketplace guidance', () => {
    const file = { buffer: createPngHeader(400, 400), mimetype: 'image/png', size: 500_000, originalname: 'capture-whatsapp.png' };
    const analysis = new ImageAnalysisService().analyze(file);
    const compliance = new ImageComplianceService().inspect(file, analysis);
    expect(analysis.score).toBeLessThan(100);
    expect(analysis.suggestions).toContain('Utilisez une image d’au moins 1 mégapixel.');
    expect(compliance.status).toBe('warning');
    expect(compliance.warnings[0]).toContain('capture d’écran');
  });

  it('normalizes export settings and exposes every derivative', () => {
    const service = new ImageOptimizationService();
    expect(service.normalizeParameters({ width: 99999, format: 'image/tiff', compression: 'high' })).toMatchObject({
      width: 6000,
      mimeType: 'image/webp',
      quality: 66
    });
    expect(Object.keys(service.createDerivatives())).toEqual(['original', 'medium', 'mobile', 'preview', 'thumbnail']);
  });
});
