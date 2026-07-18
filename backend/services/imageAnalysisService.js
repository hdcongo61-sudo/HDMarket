const readJpegDimensions = (buffer) => {
  let offset = 2;
  while (offset < buffer.length - 9) {
    if (buffer[offset] !== 0xff) break;
    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      return { width: buffer.readUInt16BE(offset + 7), height: buffer.readUInt16BE(offset + 5) };
    }
    if (!length) break;
    offset += length + 2;
  }
  return null;
};

export const readImageDimensions = (buffer, mimeType = '') => {
  if (!Buffer.isBuffer(buffer) || buffer.length < 24) return null;
  if (mimeType === 'image/png' && buffer.toString('ascii', 1, 4) === 'PNG') {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  if (mimeType === 'image/jpeg') return readJpegDimensions(buffer);
  if (mimeType === 'image/webp' && buffer.toString('ascii', 0, 4) === 'RIFF') {
    const type = buffer.toString('ascii', 12, 16);
    if (type === 'VP8X') return { width: 1 + buffer.readUIntLE(24, 3), height: 1 + buffer.readUIntLE(27, 3) };
  }
  return null;
};

export class ImageAnalysisService {
  analyze(file) {
    const dimensions = readImageDimensions(file?.buffer, file?.mimetype) || { width: 0, height: 0 };
    const megapixels = dimensions.width && dimensions.height ? dimensions.width * dimensions.height / 1_000_000 : 0;
    const fileSize = Number(file?.size || file?.buffer?.length || 0);
    const checks = {
      resolution: megapixels >= 1 ? 'good' : megapixels > 0 ? 'warning' : 'unknown',
      fileSize: fileSize <= 8 * 1024 * 1024 ? 'good' : 'warning',
      format: ['image/webp', 'image/avif'].includes(file?.mimetype) ? 'good' : 'warning'
    };
    const score = Math.max(0, 100 - Object.values(checks).filter((value) => value === 'warning').length * 8 - Object.values(checks).filter((value) => value === 'unknown').length * 12);
    const suggestions = [];
    if (checks.resolution !== 'good') suggestions.push('Utilisez une image d’au moins 1 mégapixel.');
    if (checks.fileSize !== 'good') suggestions.push('Compressez l’image avant publication.');
    if (checks.format !== 'good') suggestions.push('Le format WEBP est recommandé.');
    return { score, dimensions, fileSize, mimeType: file?.mimetype || '', checks, suggestions };
  }
}

export default new ImageAnalysisService();
