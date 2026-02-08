/**
 * Utility functions for checking user restrictions
 */

const RESTRICTION_MESSAGES = {
  canComment: "Vous n'êtes pas autorisé à commenter pour le moment.",
  canOrder: "Vous n'êtes pas autorisé à passer des commandes pour le moment.",
  canMessage: "Vous n'êtes pas autorisé à envoyer des messages pour le moment.",
  canAddFavorites: "Vous n'êtes pas autorisé à ajouter des favoris pour le moment.",
  canUploadImages: "Vous n'êtes pas autorisé à uploader des images pour le moment.",
  canBeViewed: "Votre boutique est temporairement masquée aux utilisateurs."
};

const RESTRICTION_LABELS = {
  canComment: 'Commentaires',
  canOrder: 'Commandes',
  canMessage: 'Messages',
  canAddFavorites: 'Favoris',
  canUploadImages: 'Images',
  canBeViewed: 'Visibilité boutique'
};

/**
 * Check if a user is currently restricted for a specific action
 * @param {Object} user - User document
 * @param {string} restrictionType - One of: canComment, canOrder, canMessage, canAddFavorites, canUploadImages
 * @returns {boolean} - True if restricted, false otherwise
 */
export const isRestricted = (user, restrictionType) => {
  const restriction = user?.restrictions?.[restrictionType];
  if (!restriction?.restricted) return false;

  const now = new Date();
  const start = restriction.startDate ? new Date(restriction.startDate) : null;
  const end = restriction.endDate ? new Date(restriction.endDate) : null;

  // Not yet active (scheduled for future)
  if (start && now < start) return false;

  // Already expired
  if (end && now > end) return false;

  return true;
};

/**
 * Get the user-facing message for a restriction type
 * @param {string} restrictionType
 * @returns {string}
 */
export const getRestrictionMessage = (restrictionType) => {
  return RESTRICTION_MESSAGES[restrictionType] || "Action non autorisée.";
};

/**
 * Get the admin-facing label for a restriction type
 * @param {string} restrictionType
 * @returns {string}
 */
export const getRestrictionLabel = (restrictionType) => {
  return RESTRICTION_LABELS[restrictionType] || restrictionType;
};

/**
 * Get all valid restriction types
 * @returns {string[]}
 */
export const getRestrictionTypes = () => {
  return Object.keys(RESTRICTION_MESSAGES);
};

/**
 * Format restriction info for API response
 * @param {Object} restriction - Restriction subdocument
 * @returns {Object}
 */
export const formatRestriction = (restriction) => {
  if (!restriction) {
    return {
      restricted: false,
      startDate: null,
      endDate: null,
      reason: '',
      restrictedBy: null,
      restrictedAt: null,
      isActive: false
    };
  }

  const now = new Date();
  const start = restriction.startDate ? new Date(restriction.startDate) : null;
  const end = restriction.endDate ? new Date(restriction.endDate) : null;

  let isActive = restriction.restricted;
  if (isActive && start && now < start) isActive = false;
  if (isActive && end && now > end) isActive = false;

  return {
    restricted: restriction.restricted || false,
    startDate: restriction.startDate || null,
    endDate: restriction.endDate || null,
    reason: restriction.reason || '',
    restrictedBy: restriction.restrictedBy || null,
    restrictedAt: restriction.restrictedAt || null,
    isActive
  };
};

export default {
  isRestricted,
  getRestrictionMessage,
  getRestrictionLabel,
  getRestrictionTypes,
  formatRestriction
};
