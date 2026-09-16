import mongoose from 'mongoose';

export const isChatStaff = (user) => ['admin', 'founder', 'manager'].includes(user?.role);
export const supportRoom = (userId) => `support:user:${String(userId)}`;
export const canAccessSupportMessage = (user, message) => isChatStaff(user) || (
  Boolean(message?.user) && String(message.user) === String(user?.id || user?._id)
);
export const supportHistoryFilter = (user, targetId) => {
  const id = isChatStaff(user) && targetId ? targetId : (user?.id || user?._id);
  if (!mongoose.isValidObjectId(id)) throw Object.assign(new Error('Utilisateur invalide.'), { statusCode: 400 });
  // Mixed legacy field can contain either an ObjectId or a string.
  return { user: { $in: [String(id), new mongoose.Types.ObjectId(String(id))] } };
};
export const escapeChatSearch = (value) => typeof value === 'string'
  ? value.trim().slice(0, 200).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '';
export const validChatReaction = (value) => typeof value === 'string' &&
  ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '👏', '👎', '😊', '✅'].includes(value);

export const isTrustedMediaUrl = (value) => {
  if (typeof value !== 'string' || value.length > 2048) return false;
  try {
    const url = new URL(value);
    const cloud = process.env.CLOUDINARY_CLOUD_NAME;
    return Boolean(cloud) && url.protocol === 'https:' && !url.username && !url.password &&
      url.hostname === 'res.cloudinary.com' && !url.port &&
      url.pathname.startsWith(`/${cloud}/`) &&
      /\/(?:order-messages|chat)\/attachments\//.test(url.pathname);
  } catch { return false; }
};
