// Title-cases a person's name: first letter of each word (split on spaces,
// hyphens, apostrophes) uppercase, rest lowercase — handles French/Congolese
// compound names like "jean-pierre MBEMBA" -> "Jean-Pierre Mbemba" or
// "n'goma" -> "N'Goma". Mirrors backend/utils/nameFormatting.js (hand-kept
// in sync, not shared — see CLAUDE.md on productAttributes.js for why).
export const capitalizeName = (value = '') => {
  const trimmed = String(value || '').trim().replace(/\s+/g, ' ');
  if (!trimmed) return '';
  return trimmed
    .toLowerCase()
    .replace(/(^|[\s'-])(\p{L})/gu, (match, boundary, letter) => boundary + letter.toUpperCase());
};

export default { capitalizeName };
