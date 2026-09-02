export const MAX_IMAGE_DESCRIPTION_LENGTH = 500;

const parseImageDescriptions = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const normalizeImageDescriptions = (value, imageCount) => {
  const descriptions = parseImageDescriptions(value);
  const safeImageCount = Math.max(0, Number.parseInt(imageCount, 10) || 0);
  return Array.from({ length: safeImageCount }, (_, index) =>
    String(descriptions[index] ?? '').trim().slice(0, MAX_IMAGE_DESCRIPTION_LENGTH)
  );
};

export const removeDescriptionsForImages = (images, descriptions, removedImages) => {
  const sourceImages = Array.isArray(images) ? images : [];
  const sourceDescriptions = normalizeImageDescriptions(descriptions, sourceImages.length);
  const removed = removedImages instanceof Set ? removedImages : new Set(removedImages || []);

  return sourceImages.reduce((remaining, image, index) => {
    if (!removed.has(image)) remaining.push(sourceDescriptions[index]);
    return remaining;
  }, []);
};
