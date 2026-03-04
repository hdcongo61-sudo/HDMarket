import asyncHandler from 'express-async-handler';
import { getFounderIntelligence } from '../services/founderIntelligenceService.js';
import { getFounderNotificationsAnalytics } from '../services/notificationIntelligenceService.js';

export const founderIntelligence = asyncHandler(async (req, res) => {
  const forceRefresh = String(req.query?.refresh || '').toLowerCase() === 'true';
  const data = await getFounderIntelligence({ forceRefresh });
  return res.json(data);
});

export const founderNotificationsAnalytics = asyncHandler(async (req, res) => {
  const forceRefresh = String(req.query?.refresh || '').toLowerCase() === 'true';
  const data = await getFounderNotificationsAnalytics({ forceRefresh });
  return res.json(data);
});
