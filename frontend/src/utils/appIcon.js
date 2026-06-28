// Applies an admin-uploaded app icon to the live browser favicon, the iOS
// apple-touch-icon, and the PWA manifest (rebuilt as a blob) so the uploaded
// icon takes visual effect without a rebuild/deploy.

let manifestBlobUrl = null;

const ensureLink = (rel, extraCreateAttrs = {}) => {
  if (typeof document === 'undefined') return null;
  let link = document.head.querySelector(`link[rel='${rel}']`);
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', rel);
    Object.entries(extraCreateAttrs).forEach(([key, value]) => link.setAttribute(key, value));
    document.head.appendChild(link);
  }
  return link;
};

const swapManifestIcon = async (iconUrl) => {
  const manifestLink = document.head.querySelector("link[rel='manifest']");
  if (!manifestLink) return;

  // Remember the original (static) manifest href so re-applying doesn't chain blobs.
  if (!manifestLink.dataset.originalHref) {
    manifestLink.dataset.originalHref = manifestLink.getAttribute('href') || '/manifest.webmanifest';
  }

  const res = await fetch(manifestLink.dataset.originalHref, { credentials: 'same-origin' });
  if (!res.ok) return;
  const manifest = await res.json();

  manifest.icons = [
    { src: iconUrl, sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: iconUrl, sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
  ];

  if (manifestBlobUrl) URL.revokeObjectURL(manifestBlobUrl);
  const blob = new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' });
  manifestBlobUrl = URL.createObjectURL(blob);
  manifestLink.setAttribute('href', manifestBlobUrl);
};

/**
 * Apply admin-uploaded branding to the live document.
 * - `favicon` drives the browser-tab favicon (falls back to the app icon).
 * - `icon` drives the apple-touch-icon and the PWA manifest (falls back to the favicon).
 */
export const applyAppBranding = async ({ icon = '', favicon = '' } = {}) => {
  if (typeof document === 'undefined') return;

  const faviconUrl = favicon || icon;
  const iconUrl = icon || favicon;

  try {
    // Browser tab favicon. Uploaded images are normalized to PNG server-side.
    if (faviconUrl) {
      const link = ensureLink('icon');
      if (link) {
        link.setAttribute('type', 'image/png');
        link.setAttribute('href', faviconUrl);
      }
    }

    // iOS "Add to Home Screen" icon + PWA install icon use the larger app icon.
    if (iconUrl) {
      const appleIcon = ensureLink('apple-touch-icon');
      if (appleIcon) appleIcon.setAttribute('href', iconUrl);
      await swapManifestIcon(iconUrl);
    }
  } catch {
    // Non-fatal: keep the static fallback icons.
  }
};

// Backwards-compatible single-arg helper (app icon also covers the favicon).
export const applyAppIcon = (iconUrl) => applyAppBranding({ icon: iconUrl });

export default applyAppBranding;
