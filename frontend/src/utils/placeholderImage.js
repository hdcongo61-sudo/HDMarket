// Local, always-available product image fallback. Replaces the old
// https://via.placeholder.com URLs, which produced a second failed network
// request whenever the real image failed while offline.
const PLACEHOLDER_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">' +
  '<rect width="400" height="400" fill="#f3f4f6"/>' +
  '<text x="200" y="210" text-anchor="middle" font-family="sans-serif" font-size="30" font-weight="700" fill="#9ca3af">HDMarket</text>' +
  '</svg>';

export const PLACEHOLDER_IMAGE = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(PLACEHOLDER_SVG)}`;

export default PLACEHOLDER_IMAGE;
