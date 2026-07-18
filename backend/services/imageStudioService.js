import imageAnalysisService from './imageAnalysisService.js';
import imageComplianceService from './imageComplianceService.js';
import imageOptimizationService from './imageOptimizationService.js';
import imageProcessingQueue from './imageProcessingQueue.js';
import imageStudioStorageService from './imageStudioStorageService.js';
import { getCloudinaryFolder, isCloudinaryConfigured, uploadToCloudinary } from '../utils/cloudinaryUploader.js';

const SUPPORTED_OPERATIONS = new Set(['background-remove', 'object-remove', 'upscale', 'relight', 'shadow', 'enhance', 'smart-crop']);

const transformationFor = (operation, parameters = {}) => {
  if (operation === 'enhance') return [{ effect: 'improve:outdoor:50' }, { effect: 'sharpen:80' }, { quality: 'auto:good', fetch_format: 'auto' }];
  if (operation === 'smart-crop') return [{ width: 1600, height: 1600, crop: 'fill', gravity: 'auto' }, { quality: 'auto:good', fetch_format: 'auto' }];
  if (operation === 'upscale') return [{ width: `${Math.min(8, Math.max(2, Number(parameters.scale || 2)))}.0`, crop: 'scale' }, { effect: 'upscale' }];
  if (operation === 'relight') return [{ effect: `adjust:${parameters.mode || 'auto'}` }, { effect: 'improve' }];
  if (operation === 'shadow') return [{ effect: `dropshadow:azimuth_220;elevation_45;spread_18;opacity_${Number(parameters.opacity || 35)}` }];
  if (operation === 'object-remove') return [{ effect: `gen_remove:prompt_${String(parameters.prompt || 'unwanted object').replace(/[^a-z0-9 ]/gi, '').slice(0, 60)}` }];
  return [];
};

export class ImageStudioService {
  capabilities() {
    const providerConfigured = isCloudinaryConfigured();
    const generativeEnabled = providerConfigured && String(process.env.IMAGE_STUDIO_GENERATIVE_AI_ENABLED || '').toLowerCase() === 'true';
    return {
      provider: 'hdmarket',
      storage: process.env.FIREBASE_STORAGE_BUCKET ? 'firebase' : 'managed',
      operations: {
        enhance: providerConfigured,
        'smart-crop': providerConfigured,
        shadow: false,
        relight: false,
        upscale: false,
        'background-remove': generativeEnabled,
        'object-remove': generativeEnabled
      },
      formats: ['jpeg', 'png', 'webp', 'avif'],
      maxFileSize: 15 * 1024 * 1024,
      maxDimensions: 10000
    };
  }

  analyze(file) {
    const analysis = imageAnalysisService.analyze(file);
    return { ...analysis, compliance: imageComplianceService.inspect(file, analysis) };
  }

  async process({ file, operation, parameters = {}, userId }) {
    if (!SUPPORTED_OPERATIONS.has(operation)) {
      const error = new Error('Opération Image Studio inconnue.');
      error.statusCode = 400;
      throw error;
    }
    const analysis = this.analyze(file);
    if (analysis.compliance.status === 'blocked') {
      const error = new Error(analysis.compliance.violations[0] || 'Image non conforme.');
      error.statusCode = 422;
      throw error;
    }
    const capabilities = this.capabilities();
    if (!capabilities.operations[operation]) {
      const error = new Error('Ce traitement intelligent n’est pas encore activé sur ce serveur HDMarket.');
      error.statusCode = 503;
      error.code = 'IMAGE_STUDIO_CAPABILITY_UNAVAILABLE';
      throw error;
    }
    let job;
    try {
      job = await imageProcessingQueue.add(operation, async (reportProgress) => {
        reportProgress(45);
        const options = { transformation: transformationFor(operation, parameters), quality_analysis: true };
        if (operation === 'background-remove') options.background_removal = 'cloudinary_ai';
        const uploaded = await uploadToCloudinary({
          buffer: file.buffer,
          resourceType: 'image',
          folder: getCloudinaryFolder(['image-studio', String(userId || 'seller')]),
          options
        });
        const stored = await imageStudioStorageService.storeProcessedImage({
          sourceUrl: uploaded.secure_url || uploaded.url,
          userId,
          operation,
          contentType: `image/${uploaded.format === 'jpg' ? 'jpeg' : uploaded.format || 'webp'}`
        });
        reportProgress(90);
        return {
          imageUrl: stored.url,
          storage: stored.storage,
          storageObjectPath: stored.objectPath,
          providerAssetId: uploaded.public_id,
          width: uploaded.width,
          height: uploaded.height,
          bytes: uploaded.bytes,
          format: uploaded.format
        };
      });
    } catch (cause) {
      const error = new Error('Le service de traitement d’image n’a pas pu terminer cette opération. Réessayez dans un instant.');
      error.statusCode = 502;
      error.code = 'IMAGE_STUDIO_PROCESSING_FAILED';
      error.details = { operation, providerCode: cause?.http_code || cause?.code };
      throw error;
    }
    return {
      jobId: job.id,
      status: job.status,
      ...job.result,
      analysis,
      derivatives: imageOptimizationService.createDerivatives(),
      operation
    };
  }
}

export default new ImageStudioService();
