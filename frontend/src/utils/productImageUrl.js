const isCloudinaryUrl = (url = '') =>
  typeof url === 'string' && url.includes('res.cloudinary.com') && url.includes('/upload/');

const injectCloudinaryTransform = (url = '', transform = '') => {
  if (!isCloudinaryUrl(url) || !transform) return url;
  return url.replace('/upload/', `/upload/${transform}/`);
};

export const getProductCardImageUrl = (url = '', { width = 520, lite = false } = {}) => {
  const safeWidth = Math.min(900, Math.max(180, Number(width) || 520));
  const quality = lite ? 'q_auto:eco' : 'q_auto:good';
  return injectCloudinaryTransform(url, `f_auto,c_fill,g_auto,w_${safeWidth},${quality}`);
};

export const getProductCardSrcSet = (url = '', { lite = false } = {}) => {
  if (!isCloudinaryUrl(url)) return undefined;
  const widths = lite ? [220, 360, 520] : [260, 420, 640, 840];
  return widths
    .map((width) => `${getProductCardImageUrl(url, { width, lite })} ${width}w`)
    .join(', ');
};
