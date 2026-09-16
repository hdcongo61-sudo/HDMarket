export const parseVisualSearchFilters = (body = {}) => {
  const fail = () => { throw Object.assign(new Error('Filtres de recherche invalides.'), { statusCode: 400 }); };
  if (body.query != null && (typeof body.query !== 'string' || body.query.length > 100)) fail();
  const sort = body.sort || 'similarity';
  if (!['similarity', 'price_asc', 'price_desc', 'newest'].includes(sort)) fail();
  const offset = body.offset ?? 0;
  if (!Number.isInteger(offset) || offset < 0 || offset > 200) fail();
  const productFilter = {};
  const query = body.query?.trim();
  if (query) {
    const pattern = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    productFilter.$or = ['title', 'category', 'description'].map(field => ({ [field]: { $regex: pattern, $options: 'i' } }));
  }
  for (const [key, op] of [['minPrice', '$gte'], ['maxPrice', '$lte']]) {
    if (body[key] == null || body[key] === '') continue;
    if (typeof body[key] !== 'number' || !Number.isFinite(body[key]) || body[key] < 0 || body[key] > 1e12) fail();
    productFilter.price = { ...productFilter.price, [op]: body[key] };
  }
  if (productFilter.price?.$gte > productFilter.price?.$lte) fail();
  return { productFilter, sort, offset };
};
