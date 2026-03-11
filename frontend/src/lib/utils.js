export function cn(...inputs) {
  return inputs
    .flatMap((entry) => {
      if (!entry) return [];
      if (typeof entry === 'string') return [entry];
      if (Array.isArray(entry)) return entry.filter(Boolean);
      if (typeof entry === 'object') {
        return Object.entries(entry)
          .filter(([, enabled]) => Boolean(enabled))
          .map(([key]) => key);
      }
      return [];
    })
    .join(' ')
    .trim();
}

export default cn;
