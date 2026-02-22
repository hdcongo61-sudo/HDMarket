export const safeAsync = async (fn, options = {}) => {
  const { fallback = null, label = 'safeAsync', onError } = options;
  try {
    return await fn();
  } catch (error) {
    if (typeof onError === 'function') {
      try {
        onError(error);
      } catch {
        // noop
      }
    } else if (process.env.NODE_ENV !== 'test') {
      // eslint-disable-next-line no-console
      console.warn(`[${label}]`, error?.message || error);
    }
    return fallback;
  }
};

export default safeAsync;
