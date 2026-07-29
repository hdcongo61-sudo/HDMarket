/**
 * Matches free-text address fragments ("Near Total Station") against known
 * Landmark aliases/names so the pricing engine can resolve GPS without the
 * requester ever sharing their location.
 */
import Landmark from '../../models/landmarkModel.js';

// Common French/English filler words that surround a landmark reference but
// aren't part of its name, e.g. "Near Total Station" -> "total station".
const FILLER_WORDS = [
  'near', 'close to', 'in front of', 'opposite', 'behind', 'next to', 'beside',
  'pres de', 'près de', 'en face de', 'derriere', 'derrière', 'a cote de', 'à côté de',
  'devant'
];

const normalize = (value) => {
  let text = String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip accents
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  FILLER_WORDS.forEach((filler) => {
    text = text.replace(new RegExp(`\\b${filler}\\b`, 'g'), ' ');
  });
  return text.replace(/\s+/g, ' ').trim();
};

/**
 * Scores a landmark's name/aliases against the normalized input text using
 * bidirectional substring containment — good enough for short place names
 * without needing a full fuzzy-matching dependency.
 */
const scoreCandidate = (inputText, candidateText) => {
  if (!inputText || !candidateText) return 0;
  if (inputText === candidateText) return candidateText.length * 2;
  if (inputText.includes(candidateText)) return candidateText.length;
  if (candidateText.includes(inputText)) return inputText.length;
  return 0;
};

const MIN_MATCH_SCORE = 4; // a few characters of real overlap, so short common
// words ("station", "marché") don't produce false-positive matches.

const rankCandidates = (text, candidates) => {
  const normalizedInput = normalize(text);
  if (!normalizedInput) return [];
  return candidates
    .map((candidate) => {
      const names = [normalize(candidate.name), ...(candidate.aliases || []).map(normalize)];
      const score = Math.max(...names.map((name) => scoreCandidate(normalizedInput, name)), 0);
      return { candidate, score };
    })
    .filter((entry) => entry.score >= MIN_MATCH_SCORE)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.candidate);
};

/** Best single match — used by the pricing engine's location cascade. */
export const matchLandmark = async ({ text, cityId, pricingContext = null }) => {
  if (!String(text || '').trim() || !cityId) return null;
  const candidates = pricingContext
    ? pricingContext.landmarks.filter((entry) => String(entry.cityId) === String(cityId))
    : await Landmark.find({ cityId, status: 'ACTIVE' })
        .select('name aliases latitude longitude cityId communeId')
        .lean();
  return rankCandidates(text, candidates)[0] || null;
};

/** Top N matches — used by the request form's autocomplete dropdown. */
export const searchLandmarksByText = async ({ text, cityId, limit = 5, pricingContext = null }) => {
  if (!String(text || '').trim() || !cityId) return [];
  const candidates = pricingContext
    ? pricingContext.landmarks.filter((entry) => String(entry.cityId) === String(cityId))
    : await Landmark.find({ cityId, status: 'ACTIVE' })
        .select('name aliases latitude longitude cityId communeId')
        .lean();
  return rankCandidates(text, candidates).slice(0, Math.max(1, limit));
};

/** Direct lookup for an explicitly-selected landmark (never trust client-supplied coordinates for it). */
export const getLandmarkById = async (landmarkId, pricingContext = null) => {
  if (!landmarkId) return null;
  if (pricingContext) {
    return pricingContext.landmarks.find((entry) => String(entry._id) === String(landmarkId)) || null;
  }
  return Landmark.findOne({ _id: landmarkId, status: 'ACTIVE' })
    .select('name latitude longitude cityId communeId')
    .lean();
};
