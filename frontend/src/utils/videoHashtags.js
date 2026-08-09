const HASHTAG_PATTERN = /#[\p{L}\p{N}_-]+/gu;

export const getVideoHashtags = (video = {}) => {
  const captionTags = String(video.caption || '').match(HASHTAG_PATTERN) || [];
  const storedTags = Array.isArray(video.hashtags) ? video.hashtags : [];
  const seen = new Set();

  return [...captionTags, ...storedTags]
    .map((tag) => String(tag || '').trim().replace(/^#/, ''))
    .filter((tag) => {
      if (!tag) return false;
      const key = tag.toLocaleLowerCase('fr');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

export const stripVideoHashtags = (caption = '') =>
  String(caption || '')
    .replace(HASHTAG_PATTERN, ' ')
    .replace(/\s+/g, ' ')
    .trim();
