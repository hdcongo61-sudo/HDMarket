// Maps product "color" attribute option names (FR + EN) to a real CSS color so
// the product detail page can show actual swatches instead of plain text.
// Only color NAMES are stored on a product (no hex), so we resolve them here.

const stripAccents = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const normalize = (value) => stripAccents(value).trim().toLowerCase();

// Attribute names that denote a color picker.
const COLOR_ATTRIBUTE_NAMES = new Set([
  'color',
  'colour',
  'couleur',
  'couleurs',
  'coloris',
  'teinte'
]);

export const isColorAttribute = (attribute) => {
  if (!attribute) return false;
  const candidates = [attribute.name, attribute.label, attribute.key];
  return candidates.some((candidate) => COLOR_ATTRIBUTE_NAMES.has(normalize(candidate)));
};

// Base color words (accent-stripped, lowercase) → representative hex.
// Multi-word keys are matched before single words.
const COLOR_MAP = {
  'bleu marine': '#1e3a5f',
  'bleu nuit': '#14213d',
  'bleu ciel': '#7dd3fc',
  'bleu roi': '#1d4ed8',
  'vert olive': '#6b8e23',
  'vert kaki': '#7c7b50',
  'gris anthracite': '#383a3c',
  'rose pale': '#f8c8d4',
  noir: '#111111',
  black: '#111111',
  blanc: '#ffffff',
  white: '#ffffff',
  gris: '#9ca3af',
  gray: '#9ca3af',
  grey: '#9ca3af',
  argent: '#c0c0c0',
  silver: '#c0c0c0',
  rouge: '#dc2626',
  red: '#dc2626',
  bordeaux: '#6d1f2c',
  maroon: '#6d1f2c',
  rose: '#ec4899',
  pink: '#ec4899',
  fuchsia: '#d4209e',
  magenta: '#d4209e',
  orange: '#f97316',
  corail: '#ff7f50',
  coral: '#ff7f50',
  jaune: '#eab308',
  yellow: '#eab308',
  moutarde: '#c9a227',
  mustard: '#c9a227',
  or: '#d4af37',
  dore: '#d4af37',
  gold: '#d4af37',
  golden: '#d4af37',
  beige: '#d8c3a5',
  creme: '#f3ead3',
  cream: '#f3ead3',
  ivoire: '#f4efe1',
  ivory: '#f4efe1',
  marron: '#6f4e37',
  brown: '#6f4e37',
  chocolat: '#5b3a29',
  chocolate: '#5b3a29',
  cafe: '#6f4e37',
  taupe: '#8b8378',
  kaki: '#7c7b50',
  khaki: '#7c7b50',
  vert: '#16a34a',
  green: '#16a34a',
  olive: '#6b8e23',
  menthe: '#74c69d',
  mint: '#74c69d',
  turquoise: '#14b8a6',
  cyan: '#06b6d4',
  bleu: '#2563eb',
  blue: '#2563eb',
  marine: '#1e3a5f',
  navy: '#1e3a5f',
  ciel: '#7dd3fc',
  sky: '#7dd3fc',
  indigo: '#4f46e5',
  violet: '#7c3aed',
  purple: '#7c3aed',
  mauve: '#a78bca',
  lavande: '#b497d6',
  lavender: '#b497d6',
  prune: '#7c3a5d',
  plum: '#7c3a5d',
  saumon: '#fa8072',
  salmon: '#fa8072',
  sable: '#c2b280',
  sand: '#c2b280',
  bronze: '#cd7f32',
  cuivre: '#b87333',
  copper: '#b87333'
};

// Longest keys first so "bleu marine" wins over "bleu".
const COLOR_KEYS = Object.keys(COLOR_MAP).sort((a, b) => b.length - a.length);

const LIGHTEN_WORDS = ['clair', 'claire', 'pale', 'pastel', 'light'];
const DARKEN_WORDS = ['fonce', 'foncee', 'sombre', 'dark', 'deep'];

const clamp = (value) => Math.max(0, Math.min(255, Math.round(value)));

const shadeHex = (hex, percent) => {
  const match = /^#?([\da-f]{6})$/i.exec(String(hex || '').trim());
  if (!match) return hex;
  const int = parseInt(match[1], 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  const mix = percent < 0 ? 0 : 255;
  const ratio = Math.abs(percent);
  const next = (channel) => clamp(channel + (mix - channel) * ratio);
  return `#${[next(r), next(g), next(b)]
    .map((channel) => channel.toString(16).padStart(2, '0'))
    .join('')}`;
};

/**
 * Resolve a color option label to a CSS color (hex / gradient), or '' if unknown.
 * Accepts raw hex / rgb() / hsl() values too.
 */
export const resolveSwatchColor = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';

  // Already a usable CSS color value.
  if (/^#([\da-f]{3}|[\da-f]{6})$/i.test(raw)) return raw;
  if (/^(rgb|hsl)a?\(/i.test(raw)) return raw;

  const normalized = normalize(raw);

  if (/(multicolore|multicolor|arc.?en.?ciel|rainbow)/.test(normalized)) {
    return 'conic-gradient(#ef4444,#f97316,#eab308,#22c55e,#06b6d4,#6366f1,#a855f7,#ef4444)';
  }

  if (COLOR_MAP[normalized]) return COLOR_MAP[normalized];

  const matchedKey = COLOR_KEYS.find((key) =>
    new RegExp(`(^|\\W)${key.replace(/\s+/g, '\\s+')}(\\W|$)`).test(normalized)
  );
  if (!matchedKey) return '';

  const base = COLOR_MAP[matchedKey];
  if (LIGHTEN_WORDS.some((word) => normalized.includes(word))) return shadeHex(base, 0.35);
  if (DARKEN_WORDS.some((word) => normalized.includes(word))) return shadeHex(base, -0.32);
  return base;
};
