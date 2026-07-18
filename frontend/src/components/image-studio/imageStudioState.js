export const ADJUSTMENT_DEFINITIONS = Object.freeze([
  { key: 'brightness', label: 'Luminosité', min: -100, max: 100, unit: '' },
  { key: 'contrast', label: 'Contraste', min: -100, max: 100, unit: '' },
  { key: 'exposure', label: 'Exposition', min: -100, max: 100, unit: '' },
  { key: 'highlights', label: 'Hautes lumières', min: -100, max: 100, unit: '' },
  { key: 'shadows', label: 'Ombres', min: -100, max: 100, unit: '' },
  { key: 'temperature', label: 'Température', min: -100, max: 100, unit: '' },
  { key: 'tint', label: 'Teinte', min: -100, max: 100, unit: '' },
  { key: 'saturation', label: 'Saturation', min: -100, max: 100, unit: '' },
  { key: 'vibrance', label: 'Vibrance', min: -100, max: 100, unit: '' },
  { key: 'sharpness', label: 'Netteté', min: 0, max: 100, unit: '' },
  { key: 'blur', label: 'Flou', min: 0, max: 20, unit: 'px' },
  { key: 'gamma', label: 'Gamma', min: 50, max: 200, unit: '%', defaultValue: 100 }
]);

export const FILTER_PRESETS = Object.freeze({
  Aucun: {},
  Naturel: { brightness: 4, contrast: 3, vibrance: 10 },
  Studio: { exposure: 8, contrast: 8, shadows: 10, sharpness: 18 },
  Luxe: { contrast: 15, shadows: -8, saturation: -5, sharpness: 12 },
  Chaud: { temperature: 22, vibrance: 8 },
  Froid: { temperature: -20, contrast: 5 },
  Minimal: { brightness: 10, saturation: -12, contrast: -3 },
  'Noir & blanc': { saturation: -100, contrast: 12 },
  Mobilier: { temperature: 8, shadows: 12, sharpness: 10 },
  Électronique: { contrast: 12, temperature: -6, sharpness: 22 },
  Mode: { vibrance: 18, contrast: 7, highlights: 8 },
  Bijoux: { exposure: 9, contrast: 16, sharpness: 30, highlights: 12 }
});

export const ASPECT_RATIOS = Object.freeze([
  { id: 'free', label: 'Libre', value: null },
  { id: '1:1', label: 'Carré', value: 1 },
  { id: '4:5', label: '4:5', value: 4 / 5 },
  { id: '16:9', label: '16:9', value: 16 / 9 },
  { id: '9:16', label: '9:16', value: 9 / 16 }
]);

export const BACKGROUNDS = Object.freeze([
  { id: 'original', label: 'Original', value: null },
  { id: 'white', label: 'Blanc', value: '#ffffff' },
  { id: 'black', label: 'Noir', value: '#111111' },
  { id: 'transparent', label: 'Transparent', value: 'transparent' },
  { id: 'warm', label: 'Ivoire', value: '#f5f2ee' },
  { id: 'wood', label: 'Bois', value: 'linear-gradient(135deg,#d4a574,#8b5e3c)' },
  { id: 'marble', label: 'Marbre', value: 'linear-gradient(135deg,#fff,#d9d6d0,#fff)' },
  { id: 'office', label: 'Bureau', value: 'linear-gradient(180deg,#e8edf2,#c9d1d9)' },
  { id: 'kitchen', label: 'Cuisine', value: 'linear-gradient(180deg,#f2ede5,#d5c7b5)' },
  { id: 'living-room', label: 'Salon', value: 'linear-gradient(180deg,#efe5d8,#c9ad91)' },
  { id: 'luxury', label: 'Studio luxe', value: 'linear-gradient(145deg,#25211d,#88755d)' },
  { id: 'gradient', label: 'Dégradé', value: 'linear-gradient(135deg,#fff0e4,#f5f2ee)' }
]);

export const TEMPLATES = Object.freeze([
  { id: 'luxury-white', label: 'Luxury White', background: '#ffffff', shadow: 'studio', aspectRatio: '1:1' },
  { id: 'furniture', label: 'Mobilier', background: '#eee4d7', shadow: 'natural', aspectRatio: '4:5' },
  { id: 'kitchen', label: 'Cuisine', background: '#f2ede5', shadow: 'soft', aspectRatio: '4:5' },
  { id: 'electronics', label: 'Électronique', background: '#e8edf2', shadow: 'floating', aspectRatio: '1:1' },
  { id: 'fashion', label: 'Mode', background: '#f7f1ed', shadow: 'studio', aspectRatio: '4:5' },
  { id: 'shoes', label: 'Chaussures', background: '#f5f2ee', shadow: 'product', aspectRatio: '1:1' },
  { id: 'office', label: 'Bureau', background: '#e8edf2', shadow: 'natural', aspectRatio: '16:9' },
  { id: 'minimal', label: 'Minimal', background: '#fafafa', shadow: 'soft', aspectRatio: '1:1' },
  { id: 'studio', label: 'Studio', background: '#ffffff', shadow: 'studio', aspectRatio: '4:5' }
]);

const createAdjustments = () => Object.fromEntries(
  ADJUSTMENT_DEFINITIONS.map(({ key, defaultValue = 0 }) => [key, defaultValue])
);

export const createInitialImageStudioState = (overrides = {}) => ({
  version: 1,
  // Keep the complete camera photo visible initially. Sellers can opt into a
  // marketplace crop after they have checked the composition.
  aspectRatio: 'free',
  rotation: 0,
  flipX: false,
  flipY: false,
  zoom: 1,
  pan: { x: 0, y: 0 },
  output: { format: 'image/webp', compression: 'medium', width: 1600, height: 1600, lockAspect: true },
  adjustments: createAdjustments(),
  preset: 'Aucun',
  background: { id: 'original', value: null, customUrl: '' },
  watermark: {
    enabled: false,
    type: 'shop-name',
    text: '',
    position: 'bottom-right',
    opacity: 72,
    scale: 100,
    rotation: 0
  },
  shadow: { type: 'none', opacity: 32 },
  aiOperations: [],
  ...overrides
});

export const createHistoryState = (initial) => ({ past: [], present: initial, future: [] });

export const historyReducer = (history, action) => {
  if (action.type === 'UNDO') {
    if (!history.past.length) return history;
    const previous = history.past[history.past.length - 1];
    return { past: history.past.slice(0, -1), present: previous, future: [history.present, ...history.future] };
  }
  if (action.type === 'REDO') {
    if (!history.future.length) return history;
    const next = history.future[0];
    return { past: [...history.past, history.present].slice(-50), present: next, future: history.future.slice(1) };
  }
  if (action.type === 'RESET') return createHistoryState(action.payload);
  if (action.type === 'RESTORE') {
    return { past: [...history.past, history.present].slice(-50), present: action.payload, future: [] };
  }
  if (action.type !== 'CHANGE') return history;
  const next = typeof action.payload === 'function' ? action.payload(history.present) : action.payload;
  if (next === history.present) return history;
  return { past: [...history.past, history.present].slice(-50), present: next, future: [] };
};

export const getCanvasFilter = (adjustments = {}) => {
  const brightness = 100 + Number(adjustments.brightness || 0) + Number(adjustments.exposure || 0) * 0.65;
  const contrast = 100 + Number(adjustments.contrast || 0);
  const saturation = Math.max(0, 100 + Number(adjustments.saturation || 0) + Number(adjustments.vibrance || 0) * 0.55);
  const blur = Math.max(0, Number(adjustments.blur || 0));
  const temperature = Number(adjustments.temperature || 0);
  const tint = Number(adjustments.tint || 0);
  const sepia = Math.max(0, temperature) * 0.18;
  const hue = tint * 0.32 - Math.max(0, -temperature) * 0.12;
  return `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) sepia(${sepia}%) hue-rotate(${hue}deg) blur(${blur}px)`;
};

export const getOutputQuality = (compression) => ({ low: 0.92, medium: 0.8, high: 0.64 }[compression] || 0.8);

export const extensionForMime = (mime) => ({
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif'
}[mime] || 'webp');

export const applyPreset = (state, name) => ({
  ...state,
  preset: name,
  adjustments: { ...state.adjustments, ...(FILTER_PRESETS[name] || {}) }
});

export const applySmartOptimization = (state, shopName = '') => ({
  ...state,
  aspectRatio: '1:1',
  zoom: Math.max(1.08, state.zoom),
  pan: { x: 0, y: 0 },
  preset: 'Studio',
  adjustments: { ...state.adjustments, exposure: 7, contrast: 7, shadows: 10, vibrance: 8, sharpness: 22 },
  output: { ...state.output, format: 'image/webp', compression: 'medium', width: 1600, height: 1600 },
  background: { id: 'white', value: '#ffffff', customUrl: '' },
  shadow: { type: 'soft', opacity: 28 },
  watermark: shopName ? { ...state.watermark, enabled: true, type: 'shop-name', text: shopName, opacity: 54 } : state.watermark,
  aiOperations: [...new Set([...(state.aiOperations || []), 'smart-crop', 'enhance', 'background-cleanup'])]
});
