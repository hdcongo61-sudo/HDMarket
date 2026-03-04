export const GLASS_VARIANT_CLASS = {
  glass:
    'glass-card text-slate-900 dark:text-white/90',
  blue:
    'soft-card soft-card-blue text-blue-950 dark:text-blue-100',
  purple:
    'soft-card soft-card-purple text-purple-950 dark:text-purple-100',
  green:
    'soft-card soft-card-green text-emerald-950 dark:text-emerald-100',
  orange:
    'soft-card soft-card-orange text-orange-950 dark:text-orange-100',
  red:
    'soft-card soft-card-red text-red-950 dark:text-red-100'
};

export const resolveGlassVariantClass = (variant = 'glass') => {
  const key = String(variant || 'glass').trim().toLowerCase();
  return GLASS_VARIANT_CLASS[key] || GLASS_VARIANT_CLASS.glass;
};

export default GLASS_VARIANT_CLASS;
