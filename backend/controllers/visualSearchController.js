import asyncHandler from 'express-async-handler';
import { isVisualSearchEnabled, searchByColor } from '../services/visualSearchService.js';

/**
 * POST /api/search/by-color
 * Body: { color: [r, g, b] } — dominant color extracted client-side from the
 * photo the user picked. Returns visually similar products.
 */
export const searchByImageColor = asyncHandler(async (req, res) => {
  if (!(await isVisualSearchEnabled())) {
    return res.status(403).json({
      message: 'La recherche par image n’est pas activée pour le moment.'
    });
  }

  const limit = Math.min(24, Math.max(1, Number(req.body?.limit) || 12));
  const result = await searchByColor({ color: req.body?.color, limit });
  res.json(result);
});
