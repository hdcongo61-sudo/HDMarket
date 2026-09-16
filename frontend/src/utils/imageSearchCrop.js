export const imageSearchCrop = (width, height, { zoom = 1, x = 50, y = 50 } = {}) => {
  const bound = (value, min, max, fallback) => Number.isFinite(Number(value)) ? Math.max(min, Math.min(max, Number(value))) : fallback;
  const size = Math.min(width, height) / bound(zoom, 1, 4, 1);
  return { sx: (width - size) * bound(x, 0, 100, 50) / 100, sy: (height - size) * bound(y, 0, 100, 50) / 100, size };
};
