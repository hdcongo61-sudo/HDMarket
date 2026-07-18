import api from './api';

const AI_OPERATION_LABELS = Object.freeze({
  'background-remove': 'Suppression de l’arrière-plan',
  'object-remove': 'Suppression d’objet',
  upscale: 'Agrandissement IA',
  relight: 'Relighting IA',
  shadow: 'Ombre IA',
  enhance: 'Amélioration IA',
  'smart-crop': 'Recadrage intelligent'
});

class ImageStudioService {
  async getCapabilities() {
    const { data } = await api.get('/image-studio/capabilities');
    return data;
  }

  async analyze(file) {
    const payload = new FormData();
    payload.append('image', file);
    const { data } = await api.post('/image-studio/analyze', payload, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return data;
  }

  async process({ file, operation, parameters = {} }) {
    if (!(file instanceof File || file instanceof Blob)) throw new Error('Une image est requise.');
    const payload = new FormData();
    payload.append('image', file, file.name || 'product-image.webp');
    payload.append('operation', operation);
    payload.append('parameters', JSON.stringify(parameters));
    const { data } = await api.post('/image-studio/process', payload, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000
    });
    return data;
  }

  labelFor(operation) {
    return AI_OPERATION_LABELS[operation] || operation;
  }
}

export default new ImageStudioService();
