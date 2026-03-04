import User from '../models/userModel.js';

const SPACE_REGEX = /\s+/g;

const escapeRegExp = (value = '') => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const normalizeShopName = (value = '') =>
  String(value || '')
    .replace(SPACE_REGEX, ' ')
    .trim();

export const buildShopNameExactRegex = (shopName = '') => {
  const normalized = normalizeShopName(shopName);
  if (!normalized) return null;
  return new RegExp(`^${escapeRegExp(normalized)}$`, 'i');
};

export const findShopNameConflict = async ({ shopName = '', excludeUserId = null, lean = true } = {}) => {
  const matcher = buildShopNameExactRegex(shopName);
  if (!matcher) return null;

  const query = {
    accountType: 'shop',
    shopName: { $regex: matcher }
  };

  if (excludeUserId) {
    query._id = { $ne: excludeUserId };
  }

  const cursor = User.findOne(query).select('_id shopName accountType');
  return lean ? cursor.lean() : cursor;
};
