/**
 * LazyImg — Drop-in replacement for <img> with best practices baked in:
 *   - loading="lazy" (off-main-thread decoding)
 *   - decoding="async" (non-blocking decode)
 *   - alt is required (a11y)
 *   - width/height recommended for CLS prevention
 */

import React from 'react';

export default function LazyImg({ alt, loading = 'lazy', decoding = 'async', ...rest }) {
  if (!alt && process.env.NODE_ENV === 'development') {
    console.warn('[LazyImg] Missing `alt` attribute — required for accessibility.', rest.src);
  }
  return <img alt={alt || ''} loading={loading} decoding={decoding} {...rest} />;
}
