// Product list deduplication helpers.
//
// Paginated feeds can return the same product on two pages (ordering shifts as
// products are created/boosted), which produced React "duplicate key" warnings
// in ProductMasonryGrid and silently duplicated cards. Every append must go
// through these.

const idOf = (product) => {
  const id = product?._id || product?.slug;
  return id == null ? null : String(id);
};

/** Removes duplicate products (by _id or slug) while keeping first occurrence order. */
export const dedupeProducts = (list) => {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  return list.filter((product) => {
    const id = idOf(product);
    if (!id) return true; // No identity — keep as-is.
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
};

/** Appends `incoming` to `existing`, skipping products already present. */
export const mergeProducts = (existing, incoming) => {
  const prev = Array.isArray(existing) ? existing : [];
  const prevKeys = new Set(prev.map(idOf).filter(Boolean));
  const fresh = dedupeProducts(incoming).filter((product) => {
    const id = idOf(product);
    if (!id) return true;
    return !prevKeys.has(id);
  });
  return [...prev, ...fresh];
};
