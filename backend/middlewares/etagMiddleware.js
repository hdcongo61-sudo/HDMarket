import crypto from 'crypto';

/**
 * Lightweight ETag middleware for GET endpoints.
 * Generates an MD5 hash of the response body and sets ETag + Cache-Control.
 * On subsequent requests, returns 304 if the ETag matches (If-None-Match).
 *
 * Usage:
 *   router.get('/public', etagMiddleware({ maxAge: 180 }), getPublicProducts);
 */
export const etagMiddleware = ({ maxAge = 120 } = {}) => {
  return (req, res, next) => {
    if (req.method !== 'GET') return next();

    // Intercept res.json to hash the response
    const originalJson = res.json.bind(res);

    res.json = function (body) {
      // Don't ETag error responses
      if (res.statusCode >= 400) {
        return originalJson(body);
      }

      const raw = typeof body === 'string' ? body : JSON.stringify(body);
      const hash = crypto.createHash('md5').update(raw).digest('hex');
      const etag = `"${hash}"`;

      res.setHeader('ETag', etag);
      res.setHeader('Cache-Control', `public, max-age=${maxAge}, must-revalidate`);

      // Check If-None-Match
      const ifNoneMatch = req.headers['if-none-match'];
      if (ifNoneMatch && ifNoneMatch === etag) {
        res.status(304);
        return res.end();
      }

      return originalJson(body);
    };

    next();
  };
};

export default etagMiddleware;
