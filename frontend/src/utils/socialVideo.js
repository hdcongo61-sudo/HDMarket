// Parses a Facebook or TikTok video link into an embeddable iframe source so the
// video can be played inline on the product detail page.

/**
 * @param {string} rawUrl
 * @returns {{ provider: 'tiktok'|'facebook', embedUrl: string, originalUrl: string, embeddable: boolean } | null}
 */
export const parseSocialVideo = (rawUrl) => {
  const url = String(rawUrl || '').trim();
  if (!url) return null;

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) return null;

  const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();

  // TikTok — embeddable when we can extract the numeric video id.
  if (host === 'tiktok.com' || host.endsWith('.tiktok.com')) {
    const match = parsed.pathname.match(/\/video\/(\d+)/);
    if (match) {
      return {
        provider: 'tiktok',
        embedUrl: `https://www.tiktok.com/embed/v2/${match[1]}`,
        originalUrl: url,
        embeddable: true
      };
    }
    // Short links (vm./vt.) can't be resolved to an id on the client.
    return { provider: 'tiktok', embedUrl: '', originalUrl: url, embeddable: false };
  }

  // Facebook — the video plugin resolves watch/video/reel URLs server-side.
  if (host === 'facebook.com' || host.endsWith('.facebook.com') || host === 'fb.watch' || host === 'fb.com') {
    return {
      provider: 'facebook',
      embedUrl: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false`,
      originalUrl: url,
      embeddable: true
    };
  }

  return null;
};

export const isValidSocialVideoUrl = (url) => Boolean(parseSocialVideo(url));

export default parseSocialVideo;
