import mongoose from 'mongoose';
import { getConversationForUser } from '../services/conversationService.js';
import rateLimit from 'express-rate-limit';
import { isRestricted, getRestrictionMessage } from '../utils/restrictionCheck.js';
import User from '../models/userModel.js';
import asyncHandler from 'express-async-handler';

const limiter = (max) => rateLimit({
  windowMs: 60_000, max, standardHeaders: true, legacyHeaders: false,
  keyGenerator: (req) => String(req.user?.id || req.user?._id),
  message: { message: 'Trop de tentatives. Réessayez dans une minute.' }
});
export const chatWriteLimiter = limiter(40);
export const chatUploadLimiter = limiter(10);
export const requireMessagingEnabled = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user?.id || req.user?._id).select('restrictions');
  if (!user) return res.status(401).json({ message: 'Authentification requise.' });
  if (isRestricted(user, 'canMessage')) return res.status(403).json({ message: getRestrictionMessage('canMessage') });
  next();
});

export const requireUploadConversation = asyncHandler(async (req, res, next) => {
  const id = req.query.conversationId;
  if (typeof id !== 'string' || !mongoose.isValidObjectId(id)) return res.status(400).json({ message: 'Conversation requise.' });
  await getConversationForUser({ id, user: req.user, requireMessagePermission: true });
  next();
});
