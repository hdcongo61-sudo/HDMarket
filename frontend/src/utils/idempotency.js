export const createIdempotencyKey = (prefix = 'hdm') => {
  const timePart = Date.now().toString(36);
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `${String(prefix || 'hdm')}-${timePart}-${randomPart}`;
};

export default createIdempotencyKey;
